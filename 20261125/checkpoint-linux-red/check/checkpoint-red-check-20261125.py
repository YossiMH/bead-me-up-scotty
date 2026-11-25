#!/usr/bin/env python3
"""Validate six specific Red regressions using separately accepted compiled artifacts."""
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

SOURCE_COMMIT = "a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8"
SOURCE_TREE = "c9707f7b58dd76826244719af018bf4c02a3e5fc"
BASELINE = "986f2a332aca9dd567eee41ce835917d56e29468"
BUILD_HELPER_SHA256 = "db9b710e0b181a348d3a84602d37c1e4bad2f373a46940d0d40863c93b0081f0"
BUILD_INPUTS_SHA256 = "57d129f2abd63797418f9950a2e20abe72466aafd2584ba203d317c9ee530ba3"
PREFIX = "service::checkpoint::set_v2::tests::"
EXPECTED = {
    PREFIX + "set_v2_staging_counts_attempt_outcomes_across_shards":
        ("src/service/checkpoint/set_v2.rs", 1365, "count"),
    PREFIX + "set_v2_staging_rejects_duplicate_attempts_within_a_shard":
        ("src/service/checkpoint/set_v2.rs", 1378, "duplicate"),
    PREFIX + "set_v2_staging_rejects_duplicate_attempts_across_shards":
        ("src/service/checkpoint/set_v2.rs", 1392, "duplicate"),
    "verified_restore_preserves_all_attempt_outcomes_from_set_v2":
        ("tests/attempt_receipt_checkpoint_integrity.rs", 276, "restore"),
    "selected_set_v2_generation_remains_restorable_after_tail_append":
        ("tests/checkpoint_tail_generation_integrity.rs", 126, "tail"),
    "legacy_fixed_tail_generation_remains_restorable_after_upgrade":
        ("tests/checkpoint_tail_generation_integrity.rs", 126, "tail"),
}
HARNESSES = [
    ("lib", [PREFIX + "set_v2_staging_", "--test-threads=1", "--nocapture"],
     {name for name in EXPECTED if name.startswith(PREFIX)}),
    ("attempt_receipt_checkpoint_integrity",
     ["verified_restore_preserves_all_attempt_outcomes_from_set_v2", "--exact", "--test-threads=1", "--nocapture"],
     {"verified_restore_preserves_all_attempt_outcomes_from_set_v2"}),
    ("checkpoint_tail_generation_integrity", ["--test-threads=1", "--nocapture"],
     {name for name, (_, _, kind) in EXPECTED.items() if kind == "tail"}),
]
OVERALL_SECONDS = 1200
HARNESS_SECONDS = 300
MAX_BUNDLE_BYTES = 3 * 1024 * 1024 * 1024


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_build_helper(path):
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file(),
            "Build helper must be an ordinary absolute file")
    require(sha(path) == BUILD_HELPER_SHA256, "Reviewed build helper differs")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("checkpoint_reviewed_build_helper", path)
    require(spec is not None and spec.loader is not None, "Cannot import reviewed definitions")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    return helper


def extract_bundle(B, archive, root):
    files = set()
    total = 0
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle:
            name = member.name.rstrip("/") if member.isdir() else member.name
            relative = B.relative_path(name)
            target = root.joinpath(*relative.parts)
            require(target.is_relative_to(root), "Bundle path escapes owned root")
            require(not member.issym() and not member.islnk(), "Bundle links are forbidden")
            require(member.isdir() or member.isfile(), "Bundle special files are forbidden")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            require(name not in files, "Duplicate bundle member")
            require(not name.startswith(("source/", "tmp/")) and name != "result.json",
                    "Unexpected bundle payload namespace")
            total += member.size
            require(0 <= member.size and total <= MAX_BUNDLE_BYTES and len(files) < 2000,
                    "Bundle exceeds reviewed bounds")
            require(member.mode == member.mode & 0o777, "Unsafe bundle mode")
            target.parent.mkdir(parents=True, exist_ok=True)
            stream = bundle.extractfile(member)
            require(stream is not None, "Bundle member has no bytes")
            with stream, target.open("xb") as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            os.chmod(target, member.mode)
            require(target.stat().st_size == member.size, "Bundle member length mismatch")
            B.safe_existing(target)
            files.add(name)
    return files


def check_record(B, root, record):
    path = root.joinpath(*B.relative_path(record["path"]).parts)
    require(B.file_record(path, root) == record, "File record differs: " + record["path"])
    return path


def classify(stdout, stderr, source, expected):
    summary = list(re.finditer(
        r"(?m)^test result: FAILED\. (\d+) passed; (\d+) failed; (\d+) ignored; "
        r"(\d+) measured; (\d+) filtered out; finished in [^\r\n]+$", stdout))
    require(len(summary) == 1, "No unique normal FAILED libtest summary")
    values = tuple(int(summary[0].group(index)) for index in range(1, 6))
    require(values[:4] == (0, len(expected), 0, 0), "Unexpected pass/failure/ignored counts")
    require(re.findall(r"(?m)^running (\d+) tests?$", stdout) == [str(len(expected))],
            "Unexpected libtest running count")
    prefix = stdout[:summary[0].start()]
    require("failures:\n" in prefix, "Missing failed-test name list")
    failed = [line.strip() for line in prefix.rsplit("failures:\n", 1)[1].splitlines() if line.strip()]
    require(len(failed) == len(expected) and set(failed) == expected, "Unexpected failed test names")
    combined = stdout + "\n" + stderr
    headers = list(re.finditer(
        r"(?m)^thread '([^'\r\n]+)'(?: \([0-9]+\))? panicked at (.+):([0-9]+):([0-9]+):\r?$",
        combined))
    require(len(headers) == len(expected) and {match.group(1) for match in headers} == expected,
            "Unexpected panic threads or duplicate panic blocks")
    observations = []
    for index, header in enumerate(headers):
        name = header.group(1)
        end = headers[index + 1].start() if index + 1 < len(headers) else len(combined)
        block = combined[header.end():end]
        relative, line, kind = EXPECTED[name]
        require(header.group(2) in (relative, str(source / relative)) and int(header.group(3)) == line,
                "Panic occurred at an unintended source location: " + name)
        if kind == "count":
            require(re.search(r"assertion .*left == right.* failed", block)
                    and re.search(r"left:\s*0\s+right:\s*2(?:\s|$)", block),
                    "Count test did not expose zero-versus-two")
        elif kind == "duplicate":
            require(re.search(r"called .Result::unwrap_err\(\). on an .Ok. value", block)
                    and "urn:fixture:attempt:duplicate" in block,
                    "Duplicate test did not expose accepted duplicate attempts")
        elif kind == "restore":
            mismatch = re.search(
                r"Unverified restore source: pointer counts \(issues=(\d+), events=(\d+), "
                r"receipts=(\d+), attempt outcomes=2, redaction records=(\d+)\) disagree with "
                r"staged records \((\d+), (\d+), (\d+), 0, (\d+)\)", block)
            require(mismatch is not None, "Restore did not expose the exact outcome-count mismatch")
            require(mismatch.groups()[:4] == mismatch.groups()[4:], "Restore failed for another count difference")
        else:
            require("selected tail bytes changed after append" in block,
                    "Tail failed before the intended retention assertion")
        observations.append({"test": name, "source": relative, "line": line, "defect": kind,
                             "panic_sha256": hashlib.sha256(block.encode("utf-8")).hexdigest()})
    return {"status": "matched_expected_failures", "failed": len(expected), "passed": 0,
            "ignored": 0, "observations": sorted(observations, key=lambda row: row["test"])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-directory", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    parser.add_argument("--build-helper", required=True)
    args = parser.parse_args()
    require(sys.platform == "linux", "Hosted Linux only")
    require(re.fullmatch(r"[a-f0-9]{64}", args.inputs_sha256)
            and re.fullmatch(r"[a-f0-9]{64}", args.helper_sha256), "Missing exact request hashes")
    own = Path(__file__).absolute()
    require(own.resolve(strict=True) == own and sha(own) == args.helper_sha256, "Checker differs")
    B = load_build_helper(Path(args.build_helper))
    request_path = B.safe_existing(Path(args.inputs))
    require(request_path.stat().st_size <= 1024 * 1024 and sha(request_path) == args.inputs_sha256, "Inputs differ")
    request = B.read_json(request_path)
    require(request["schema_version"] == 1 and request["source_commit"] == SOURCE_COMMIT
            and request["source_tree"] == SOURCE_TREE and request["baseline_commit"] == BASELINE,
            "Unexpected accepted source identity")
    require(request["build_helper_sha256"] == BUILD_HELPER_SHA256
            and request["build_inputs_sha256"] == BUILD_INPUTS_SHA256, "Unaccepted compiler helper or inputs")
    for key in ("outer_result_sha256", "compile_result_sha256"):
        require(isinstance(request.get(key), str) and B.SHA256.fullmatch(request[key]), "Missing accepted " + key)
    require(isinstance(request.get("artifact_id"), int) and request["artifact_id"] > 0, "Missing exact artifact ID")
    producing = request["run"]
    require(producing["repository"] == "YossiMH/bead-me-up-scotty"
            and re.fullmatch(r"[0-9]+", producing["id"])
            and re.fullmatch(r"[1-9][0-9]*", producing["attempt"])
            and B.SHA1.fullmatch(producing["workflow_commit"]), "Missing producing run identity")
    artifact = B.safe_existing(Path(args.artifact_directory), directory=True)
    outer_path = B.safe_existing(artifact / "result.json")
    require(sha(outer_path) == request["outer_result_sha256"], "Accepted outer receipt differs")
    outer = B.read_json(outer_path)
    require(outer["status"] == "passed" and outer["compile_result_sha256"] == request["compile_result_sha256"],
            "Compilation/package was not accepted")
    require(sha(B.safe_existing(artifact / "build-result.json")) == request["compile_result_sha256"],
            "Downloaded compile receipt differs")
    require(outer["bundle"]["path"] == "compile-bundle.tar.gz", "Unexpected bundle path")
    require({key: outer["bundle"][key] for key in ("sha256", "bytes")} == request["bundle"],
            "Bundle does not match accepted input")
    bundle_path = B.safe_existing(artifact / "compile-bundle.tar.gz")
    require(sha(bundle_path) == request["bundle"]["sha256"]
            and bundle_path.stat().st_size == request["bundle"]["bytes"], "Bundle bytes differ")
    runner_temp = B.safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    build_root = runner_temp / ("bead-checkpoint-red-build-" + producing["id"] + "-" + producing["attempt"])
    require(str(build_root) == outer["build_root"] and not build_root.exists(),
            "Exact compiled build root is unavailable or already exists")
    check_id, check_attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"[0-9]+", check_id) and re.fullmatch(r"[1-9][0-9]*", check_attempt), "Invalid check run")
    check_root = runner_temp / ("bead-checkpoint-red-check-" + check_id + "-" + check_attempt)
    require(not check_root.exists() and artifact != build_root and not artifact.is_relative_to(build_root),
            "Use fresh separate owned output roots")
    for ancestor in (build_root.parent, *build_root.parent.parents):
        require(not (ancestor / ".git").exists(), "Restored build would inherit another Git workspace")
    check_root.mkdir()
    (check_root / "logs").mkdir()
    build_root.mkdir()
    began = time.monotonic()
    result = {"schema_version": 1, "status": "failed", "operation": "checkpoint-red-check",
              "input_sha256": args.inputs_sha256, "helper_sha256": args.helper_sha256,
              "build_helper_sha256": BUILD_HELPER_SHA256, "build_root": str(build_root),
              "check_root": str(check_root), "artifact_id": request["artifact_id"], "producing_run": producing,
              "source_commit": SOURCE_COMMIT, "source_tree": SOURCE_TREE,
              "run": {"repository": os.environ["GITHUB_REPOSITORY"], "id": check_id,
                      "attempt": check_attempt, "workflow_commit": os.environ["GITHUB_SHA"]},
              "started": B.utc(), "harness_limit_seconds": HARNESS_SECONDS,
              "overall_limit_seconds": OVERALL_SECONDS, "harnesses": [], "failed_test_count": 0, "passed_test_count": 0}
    B.write_json(check_root / "attempt-started.json", result)
    runner = None
    source_files = None
    executable_records = None
    source = build_root / "source"

    def timed_out(_signal, _frame):
        raise TimeoutError("Checker deadline or termination received")

    old_alarm = signal.signal(signal.SIGALRM, timed_out)
    old_term = signal.signal(signal.SIGTERM, timed_out)
    signal.setitimer(signal.ITIMER_REAL, OVERALL_SECONDS - 10)
    try:
        bundle_files = extract_bundle(B, bundle_path, build_root)
        compile_path = B.safe_existing(build_root / "build-result.json")
        require(sha(compile_path) == request["compile_result_sha256"], "Compile receipt bytes differ")
        compiled = B.read_json(compile_path)
        require(compiled["schema_version"] == 1 and compiled["status"] == "passed"
                and compiled["operation"] == "checkpoint-red-compile-only"
                and compiled["helper_sha256"] == BUILD_HELPER_SHA256
                and compiled["input_sha256"] == BUILD_INPUTS_SHA256, "Compile receipt is not the accepted build")
        require(compiled["tests_executed"] is False and compiled["product_executed"] is False,
                "Compile result crossed the execution boundary")
        require(all(compiled["run"][key] == value for key, value in producing.items()), "Producing run differs")
        require(compiled["build_root"] == str(build_root) and compiled["source_root"] == str(source)
                and compiled["target_root"] == str(build_root / "target"), "Compile-time absolute roots differ")
        require(compiled["command"] == B.COMMAND, "Unexpected compilation command")
        require(compiled["source"]["commit"] == SOURCE_COMMIT and compiled["source"]["tree"] == SOURCE_TREE
                and compiled["source"]["baseline_commit"] == BASELINE, "Compiled source differs")
        require(not any(row["signals"] or row["remaining"] for row in compiled["process_group_cleanup"]),
                "Compilation needed descendant cleanup")
        require(sha(build_root / "build-inputs.json") == BUILD_INPUTS_SHA256, "Actual build inputs differ")
        build_inputs = B.read_json(build_root / "build-inputs.json")
        require(build_inputs["source_commit"] == SOURCE_COMMIT and build_inputs["source_tree"] == SOURCE_TREE,
                "Build input source mismatch")
        require(compiled["source"]["repository"] == "YossiMH/bead-rs"
                and compiled["source"]["approved_files"] == build_inputs["approved_files"]
                and compiled["source"]["production_prefix"] == build_inputs["production_prefix"],
                "Build source pin report differs from actual inputs")
        source_manifest = B.safe_existing(build_root / "source-files.json")
        require(sha(source_manifest) == compiled["source"]["files_manifest_sha256"], "Source manifest differs")
        manifest = B.read_json(source_manifest)
        require(manifest["schema_version"] == 1 and manifest["source_commit"] == SOURCE_COMMIT
                and manifest["source_tree"] == SOURCE_TREE, "Source manifest identity mismatch")
        source_files = manifest["files"]
        for name, record in source_files.items():
            B.relative_path(name)
            require(record["path"] == name and B.SHA1.fullmatch(record["git_blob"])
                    and B.SHA256.fullmatch(record["sha256"]), "Malformed source file record")
        tracked = {name: {key: row[key] for key in ("git_mode", "git_blob")} for name, row in source_files.items()}
        archive = B.safe_existing(build_root / "source.tar")
        require(sha(archive) == compiled["source"]["archive_sha256"]
                and archive.stat().st_size == compiled["source"]["archive_bytes"], "Source archive differs")
        restored = B.extract_source(archive, source, tracked)
        require(restored == source_files, "Recreated source differs in bytes or modes")
        for name, pin in build_inputs["approved_files"].items():
            require(source_files[name]["sha256"] == pin["sha256"], "Approved tests differ")
        executable_records = compiled["executables"]
        actual = B.compiled_outputs(build_root / "logs" / "cargo.stdout.jsonl", source, build_root / "target", build_root)
        require(actual == executable_records, "Cargo artifact identities differ from compile receipt")
        expected_bundle = {"source.tar", "source-files.json", "build-inputs.json", "build-result.json", "attempt-started.json"}
        expected_bundle.update(row["path"] for row in executable_records.values())
        for name in bundle_files - expected_bundle:
            relative = B.relative_path(name)
            require(len(relative.parts) == 2 and relative.parts[0] == "logs", "Unlisted bundle payload")
        require(expected_bundle <= bundle_files, "Missing required bundle payload")
        (build_root / "tmp").mkdir()
        env = B.clean_environment(build_root)
        env["CARGO_BIN_EXE_bead"] = str(check_record(B, build_root, executable_records["bead"]))
        env["CARGO_TERM_COLOR"] = "never"
        env["RUST_BACKTRACE"] = "0"
        runner = B.Runner(check_root, env, began + OVERALL_SECONDS - 10)
        for name, arguments, expected in HARNESSES:
            binary = check_record(B, build_root, executable_records[name])
            started = time.monotonic()
            runner.deadline = min(started + HARNESS_SECONDS - 5, began + OVERALL_SECONDS - 10)
            label = "harness-" + name
            normal_failure = False
            try:
                runner.run([str(binary), *arguments], source, label)
            except RuntimeError as error:
                record = runner.commands[-1] if runner.commands else {}
                normal_failure = str(error) == label + " exited 101" and record.get("exit_code") == 101
                require(normal_failure and not record.get("cleanup"), "Unsafe harness failure: " + str(error))
            duration = time.monotonic() - started
            require(duration <= HARNESS_SECONDS and not any(row["signals"] or row["remaining"] for row in runner.cleanup),
                    "Harness exceeded its owned execution bound")
            stdout_path, stderr_path = check_root / "logs" / (label + ".stdout"), check_root / "logs" / (label + ".stderr")
            require(stdout_path.stat().st_size <= 16 * 1024 * 1024 and stderr_path.stat().st_size <= 16 * 1024 * 1024,
                    "Harness output exceeded bounds")
            observation = {"name": name, "args": arguments, "exit_code": runner.commands[-1]["exit_code"],
                           "duration_seconds": round(duration, 3),
                           "stdout": B.file_record(stdout_path, check_root), "stderr": B.file_record(stderr_path, check_root)}
            try:
                require(normal_failure, "Harness unexpectedly succeeded")
                observation.update(classify(stdout_path.read_text(encoding="utf-8"),
                                            stderr_path.read_text(encoding="utf-8"), source, expected))
            except RuntimeError as error:
                observation.update({"status": "unexpected_outcome", "error": str(error)})
            result["harnesses"].append(observation)
        require(len(result["harnesses"]) == 3 and all(row["status"] == "matched_expected_failures"
                                                    for row in result["harnesses"]), "Expected Red failures were not all established")
        require(sum(row["failed"] for row in result["harnesses"]) == 6, "Expected exactly six failures")
        result["status"] = "passed_expected_failures"
        result["failed_test_count"] = 6
        result["passed_test_count"] = 0
    except BaseException as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if runner is not None and runner.active is not None:
            runner.stop_group(runner.active, "final-cleanup")
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_alarm)
        signal.signal(signal.SIGTERM, old_term)
        try:
            if source_files is not None and source.exists():
                for name, record in source_files.items():
                    require(B.file_record(source / name, source) == {key: record[key] for key in ("path", "sha256", "bytes", "mode")},
                            "Checks modified source: " + name)
            if executable_records is not None:
                for record in executable_records.values():
                    check_record(B, build_root, record)
            require(sha(own) == args.helper_sha256 and sha(request_path) == args.inputs_sha256
                    and sha(Path(args.build_helper)) == BUILD_HELPER_SHA256, "Reviewed helper or inputs changed")
        except BaseException as error:
            result["status"] = "failed"
            result["preservation_error"] = str(error)
        if runner is not None:
            result["commands"] = runner.commands
            result["process_group_cleanup"] = runner.cleanup
            if any(row["signals"] or row["remaining"] for row in runner.cleanup):
                result["status"] = "failed"
        result["finished"] = B.utc()
        result["duration_seconds"] = round(time.monotonic() - began, 3)
        if result["duration_seconds"] > OVERALL_SECONDS:
            result["status"] = "failed"
            result["deadline_exceeded"] = True
        result["logs_retention_days_required"] = 7
        output = check_root / "result.json"
        B.write_json(output, result)
        data = output.read_bytes()
        require(len(data) <= 256 * 1024, "Check receipt exceeds stdout bound")
        print("CHECKPOINT_RED_RESULT_SHA256 " + hashlib.sha256(data).hexdigest(), flush=True)
        print("CHECKPOINT_RED_RESULT_BASE64 " + base64.b64encode(data).decode("ascii"), flush=True)
        print(json.dumps(result, sort_keys=True), flush=True)
    return 0 if result["status"] == "passed_expected_failures" else 1


if __name__ == "__main__":
    sys.exit(main())
