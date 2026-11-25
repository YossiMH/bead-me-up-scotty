"""Verify downloaded production files and run the two bounded Windows checks."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import zipfile


def file_hash(filename):
    """Hash exact bytes, including original line endings."""
    with filename.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def checked_file(root, row):
    """Refuse paths or bytes outside one downloaded record."""
    name = row["path"]
    relative = PurePosixPath(name)
    if relative.is_absolute() or "\\" in name or ":" in name or any(part in ("", ".", "..") for part in name.split("/")):
        raise RuntimeError("Invalid input path: " + name)
    filename = root.joinpath(*relative.parts)
    if filename.is_symlink() or not filename.is_file() or not filename.resolve().is_relative_to(root.resolve()):
        raise RuntimeError("Missing regular input file: " + name)
    if file_hash(filename) != row["sha256"] or ("bytes" in row and filename.stat().st_size != row["bytes"]):
        raise RuntimeError("Input bytes differ: " + name)
    return filename


def retain_text(filename, label):
    """Expose complete actual text and its hash for remote recovery without rebuilding."""
    data = filename.read_bytes()
    content = data.decode("utf-8")
    parts = (len(content) + 4095) // 4096
    print("RETAIN_FILE " + json.dumps({"path": label, "sha256": hashlib.sha256(data).hexdigest(),
                                      "bytes": len(data), "parts": parts}), flush=True)
    for index in range(parts):
        print("RETAIN_PART " + json.dumps({"path": label, "part": index,
                                          "content": content[index * 4096:(index + 1) * 4096]}), flush=True)


def main():
    """Verify immutable inputs before starting bounded processes in the caller's Windows Job."""
    parser = argparse.ArgumentParser()
    for name in ["source", "runtime", "native", "inputs", "output", "fixtures"]:
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    inputs = json.loads(args.inputs.read_text(encoding="utf-8"))
    result = {"status": "failed", "inputs": inputs, "commands": []}
    try:
        source_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True, timeout=10).strip()
        source_tree = subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], cwd=source, text=True, timeout=10).strip()
        assert source_commit == inputs["app_source_commit"]
        assert source_tree == inputs["app_source_tree"]
        runtime_manifest = args.runtime / "scotty-runtime.json"
        assert file_hash(runtime_manifest) == inputs["runtime_manifest_sha256"]
        runtime = json.loads(runtime_manifest.read_text(encoding="utf-8"))
        assert runtime["source_commit"] == source_commit and runtime["build_id"] == inputs["runtime_build_id"]
        assert len(runtime["files"]) == inputs["runtime_files"]
        archive = checked_file(args.runtime, {"path": "scotty-runtime.zip", "sha256": inputs["runtime_zip_sha256"],
                                             "bytes": runtime["bytes"]})
        assert runtime["sha256"] == inputs["runtime_zip_sha256"]
        assert file_hash(source / "package-lock.json") == runtime["dependency_lock_sha256"]
        lock_blob = subprocess.check_output(["git", "rev-parse", "HEAD:package-lock.json"],
                                            cwd=source, text=True, timeout=10).strip()
        assert lock_blob == runtime["dependency_lock_git_blob"]
        sources = json.loads((args.runtime / "source-sha256.json").read_text(encoding="utf-8"))
        for row in sources:
            checked_file(source, row)
            blob = subprocess.check_output(["git", "rev-parse", "HEAD:" + row["path"]],
                                            cwd=source, text=True, timeout=10).strip()
            assert blob == row["git_blob"], row["path"]
        assert not (source / ".next").exists()
        inventory = {row["path"]: row for row in runtime["files"]}
        assert len(inventory) == len(runtime["files"]) == len({name.casefold() for name in inventory})
        with zipfile.ZipFile(archive) as package:
            assert len(package.infolist()) == len(inventory) and set(package.namelist()) == set(inventory)
            for name, row in inventory.items():
                assert name.startswith(".next/") and "\\" not in name and ":" not in name
                assert not any(part in ("", ".", "..") for part in name.split("/"))
                data = package.read(name)
                assert len(data) == row["bytes"] and hashlib.sha256(data).hexdigest() == row["sha256"], name
                target = source.joinpath(*PurePosixPath(name).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as stream:
                    stream.write(data)
                checked_file(source, row)
        assert (source / ".next/BUILD_ID").read_text(encoding="utf-8").strip() == inputs["runtime_build_id"]
        assert file_hash(args.native / "artifact-manifest.json") == inputs["native_manifest_sha256"]
        native_manifest = json.loads((args.native / "artifact-manifest.json").read_text(encoding="utf-8"))
        assert native_manifest["source_commit"] == inputs["native_source_commit"]
        assert native_manifest["target"] == "x86_64-pc-windows-msvc"
        for row in [inputs["native_executable"], inputs["native_metadata"]]:
            recorded = [item for item in native_manifest["files"] if item["path"] == row["path"]]
            assert len(recorded) == 1 and all(recorded[0].get(key) == value for key, value in row.items()), row["path"]
            checked_file(args.native, recorded[0])
        binary = args.native.joinpath(*PurePosixPath(inputs["native_executable"]["path"]).parts).resolve()
        metadata = json.loads(args.native.joinpath(*PurePosixPath(inputs["native_metadata"]["path"]).parts).read_text(encoding="utf-8"))
        assert metadata["git_commit_sha"] == inputs["native_source_commit"]
        assert metadata["build_target"] == metadata["build_host_target"] == "x86_64-pc-windows-msvc"
        assert metadata["binary_sha256"] == inputs["native_executable"]["sha256"]
        assert metadata["source"] == "git-archive" and metadata["build_profile"] == "release"
        assert metadata["execution_verification"] == "executed"
        for name in ["source-sha256.json", "scotty-runtime.json", "result.json"]:
            shutil.copyfile(args.runtime / name, output / ("linux-" + name))
            retain_text(output / ("linux-" + name), "linux-" + name)
        shutil.copyfile(args.inputs, output / "inputs.json")
        retain_text(args.native.joinpath(*PurePosixPath(inputs["native_metadata"]["path"]).parts), "native-metadata.json")
        node = Path(shutil.which("node.exe") or "")
        assert node.is_file()
        npm_cli = node.parent / "node_modules/npm/bin/npm-cli.js"
        assert npm_cli.is_file()
        args.fixtures.mkdir(parents=True, exist_ok=False)
        temporary = args.fixtures.parent / "temporary"
        temporary.mkdir(exist_ok=False)
        environment = dict(os.environ, BEAD_BIN=str(binary), SCOTTY_TEST_ROOT=str(args.fixtures.resolve()),
                           NEXT_TELEMETRY_DISABLED="1", NODE_OPTIONS="--max-old-space-size=512",
                           TMP=str(temporary), TEMP=str(temporary), TMPDIR=str(temporary))
        result["node"] = subprocess.check_output([str(node), "--version"], text=True, timeout=10).strip()
        commands = [
            ("npm-ci", [str(node), str(npm_cli), "ci", "--no-audit", "--no-fund"]),
            ("native-store", [str(node), "--conditions=react-server", "--import", "./scripts/support/register-source.mjs",
                              "--test", "--test-reporter=tap", "scripts/test-local-bead-rs.mjs"]),
            ("production-http", [str(node), "scripts/test-native-type-roundtrip.mjs"]),
        ]
        for name, command in commands:
            timed_out = False
            with (output / (name + ".stdout")).open("wb") as stdout, (output / (name + ".stderr")).open("wb") as stderr:
                process = subprocess.Popen(command, cwd=source, env=environment, stdout=stdout, stderr=stderr)
                try:
                    process.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    timed_out = True
                    process.kill()
                    process.wait(timeout=10)
            result["commands"].append({"name": name, "command": command, "exit": process.returncode,
                                       "timeout_seconds": 180, "timed_out": timed_out})
            retain_text(output / (name + ".stdout"), name + ".stdout")
            retain_text(output / (name + ".stderr"), name + ".stderr")
            if timed_out or process.returncode != 0:
                raise RuntimeError(name + " did not finish successfully")
        tap = (output / "native-store.stdout").read_text(encoding="utf-8")
        counts = {field: int(re.search(r"^# " + field + r" (\d+)$", tap, re.M)[1])
                  for field in ["tests", "pass", "fail", "cancelled", "skipped", "todo"]}
        assert counts == {"tests": 1, "pass": 1, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0}, counts
        http_results = list(args.fixtures.glob("type-http-*/result.json"))
        assert len(http_results) == 1
        http = json.loads(http_results[0].read_text(encoding="utf-8"))
        assert http["status"] == "passed" and http["binarySha256"] == inputs["native_executable"]["sha256"]
        assert http["cleanup"]["portReleased"] is True and "serverExit" in http["cleanup"]
        result["remaining_edit_directories"] = sorted(path.name for path in temporary.iterdir()
                                                      if path.name.startswith("scotty-edit-"))
        assert result["remaining_edit_directories"] == []
        result["native_store_tests"] = counts
        result["http_result"] = http_results[0].relative_to(args.fixtures).as_posix()
        result["status"] = "passed"
    except Exception as error:
        result["error"] = repr(error)
        raise
    finally:
        for filename in sorted(args.fixtures.rglob("*")):
            if filename.is_file() and filename.name in {"result.json", "server.log", "type-edit.json",
                                                          "commands.json", "capabilities.json", "git-result.json"}:
                relative = filename.relative_to(args.fixtures)
                saved = output / "cases" / relative
                saved.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(filename, saved)
                retain_text(saved, "cases/" + relative.as_posix())
        result_file = output / "windows-result.json"
        result_file.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
        retain_text(result_file, "windows-result.json")


if __name__ == "__main__":
    main()
