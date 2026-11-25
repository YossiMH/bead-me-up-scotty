"""Build immutable Windows release/test artifacts on a disposable hosted runner."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import subprocess
import sys
import tarfile
import time
import traceback
from datetime import datetime, timezone


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def file_hash(path):
    """Hash retained files without holding the source archive in memory."""
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    """Write an artifact receipt with stable UTF-8 and LF bytes."""
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8", newline="\n")


def file_record(path, root):
    """Record bytes relative to the artifact directory for download validation."""
    return {"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size,
            "sha256": file_hash(path)}


def pe_x64(path):
    """Reject a host or wrong-architecture executable before retaining it."""
    with path.open("rb") as stream:
        header = stream.read(64)
        require(len(header) == 64 and header[:2] == b"MZ", "Missing DOS header: " + str(path))
        offset = struct.unpack_from("<I", header, 60)[0]
        require(64 <= offset <= path.stat().st_size - 26, "Invalid PE offset")
        stream.seek(offset)
        header = stream.read(26)
    require(header[:4] == b"PE\0\0" and struct.unpack_from("<H", header, 4)[0] == 0x8664
            and struct.unpack_from("<H", header, 24)[0] == 0x20B,
            "Expected an AMD64 PE32+ executable: " + str(path))


def activate_msvc(run, work, env):
    """Import the installed x64 VC environment and override Git Bash's link.exe."""
    vswhere = Path(os.environ["ProgramFiles(x86)"]) / "Microsoft Visual Studio/Installer/vswhere.exe"
    installation = Path(run([str(vswhere), "-latest", "-products", "*", "-requires",
                             "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property",
                             "installationPath"], work, "vswhere", 30).read_text().strip())
    vcvars = installation / "VC/Auxiliary/Build/vcvars64.bat"
    keys = ["PATH", "INCLUDE", "LIB", "LIBPATH", "VCINSTALLDIR", "VCToolsInstallDir",
            "VCToolsVersion", "WindowsSdkDir", "WindowsSDKVersion",
            "VSCMD_ARG_HOST_ARCH", "VSCMD_ARG_TGT_ARCH"]
    emitter = work / "emit-msvc.py"
    emitter.write_text("import json, os\nprint(json.dumps({k: os.environ.get(k) for k in "
                       + repr(keys) + "}))\n", encoding="utf-8")
    command = work / "activate-msvc.cmd"
    for value in (str(vcvars), sys.executable, str(emitter)):
        require(not any(c in value for c in '"%!&^<>\r\n'), "Unsupported command-file path")
    command.write_text('@echo off\ncall "' + str(vcvars) + '" >nul\n'
                       'if errorlevel 1 exit /b %errorlevel%\n"' + sys.executable
                       + '" "' + str(emitter) + '"\n', encoding="utf-8", newline="\r\n")
    values = json.loads(run([str(Path(os.environ["SystemRoot"]) / "System32/cmd.exe"),
                             "/d", "/c", str(command)], work, "activate-msvc", 60).read_text())
    require(set(values) == set(keys) and all(values.values())
            and values["VSCMD_ARG_HOST_ARCH"] == values["VSCMD_ARG_TGT_ARCH"] == "x64",
            "Incomplete x64 Visual C++ environment")
    env.update(values)
    linker = Path(values["VCToolsInstallDir"]) / "bin/Hostx64/x64/link.exe"
    require(linker.resolve().is_relative_to(installation.resolve()), "Unexpected MSVC linker path")
    pe_x64(linker)
    env["CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER"] = str(linker)
    return {"installation": str(installation), "linker": str(linker),
            "linker_sha256": file_hash(linker), "toolset": values["VCToolsVersion"],
            "sdk": values["WindowsSDKVersion"]}


def extract_source(archive, source, tracked):
    """Extract only exact regular Git blobs; retain their identities for test reuse."""
    files = {}
    with tarfile.open(archive, "r:") as stream:
        for member in stream:
            if member.isdir():
                continue
            name = member.name
            relative = PurePosixPath(name)
            require(member.isfile() and not relative.is_absolute() and ".." not in relative.parts
                    and name in tracked and name not in files, "Unexpected archive member: " + name)
            destination = source.joinpath(*relative.parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            contents = stream.extractfile(member)
            require(contents is not None, "Missing archive contents: " + name)
            with contents, destination.open("xb") as output:
                shutil.copyfileobj(contents, output)
            blob = hashlib.sha1(("blob " + str(member.size) + "\0").encode())
            with destination.open("rb") as raw:
                for chunk in iter(lambda: raw.read(1024 * 1024), b""):
                    blob.update(chunk)
            require(blob.hexdigest() == tracked[name]["git_blob"], "Archived Git blob differs: " + name)
            files[name] = dict(file_record(destination, source), **tracked[name])
    require(set(files) == set(tracked) and not (source / ".git").exists(), "Incomplete source archive")
    return files


def retain_executables(log, source, target_root, target, tests, output):
    """Use Cargo's actual output paths, preserving compile-time paths in the receipt."""
    found = {}
    finished = []
    for line in log.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        message = json.loads(line)
        if message.get("reason") == "build-finished":
            finished.append(message.get("success"))
        if message.get("reason") != "compiler-artifact" or not message.get("executable"):
            continue
        info, profile = message["target"], message["profile"]
        if profile["test"] and info["name"] == "bead_rs" and "lib" in info["kind"]:
            key = "lib"
        elif profile["test"] and info["name"] in tests and "test" in info["kind"]:
            key = info["name"]
        elif not profile["test"] and info["name"] == "bead" and "bin" in info["kind"]:
            key = "bead"
        else:
            continue
        binary = Path(message["executable"]).resolve()
        require(key not in found and Path(message["manifest_path"]).resolve() == source / "Cargo.toml",
                "Duplicate output or unexpected package: " + key)
        require(binary.is_relative_to(target_root / target), "Executable outside selected target")
        pe_x64(binary)
        retained = output / "executables" / (key + ".exe")
        shutil.copy2(binary, retained)
        found[key] = dict(file_record(retained, output), compiled_path=str(binary),
                          target_name=info["name"], kind=info["kind"], test=profile["test"])
    require(finished == [True] and set(found) == set(tests) | {"lib", "bead"},
            "Cargo did not produce every requested Windows harness and debug bead")
    return found


def main():
    """Own one bounded hosted build and retain useful output even after a failure."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    require(sys.platform == "win32", "This packet requires a hosted Windows runner")
    inputs = json.loads(args.inputs.read_text(encoding="utf-8"))
    require(inputs["repository"] == "YossiMH/bead-rs" and inputs["target"] == "x86_64-pc-windows-msvc"
            and re.fullmatch(r"[a-f0-9]{40}", inputs["source_commit"])
            and re.fullmatch(r"[a-f0-9]{40}", inputs["source_tree"]), "Invalid frozen build input")
    checkout, output = args.checkout.resolve(), args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    work = output.with_name(output.name + "-work")
    work.mkdir()
    logs = output / "logs"
    logs.mkdir()
    (output / "executables").mkdir()
    (output / "release").mkdir()
    source, target_root = work / "source", work / "target"
    source.mkdir()
    started = time.monotonic()
    deadline = started + 2400
    commands = []
    env = dict(os.environ)
    for key in list(env):
        if key.upper().startswith(("BEAD", "CARGO_", "RUSTC_", "RUSTDOC_")) or key.upper() in {
            "RUSTFLAGS", "RUSTDOCFLAGS", "RUSTC", "RUSTDOC", "RUSTUP_TOOLCHAIN", "BASH_ENV",
            "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
            "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"
        }:
            del env[key]
    env.update({"CARGO_BUILD_JOBS": "1", "CARGO_INCREMENTAL": "0",
                "RUSTUP_TOOLCHAIN": inputs["rust_toolchain"], "CARGO_TARGET_DIR": str(target_root),
                "GIT_CEILING_DIRECTORIES": str(work)})
    result = {"schema_version": 1, "source_commit": inputs["source_commit"],
              "source_tree": inputs["source_tree"], "target": inputs["target"],
              "run_id": os.environ["GITHUB_RUN_ID"], "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
              "workflow_commit": os.environ["GITHUB_SHA"], "runner_os": os.environ["RUNNER_OS"],
              "runner_image": os.environ.get("ImageVersion"), "python": sys.version,
              "source_root": str(source), "target_root": str(target_root),
              "started": datetime.now(timezone.utc).isoformat(), "commands": commands,
              "tests_executed": False}

    def run(argv, cwd, label, seconds=2400, stdout_path=None):
        """Wait for a command; Actions owns the disposable VM and all descendants."""
        stdout = stdout_path or logs / (label + ".stdout")
        stderr = logs / (label + ".stderr")
        remaining = min(seconds, deadline - time.monotonic())
        require(remaining > 0, "Hosted build deadline exceeded")
        command = {"argv": argv, "cwd": str(cwd), "stdout": stdout.relative_to(output).as_posix(),
                   "stderr": stderr.relative_to(output).as_posix(), "timeout_seconds": remaining}
        commands.append(command)
        print("RUN " + label + ": " + subprocess.list2cmdline(argv), flush=True)
        began = time.monotonic()
        with stdout.open("wb") as out_stream, stderr.open("wb") as err_stream:
            completed = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=out_stream, stderr=err_stream, timeout=remaining)
        command.update({"exit_code": completed.returncode,
                        "duration_seconds": round(time.monotonic() - began, 3)})
        if completed.returncode:
            print(stderr.read_text(encoding="utf-8", errors="replace")[-12000:], flush=True)
            raise RuntimeError(label + " exited " + str(completed.returncode))
        return stdout

    try:
        shutil.copy2(args.inputs, output / "build-inputs.json")
        shutil.copy2(Path(__file__), output / "build.py")
        git = ["git", "-C", str(checkout)]
        head = run(git + ["rev-parse", "HEAD"], checkout, "source-head", 30).read_text().strip()
        tree = run(git + ["rev-parse", "HEAD^{tree}"], checkout, "source-tree", 30).read_text().strip()
        require(head == inputs["source_commit"] and tree == inputs["source_tree"], "Source identity differs")
        require(not run(git + ["status", "--porcelain"], checkout, "source-status", 30).read_text().strip(),
                "Source checkout has local changes")
        script = checkout / "scripts/build-from-archive.sh"
        require(file_hash(script) == inputs["archive_script_sha256"], "Original archive script changed")
        shutil.copy2(script, output / "archive-build-script.sh")
        result["visual_cpp"] = activate_msvc(run, work, env)
        run(["rustup", "toolchain", "install", inputs["rust_toolchain"], "--profile", "minimal",
             "--component", "rustfmt", "--target", inputs["target"], "--no-self-update"],
            work, "rustup", 600)
        result["rustc"] = run(["rustc", "-vV"], work, "rustc", 30).read_text().strip()
        result["cargo"] = run(["cargo", "--version"], work, "cargo-version", 30).read_text().strip()
        require("host: " + inputs["target"] in result["rustc"], "Unexpected Rust host target")
        bash = Path(os.environ["ProgramFiles"]) / "Git/bin/bash.exe"
        cygpath = bash.parent.parent / "usr/bin/cygpath.exe"
        paths = {}
        for label, path in [("script", script), ("release", output / "release"),
                            ("scratch", work / "archive-build-scratch")]:
            paths[label] = run([str(cygpath), "-u", str(path)], work, "cygpath-" + label, 30).read_text().strip()
        result["git_bash_python"] = run([str(bash), "-c", "python3 --version"], work,
                                       "bash-python", 30).read_text().strip()
        env["BEAD_BUILD_SCRATCH_ROOT"] = paths["scratch"]
        release_name = "bead-checkpoint-" + head[:12] + ".exe"
        run([str(bash), paths["script"], head, "--target", inputs["target"], "--name", release_name,
             "--out", paths["release"]], checkout, "archive-release")
        del env["BEAD_BUILD_SCRATCH_ROOT"]
        release = output / "release" / release_name
        metadata_path = release.with_name(release.name + ".metadata.json")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        pe_x64(release)
        require(metadata["git_commit_sha"] == head and metadata["build_target"] == inputs["target"]
                and metadata["build_host_target"] == inputs["target"]
                and metadata["source"] == "git-archive" and metadata["build_profile"] == "release"
                and metadata["build_features"] == "default" and metadata["binary_name"] == release_name
                and metadata["binary_sha256"] == file_hash(release)
                and metadata["binary_size_bytes"] == release.stat().st_size
                and metadata["execution_verification"] == "executed"
                and metadata["embedded_version_string"].startswith("bead "), "Release metadata differs")
        result["release"] = {"executable": file_record(release, output),
                             "metadata": file_record(metadata_path, output)}
        run(["dumpbin.exe", "/DEPENDENTS", str(release)], work, "release-imports", 30)
        tracked_log = run(git + ["ls-tree", "-r", "-z", head], checkout, "tracked-files", 60)
        tracked = {}
        for row in tracked_log.read_bytes().split(b"\0"):
            if not row:
                continue
            identity, name = row.split(b"\t", 1)
            mode, kind, blob = identity.decode().split()
            require(kind == "blob" and mode in {"100644", "100755"}, "Non-regular source file")
            tracked[name.decode("utf-8")] = {"git_mode": mode, "git_blob": blob}
        archive = output / "source.tar"
        run(git + ["archive", "--format=tar", "--output=" + str(archive), head],
            checkout, "source-archive", 180)
        require(archive.stat().st_size < 1024 * 1024 * 1024, "Source archive exceeds 1 GiB")
        files = extract_source(archive, source, tracked)
        write_json(output / "source-files.json", {"source_commit": head, "source_tree": tree, "files": files})
        result["source_archive"] = file_record(archive, output)
        result["source_manifest"] = file_record(output / "source-files.json", output)
        run(["cargo", "fmt", "--check"], source, "cargo-fmt", 120)
        compile_command = ["cargo", "test", "--locked", "--no-run", "--lib"]
        for target in inputs["test_targets"]:
            compile_command += ["--test", target]
        compile_command += ["--target", inputs["target"], "--message-format=json"]
        cargo_log = run(compile_command, source, "cargo-tests", stdout_path=logs / "cargo-tests.jsonl")
        result["executables"] = retain_executables(cargo_log, source, target_root,
                                                  inputs["target"], inputs["test_targets"], output)
        for name, row in files.items():
            require(file_hash(source / name) == row["sha256"], "Build changed source: " + name)
        result["status"] = "passed"
    except Exception as error:
        result["status"] = "failed"
        result["error"] = type(error).__name__ + ": " + str(error)
        (logs / "failure.txt").write_text(traceback.format_exc(), encoding="utf-8")
        print(traceback.format_exc(), flush=True)
    finally:
        result["duration_seconds"] = round(time.monotonic() - started, 3)
        result["finished"] = datetime.now(timezone.utc).isoformat()
        write_json(output / "build-result.json", result)
        records = [file_record(path, output) for path in sorted(output.rglob("*")) if path.is_file()]
        require(sum(row["bytes"] for row in records) <= 3 * 1024**3, "Artifact exceeds 3 GiB")
        manifest = output / "artifact-manifest.json"
        write_json(manifest, {"schema_version": 1, "source_commit": inputs["source_commit"],
                             "target": inputs["target"], "files": records})
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as outputs:
            outputs.write("manifest_sha256=" + file_hash(manifest) + "\n")
        print("CHECKPOINT_WINDOWS_BUILD_RESULT " + json.dumps(result, sort_keys=True), flush=True)
        print("ARTIFACT_MANIFEST_SHA256 " + file_hash(manifest), flush=True)
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
