#!/usr/bin/env python3
"""Run the complete default Cargo suite from the separately accepted Linux build."""
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
import struct
import sys
import tarfile
import time

GREEN_HELPER_SHA256 = "94c4a9012f35326234cd0eb613017b22018f0679be2d4f53fce08c9f1d4af6ad"
BUILD_INPUTS_SHA256 = "50af921e6fff03182d2a0c85663c4350150b12e0ffef046e922fa9540ba24bf8"
SOURCE_COMMIT = "515b503b24baf71737ff8fa6c879bd0752ef0fc6"
SOURCE_TREE = "b7c196bb6b337bdc7503e28d3a600e860fa3b799"
COMMAND = ["cargo", "test", "--locked", "--no-fail-fast", "--", "--test-threads=1"]
SECONDS = 5400
MAX_BUNDLE_BYTES = 10 * 1024 * 1024 * 1024
MAX_EXTRACTED_BYTES = 10 * 1024 * 1024 * 1024
MAX_FILES = 101000
EXPECTED_NEW_TESTS = {
    "service::checkpoint::set_v2::tests::set_v2_staging_counts_attempt_outcomes_across_shards",
    "service::checkpoint::set_v2::tests::set_v2_staging_rejects_duplicate_attempts_within_a_shard",
    "service::checkpoint::set_v2::tests::set_v2_staging_rejects_duplicate_attempts_across_shards",
    "verified_restore_preserves_all_attempt_outcomes_from_set_v2",
    "selected_set_v2_generation_remains_restorable_after_tail_append",
    "legacy_fixed_tail_generation_remains_restorable_after_upgrade",
}

PIN_INTERPRETER = Path("/nix/store/m07h00fl6538s4gavrp66a20ka4hg7fy-glibc-2.42-67/lib/ld-linux-x86-64.so.2")
PIN_HASHES = {
    "bead-pre-feature": "7e0e73defebb75fc987ddf8b6fb959f47c73ccbbcd7e066e2af302a6a43db6b5",
    "bead-pre-attempt-resolution": "d0da42bbf59b721bc64bc3d55610844efe3f1f06e37c2d9494c0b3dda6e29ac6",
    "bead-attempt-resolution-f25ab5c": "9a8455f25bacf5bc961bd740442fdc1b30a67fb6e38d304c23c97a57cf57b04e",
    "bead-attempt-resolution-e115609": "68fe8d534721be4ba4147312364d8f0b216b62f3093e85e7c91f0a0db695a645",
    "bead-managed-secret-policy-cd4986c": "6a5969ed9c1c5215d3f0f93505aa0603d7375281f6fb3f64ea6101ece149a50f",
}
GIT_IDENTITY = {
    "GIT_AUTHOR_NAME": "Bead checkpoint CI",
    "GIT_AUTHOR_EMAIL": "bead-checkpoint-ci@example.invalid",
    "GIT_COMMITTER_NAME": "Bead checkpoint CI",
    "GIT_COMMITTER_EMAIL": "bead-checkpoint-ci@example.invalid",
}


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as reader:
        for block in iter(lambda: reader.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_green(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file(),
            "Build helper must be an ordinary absolute file")
    require(sha(path) == GREEN_HELPER_SHA256, "Accepted Green helper differs")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("accepted_linux_build", path)
    require(spec is not None and spec.loader is not None, "Cannot import accepted build definitions")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_record(B, root, record):
    path = root.joinpath(*B.relative_path(record["path"]).parts)
    basic = {key: record[key] for key in ("path", "bytes", "sha256", "mode")}
    require(B.file_record(path, root) == basic, "Retained file differs: " + record["path"])
    return path


def extract_bundle(B, archive, root):
    files = set()
    total = 0
    with tarfile.open(archive, "r:gz") as source:
        for member in source:
            name = member.name.rstrip("/") if member.isdir() else member.name
            parts = B.relative_path(name).parts
            path = root.joinpath(*parts)
            require(path.is_relative_to(root), "Bundle member leaves owned root")
            require(not member.issym() and not member.islnk() and (member.isdir() or member.isfile()),
                    "Bundle links or special members are forbidden")
            if member.isdir():
                path.mkdir(parents=True, exist_ok=True)
                continue
            require(name not in files and not name.startswith(("source/", "tmp/"))
                    and name != "result.json", "Unexpected or duplicate bundle member")
            total += member.size
            require(0 <= member.size and total <= MAX_EXTRACTED_BYTES and len(files) < MAX_FILES,
                    "Qualification bundle exceeds reviewed limits")
            require(member.mode == member.mode & 0o777, "Unsafe archive mode")
            path.parent.mkdir(parents=True, exist_ok=True)
            reader = source.extractfile(member)
            require(reader is not None, "Missing bundle bytes")
            with reader, path.open("xb") as output:
                shutil.copyfileobj(reader, output, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            os.chmod(path, member.mode)
            require(path.stat().st_size == member.size, "Extracted member length differs")
            B.safe_existing(path)
            files.add(name)
    return files


def parse_results(stdout, stderr, source, build_root, build):
    mapping = {}
    for key, row in build["executables"].items():
        if row["test_harness"]:
            mapping[str(build_root / row["path"])] = key.removeprefix("harness:")
    executed = []
    docs = []
    for line in stderr.splitlines():
        if re.match(r"^\s*Running ", line):
            match = re.search(r"\(([^()\r\n]+)\)\s*$", line)
            require(match is not None, "Unrecognized Cargo target execution line")
            path = Path(match.group(1))
            if not path.is_absolute():
                path = source / path
            absolute = str(path.resolve(strict=True))
            require(absolute in mapping and mapping[absolute] not in executed, "Unknown or repeated test harness")
            executed.append(mapping[absolute])
        match = re.match(r"^\s*Doc-tests\s+(\S+)\s*$", line)
        if match:
            docs.append("doctest:" + match.group(1))
    require(set(executed) == set(build["default_harnesses"]), "A default test harness did not execute")
    require(len(docs) == 1 and docs == ["doctest:bead_rs"], "Default library doctests did not execute exactly once")
    summaries = list(re.finditer(
        r"(?m)^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; "
        r"(\d+) measured; (\d+) filtered out; finished in [^\r\n]+$", stdout))
    starts = list(re.finditer(r"(?m)^running (\d+) tests?\r?$", stdout))
    require(len(summaries) == len(starts) and len(summaries) >= len(executed) + 1,
            "Incomplete target summary coverage")
    # Rust2024 can run compatible and standalone doctest groups separately.
    # Every emitted group must still have a complete, unfiltered success summary.
    doc_groups = len(summaries) - len(executed)
    target_order = executed + ["doctest:bead_rs:" + str(index + 1) for index in range(doc_groups)]
    targets = []
    all_passed_names = set()
    previous_end = 0
    for index, (start, summary) in enumerate(zip(starts, summaries)):
        require(previous_end <= start.start() < summary.start(), "Test output blocks overlap")
        passed, failed, ignored, measured, filtered = (int(summary.group(i)) for i in range(2, 7))
        require(summary.group(1) == "ok" and failed == measured == filtered == 0,
                "A complete-suite target failed or was filtered")
        require(int(start.group(1)) == passed + ignored, "Target running count differs")
        body = stdout[start.end():summary.start()]
        names = re.findall(r"(?m)^test (.+) \.\.\. (ok|ignored(?:, [^\r\n]+)?)\r?$", body)
        passed_names = [name for name, status in names if status == "ok"]
        ignored_names = [{"name": name, "status": status} for name, status in names if status != "ok"]
        require(len(passed_names) == passed and len(ignored_names) == ignored
                and len({name for name, _ in names}) == len(names), "Test names do not match target counts")
        all_passed_names.update(passed_names)
        targets.append({"target": target_order[index], "passed": passed, "failed": failed,
                        "ignored": ignored, "measured": measured, "filtered_out": filtered,
                        "passed_tests": passed_names, "ignored_tests": ignored_names})
        previous_end = summary.end()
    require(EXPECTED_NEW_TESTS <= all_passed_names, "A new checkpoint regression did not pass in the full suite")
    return {"targets": targets, "target_count": len(targets),
            "passed_test_count": sum(row["passed"] for row in targets),
            "failed_test_count": 0, "ignored_test_count": sum(row["ignored"] for row in targets),
            "required_new_tests": sorted(EXPECTED_NEW_TESTS), "required_new_tests_passed": 6,
            "unfiltered_default_harnesses": sorted(executed), "doctests": docs,
            "doctest_result_groups": doc_groups}



def elf_interpreter(path):
    """Read PT_INTERP without modifying or running a historical binary."""
    with path.open("rb") as stream:
        header = stream.read(64)
        require(len(header) == 64 and header[:6] == b"\x7fELF\x02\x01"
                and struct.unpack_from("<H", header, 18)[0] == 62, "Expected x86-64 ELF pin")
        offset = struct.unpack_from("<Q", header, 32)[0]
        stride, count = struct.unpack_from("<HH", header, 54)
        require(stride >= 56 and 0 < count <= 128
                and offset + stride * count <= path.stat().st_size, "Invalid pin program headers")
        interpreters = []
        for index in range(count):
            stream.seek(offset + index * stride)
            row = stream.read(56)
            if struct.unpack_from("<I", row)[0] != 3:
                continue
            start, size = struct.unpack_from("<Q", row, 8)[0], struct.unpack_from("<Q", row, 32)[0]
            require(0 < size <= 4096 and start + size <= path.stat().st_size, "Invalid PT_INTERP")
            stream.seek(start)
            value = stream.read(size)
            require(value.endswith(b"\0") and b"\0" not in value[:-1], "Invalid interpreter string")
            interpreters.append(value[:-1].decode("ascii"))
    require(len(interpreters) == 1, "Expected one pin interpreter")
    return interpreters[0]


def prepare_test_environment(B, runner, source, build_root, build, correction):
    """Supply the three measured test-host prerequisites, keeping source bytes exact."""
    pins = []
    for name, expected in PIN_HASHES.items():
        binary = B.safe_existing(source / "pinned-binaries" / name)
        metadata = B.read_json(source / "pinned-binaries" / (name + ".metadata.json"))
        require(sha(binary) == metadata["binary_sha256"] == expected, "Historical pin bytes differ: " + name)
        require(elf_interpreter(binary) == str(PIN_INTERPRETER), "Historical pin interpreter differs")
        pins.append(B.file_record(binary, source))
    correction["pins"] = pins
    loader = B.safe_existing(Path("/lib64/ld-linux-x86-64.so.2").resolve(strict=True))
    require(loader.parent in (Path("/usr/lib/x86_64-linux-gnu"), Path("/lib/x86_64-linux-gnu"))
            and os.access(loader, os.X_OK), "Unexpected native Ubuntu loader")
    version = runner.run([str(loader), "--version"], source, "native-loader-version").read_text()
    require(re.search(r"\bGLIBC 2\.39(?:[- )]|$)", version) is not None,
            "Expected the Ubuntu24.04 native GLIBC2.39 loader")
    correction["native_loader"] = {**B.file_record(loader, Path("/")), "absolute_path": str(loader),
                                   "version": version.strip()}
    require(not os.path.lexists(PIN_INTERPRETER), "Pin interpreter path already exists")
    directories = list(reversed(PIN_INTERPRETER.parent.parents[:-1])) + [PIN_INTERPRETER.parent]
    require(directories == [Path("/nix"), Path("/nix/store"), PIN_INTERPRETER.parent.parent,
                            PIN_INTERPRETER.parent], "Unexpected interpreter directory plan")
    for index, directory in enumerate(directories):
        if os.path.lexists(directory):
            B.safe_existing(directory, directory=True)
            continue
        correction["created_directories"].append(str(directory))
        runner.run(["sudo", "-n", "mkdir", "-m", "755", "--", str(directory)], source,
                   "pin-loader-directory-" + str(index))
        B.safe_existing(directory, directory=True)
    correction["loader_alias"] = {"path": str(PIN_INTERPRETER), "target": str(loader)}
    runner.run(["sudo", "-n", "ln", "-s", "--", str(loader), str(PIN_INTERPRETER)],
               source, "pin-loader-alias")
    require(PIN_INTERPRETER.is_symlink() and os.readlink(PIN_INTERPRETER) == str(loader)
            and PIN_INTERPRETER.resolve(strict=True) == loader, "Interpreter alias differs")
    for index, record in enumerate(pins):
        # --list resolves dependencies and versions without calling the pin's main.
        listed = runner.run([str(loader), "--list", str(source / record["path"])],
                            source, "pin-loader-dependencies-" + str(index)).read_text()
        require("not found" not in listed, "An unchanged historical pin dependency is unavailable")
    harness = B.safe_existing(build_root / build["executables"]["harness:test:r002_leased_claims"]["path"])
    binary = B.safe_existing(build_root / build["executables"]["binary:bead"]["path"])
    alias = harness.parent.parent / "bead"
    require(alias.is_relative_to(build_root / "target") and alias != binary
            and not os.path.lexists(alias), "Legacy lease-test path is not fresh and owned")
    correction["lease_binary_alias"] = {"path": str(alias), "target": str(binary)}
    alias.symlink_to(binary)
    require(alias.resolve(strict=True) == binary, "Legacy lease-test alias differs")
    correction["status"] = "prepared"


def remove_test_environment(B, runner, source, correction):
    """Remove only the aliases and empty directories created by this invocation."""
    failures = []
    for key in ("lease_binary_alias", "loader_alias"):
        row = correction.get(key)
        if not row:
            continue
        path = Path(row["path"])
        try:
            if os.path.lexists(path):
                require(path.is_symlink() and os.readlink(path) == row["target"],
                        "Owned test alias changed; preserving it: " + str(path))
                if key == "loader_alias":
                    runner.run(["sudo", "-n", "unlink", "--", str(path)], source, "remove-pin-loader-alias")
                else:
                    path.unlink()
            require(not os.path.lexists(path), "Owned test alias survived cleanup")
            row["removed"] = True
        except BaseException as error:
            failures.append(str(error))
    for index, name in enumerate(reversed(correction["created_directories"])):
        directory = Path(name)
        try:
            if os.path.lexists(directory):
                B.safe_existing(directory, directory=True)
                runner.run(["sudo", "-n", "rmdir", "--", name], source, "remove-loader-directory-" + str(index))
            require(not os.path.lexists(directory), "Owned loader directory survived cleanup")
        except BaseException as error:
            failures.append(str(error))
    if correction.get("native_loader"):
        row = correction["native_loader"]
        try:
            require(B.file_record(Path(row["absolute_path"]), Path("/")) ==
                    {key: row[key] for key in ("path", "bytes", "sha256", "mode")}, "Native loader changed")
        except BaseException as error:
            failures.append(str(error))
    correction["cleanup_errors"] = failures
    correction["cleanup_status"] = "passed" if not failures else "failed"
    require(not failures, "Test environment cleanup failed: " + "; ".join(failures))


def main():
    began = time.monotonic()
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-directory", required=True)
    parser.add_argument("--green-helper", required=True)
    parser.add_argument("--support-helper", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    args = parser.parse_args()
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true", "Hosted Linux only")
    G = load_green(args.green_helper)
    B = G.load_support(args.support_helper)
    own = B.safe_existing(Path(__file__).absolute())
    request = B.safe_existing(Path(args.inputs))
    require(B.SHA256.fullmatch(args.inputs_sha256) and B.SHA256.fullmatch(args.helper_sha256),
            "Exact accepted input/helper hashes required")
    require(sha(own) == args.helper_sha256 and sha(request) == args.inputs_sha256, "Reviewed checker input differs")
    inputs = B.read_json(request)
    require(inputs.get("schema_version") == 1 and inputs.get("source_commit") == SOURCE_COMMIT
            and inputs.get("source_tree") == SOURCE_TREE, "Unexpected checked source")
    for key in ("build_result_sha256", "outer_result_sha256", "bundle_sha256"):
        require(isinstance(inputs.get(key), str) and B.SHA256.fullmatch(inputs[key]), "Missing accepted " + key)
    require(isinstance(inputs.get("build_run"), str) and re.fullmatch(r"[0-9]+", inputs["build_run"])
            and isinstance(inputs.get("build_attempt"), str) and re.fullmatch(r"[1-9][0-9]*", inputs["build_attempt"])
            and B.SHA1.fullmatch(inputs.get("build_workflow_commit", "")), "Missing accepted producing run")
    artifact = B.safe_existing(Path(args.artifact_directory), directory=True)
    outer_path, build_path = artifact / "result.json", artifact / "build-result.json"
    require(sha(B.safe_existing(outer_path)) == inputs["outer_result_sha256"]
            and sha(B.safe_existing(build_path)) == inputs["build_result_sha256"], "Accepted build receipts differ")
    outer, build = B.read_json(outer_path), B.read_json(build_path)
    require(outer["status"] == build["status"] == "passed"
            and outer["build_result_sha256"] == inputs["build_result_sha256"], "Predecessor build did not pass")
    require(build["source_commit"] == SOURCE_COMMIT and build["source_tree"] == SOURCE_TREE
            and build["helper_sha256"] == GREEN_HELPER_SHA256 and build["input_sha256"] == BUILD_INPUTS_SHA256,
            "Accepted build identity differs")
    require(build["run"] == {"id": inputs["build_run"], "attempt": inputs["build_attempt"],
                             "workflow_commit": inputs["build_workflow_commit"],
                             "repository": "YossiMH/bead-me-up-scotty"}, "Producing workflow differs")
    require(build["tests_executed"] is False and build["profiles"] == G.PROFILES
            and build["cargo_build_jobs"] == 1 and build["compile_command"] == G.BUILD_COMMAND,
            "Predecessor compiler contract differs")
    require(all(row["exit_code"] == 0 and row["error"] is None for row in build["commands"])
            and all(not row["signals"] and not row["remaining"] for row in build["process_group_cleanup"]),
            "Predecessor command/cleanup failure")
    bundle = check_record(B, artifact, outer["bundle"])
    require(bundle.stat().st_size == inputs["bundle_bytes"] <= MAX_BUNDLE_BYTES
            and sha(bundle) == inputs["bundle_sha256"], "Accepted qualification bundle differs")
    temp = B.safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    build_root = Path(build["build_root"])
    expected_root = temp / ("bead-checkpoint-linux-build-" + inputs["build_run"] + "-" + inputs["build_attempt"])
    require(build_root == expected_root and outer["build_root"] == str(expected_root) and not build_root.exists(),
            "Exact original build root must be fresh")
    source, target = build_root / "source", build_root / "target"
    require(build["source_root"] == str(source) and build["target_root"] == str(target), "Recorded layout differs")
    run_id, attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"[0-9]+", run_id) and re.fullmatch(r"[1-9][0-9]*", attempt), "Invalid checker run identity")
    output = temp / ("bead-checkpoint-full-suite-" + run_id + "-" + attempt)
    require(not output.exists(), "Fresh suite output is required")
    for ancestor in (temp, *temp.parents):
        require(not (ancestor / ".git").exists(), "Suite archive would inherit Git")
    require(shutil.disk_usage(temp).free > build["target_bytes"] + 2 * build["source_archive"]["bytes"]
            + 512 * 1024 * 1024, "Insufficient owned hosted disk headroom for full bundle")
    output.mkdir()
    for name in ("logs", "tmp"):
        (output / name).mkdir()
    build_root.mkdir()
    (build_root / "tmp").mkdir()
    result = {"schema_version": 1, "status": "failed", "operation": "checkpoint-full-suite",
              "source_commit": SOURCE_COMMIT, "source_tree": SOURCE_TREE, "build_root": str(build_root),
              "output": str(output), "input_sha256": args.inputs_sha256, "helper_sha256": args.helper_sha256,
              "build_result_sha256": inputs["build_result_sha256"], "bundle_sha256": inputs["bundle_sha256"],
              "producing_run": build["run"], "seconds": SECONDS, "command": COMMAND, "profiles": G.PROFILES,
              "started": B.utc(), "run": {"id": run_id, "attempt": attempt,
                  "workflow_commit": os.environ["GITHUB_SHA"], "repository": os.environ["GITHUB_REPOSITORY"]}}
    B.write_json(output / "attempt-started.json", result)
    runner = None
    source_files = None
    correction = {"status": "pending", "created_directories": [], "child_git_identity": GIT_IDENTITY}
    result["environment_corrections"] = correction
    def stop(_signal, _frame):
        raise TimeoutError("Full-suite deadline or supervisor stop")

    old_alarm = signal.signal(signal.SIGALRM, stop)
    old_term = signal.signal(signal.SIGTERM, stop)
    signal.setitimer(signal.ITIMER_REAL, max(0.001, SECONDS - (time.monotonic() - began) - 5))
    try:
        members = extract_bundle(B, bundle, build_root)
        require(sha(build_root / "build-result.json") == inputs["build_result_sha256"]
                and sha(build_root / "build-inputs.json") == BUILD_INPUTS_SHA256, "Bundle metadata differs")
        source_tar = check_record(B, build_root, build["source_archive"])
        source_manifest = check_record(B, build_root, build["source_files"])
        target_manifest = check_record(B, build_root, build["target_files"])
        source_files = B.read_json(source_manifest)["files"]
        targets = B.read_json(target_manifest)
        require(targets["bytes"] == build["target_bytes"], "Target inventory size differs")
        expected_members = {"source.tar", "source-files.json", "target-files.json", "build-inputs.json",
                            "build-result.json", "attempt-started.json", "repair-whitespace.json", "format-check.json"}
        expected_members.update(targets["files"])
        expected_members.update(row["path"] for row in build["release"].values() if isinstance(row, dict))
        for row in build["commands"]:
            expected_members.update((row["stdout"], row["stderr"], "logs/" + row["label"] + ".started.json",
                                     "logs/" + row["label"] + ".exit.json"))
        require(members == expected_members, "Bundle members exceed the accepted inventory")
        tracked = {name: {"git_blob": row["git_blob"], "git_mode": row["git_mode"]}
                   for name, row in source_files.items()}
        extracted = B.extract_source(source_tar, source, tracked)
        require(set(extracted) == set(source_files), "Source inventory differs")
        for name, row in source_files.items():
            path = check_record(B, source, row)
            require(type(row["mtime_ns"]) is int, "Missing exact source mtime")
            os.utime(path, ns=(row["mtime_ns"], row["mtime_ns"]))
        for name, row in targets["files"].items():
            require(name == row["path"] and name.startswith("target/"), "Target inventory leaves namespace")
            path = check_record(B, build_root, row)
            require(type(row["mtime_ns"]) is int, "Missing exact target mtime")
            os.utime(path, ns=(row["mtime_ns"], row["mtime_ns"]))
        metadata = B.read_json(build_root / "logs" / "cargo-metadata.stdout")
        reproduced, harnesses = G.compiled_outputs(
            B, build_root / "logs" / "cargo.stdout.jsonl", metadata, source, target, build_root)
        require(reproduced == build["executables"] and harnesses == build["default_harnesses"],
                "Retained Cargo executable map differs")
        env = B.clean_environment(build_root)
        env.update(G.PROFILES)
        env.update(GIT_IDENTITY)
        env["CARGO_TERM_COLOR"] = "never"
        env["CARGO_BIN_EXE_bead"] = str(build_root / build["executables"]["binary:bead"]["path"])
        runner = B.Runner(output, env, began + SECONDS - 10)
        rustc = runner.run(["rustc", "--version"], source, "rustc-version").read_text().strip()
        cargo = runner.run(["cargo", "--version"], source, "cargo-version").read_text().strip()
        require({"rustc": rustc, "cargo": cargo} == build["toolchain"], "Test toolchain differs from compilation")
        result["toolchain"] = build["toolchain"]
        result["cargo_bin_exe_bead"] = env["CARGO_BIN_EXE_bead"]
        prepare_test_environment(B, runner, source, build_root, build, correction)
        B.write_json(output / "environment-corrections.json", correction)
        B.write_json(output / "executables-before.json", reproduced)
        result["executables_before_file"] = B.file_record(output / "executables-before.json", output)
        suite_failure = None
        try:
            runner.run(COMMAND, source, "cargo-full-suite")
        except BaseException as error:
            suite_failure = error
        stdout_path, stderr_path = output / "logs" / "cargo-full-suite.stdout", output / "logs" / "cargo-full-suite.stderr"
        require(stdout_path.stat().st_size <= 64 * 1024 * 1024 and stderr_path.stat().st_size <= 64 * 1024 * 1024,
                "Complete-suite output exceeds inspection bound")
        result["stdout"] = B.file_record(stdout_path, output)
        result["stderr"] = B.file_record(stderr_path, output)
        if suite_failure is not None:
            raise suite_failure
        require(runner.commands[-1]["exit_code"] == 0, "Cargo suite did not exit zero")
        parsed = parse_results(stdout_path.read_text(encoding="utf-8"),
                               stderr_path.read_text(encoding="utf-8"), source, build_root, build)
        B.write_json(output / "complete-target-results.json", parsed)
        result["complete_target_results_file"] = B.file_record(output / "complete-target-results.json", output)
        result.update({key: value for key, value in parsed.items() if key != "targets"})
        result["targets"] = [{key: value for key, value in row.items() if key != "passed_tests"}
                             for row in parsed["targets"]]
        result["status"] = "passed"
    except BaseException as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if runner is not None and runner.active is not None:
            runner.stop_group(runner.active, "final-cleanup")
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_alarm)
        signal.signal(signal.SIGTERM, old_term)
        if runner is not None:
            try:
                runner.deadline = min(began + SECONDS, time.monotonic() + 8)
                remove_test_environment(B, runner, source, correction)
            except BaseException as error:
                result["status"] = "failed"
                result["environment_cleanup_error"] = str(error)
        try:
            if source_files is not None and source.exists():
                for name, row in source_files.items():
                    check_record(B, source, row)
                result["source_files_unchanged"] = len(source_files)
            if target.exists():
                after = {}
                for key, row in build["executables"].items():
                    path = B.safe_existing(build_root / row["path"])
                    after[key] = B.file_record(path, build_root)
                B.write_json(output / "executables-after.json", after)
                result["executables_after_file"] = B.file_record(output / "executables-after.json", output)
                result["recompiled_executables"] = sorted(key for key, row in after.items()
                    if any(row[field] != build["executables"][key][field] for field in ("sha256", "bytes", "mode")))
            require(sha(own) == args.helper_sha256 and sha(request) == args.inputs_sha256
                    and sha(Path(args.green_helper)) == GREEN_HELPER_SHA256
                    and sha(Path(args.support_helper)) == G.SUPPORT_SHA256, "Reviewed checker inputs changed")
        except BaseException as error:
            result["status"] = "failed"
            result["preservation_error"] = str(error)
        if runner is not None:
            result["commands"] = runner.commands
            result["process_group_cleanup"] = runner.cleanup
            if any(row["signals"] or row["remaining"] for row in runner.cleanup):
                result["status"] = "failed"
                result["cleanup_error"] = "Owned processes did not finish cleanly"
        result["finished"] = B.utc()
        result["duration_seconds"] = round(time.monotonic() - began, 3)
        if result["duration_seconds"] > SECONDS:
            result["status"] = "failed"
            result["deadline_exceeded"] = True
        result["logs_retention_days_required"] = 7
        B.write_json(output / "result.json", result)
        G.emit_text_records(B, output, ["result.json"])
        for name in ("complete-target-results.json", "executables-before.json", "executables-after.json", "environment-corrections.json"):
            path = output / name
            if path.is_file():
                record = B.file_record(path, output)
                if path.stat().st_size <= 256 * 1024:
                    record["base64"] = base64.b64encode(path.read_bytes()).decode("ascii")
                print("CHECKPOINT_SUITE_DETAIL " + json.dumps(record, sort_keys=True), flush=True)
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
