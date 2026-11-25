#!/usr/bin/env python3
"""Compile the reviewed tests-only checkpoint source on an isolated hosted Linux runner."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone

EXPECTED_FILES = {
    "src/service/checkpoint/set_v2.rs": "M",
    "tests/attempt_receipt_checkpoint_integrity.rs": "M",
    "tests/checkpoint_set_v2_conformance.rs": "M",
    "tests/checkpoint_tail_generation_integrity.rs": "A",
}
PREFIX_PATH = "src/service/checkpoint/set_v2.rs"
PREFIX_BYTES = 47227
PREFIX_SHA256 = "310974bfae112134b290f4c8040b7f68994e009d207ff2a1a470af22145be538"
BASELINE_FILE_SHA256 = "eae52fc4a02eecb1452bc07f967861e50f86afa9872b88d43080dc86069092a8"
BASELINE_COMMIT = "986f2a332aca9dd567eee41ce835917d56e29468"
TEST_MARKER = b"#[cfg(test)]\nmod tests {\n"
COMMAND = [
    "cargo", "test", "--locked", "--no-run", "--lib",
    "--test", "attempt_receipt_checkpoint_integrity",
    "--test", "checkpoint_tail_generation_integrity",
    "--test", "checkpoint_set_v2_conformance",
    "--message-format=json",
]
TEST_TARGETS = {
    "attempt_receipt_checkpoint_integrity",
    "checkpoint_tail_generation_integrity",
    "checkpoint_set_v2_conformance",
}
SHA256 = re.compile(r"^[a-f0-9]{64}$")
SHA1 = re.compile(r"^[a-f0-9]{40}$")
MAX_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_SOURCE_FILES = 100000
DEADLINE_SECONDS = 1800
WORK_SECONDS = 1790


def require(value, message):
    if not value:
        raise RuntimeError(message)


def utc():
    return datetime.now(timezone.utc).isoformat()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key: " + key)
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())


def safe_existing(path, directory=False):
    path = Path(path)
    require(path.is_absolute(), "Absolute path required")
    require(path.resolve(strict=True) == path, "Symlink or redirected path: " + str(path))
    mode = path.lstat().st_mode
    require(stat.S_ISDIR(mode) if directory else stat.S_ISREG(mode), "Unexpected file type: " + str(path))
    return path


def relative_path(value):
    require(isinstance(value, str) and value and "\\" not in value
            and all(ord(character) >= 32 and ord(character) != 127 for character in value),
            "Invalid archive-relative path")
    parts = value.split("/")
    require(not value.startswith("/") and all(part not in ("", ".", "..") for part in parts),
            "Unsafe archive-relative path: " + value)
    require(".git" not in parts, "Git metadata is forbidden in extracted source")
    return PurePosixPath(value)


def file_record(path, root):
    safe_existing(path)
    require(path.is_relative_to(root), "File leaves owned root")
    mode = stat.S_IMODE(path.stat().st_mode)
    return {"path": path.relative_to(root).as_posix(), "sha256": file_hash(path),
            "bytes": path.stat().st_size, "mode": mode}


def clean_environment(root):
    env = dict(os.environ)
    prefixes = ("BEAD", "GIT_", "CARGO_", "RUSTC_", "RUSTDOC_")
    exact = {"RUSTFLAGS", "RUSTDOCFLAGS", "RUSTC", "RUSTDOC", "RUSTUP_TOOLCHAIN",
             "TMPDIR", "TMP", "TEMP", "LD_PRELOAD", "LD_LIBRARY_PATH"}
    for key in list(env):
        upper = key.upper()
        if upper.startswith(prefixes) or upper in exact:
            del env[key]
    env.update({
        "CARGO_BUILD_JOBS": "1",
        "CARGO_TARGET_DIR": str(root / "target"),
        "RUSTUP_TOOLCHAIN": "1.100.0",
        "TMPDIR": str(root / "tmp"),
        "TMP": str(root / "tmp"),
        "TEMP": str(root / "tmp"),
        "GIT_OPTIONAL_LOCKS": "0",
        "LC_ALL": "C.UTF-8",
    })
    return env


class Runner:
    def __init__(self, root, env, deadline):
        self.root = root
        self.env = env
        self.deadline = deadline
        self.active = None
        self.commands = []
        self.cleanup = []

    def stop_group(self, process, label):
        pgid = process.pid
        record = {"label": label, "pgid": pgid, "signals": [], "remaining": False}
        try:
            os.killpg(pgid, 0)
        except ProcessLookupError:
            self.cleanup.append(record)
            return record
        for sig, grace in ((signal.SIGTERM, 2.0), (signal.SIGKILL, 2.0)):
            try:
                os.killpg(pgid, sig)
                record["signals"].append(sig.name)
            except ProcessLookupError:
                break
            until = time.monotonic() + grace
            while time.monotonic() < until:
                process.poll()
                try:
                    os.killpg(pgid, 0)
                except ProcessLookupError:
                    break
                time.sleep(0.05)
            else:
                continue
            break
        process.poll()
        try:
            os.killpg(pgid, 0)
            record["remaining"] = True
        except ProcessLookupError:
            pass
        self.cleanup.append(record)
        return record

    def run(self, args, cwd, label, stdout_path=None):
        require(time.monotonic() < self.deadline, "Compile work deadline expired")
        require(self.active is None, "Concurrent owned commands are forbidden")
        out = stdout_path or self.root / "logs" / (label + ".stdout")
        err = self.root / "logs" / (label + ".stderr")
        started = utc()
        record = {"label": label, "args": args, "cwd": str(cwd), "started": started,
                  "stdout": str(out.relative_to(self.root)), "stderr": str(err.relative_to(self.root))}
        write_json(self.root / "logs" / (label + ".started.json"), record)
        process = None
        failure = None
        try:
            with out.open("xb") as stdout, err.open("xb") as stderr:
                process = subprocess.Popen(args, cwd=cwd, env=self.env, stdin=subprocess.DEVNULL,
                                           stdout=stdout, stderr=stderr, start_new_session=True)
                self.active = process
                record["pid"] = process.pid
                record["pgid"] = process.pid
                remaining = self.deadline - time.monotonic()
                require(remaining > 0, "Compile work deadline expired")
                process.wait(timeout=remaining)
                stdout.flush()
                stderr.flush()
                os.fsync(stdout.fileno())
                os.fsync(stderr.fileno())
            require(process.returncode == 0, label + " exited " + str(process.returncode))
        except BaseException as error:
            failure = error
        finally:
            if process is not None:
                cleanup = self.stop_group(process, label)
                record["exit_code"] = process.poll()
                if cleanup["signals"] or cleanup["remaining"]:
                    record["cleanup"] = cleanup
                    if failure is None:
                        failure = RuntimeError("Unexpected remaining descendants after " + label)
            self.active = None
            record["finished"] = utc()
            record["error"] = str(failure) if failure else None
            self.commands.append(record)
            write_json(self.root / "logs" / (label + ".exit.json"), record)
        if failure:
            raise failure
        return out


def extract_source(archive, source, tracked):
    source.mkdir()
    files = {}
    total = 0
    with tarfile.open(archive, "r:") as tar:
        for member in tar:
            name = member.name.rstrip("/") if member.isdir() else member.name
            relative = relative_path(name)
            target = source.joinpath(*relative.parts)
            require(target.is_relative_to(source), "Archive leaves source root")
            require(not member.issym() and not member.islnk(), "Links are forbidden in the reviewed source archive")
            require(member.isdir() or member.isfile(), "Special archive member refused")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            require(name not in files, "Duplicate source archive member")
            require(name in tracked, "Archive contains an untracked file")
            total += member.size
            require(total <= MAX_SOURCE_BYTES and len(files) < MAX_SOURCE_FILES,
                    "Source archive exceeds its reviewed bound")
            target.parent.mkdir(parents=True, exist_ok=True)
            stream = tar.extractfile(member)
            require(stream is not None, "Missing archive file bytes")
            with stream, target.open("xb") as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            require(target.stat().st_size == member.size, "Archive member length mismatch")
            mode = member.mode & 0o777
            require(member.mode == mode and mode & 0o600 == 0o600, "Unsafe Git archive file mode")
            require(bool(mode & 0o111) == (tracked[name]["git_mode"] == "100755"),
                    "Git archive executable mode differs")
            os.chmod(target, mode)
            blob_digest = hashlib.sha1(("blob " + str(member.size) + "\0").encode("ascii"))
            with target.open("rb") as stored:
                for chunk in iter(lambda: stored.read(1024 * 1024), b""):
                    blob_digest.update(chunk)
            require(blob_digest.hexdigest() == tracked[name]["git_blob"], "Archived bytes differ from tracked blob")
            files[name] = {**file_record(target, source), "git_blob": tracked[name]["git_blob"],
                           "git_mode": tracked[name]["git_mode"]}
    require(set(files) == set(tracked), "Git archive omitted tracked source files")
    require(not (source / ".git").exists(), "Extracted source contains Git metadata")
    return files


def compiled_outputs(log, source, target, root):
    found = {}
    build_finished = []
    with log.open("r", encoding="utf-8") as output:
        for line in output:
            if not line.strip():
                continue
            message = json.loads(line, object_pairs_hook=unique_object)
            if message.get("reason") == "build-finished":
                build_finished.append(message.get("success"))
            if message.get("reason") != "compiler-artifact" or not message.get("executable"):
                continue
            target_info = message["target"]
            kinds = target_info["kind"]
            key = None
            if message["profile"]["test"] and "lib" in kinds:
                key = "lib"
            elif message["profile"]["test"] and "test" in kinds and target_info["name"] in TEST_TARGETS:
                key = target_info["name"]
            elif not message["profile"]["test"] and "bin" in kinds and target_info["name"] == "bead":
                key = "bead"
            else:
                continue
            require(key not in found, "Duplicate compiled executable: " + key)
            manifest = safe_existing(Path(message["manifest_path"]))
            require(manifest == source / "Cargo.toml", "Executable belongs to another package")
            binary = safe_existing(Path(message["executable"]))
            require(binary.is_relative_to(target), "Cargo executable leaves owned target")
            if key == "bead":
                require(binary == target / "debug" / "bead", "Unexpected bead binary path")
            else:
                # Cargo1.100 reports build-unit paths through its executable JSON field.
                parts = binary.relative_to(target).parts
                expected_name = "bead_rs" if key == "lib" else key
                require(target_info["name"] == expected_name, "Unexpected test target name")
                require(len(parts) == 6 and parts[:3] == ("debug", "build", "bead-rs")
                        and re.fullmatch(r"[a-f0-9]{16}", parts[3]) and parts[4] == "out"
                        and parts[5] == expected_name + "-" + parts[3],
                        "Unexpected Cargo1.100 test executable path: " + str(binary.relative_to(target)))
            require(os.access(binary, os.X_OK) and binary.stat().st_size > 0,
                    "Compiled executable is empty or not executable")
            found[key] = file_record(binary, root)
    require(build_finished == [True], "Missing successful Cargo build-finished message")
    require(set(found) == TEST_TARGETS | {"lib", "bead"}, "Expected four tests plus the bead binary")
    require(len({row["path"] for row in found.values()}) == 5, "Executables alias one another")
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    args = parser.parse_args()
    require(sys.platform == "linux", "Hosted Linux only")
    require(SHA256.fullmatch(args.inputs_sha256) and SHA256.fullmatch(args.helper_sha256),
            "Exact reviewed helper/input hashes are required")
    helper = safe_existing(Path(__file__).absolute())
    require(file_hash(helper) == args.helper_sha256, "Helper bytes changed")
    inputs_path = safe_existing(Path(args.inputs))
    require(inputs_path.stat().st_size <= 1024 * 1024, "Inputs exceed 1 MiB")
    require(file_hash(inputs_path) == args.inputs_sha256, "Input bytes changed")
    inputs = read_json(inputs_path)
    require(inputs.get("schema_version") == 1 and inputs.get("repository") == "YossiMH/bead-rs",
            "Invalid approved build inputs")
    for key in ("baseline_commit", "source_commit", "source_tree"):
        require(isinstance(inputs.get(key), str) and SHA1.fullmatch(inputs[key]), "Missing exact " + key)
    require(inputs["baseline_commit"] == BASELINE_COMMIT, "Unexpected production baseline")
    approved = inputs.get("approved_files")
    require(isinstance(approved, dict) and set(approved) == set(EXPECTED_FILES), "Unexpected approved source delta")
    for name, row in approved.items():
        require(row["status"] == EXPECTED_FILES[name] and SHA256.fullmatch(row["sha256"]), "Invalid approved file pin")
    require(inputs.get("production_prefix") == {
        "path": PREFIX_PATH, "bytes": PREFIX_BYTES, "sha256": PREFIX_SHA256,
        "baseline_file_sha256": BASELINE_FILE_SHA256,
    }, "Production prefix pin differs")
    checkout = safe_existing(Path(args.checkout), directory=True)
    runner_temp = safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    run_id, attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"[0-9]+", run_id) and re.fullmatch(r"[1-9][0-9]*", attempt), "Invalid hosted run identity")
    workflow_commit = os.environ["GITHUB_SHA"]
    require(SHA1.fullmatch(workflow_commit), "Missing workflow commit")
    root = runner_temp / ("bead-checkpoint-red-build-" + run_id + "-" + attempt)
    require(not root.exists(), "Build root already exists; do not replay into it")
    root.mkdir()
    for name in ("logs", "tmp", "target"):
        (root / name).mkdir()
    source, target = root / "source", root / "target"
    for ancestor in (root, *root.parents):
        require(not (ancestor / ".git").exists(), "Archive build would inherit an ancestor Git workspace")
    env = clean_environment(root)
    began = time.monotonic()
    runner = Runner(root, env, began + WORK_SECONDS)
    status = {"schema_version": 1, "status": "failed", "operation": "checkpoint-red-compile-only",
              "input_sha256": args.inputs_sha256, "helper_sha256": args.helper_sha256,
              "build_root": str(root), "source_root": str(source), "target_root": str(target),
              "run": {"id": run_id, "attempt": attempt, "workflow_commit": workflow_commit,
                      "repository": os.environ["GITHUB_REPOSITORY"],
                      "workflow_ref": os.environ.get("GITHUB_WORKFLOW_REF")},
              "started": utc(), "deadline_seconds": DEADLINE_SECONDS, "work_seconds": WORK_SECONDS,
              "command": COMMAND, "tests_executed": False, "product_executed": False,
              "environment": {"CARGO_BUILD_JOBS": "1", "CARGO_TARGET_DIR": str(target),
                              "TMPDIR": str(root / "tmp"), "RUSTUP_TOOLCHAIN": "1.100.0"}}
    outer = {"schema_version": 1, "status": "failed", "build_root": str(root)}
    write_json(root / "attempt-started.json", {"started": status["started"], "input_sha256": args.inputs_sha256,
                                            "helper_sha256": args.helper_sha256, "build_root": str(root)})

    def deadline_handler(_signal, _frame):
        raise TimeoutError("Owned compile work deadline reached")

    old_alarm = signal.signal(signal.SIGALRM, deadline_handler)
    old_term = signal.signal(signal.SIGTERM, deadline_handler)
    signal.setitimer(signal.ITIMER_REAL, WORK_SECONDS)
    try:
        with inputs_path.open("rb") as original, (root / "build-inputs.json").open("xb") as saved:
            shutil.copyfileobj(original, saved)
            saved.flush()
            os.fsync(saved.fileno())
        require(file_hash(root / "build-inputs.json") == args.inputs_sha256, "Copied inputs changed")
        def git(arguments, label):
            return runner.run(["git", "-C", str(checkout), *arguments], checkout, label)

        top = git(["rev-parse", "--show-toplevel"], "git-root").read_text().strip()
        require(Path(top) == checkout, "Checkout path is not the Git root")
        require(not git(["status", "--porcelain=v1", "--untracked-files=all", "-z"], "git-status").read_bytes(),
                "Source checkout is not clean")
        head = git(["rev-parse", "HEAD"], "git-head").read_text().strip()
        require(head == inputs["source_commit"], "Checkout HEAD differs from approved commit")
        tree = git(["rev-parse", "HEAD^{tree}"], "git-tree").read_text().strip()
        require(tree == inputs["source_tree"], "Checkout tree differs from approved tree")
        parents = git(["rev-list", "--parents", "-n", "1", "HEAD"], "git-parent").read_text().split()
        require(parents == [head, inputs["baseline_commit"]], "Tests-only source must directly descend from the approved baseline")
        git(["cat-file", "-e", inputs["baseline_commit"] + "^{commit}"], "git-baseline")
        changes = git(["diff", "--name-status", "--no-renames", "-z", inputs["baseline_commit"], head, "--"],
                      "git-delta").read_bytes().split(b"\0")
        require(changes[-1] == b"" and (len(changes) - 1) % 2 == 0, "Malformed Git delta")
        delta = {}
        for index in range(0, len(changes) - 1, 2):
            change, name = changes[index].decode("ascii"), changes[index + 1].decode("utf-8")
            require(name not in delta, "Duplicate changed source path")
            delta[name] = change
        require(delta == EXPECTED_FILES, "Source delta exceeds the four reviewed test files")
        git(["diff", "--check", inputs["baseline_commit"], head, "--"], "git-whitespace")
        listing = git(["ls-tree", "-r", "-z", "--full-tree", head], "git-files").read_bytes().split(b"\0")
        tracked = {}
        for entry in listing:
            if not entry:
                continue
            metadata, name_bytes = entry.split(b"\t", 1)
            mode, kind, blob = metadata.decode("ascii").split()
            name = name_bytes.decode("utf-8")
            relative_path(name)
            require(kind == "blob" and mode in ("100644", "100755"), "Links/submodules/special tracked objects are refused")
            require(name not in tracked, "Duplicate tracked source file")
            tracked[name] = {"git_mode": mode, "git_blob": blob}
        require(0 < len(tracked) <= MAX_SOURCE_FILES, "Unexpected source file count")
        baseline_file = git(["show", inputs["baseline_commit"] + ":" + PREFIX_PATH], "baseline-production").read_bytes()
        require(hashlib.sha256(baseline_file).hexdigest() == BASELINE_FILE_SHA256, "Baseline source changed")
        require(baseline_file.find(TEST_MARKER) == PREFIX_BYTES, "Baseline production boundary changed")
        require(hashlib.sha256(baseline_file[:PREFIX_BYTES]).hexdigest() == PREFIX_SHA256, "Baseline prefix differs")
        archive = root / "source.tar"
        runner.run(["git", "-C", str(checkout), "archive", "--format=tar", head], checkout, "git-archive", archive)
        require(0 < archive.stat().st_size <= MAX_SOURCE_BYTES, "Source archive exceeds reviewed size")
        files = extract_source(archive, source, tracked)
        for name, pin in approved.items():
            require(files[name]["sha256"] == pin["sha256"], "Approved test source differs: " + name)
        candidate = (source / PREFIX_PATH).read_bytes()
        require(candidate.find(TEST_MARKER) == PREFIX_BYTES, "Candidate production boundary changed")
        require(hashlib.sha256(candidate[:PREFIX_BYTES]).hexdigest() == PREFIX_SHA256, "Production code changed in tests-only source")
        write_json(root / "source-files.json", {"schema_version": 1, "source_commit": head, "source_tree": tree, "files": files})
        rustc = runner.run(["rustc", "--version"], source, "rustc-version").read_text().strip()
        cargo = runner.run(["cargo", "--version"], source, "cargo-version").read_text().strip()
        require(re.fullmatch(r"rustc 1\.100\.0 \([^\n]+\)", rustc), "Rust1.100.0 is required")
        require(re.fullmatch(r"cargo 1\.100\.0 \([^\n]+\)", cargo), "Cargo1.100.0 is required")
        status["source"] = {"repository": inputs["repository"], "baseline_commit": inputs["baseline_commit"],
                            "commit": head, "tree": tree, "archive_path": "source.tar",
                            "archive_sha256": file_hash(archive), "archive_bytes": archive.stat().st_size,
                            "files_manifest_path": "source-files.json",
                            "files_manifest_sha256": file_hash(root / "source-files.json"),
                            "approved_files": approved, "production_prefix": inputs["production_prefix"]}
        status["toolchain"] = {"rustc": rustc, "cargo": cargo}
        cargo_log = runner.run(COMMAND, source, "cargo", root / "logs" / "cargo.stdout.jsonl")
        status["executables"] = compiled_outputs(cargo_log, source, target, root)
        require(not (source / ".git").exists(), "Build recreated Git metadata")
        for name, pin in files.items():
            require(file_record(source / name, source) == {k: pin[k] for k in ("path", "sha256", "bytes", "mode")},
                    "Build changed tracked source: " + name)
        require(file_hash(inputs_path) == args.inputs_sha256 and file_hash(helper) == args.helper_sha256,
                "Reviewed helper/inputs changed during build")
        status["status"] = "passed"
        status["commands"] = runner.commands
        status["process_group_cleanup"] = runner.cleanup
        status["finished"] = utc()
        status["duration_seconds"] = round(time.monotonic() - began, 3)
        write_json(root / "build-result.json", status)
        bundle = root / "compile-bundle.tar.gz"
        names = ["source.tar", "source-files.json", "build-inputs.json", "build-result.json", "attempt-started.json"]
        names.extend(path.relative_to(root).as_posix() for path in sorted((root / "logs").iterdir()))
        names.extend(value["path"] for value in status["executables"].values())
        require(len(names) == len(set(names)), "Bundle paths are not unique")
        with tarfile.open(bundle, "x:gz", compresslevel=1) as tar:
            for name in sorted(names):
                relative_path(name)
                safe_existing(root / name)
                tar.add(root / name, arcname=name, recursive=False)
        outer.update({"status": "passed", "compile_result_sha256": file_hash(root / "build-result.json"),
                      "bundle": file_record(bundle, root)})
    except BaseException as error:
        outer["error"] = type(error).__name__ + ": " + str(error)
        status["status"] = "failed"
        status["error"] = outer["error"]
    finally:
        if runner.active is not None:
            runner.stop_group(runner.active, "final-cleanup")
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_alarm)
        signal.signal(signal.SIGTERM, old_term)
        status["commands"] = runner.commands
        status["process_group_cleanup"] = runner.cleanup
        status["finished"] = utc()
        status["duration_seconds"] = round(time.monotonic() - began, 3)
        if not (root / "build-result.json").exists():
            write_json(root / "build-result.json", status)
        if any(row["remaining"] for row in runner.cleanup):
            outer["status"] = "failed"
            outer["error"] = "Owned process group did not finish cleanup"
        if time.monotonic() - began > DEADLINE_SECONDS:
            outer["status"] = "failed"
            outer["error"] = "Compile phase exceeded its 1800-second deadline"
        outer["finished"] = utc()
        outer["duration_seconds"] = round(time.monotonic() - began, 3)
        outer["logs_retention_days_required"] = 7
        write_json(root / "result.json", outer)
        for prefix, name in (("CHECKPOINT_BUILD_RESULT", "build-result.json"),
                             ("CHECKPOINT_OUTER_RESULT", "result.json")):
            data = (root / name).read_bytes()
            require(len(data) <= 256 * 1024, "Receipt metadata exceeds stdout bound")
            print(prefix + "_SHA256 " + hashlib.sha256(data).hexdigest(), flush=True)
            print(prefix + "_BASE64 " + base64.b64encode(data).decode("ascii"), flush=True)
        print(json.dumps(outer, sort_keys=True), flush=True)
    return 0 if outer["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
