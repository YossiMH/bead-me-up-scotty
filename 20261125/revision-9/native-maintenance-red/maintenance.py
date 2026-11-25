"""Compile and separately verify the unchanged Windows maintenance-lock Red."""
import argparse
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import time
import traceback

import windows_build_support as B

SOURCE = "c90f0cdbade93f9e9e6206e9a4d1999fa63afb1b"
TREE = "13e8f57a4de57819dfe3f13cc71f6078ac27bba7"
TARGET = "x86_64-pc-windows-msvc"
TOOLCHAIN = "1.100.0"
SUPPORT_SHA = "1c6cfa0b0c60c891c77a922823d1f3c0f4e14ba80b30d4260aee873105093b07"
SOURCE_HASHES = {
    "tests/redaction_transaction.rs": "4a88e30fa515bf2b92dc55671dd5ba09e22230c353d50dbb5d1c0d1b96c6cd34",
    "src/service/redaction.rs": "d5151ce88ada09a57ed7fcfcd38faacf84e168356c7a56ba640cf4bf34ec4480",
}
CASES = {
    "issue_redaction_is_exact_atomic_and_idempotent",
    "aws_secret_access_key_assignment_is_discoverable_and_redactable",
    "garage_access_key_id_assignment_is_discoverable_and_redactable",
    "assignee_metadata_is_redactable_without_deleting_the_issue",
    "every_supported_nonissue_record_preserves_identity_and_integrity",
    "concurrent_identical_requests_commit_once_and_replay_once",
}
FAILED_CASE = "concurrent_identical_requests_commit_once_and_replay_once"


def utc():
    return datetime.now(timezone.utc).isoformat()


def emit(path, root):
    data = path.read_bytes()
    row = dict(B.file_record(path, root), base64=base64.b64encode(data).decode())
    print("MAINTENANCE_TEXT " + json.dumps(row, sort_keys=True), flush=True)


def clean_environment():
    env = dict(os.environ)
    for key in list(env):
        if key.upper().startswith(("BEAD", "CARGO_", "RUSTC_", "RUSTDOC_")) or key.upper() in {
            "RUSTFLAGS", "RUSTDOCFLAGS", "RUSTC", "RUSTDOC", "RUSTUP_TOOLCHAIN", "BASH_ENV",
            "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
            "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        }:
            del env[key]
    env.update({"CARGO_BUILD_JOBS": "1", "CARGO_INCREMENTAL": "0", "RUSTUP_TOOLCHAIN": TOOLCHAIN})
    return env


def command(argv, cwd, label, seconds, env, output, commands, accepted=(0,)):
    stdout, stderr = output / "logs" / (label + ".stdout"), output / "logs" / (label + ".stderr")
    row = {"argv": argv, "cwd": str(cwd), "started": utc(), "limit_seconds": seconds,
           "stdout": stdout.relative_to(output).as_posix(), "stderr": stderr.relative_to(output).as_posix()}
    commands.append(row)
    started = time.monotonic()
    try:
        with stdout.open("wb") as out, stderr.open("wb") as err:
            completed = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=out, stderr=err, timeout=seconds,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
        row["exit_code"] = completed.returncode
        B.require(completed.returncode in accepted, label + " exited " + str(completed.returncode))
    except BaseException as error:
        row["error"] = type(error).__name__ + ": " + str(error)
        raise
    finally:
        row.update({"finished": utc(), "duration_seconds": round(time.monotonic() - started, 3)})
    return stdout


def build(args, output, result):
    checkout = args.checkout.resolve()
    work = output.with_name(output.name + "-work")
    work.mkdir()
    source, target = work / "source", work / "target"
    source.mkdir()
    (output / "executables").mkdir()
    env = clean_environment()
    env.update({"CARGO_TARGET_DIR": str(target), "GIT_CEILING_DIRECTORIES": str(work)})
    deadline = time.monotonic() + 1800

    def run(argv, cwd, label, seconds=1500):
        remaining = min(seconds, deadline - time.monotonic())
        B.require(remaining > 0, "Focused compile deadline exceeded")
        return command(argv, cwd, label, remaining, env, output, result["commands"])

    git = ["git", "-C", str(checkout)]
    B.require(run(git + ["rev-parse", "HEAD"], checkout, "head", 30).read_text().strip() == SOURCE,
              "Wrong unchanged source")
    B.require(run(git + ["rev-parse", "HEAD^{tree}"], checkout, "tree", 30).read_text().strip() == TREE,
              "Wrong source tree")
    B.require(not run(git + ["status", "--porcelain"], checkout, "status", 30).read_text().strip(),
              "Modified checkout")
    tracked = {}
    for row in run(git + ["ls-tree", "-r", "-z", SOURCE], checkout, "tracked", 60).read_bytes().split(b"\0"):
        if row:
            identity, name = row.split(b"\t", 1)
            mode, kind, blob = identity.decode().split()
            B.require(kind == "blob" and mode in {"100644", "100755"}, "Non-regular tracked input")
            tracked[name.decode("utf-8")] = {"git_mode": mode, "git_blob": blob}
    archive = work / "source.tar"
    run(git + ["archive", "--format=tar", "--output=" + str(archive), SOURCE], checkout, "archive", 180)
    files = B.extract_source(archive, source, tracked)
    B.write_json(output / "source-files.json", {"source_commit": SOURCE, "source_tree": TREE, "files": files})
    for name, expected in SOURCE_HASHES.items():
        B.require(B.file_hash(source / name) == expected, "Changed accepted maintenance source: " + name)
    result["source_archive"] = {"sha256": B.file_hash(archive), "bytes": archive.stat().st_size}
    result["source_manifest"] = B.file_record(output / "source-files.json", output)
    result["source_root"], result["target_root"] = str(source), str(target)
    result["visual_cpp"] = B.activate_msvc(run, work, env)
    run(["rustup", "toolchain", "install", TOOLCHAIN, "--profile", "minimal",
         "--target", TARGET, "--no-self-update"], work, "rustup", 600)
    result["rustc"] = run(["rustc", "-vV"], work, "rustc", 30).read_text().strip()
    result["cargo"] = run(["cargo", "--version"], work, "cargo", 30).read_text().strip()
    B.require("host: " + TARGET in result["rustc"] and result["rustc"].startswith("rustc 1.100.0 "),
              "Wrong Rust compiler")
    argv = ["cargo", "test", "--locked", "--no-run", "--test", "redaction_transaction",
            "--target", TARGET, "--message-format=json"]
    cargo = run(argv, source, "cargo-tests")
    found, finished = {}, []
    for line in cargo.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        message = json.loads(line)
        if message.get("reason") == "build-finished":
            finished.append(message.get("success"))
        if message.get("reason") != "compiler-artifact" or not message.get("executable"):
            continue
        info, profile = message["target"], message["profile"]
        key = info["name"]
        B.require((key == "redaction_transaction" and profile["test"] and info["kind"] == ["test"])
                  or (key == "bead" and not profile["test"] and info["kind"] == ["bin"]),
                  "Unexpected compiled executable")
        binary = Path(message["executable"]).resolve()
        B.require(key not in found and Path(message["manifest_path"]).resolve() == source / "Cargo.toml"
                  and binary.is_relative_to(target / TARGET), "Unexpected compiler path or package")
        B.pe_x64(binary)
        retained = output / "executables" / (key + ".exe")
        shutil.copy2(binary, retained)
        found[key] = dict(B.file_record(retained, output), compiled_path=str(binary))
    B.require(finished == [True] and set(found) == {"bead", "redaction_transaction"}, "Incomplete compile")
    for name, row in files.items():
        B.require(B.file_hash(source / name) == row["sha256"], "Build changed source: " + name)
    B.require(not run(git + ["status", "--porcelain"], checkout, "status-after", 30).read_text().strip(),
              "Build changed checkout")
    result.update({"executables": found, "source_unchanged": True, "tests_executed": False,
                   "release_built": False, "status": "passed"})


def red(args, output, result):
    artifact = args.artifact.resolve()
    manifest = artifact / "artifact-manifest.json"
    B.require(B.file_hash(manifest) == args.manifest_sha256, "Downloaded manifest differs")
    recorded = json.loads(manifest.read_text(encoding="utf-8"))
    B.require(recorded["source_commit"] == SOURCE and recorded["source_tree"] == TREE
              and recorded["target"] == TARGET, "Artifact identity differs")
    expected = set()
    for row in recorded["files"]:
        relative = PurePosixPath(row["path"])
        B.require(not relative.is_absolute() and ".." not in relative.parts
                  and row["path"].lower() not in expected, "Invalid artifact member")
        path = artifact.joinpath(*relative.parts).resolve()
        B.require(path.is_relative_to(artifact) and path.is_file() and not path.is_symlink()
                  and B.file_record(path, artifact) == row, "Downloaded bytes differ: " + row["path"])
        expected.add(row["path"].lower())
    B.require({p.relative_to(artifact).as_posix().lower() for p in artifact.rglob("*") if p.is_file()}
              == expected | {"artifact-manifest.json"}, "Downloaded file inventory differs")
    built = json.loads((artifact / "build-result.json").read_text(encoding="utf-8"))
    B.require(built["status"] == "passed" and built["source_commit"] == SOURCE and built["source_tree"] == TREE
              and built["target"] == TARGET and built["source_hashes"] == SOURCE_HASHES
              and built["rust_toolchain"] == TOOLCHAIN and built["source_unchanged"]
              and built["tests_executed"] is False and built["release_built"] is False
              and built["run_id"] == os.environ["GITHUB_RUN_ID"]
              and built["run_attempt"] == os.environ["GITHUB_RUN_ATTEMPT"]
              and built["workflow_commit"] == os.environ["GITHUB_SHA"]
              and set(built["executables"]) == {"bead", "redaction_transaction"}, "Compile receipt differs")
    source_files = json.loads((artifact / "source-files.json").read_text(encoding="utf-8"))
    B.require(source_files["source_commit"] == SOURCE and source_files["source_tree"] == TREE
              and all(source_files["files"][name]["sha256"] == value for name, value in SOURCE_HASHES.items()),
              "Retained source hashes differ")
    result["download"] = {"manifest_sha256": args.manifest_sha256, "artifact_id": args.artifact_id,
                          "build_result_sha256": B.file_hash(artifact / "build-result.json"),
                          "verified_files": len(expected), "executables": built["executables"]}
    B.write_json(output / "download-verification.json", result["download"])
    # Restore only the two accepted executables at the producer's owned paths.
    owned = Path(os.environ["RUNNER_TEMP"]) / ("bead-maintenance-" + built["run_id"] + "-"
                                              + built["run_attempt"] + "-work")
    target = owned / "target"
    B.require(Path(built["target_root"]) == target and not owned.exists(), "Unsafe restoration root")
    executables = {}
    for key, row in built["executables"].items():
        binary = Path(row["compiled_path"])
        B.require(binary.is_relative_to(target / TARGET) and binary.suffix.lower() == ".exe",
                  "Unsafe compiled path")
        binary.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(artifact / row["path"], binary)
        B.require(B.file_hash(binary) == row["sha256"] and binary.stat().st_size == row["bytes"],
                  "Restored executable differs")
        B.pe_x64(binary)
        executables[key] = binary
    fixtures = output / "fixtures"
    fixtures.mkdir()
    B.require(all(not (p / ".beads").exists() for p in (fixtures, *fixtures.parents)),
              "Disposable test root would discover another workspace")
    env = clean_environment()
    env.update({"TEMP": str(fixtures), "TMP": str(fixtures), "TMPDIR": str(fixtures),
                "CARGO_BIN_EXE_bead": str(executables["bead"]), "RUST_TEST_THREADS": "1"})
    harness = str(executables["redaction_transaction"])
    listed = command([harness, "--list"], output, "list", 30, env, output, result["commands"])
    names = re.findall(r"^(\S+): test$", listed.read_text(encoding="utf-8"), re.MULTILINE)
    B.require(len(names) == 6 and set(names) == CASES, "Six-case inventory differs")
    stdout = command([harness, "--test-threads=1", "--nocapture"], output, "red", 180,
                     env, output, result["commands"], accepted=(101,))
    text = stdout.read_text(encoding="utf-8")
    stderr = (output / "logs/red.stderr").read_text(encoding="utf-8")
    cases = re.findall(r"^test (\S+) \.\.\. (ok|FAILED)$", text, re.MULTILINE)
    result["observed_cases"] = [{"name": name, "status": status} for name, status in cases]
    result["harness_exit"] = result["commands"][-1]["exit_code"]
    B.require(len(cases) == 6 and {name for name, _ in cases} == CASES
              and [name for name, status in cases if status == "FAILED"] == [FAILED_CASE]
              and sum(status == "ok" for _, status in cases) == 5, "Unexpected Red cases")
    summaries = re.findall(r"^test result: FAILED\. (\d+) passed; (\d+) failed; (\d+) ignored; "
                           r"(\d+) measured; (\d+) filtered out;", text, re.MULTILINE)
    B.require(summaries == [("5", "1", "0", "0", "0")], "Incomplete Red summary")
    B.require('Integrity("could not acquire workspace maintenance lock")' in stderr
              and "operation.lock" not in stderr, "Expected maintenance acquisition failure absent")
    for key, binary in executables.items():
        B.require(B.file_hash(binary) == built["executables"][key]["sha256"], "Executable changed")
    result.update({"status": "expected-red", "cases": [{"name": n, "status": s} for n, s in cases],
                   "passed": 5, "failed": 1, "ignored": 0, "harness_exit": 101,
                   "expected_failure": FAILED_CASE, "source_unchanged": True,
                   "outer_owned_job_cleanup_required": True})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["build", "red"])
    parser.add_argument("--checkout", type=Path)
    parser.add_argument("--artifact", type=Path)
    parser.add_argument("--manifest-sha256")
    parser.add_argument("--artifact-id")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    B.require(sys.platform == "win32", "Windows host required")
    B.require(B.file_hash(Path(B.__file__)) == SUPPORT_SHA, "Accepted build support changed")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    (output / "logs").mkdir()
    result = {"schema_version": 1, "operation": "windows-maintenance-" + args.phase,
              "status": "failed", "source_commit": SOURCE, "source_tree": TREE, "target": TARGET,
              "source_hashes": SOURCE_HASHES, "rust_toolchain": TOOLCHAIN, "started": utc(),
              "run_id": os.environ["GITHUB_RUN_ID"], "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
              "workflow_commit": os.environ["GITHUB_SHA"], "commands": []}
    began = time.monotonic()
    try:
        (build if args.phase == "build" else red)(args, output, result)
    except BaseException as error:
        result.update({"status": "failed", "error": type(error).__name__ + ": " + str(error)})
        (output / "logs/failure.txt").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        result.update({"finished": utc(), "duration_seconds": round(time.monotonic() - began, 3)})
        receipt = output / ("build-result.json" if args.phase == "build" else "red-result.json")
        B.write_json(receipt, result)
        emit(receipt, output)
        for path in sorted((output / "logs").glob("*")):
            if path.is_file():
                emit(path, output)
        if args.phase == "build":
            records = [B.file_record(path, output) for path in sorted(output.rglob("*")) if path.is_file()]
            B.require(sum(row["bytes"] for row in records) < 150 * 1024**2, "Focused artifact exceeds bound")
            manifest = output / "artifact-manifest.json"
            B.write_json(manifest, {"source_commit": SOURCE, "source_tree": TREE, "target": TARGET,
                                   "files": records})
            emit(manifest, output)
            if result["status"] == "passed":
                with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as destination:
                    destination.write("manifest_sha256=" + B.file_hash(manifest) + "\n")
    return 0 if result["status"] in {"passed", "expected-red"} else 1


if __name__ == "__main__":
    sys.exit(main())
