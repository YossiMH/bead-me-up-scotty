#!/usr/bin/env python3
"""Qualify separately accepted Windows binaries under the reviewed outer Job."""
import argparse
import ctypes
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile
import time

SMOKE_SHA256 = "2a29faa7df3e9c04dd7543a5f8fd54552dd34c83248c1eda0d427e8f1a215a0b"
ORIGINAL_COMMIT = "afac9fa0ce9533a707d745018d16a25e4ccff492"
ORIGINAL_ROOT = "4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d"
ORIGINAL_POINTER = "f1a2009037599216140c8a6832480e4d869d596f8001c29a6fc0f1788f42aa43"
STAGING_FILTER = "service::checkpoint::set_v2::tests::set_v2_staging_"
EXPECTED_STAGING = {
    STAGING_FILTER + "counts_attempt_outcomes_across_shards",
    STAGING_FILTER + "rejects_duplicate_attempts_within_a_shard",
    STAGING_FILTER + "rejects_duplicate_attempts_across_shards",
}
REQUIRED_TESTS = {
    "lib": EXPECTED_STAGING,
    "attempt_receipt_checkpoint_integrity": {"verified_restore_preserves_all_attempt_outcomes_from_set_v2"},
    "checkpoint_tail_generation_integrity": {
        "selected_set_v2_generation_remains_restorable_after_tail_append",
        "legacy_fixed_tail_generation_remains_restorable_after_upgrade",
    },
}
WORK_SECONDS = 8400
HARNESSES = ["lib", "attempt_receipt_checkpoint_integrity", "checkpoint_tail_generation_integrity",
             "checkpoint_set_v2_conformance", "attempt_outcome_round_trip", "r036_verified_restore"]


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def object_pairs(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate input key")
        result[key] = value
    return result


def load_build(path, expected):
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file()
            and sha(path) == expected, "Exact accepted build helper differs")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("reviewed_windows_build", path)
    require(spec is not None and spec.loader is not None, "Cannot import reviewed build definitions")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_record(B, root, row):
    path = root.joinpath(*B.relative_path(row["path"]).parts)
    require(B.file_record(path, root) == row, "Retained file differs: " + row["path"])
    return path


def extract_bundle(B, archive, root):
    files, total = set(), 0
    with tarfile.open(archive, "r:gz") as tar:
        for member in tar:
            name = member.name.rstrip("/") if member.isdir() else member.name
            relative = B.relative_path(name)
            target = root.joinpath(*relative.parts)
            require(target.is_relative_to(root) and not member.issym() and not member.islnk()
                    and (member.isdir() or member.isfile()), "Unsafe bundle member")
            require(not name.lower().startswith(("source/", "tmp/")) and name.lower() != "result.json",
                    "Unexpected bundle namespace")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                B.safe_existing(target, directory=True)
                continue
            require(name.lower() not in files, "Case-aliased bundle member")
            files.add(name.lower())
            total += member.size
            require(0 <= member.size and total <= B.MAX_BUNDLE_BYTES and len(files) < 2000,
                    "Bundle exceeds reviewed bounds")
            require(member.mode == member.mode & 0o777, "Unsafe bundle mode")
            target.parent.mkdir(parents=True, exist_ok=True)
            B.safe_existing(target.parent, directory=True)
            stream = tar.extractfile(member)
            require(stream is not None, "Missing bundle bytes")
            with stream, target.open("xb") as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            os.chmod(target, member.mode)
            require(target.stat().st_size == member.size, "Bundle member size differs")
            B.safe_existing(target)
    return files


def parse_list(text):
    names = re.findall(r"(?m)^(.+): test\r?$", text)
    summary = re.findall(r"(?m)^(\d+) tests?, (\d+) benchmarks?\r?$", text)
    require(len(summary) == 1 and int(summary[0][0]) == len(names) and int(summary[0][1]) == 0
            and len(names) == len(set(names)) and names, "Invalid complete libtest listing")
    return set(names)


def parse_pass(text, expected, key):
    summary = re.findall(
        r"(?m)^test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; "
        r"(\d+) filtered out; finished in [^\r\n]+\r?$", text)
    require(len(summary) == 1, "Missing unique passing libtest summary: " + key)
    counts = tuple(int(value) for value in summary[0])
    require(counts[:4] == (len(expected), 0, 0, 0) and (key == "lib" or counts[4] == 0),
            "Passed/ignored/filtered target counts differ: " + key)
    running = re.findall(r"(?m)^running (\d+) tests?\r?$", text)
    require(running == [str(len(expected))], "Unexpected running count: " + key)
    return {"passed": counts[0], "failed": 0, "ignored": 0, "measured": 0, "filtered": counts[4],
            "tests": sorted(expected)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-directory", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    parser.add_argument("--build-helper", required=True)
    parser.add_argument("--corpus-helper", required=True)
    parser.add_argument("--corpus-inputs", required=True)
    parser.add_argument("--smoke-helper", required=True)
    args = parser.parse_args()
    require(sys.platform == "win32" and ctypes.sizeof(ctypes.c_void_p) == 8, "Hosted Windows x64 only")
    require(re.fullmatch(r"[a-f0-9]{64}", args.helper_sha256)
            and re.fullmatch(r"[a-f0-9]{64}", args.inputs_sha256), "Reviewed input and helper hashes required")
    own, request_path = Path(__file__).absolute(), Path(args.inputs)
    require(own.resolve(strict=True) == own and sha(own) == args.helper_sha256, "Checker bytes differ")
    require(request_path.is_absolute() and request_path.resolve(strict=True) == request_path
            and request_path.stat().st_size <= 1024 * 1024 and sha(request_path) == args.inputs_sha256,
            "Check input bytes differ")
    request = json.loads(request_path.read_text(encoding="utf-8"), object_pairs_hook=object_pairs)
    pin_keys = ("build_helper_sha256", "build_inputs_sha256", "build_result_sha256", "outer_result_sha256",
                "supervisor_result_sha256", "supervisor_completion_sha256", "corpus_helper_sha256",
                "corpus_inputs_sha256")
    require(all(isinstance(request.get(key), str) and re.fullmatch(r"[a-f0-9]{64}", request[key]) for key in pin_keys),
            "An accepted artifact/helper/input pin is missing")
    B = load_build(Path(args.build_helper), request["build_helper_sha256"])
    B.safe_existing(own)
    B.safe_existing(request_path)
    require(request["schema_version"] == 1 and request["target"] == B.TARGET
            and request["baseline_commit"] == B.BASELINE_COMMIT and request["tests_commit"] == B.TESTS_COMMIT
            and request["job_helper_sha256"] == B.JOB_SHA256
            and request["smoke_helper_sha256"] == SMOKE_SHA256, "Unexpected check contract")
    for key in ("source_commit", "source_tree"):
        require(isinstance(request.get(key), str) and B.SHA1.fullmatch(request[key]), "Missing source identity")
    require(isinstance(request.get("artifact_id"), int) and request["artifact_id"] > 0, "Missing exact artifact ID")
    build_run = request["run"]
    require(build_run["repository"] == "YossiMH/bead-me-up-scotty"
            and re.fullmatch(r"[0-9]+", build_run["id"]) and re.fullmatch(r"[1-9][0-9]*", build_run["attempt"])
            and B.SHA1.fullmatch(build_run["workflow_commit"]), "Invalid producing run")
    artifact = B.safe_existing(Path(args.artifact_directory), directory=True)
    corpus_helper = B.safe_existing(Path(args.corpus_helper))
    corpus_inputs = B.safe_existing(Path(args.corpus_inputs))
    smoke_helper = B.safe_existing(Path(args.smoke_helper))
    require(sha(corpus_helper) == request["corpus_helper_sha256"] and sha(corpus_inputs) == request["corpus_inputs_sha256"]
            and sha(smoke_helper) == SMOKE_SHA256, "A reviewed qualification helper differs")
    for filename, key in (("result.json", "outer_result_sha256"), ("build-result.json", "build_result_sha256"),
                          ("supervisor-result.json", "supervisor_result_sha256"),
                          ("supervisor-completion.json", "supervisor_completion_sha256")):
        require(sha(B.safe_existing(artifact / filename)) == request[key], "Accepted receipt differs: " + filename)
    outer, build = B.read_json(artifact / "result.json"), B.read_json(artifact / "build-result.json")
    supervisor = B.read_json(artifact / "supervisor-result.json")
    completion = B.read_json(artifact / "supervisor-completion.json")
    require(outer["status"] == "passed" and outer["build_result_sha256"] == request["build_result_sha256"]
            and build["status"] == "passed" and build["operation"] == "checkpoint-windows-build"
            and build["input_sha256"] == request["build_inputs_sha256"]
            and build["helper_sha256"] == request["build_helper_sha256"] and not build["tests_executed"]
            and build["target"] == B.TARGET and build["source"]["commit"] == request["source_commit"]
            and build["source"]["tree"] == request["source_tree"], "Build was not accepted for these inputs")
    require(all(build["run"][key] == value for key, value in build_run.items()), "Producing run differs")
    require(supervisor["status"] == "passed" and supervisor["phase"] == "build" and supervisor["helper_exit_code"] == 0
            and supervisor["helper_sha256"] == request["build_helper_sha256"]
            and supervisor["inputs_sha256"] == request["build_inputs_sha256"]
            and supervisor["job_helper_sha256"] == B.JOB_SHA256
            and supervisor["owned_children_remaining"] == 0 and supervisor["owned_children_empty_before_outer_exit"],
            "Build Job did not reach child quiescence")
    require(completion["status"] == "passed" and completion["phase"] == "build"
            and completion["supervisor_exit_code"] == 0 and completion["supervisor_process_exited"]
            and completion["supervisor_result_sha256"] == request["supervisor_result_sha256"]
            and completion["owned_job_empty_after_supervisor_exit"], "Build supervisor completion is unverified")
    bundle = B.safe_existing(artifact / "windows-build-bundle.tar.gz")
    require(outer["bundle"]["path"] == bundle.name and outer["bundle"]["sha256"] == request["bundle"]["sha256"]
            and outer["bundle"]["bytes"] == request["bundle"]["bytes"]
            and sha(bundle) == request["bundle"]["sha256"] and bundle.stat().st_size == request["bundle"]["bytes"],
            "Exact accepted bundle differs")
    temp = B.safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    restored = temp / ("bead-checkpoint-windows-build-" + build_run["id"] + "-" + build_run["attempt"])
    require(Path(build["build_root"]) == restored and Path(outer["build_root"]) == restored
            and Path(build["source_root"]) == restored / "source" and Path(build["target_root"]) == restored / "target",
            "Retained compile-time paths do not match the owned restoration root")
    require(not restored.exists(), "Compile-time restoration root already exists")
    run = B.hosted_run()
    root = temp / ("bead-checkpoint-windows-check-" + run["id"] + "-" + run["attempt"])
    require(not root.exists(), "Check root exists; do not replay")
    for owned in (restored, root):
        for ancestor in (owned, *owned.parents):
            require(not (ancestor / ".git").exists(), "Restored artifacts would inherit an unrelated Git workspace")
    root.mkdir()
    for name in ("logs", "tmp", "release-under-test"):
        (root / name).mkdir()
    began = time.monotonic()
    runner = B.Runner(root, B.clean_environment(root), began + WORK_SECONDS)
    result = {"schema_version": 1, "status": "failed", "operation": "checkpoint-windows-checks",
              "run": run, "build_run": build_run, "artifact_id": request["artifact_id"],
              "input_sha256": args.inputs_sha256, "helper_sha256": args.helper_sha256,
              "build_result_sha256": request["build_result_sha256"], "source_commit": request["source_commit"],
              "source_tree": request["source_tree"], "target": B.TARGET, "started": B.utc(),
              "owned_job_baseline": runner.baseline_record,
              "test_results": [], "outer_windows_job_verification_required": True}
    B.write_json(root / "attempt-started.json", result)
    source_files, executables, release_path, metadata_path, corpus_root = None, None, None, None, None
    try:
        runner.run([sys.executable, "-m", "py_compile", str(own), args.build_helper, str(corpus_helper)],
                   root, "parse-check-helpers", 60)
        restored.mkdir()
        members = extract_bundle(B, bundle, restored)
        require(sha(restored / "build-result.json") == request["build_result_sha256"]
                and sha(restored / "build-inputs.json") == request["build_inputs_sha256"], "Inner build receipts differ")
        expected_members = {"source.tar", "source-files.json", "build-inputs.json", "build-result.json",
                            "attempt-started.json", "archive-build-script.sh", "activate-msvc.cmd", "emit-msvc-environment.py"}
        expected_members.update(row["path"].lower() for row in build["executables"].values())
        expected_members.update(build["release"][key]["path"].lower() for key in ("executable", "metadata"))
        for command in build["commands"]:
            expected_members.update({command["stdout"].lower(), command["stderr"].lower(),
                                     "logs/" + command["label"] + ".started.json",
                                     "logs/" + command["label"] + ".exit.json"})
        require(members == expected_members, "Bundle contains missing or unreviewed files")
        source_archive = check_record(B, restored, build["source"]["archive"])
        source_manifest = check_record(B, restored, build["source"]["files_manifest"])
        manifest = B.read_json(source_manifest)
        require(manifest["source_commit"] == request["source_commit"] and manifest["source_tree"] == request["source_tree"],
                "Source manifest provenance differs")
        source_files = B.extract_source(source_archive, restored / "source", manifest["files"])
        require(source_files == manifest["files"], "Recreated source bytes/modes/Git blobs differ")
        executables = B.compiled_outputs(restored / "logs" / "cargo.stdout.jsonl", restored / "source",
                                        restored / "target", restored)
        require(executables == build["executables"], "Recreated Cargo outputs differ")
        release_path = check_record(B, restored, build["release"]["executable"])
        metadata_path = check_record(B, restored, build["release"]["metadata"])
        require(check_record(B, restored, build["release"]["archive_script"]).name == "archive-build-script.sh"
                and sha(restored / "archive-build-script.sh") == B.ARCHIVE_SCRIPT_SHA256, "Archive builder identity differs")
        B.pe_x64(release_path)
        native = B.read_json(metadata_path)
        require(native["git_commit_sha"] == request["source_commit"] and native["build_target"] == B.TARGET
                and native["binary_sha256"] == sha(release_path) and native["binary_size_bytes"] == release_path.stat().st_size,
                "Retained release metadata differs")
        for path in (release_path, metadata_path):
            destination = root / "release-under-test" / path.name
            shutil.copyfile(path, destination)
            require(sha(destination) == sha(path), "Release-under-test copy differs")
        result["release_under_test"] = {
            "executable": B.file_record(root / "release-under-test" / release_path.name, root),
            "metadata": B.file_record(root / "release-under-test" / metadata_path.name, root),
        }
        runner.env["CARGO_BIN_EXE_bead"] = str(check_record(B, restored, executables["bead"]))
        for key in HARNESSES:
            target_started = time.monotonic()
            binary = check_record(B, restored, executables[key])
            filters = [STAGING_FILTER] if key == "lib" else []
            listing = runner.run([str(binary), *filters, "--list"], restored / "source", key + "-list", 30)
            names = parse_list(listing.read_text(encoding="utf-8"))
            require(REQUIRED_TESTS.get(key, set()).issubset(names), "A required regression is absent: " + key)
            if key in ("lib", "checkpoint_tail_generation_integrity"):
                require(names == REQUIRED_TESTS[key], "Unexpected focused regression set")
            output = runner.run([str(binary), *filters, "--test-threads=1", "--nocapture"], restored / "source",
                                key + "-tests", max(0, 895 - (time.monotonic() - target_started)),
                                allowed_exits=(0, 101))
            row = {"target": key, "exit_code": runner.commands[-1]["exit_code"],
                   "duration_seconds": round(time.monotonic() - target_started, 3)}
            try:
                require(row["exit_code"] == 0, "Harness failed")
                row.update(parse_pass(output.read_text(encoding="utf-8"), names, key))
                row["status"] = "passed"
            except RuntimeError as error:
                row.update({"status": "failed", "error": str(error)})
            require(row["duration_seconds"] <= 900, "Harness exceeded its complete 900-second target budget")
            result["test_results"].append(row)
        require(len(result["test_results"]) == 6 and all(row["status"] == "passed" for row in result["test_results"]),
                "One or more required Windows test targets failed")
        original = restored / "source" / ".beads" / "checkpoint"
        require(sha(original / "current.json") == ORIGINAL_POINTER
                and sha(original / "objects" / (ORIGINAL_ROOT + ".jsonl")) == ORIGINAL_ROOT,
                "Published original current checkpoint differs")
        corpus_request = B.read_json(corpus_inputs)
        require(corpus_request["source_commit"] == request["source_commit"]
                and corpus_request["source_tree"] == request["source_tree"]
                and corpus_request["release_sha256"] == sha(release_path)
                and corpus_request["release_bytes"] == release_path.stat().st_size
                and corpus_request["metadata_sha256"] == sha(metadata_path) and corpus_request["target"] == B.TARGET
                and corpus_request["original_public_commit"] == ORIGINAL_COMMIT
                and corpus_request["windows_job_helper_sha256"] == B.JOB_SHA256, "Corpus verifier input differs")
        corpus_root = temp / ("bead-checkpoint-windows-corpus-" + run["id"] + "-" + run["attempt"])
        require(not corpus_root.exists(), "Public corpus output already exists")
        runner.run([sys.executable, str(corpus_helper), "--binary", str(release_path), "--metadata", str(metadata_path),
                    "--original-checkpoint", str(original), "--output", str(corpus_root),
                    "--inputs", str(corpus_inputs), "--inputs-sha256", request["corpus_inputs_sha256"],
                    "--helper-sha256", request["corpus_helper_sha256"], "--supervision", "outer-windows-job"],
                   root, "public-corpus", 1200)
        corpus_result = B.read_json(corpus_root / "result.json")
        require(corpus_result["status"] == "passed" and corpus_result["operation"] == "public-original-checkpoint-recovery"
                and corpus_result["verification_restores"] == 4
                and corpus_result["all_original_attempt_outcomes_preserved"] == 413
                and corpus_result["original_public_input_unchanged"] and corpus_result["checkpoint_configuration_unchanged"]
                and corpus_result["cleanup"]["outer_windows_job_verification_required"],
                "Public corpus qualification is incomplete")
        expected_comparisons = {"original_restore", "published_current_restore", "previous_preserved",
                                "isolated_create", "current_restore_after_append", "previous_restore_after_append"}
        require(set(corpus_result["comparisons"]) == expected_comparisons
                and all(row["status"] == "passed" for row in corpus_result["comparisons"].values())
                and corpus_result["original_public_source"]["counts"] == {
                    "issue": 954, "event": 11264, "provenance_receipt": 5, "attempt_outcome": 413}
                and all(not row["remaining"] for row in corpus_result["process_cleanup"]),
                "Corpus comparisons, original counts or native cleanup differ")
        result["public_corpus"] = {"output": str(corpus_root), "result_sha256": sha(corpus_root / "result.json"),
                                   "verification_restores": 4, "original_attempt_outcomes": 413}
        smoke_root, smoke_output = root / "smoke-fixtures", root / "smoke-output"
        require(not smoke_root.exists() and not smoke_output.exists(), "Smoke output already exists")
        powershell = B.safe_existing(Path(os.environ["SystemRoot"]) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe")
        runner.run([str(powershell), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(smoke_helper),
                    "-BeadExe", str(release_path), "-ExpectedSha256", sha(release_path),
                    "-ScratchRoot", str(smoke_root), "-OutputDirectory", str(smoke_output)],
                   root, "native-smoke", 1200)
        smoke_results = list(smoke_output.glob("windows-native-smoke-*.json"))
        require(len(smoke_results) == 1, "Native smoke did not produce one result")
        smoke = B.read_json(smoke_results[0])
        require(smoke["status"] == "passed" and smoke["expected_sha256"] == sha(release_path)
                and len(smoke["commands"]) == 55 and smoke["cleanup"] == "removed_owned_fixtures",
                "Unchanged native editing smoke is incomplete")
        result["native_smoke"] = {"result": str(smoke_results[0]), "sha256": sha(smoke_results[0]),
                                  "commands": 55, "checks": smoke["checks"]}
        result["qualified_release"] = result["release_under_test"]
        result["status"] = "passed"
    except BaseException as error:
        result.update({"status": "failed", "error": type(error).__name__ + ": " + str(error)})
    finally:
        try:
            if source_files is not None:
                for name, row in source_files.items():
                    require(B.file_record(restored / "source" / name, restored / "source")
                            == {key: row[key] for key in ("path", "sha256", "bytes", "mode")}, "Tracked source changed: " + name)
            if executables is not None:
                for row in executables.values():
                    check_record(B, restored, row)
            if release_path is not None:
                check_record(B, restored, build["release"]["executable"])
                check_record(B, restored, build["release"]["metadata"])
            if "release_under_test" in result:
                for row in result["release_under_test"].values():
                    check_record(B, root, row)
            require(sha(own) == args.helper_sha256 and sha(request_path) == args.inputs_sha256
                    and sha(corpus_helper) == request["corpus_helper_sha256"]
                    and sha(corpus_inputs) == request["corpus_inputs_sha256"]
                    and sha(smoke_helper) == SMOKE_SHA256, "A reviewed check input changed")
            require(runner.owned_baseline.matches(B.job_pids()), "Owned child processes or baseline identity differ after checks")
            require(time.monotonic() - began <= WORK_SECONDS, "Qualification exceeded its total deadline")
            result["inputs_and_source_unchanged"] = True
            result["owned_children_quiescent"] = True
        except BaseException as error:
            result.update({"status": "failed", "postcheck_error": type(error).__name__ + ": " + str(error)})
        result.update({"commands": runner.commands, "finished": B.utc(),
                       "duration_seconds": round(time.monotonic() - began, 3), "logs_retention_days_required": 7})
        B.write_json(root / "result.json", result)
        B.emit_receipt("CHECKPOINT_WINDOWS_CHECK_RESULT", root / "result.json")
        B.emit_small_streams(root, root / "logs")
        B.emit_small_streams(root, root / "smoke-output")
        if corpus_root is not None and corpus_root.exists():
            B.emit_small_streams(corpus_root, corpus_root / "logs")
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
