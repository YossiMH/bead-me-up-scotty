#!/usr/bin/env python3
"""Build the exact native candidate and every default test on hosted Linux."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import sys
import tarfile
import time

SUPPORT_SHA256 = "db9b710e0b181a348d3a84602d37c1e4bad2f373a46940d0d40863c93b0081f0"
BASELINE = "515b503b24baf71737ff8fa6c879bd0752ef0fc6"
TESTS_COMMIT = "14051553b607bc160fb46f053c52ddeeadf846db"
SOURCE_COMMIT = "9ffefad6bb3b21ac1362f54df245af82ed85ec6e"
SOURCE_TREE = "31c63a88be4d7f818aa115b8b83b1ef58518ad13"
EXPECTED_FILES = {
    "man/man1/bead-update.1": ("M", "04c6e2f94937da51f72a675be615f8981e96a7d9b76699354cdc3753156c73af"),
    "research/specs/issue-editing-v1.md": ("M", "aa17bc14898c8591da9fa3fe4b45cc77f3b893b8229b8bf78776c9349d7448d9"),
    "src/cli.rs": ("M", "956abc229044f53d1af66506b5df4810f3037db9558eb38183467aa711eaec83"),
    "src/main.rs": ("M", "d4b1ab9d02b186615cfd3f65dbb8d98366fad11d00065bbfe65ce7604612a3e0"),
    "src/service/capabilities.rs": ("M", "a99f851d759a3e2095ba28a9adeb4a7694e45dca83134ade2447f8436cb384b1"),
    "src/service/schema.rs": ("M", "fe006a48e2636c4956c15afcc2993e5d8e2d8782874dc6064178871ccd371f1b"),
    "tests/issue_type_file.rs": ("A", "aa52f2cfc87a14ec3d1e0279297b8d80c2e383dae3146e67ac0bbdc28f321995"),
}
BUILD_COMMAND = ["cargo", "test", "--locked", "--no-run", "--message-format=json"]
PROFILES = {"CARGO_PROFILE_DEV_DEBUG": "0", "CARGO_PROFILE_TEST_DEBUG": "0", "CARGO_INCREMENTAL": "0"}
BUILD_SECONDS = 1800
WORK_SECONDS = 1790
MAX_TARGET_BYTES = 8 * 1024 * 1024 * 1024
MAX_TARGET_FILES = 100000


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as reader:
        for block in iter(lambda: reader.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_support(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file(),
            "Support helper must be an ordinary absolute file")
    require(sha(path) == SUPPORT_SHA256, "Reviewed support helper differs")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("reviewed_checkpoint_build_support", path)
    require(spec is not None and spec.loader is not None, "Cannot import reviewed support")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_delta(data):
    parts = data.split(b"\0")
    require(parts[-1] == b"" and (len(parts) - 1) % 2 == 0, "Malformed Git file delta")
    result = {}
    for i in range(0, len(parts) - 1, 2):
        status, path = parts[i].decode("ascii"), parts[i + 1].decode("utf-8")
        require(path not in result, "Duplicate Git delta path")
        result[path] = status
    return result


def compiled_outputs(B, log, metadata, source, target, root):
    package = next(p for p in metadata["packages"] if p["manifest_path"] == str(source / "Cargo.toml"))
    require(package["name"] == "bead-rs", "Unexpected root package")
    targets = {}
    expected_harnesses = set()
    for item in package["targets"]:
        kinds = item["kind"]
        require(len(kinds) == 1, "Unexpected root target kind")
        kind = kinds[0]
        name = item["name"]
        key = kind + ":" + name
        require(key not in targets, "Duplicate package target")
        targets[key] = item
        if kind in ("lib", "bin", "test") and item["test"]:
            require(not item.get("required-features"), "Default test target has unbound required features")
            expected_harnesses.add(key)
    found = {}
    finished = []
    with log.open("r", encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            row = json.loads(line, object_pairs_hook=B.unique_object)
            if row.get("reason") == "build-finished":
                finished.append(row.get("success"))
            if row.get("reason") != "compiler-artifact" or not row.get("executable"):
                continue
            if row.get("package_id") != package["id"]:
                continue
            info = row["target"]
            require(len(info["kind"]) == 1, "Unexpected executable target kind")
            kind, name = info["kind"][0], info["name"]
            key = kind + ":" + name
            require(key in targets, "Executable target absent from Cargo metadata")
            if row["profile"]["test"] and key in expected_harnesses:
                key = "harness:" + key
            elif not row["profile"]["test"] and kind == "bin":
                key = "binary:" + name
            else:
                continue
            require(key not in found, "Repeated compiled target")
            require(B.safe_existing(Path(row["manifest_path"])) == source / "Cargo.toml",
                    "Executable belongs to another source")
            binary = B.safe_existing(Path(row["executable"]))
            require(binary.is_relative_to(target) and binary.stat().st_size > 0 and os.access(binary, os.X_OK),
                    "Executable leaves the owned target or is unusable")
            if key == "binary:bead":
                require(binary == target / "debug" / "bead", "Unexpected ordinary bead binary path")
            found[key] = {**B.file_record(binary, root), "target_name": name, "target_kind": kind,
                          "test_harness": key.startswith("harness:")}
    require(finished == [True], "Missing unique successful Cargo completion")
    require({key.removeprefix("harness:") for key in found if key.startswith("harness:")}
            == expected_harnesses, "All default test harnesses were not compiled")
    require("binary:bead" in found, "Default native executable was not compiled")
    require(len({v["path"] for v in found.values()}) == len(found), "Executable paths alias")
    return found, sorted(expected_harnesses)


def target_inventory(B, target, root):
    files = {}
    total = 0
    for directory, subdirs, names in os.walk(target, followlinks=False):
        B.safe_existing(Path(directory), directory=True)
        for name in subdirs:
            B.safe_existing(Path(directory) / name, directory=True)
        for name in sorted(names):
            path = B.safe_existing(Path(directory) / name)
            total += path.stat().st_size
            require(total <= MAX_TARGET_BYTES and len(files) < MAX_TARGET_FILES, "Compiled target exceeds archive bound")
            row = B.file_record(path, root)
            row["mtime_ns"] = path.stat().st_mtime_ns
            files[row["path"]] = row
    return files, total


def emit_text_records(B, root, result_names, selected_text=None):
    for name in result_names:
        path = root / name
        if path.is_file():
            data = path.read_bytes()
            require(len(data) <= 256 * 1024, "Result receipt exceeds stdout bound")
            print("CHECKPOINT_LINUX_RECEIPT " + json.dumps({
                "path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                "base64": base64.b64encode(data).decode("ascii")}, sort_keys=True), flush=True)
    for path in sorted((root / "logs").iterdir()):
        if selected_text is not None and path.name not in selected_text:
            continue
        if not path.is_file() or not (path.name.endswith((".stdout", ".stderr", ".jsonl"))):
            continue
        record = B.file_record(path, root)
        if path.stat().st_size <= 256 * 1024:
            data = path.read_bytes()
            try:
                data.decode("utf-8")
            except UnicodeDecodeError:
                continue
            record["base64"] = base64.b64encode(data).decode("ascii")
        print("CHECKPOINT_LINUX_TEXT " + json.dumps(record, sort_keys=True), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--support-helper", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    args = parser.parse_args()
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true", "Hosted Linux only")
    B = load_support(args.support_helper)
    own = B.safe_existing(Path(__file__).absolute())
    request = B.safe_existing(Path(args.inputs))
    require(B.SHA256.fullmatch(args.inputs_sha256) and B.SHA256.fullmatch(args.helper_sha256),
            "Exact input/helper hashes required")
    require(sha(own) == args.helper_sha256 and sha(request) == args.inputs_sha256, "Reviewed bytes changed")
    inputs = B.read_json(request)
    require(inputs.get("schema_version") == 1 and inputs.get("source_commit") == SOURCE_COMMIT
            and inputs.get("source_tree") == SOURCE_TREE and inputs.get("baseline_commit") == BASELINE
            and inputs.get("tests_commit") == TESTS_COMMIT,
            "Unexpected approved source")
    approved = {p: {"status": pair[0], "sha256": pair[1]} for p, pair in EXPECTED_FILES.items()}
    require(inputs.get("approved_files") == approved and inputs.get("profiles") == PROFILES,
            "Approved files/profiles differ")
    checkout = B.safe_existing(Path(args.checkout), directory=True)
    temp = B.safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    run_id, attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"[0-9]+", run_id) and re.fullmatch(r"[1-9][0-9]*", attempt), "Invalid hosted identity")
    root = temp / ("bead-checkpoint-linux-build-" + run_id + "-" + attempt)
    require(not root.exists(), "Fresh build root required")
    for ancestor in (temp, *temp.parents):
        require(not (ancestor / ".git").exists(), "Archive would inherit Git")
    root.mkdir()
    for name in ("logs", "tmp", "target", "release", "release-scratch"):
        (root / name).mkdir()
    source, target = root / "source", root / "target"
    env = B.clean_environment(root)
    env.update(PROFILES)
    env["CARGO_TERM_COLOR"] = "never"
    env["BEAD_BUILD_SCRATCH_ROOT"] = str(root / "release-scratch")
    began = time.monotonic()
    runner = B.Runner(root, env, began + WORK_SECONDS)
    status = {"schema_version": 1, "status": "failed", "operation": "checkpoint-linux-build",
              "helper_sha256": args.helper_sha256, "support_helper_sha256": SUPPORT_SHA256,
              "input_sha256": args.inputs_sha256, "build_root": str(root), "source_root": str(source),
              "target_root": str(target), "source_commit": SOURCE_COMMIT, "source_tree": SOURCE_TREE,
              "baseline_commit": BASELINE, "tests_commit": TESTS_COMMIT,
              "approved_files": approved,
              "profiles": PROFILES, "cargo_build_jobs": 1, "build_seconds": BUILD_SECONDS,
              "started": B.utc(), "tests_executed": False,
              "run": {"id": run_id, "attempt": attempt, "workflow_commit": os.environ["GITHUB_SHA"],
                      "repository": os.environ["GITHUB_REPOSITORY"]}}
    outer = {"schema_version": 1, "status": "failed", "build_root": str(root)}
    B.write_json(root / "attempt-started.json", status)

    def stop(_signal, _frame):
        raise TimeoutError("Owned Linux build deadline or supervisor stop")

    old_alarm = signal.signal(signal.SIGALRM, stop)
    old_term = signal.signal(signal.SIGTERM, stop)
    signal.setitimer(signal.ITIMER_REAL, WORK_SECONDS)
    try:
        shutil.copyfile(request, root / "build-inputs.json")
        require(sha(root / "build-inputs.json") == args.inputs_sha256, "Copied input changed")
        def git(arguments, label):
            return runner.run(["git", "-C", str(checkout), *arguments], checkout, label)
        require(Path(git(["rev-parse", "--show-toplevel"], "git-root").read_text().strip()) == checkout,
                "Wrong checkout root")
        require(not git(["status", "--porcelain=v1", "--untracked-files=all", "-z"], "git-status").read_bytes(),
                "Checkout is not clean")
        require(git(["rev-parse", "HEAD"], "git-head").read_text().strip() == SOURCE_COMMIT,
                "Checkout commit differs")
        require(git(["rev-parse", "HEAD^{tree}"], "git-tree").read_text().strip() == SOURCE_TREE,
                "Checkout tree differs")
        require(git(["rev-list", "--parents", "-n", "1", "HEAD"], "git-parent").read_text().split()
                == [SOURCE_COMMIT, TESTS_COMMIT], "Implementation must descend from accepted tests")
        require(git(["rev-list", "--parents", "-n", "1", TESTS_COMMIT], "git-tests-parent").read_text().split()
                == [TESTS_COMMIT, BASELINE], "Tests must descend from the accepted checkpoint source")
        tests_delta = parse_delta(git(["diff", "--name-status", "--no-renames", "-z", BASELINE, TESTS_COMMIT, "--"],
                                     "git-tests-delta").read_bytes())
        require(tests_delta == {"research/specs/issue-editing-v1.md": "M", "tests/issue_type_file.rs": "A"},
                "Tests-only predecessor changed production source")
        implementation_delta = parse_delta(git(["diff", "--name-status", "--no-renames", "-z", TESTS_COMMIT, SOURCE_COMMIT, "--"],
                                              "git-implementation-delta").read_bytes())
        require(implementation_delta == {p: "M" for p in EXPECTED_FILES if not p.startswith("research/")},
                "Implementation changed unrelated files or accepted specification")
        delta = parse_delta(git(["diff", "--name-status", "--no-renames", "-z", BASELINE, SOURCE_COMMIT, "--"],
                                "git-cumulative-delta").read_bytes())
        require(delta == {p: row[0] for p, row in EXPECTED_FILES.items()}, "Unexpected cumulative source delta")
        git(["diff", "--check", TESTS_COMMIT, SOURCE_COMMIT, "--"], "git-repair-whitespace")
        whitespace = {"schema_version": 1, "status": "passed", "operation": "repair-git-diff-check",
                      "base": TESTS_COMMIT, "source_commit": SOURCE_COMMIT, "exit_code": 0,
                      "command": runner.commands[-1],
                      "stdout": B.file_record(root / "logs" / "git-repair-whitespace.stdout", root),
                      "stderr": B.file_record(root / "logs" / "git-repair-whitespace.stderr", root)}
        B.write_json(root / "repair-whitespace.json", whitespace)
        emit_text_records(B, root, ["repair-whitespace.json"],
                          {"git-repair-whitespace.stdout", "git-repair-whitespace.stderr"})
        git(["diff", "--check", BASELINE, SOURCE_COMMIT, "--"], "git-whitespace")
        listing = git(["ls-tree", "-r", "-z", "--full-tree", "HEAD"], "git-files").read_bytes().split(b"\0")
        tracked = {}
        for entry in listing:
            if not entry:
                continue
            head, raw_name = entry.split(b"\t", 1)
            mode, kind, blob = head.decode("ascii").split()
            name = raw_name.decode("utf-8")
            B.relative_path(name)
            require(kind == "blob" and mode in ("100644", "100755") and name not in tracked,
                    "Unsupported tracked source entry")
            tracked[name] = {"git_mode": mode, "git_blob": blob}
        archive = root / "source.tar"
        runner.run(["git", "-C", str(checkout), "archive", "--format=tar", SOURCE_COMMIT], checkout, "git-archive", archive)
        files = B.extract_source(archive, source, tracked)
        for name, row in approved.items():
            require(files[name]["sha256"] == row["sha256"], "Approved source bytes differ: " + name)
        for name, row in files.items():
            row["mtime_ns"] = (source / name).stat().st_mtime_ns
        B.write_json(root / "source-files.json", {"schema_version": 1, "source_commit": SOURCE_COMMIT,
                                                "source_tree": SOURCE_TREE, "files": files})
        rustc = runner.run(["rustc", "--version"], source, "rustc-version").read_text().strip()
        cargo = runner.run(["cargo", "--version"], source, "cargo-version").read_text().strip()
        require(re.fullmatch(r"rustc 1\.100\.0 \([^\n]+\)", rustc)
                and re.fullmatch(r"cargo 1\.100\.0 \([^\n]+\)", cargo), "Rust/Cargo1.100.0 required")
        status["toolchain"] = {"rustc": rustc, "cargo": cargo}
        runner.run(["cargo", "fmt", "--all", "--", "--check"], source, "cargo-fmt")
        formatting = {"schema_version": 1, "status": "passed", "operation": "repaired-source-format-check",
                      "source_commit": SOURCE_COMMIT, "exit_code": 0, "command": runner.commands[-1],
                      "stdout": B.file_record(root / "logs" / "cargo-fmt.stdout", root),
                      "stderr": B.file_record(root / "logs" / "cargo-fmt.stderr", root)}
        B.write_json(root / "format-check.json", formatting)
        emit_text_records(B, root, ["format-check.json"], {"cargo-fmt.stdout", "cargo-fmt.stderr"})
        runner.run(["cargo", "clippy", "--locked", "--all-targets", "--", "-D", "warnings"], source, "cargo-clippy")
        metadata_log = runner.run(["cargo", "metadata", "--locked", "--no-deps", "--format-version", "1"],
                                  source, "cargo-metadata")
        metadata = B.read_json(metadata_log)
        require(metadata["target_directory"] == str(target) and metadata["workspace_root"] == str(source),
                "Cargo target or workspace redirected")
        compile_log = runner.run(BUILD_COMMAND, source, "cargo-all-default-no-run", root / "logs" / "cargo.stdout.jsonl")
        executables, harnesses = compiled_outputs(B, compile_log, metadata, source, target, root)
        status["executables"] = executables
        status["default_harnesses"] = harnesses
        status["compile_command"] = BUILD_COMMAND
        generated = root / "generated-man"
        generator = root / executables["binary:generate-man-pages"]["path"]
        runner.run([str(generator), str(generated)], source, "generate-man-pages")
        generated_update = generated / "bead-update.1"
        require(generated_update.read_bytes() == (source / "man/man1/bead-update.1").read_bytes(),
                "Tracked update man page differs from the actual generator")
        status["generated_update_man_sha256"] = sha(generated_update)
        shutil.rmtree(generated)
        pin_name = "bead-editing-" + SOURCE_COMMIT[:7] + "-linux-20261125"
        runner.run(["bash", "scripts/build-from-archive.sh", SOURCE_COMMIT,
                    "--target", "x86_64-unknown-linux-gnu", "--name", pin_name,
                    "--out", str(root / "release")], checkout, "archive-release-build")
        release = B.safe_existing(root / "release" / pin_name)
        release_meta = B.safe_existing(root / "release" / (pin_name + ".metadata.json"))
        meta = B.read_json(release_meta)
        require(meta["git_commit_sha"] == SOURCE_COMMIT and meta["build_target"] == "x86_64-unknown-linux-gnu"
                and meta["source"] == "git-archive" and meta["build_features"] == "default"
                and meta["build_profile"] == "release" and meta["execution_verification"] == "executed",
                "Archive release provenance differs")
        require(meta["binary_sha256"] == sha(release) and meta["binary_size_bytes"] == release.stat().st_size,
                "Archive release bytes differ")
        version = runner.run([str(release), "--version"], root / "tmp", "release-version").read_text().strip()
        require(version == meta["embedded_version_string"] and version, "Release version differs")
        status["release"] = {"binary": B.file_record(release, root), "metadata": B.file_record(release_meta, root),
                             "version": version, "target": "x86_64-unknown-linux-gnu"}
        require(not list((root / "release-scratch").iterdir()), "Archive build left unexpected scratch after success")
        for name, row in files.items():
            require(B.file_record(source / name, source) == {key: row[key] for key in ("path", "sha256", "bytes", "mode")},
                    "Build changed tracked source: " + name)
        require(not (source / ".git").exists(), "Archive inherited Git")
        require(not git(["status", "--porcelain=v1", "--untracked-files=all", "-z"], "git-status-after").read_bytes(),
                "Archive release build changed checkout")
        target_files, target_bytes = target_inventory(B, target, root)
        B.write_json(root / "target-files.json", {"schema_version": 1, "files": target_files, "bytes": target_bytes})
        status["source_archive"] = B.file_record(archive, root)
        status["source_files"] = B.file_record(root / "source-files.json", root)
        status["target_files"] = B.file_record(root / "target-files.json", root)
        status["target_bytes"] = target_bytes
        status["status"] = "passed"
        status["commands"] = runner.commands
        status["process_group_cleanup"] = runner.cleanup
        status["finished"] = B.utc()
        status["duration_seconds"] = round(time.monotonic() - began, 3)
        B.write_json(root / "build-result.json", status)
        names = {"source.tar", "source-files.json", "target-files.json", "build-inputs.json",
                 "build-result.json", "attempt-started.json", "repair-whitespace.json", "format-check.json"}
        names.update(path.relative_to(root).as_posix() for path in (root / "logs").iterdir())
        names.update(target_files)
        names.update(row["path"] for row in status["release"].values() if isinstance(row, dict))
        bundle = root / "qualification-bundle.tar.gz"
        with tarfile.open(bundle, "x:gz", compresslevel=1, dereference=True) as tar:
            for name in sorted(names):
                B.relative_path(name)
                B.safe_existing(root / name)
                tar.add(root / name, arcname=name, recursive=False)
        outer.update({"status": "passed", "build_result_sha256": sha(root / "build-result.json"),
                      "bundle": B.file_record(bundle, root)})
        for directory_name in ("public-original",):
            (root / directory_name).mkdir()
        original_pointer = source / ".beads" / "checkpoint" / "current.json"
        original = B.read_json(original_pointer)
        original_root = original["active_root"]["path"]
        require(original_root == "objects/4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d.jsonl",
                "Public original pointer changed in the source archive")
        for name in ("current.json", original_root):
            origin = source / ".beads" / "checkpoint" / name
            destination = root / "public-original" / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origin, destination)
            require(sha(origin) == sha(destination), "Copied public source changed")
        require(sha(own) == args.helper_sha256 and sha(request) == args.inputs_sha256,
                "Reviewed inputs changed during compilation")
    except BaseException as error:
        outer["status"] = "failed"
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
        status["finished"] = B.utc()
        status["duration_seconds"] = round(time.monotonic() - began, 3)
        if not (root / "build-result.json").exists():
            B.write_json(root / "build-result.json", status)
        if any(row["signals"] or row["remaining"] for row in runner.cleanup):
            outer["status"] = "failed"
            outer["error"] = "Owned build process group did not finish cleanly"
        if time.monotonic() - began > BUILD_SECONDS:
            outer["status"] = "failed"
            outer["error"] = "Build exceeded its 1800-second deadline"
        outer["finished"] = B.utc()
        outer["duration_seconds"] = round(time.monotonic() - began, 3)
        outer["logs_retention_days_required"] = 7
        B.write_json(root / "result.json", outer)
        emit_text_records(B, root, ["build-result.json", "result.json"])
    return 0 if outer["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
