#!/usr/bin/env python3
"""Combine the five checked Windows partitions without executing native code."""
import argparse
import base64
from datetime import datetime
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import sys
import time


def require(value, message):
    if not value:
        raise RuntimeError(message)


def pairs(rows):
    result = {}
    for key, value in rows:
        require(key not in result, "Duplicate JSON key")
        result[key] = value
    return result


def read(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def member(root, row):
    name = row["path"]
    relative = PurePosixPath(name)
    require(isinstance(name, str) and not relative.is_absolute() and "\\" not in name and ":" not in name
            and all(part not in ("", ".", "..") for part in name.split("/")), "Invalid retained path")
    path = root.joinpath(*relative.parts)
    require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root.resolve())
            and path.stat().st_size == row["bytes"] and sha(path) == row["sha256"],
            "Retained file differs: " + name)
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--packet", required=True, type=Path)
    parser.add_argument("--packet-sha256", required=True)
    parser.add_argument("--outputs", required=True, type=Path)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--run-attempt", required=True)
    parser.add_argument("--workflow-commit", required=True)
    parser.add_argument("--window-start", required=True, type=int)
    parser.add_argument("--window-deadline", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = {"schema_version": 1, "status": "failed", "operation": "checkpoint-windows-partition-aggregate",
              "run_id": args.run_id, "run_attempt": args.run_attempt, "workflow_commit": args.workflow_commit,
              "window_start_epoch": args.window_start, "window_deadline_epoch": args.window_deadline,
              "partitions": {}, "ordinary_cases": [], "grid_cells": [], "targets": {}}
    try:
        require(re.fullmatch(r"[0-9]+", args.run_id) and re.fullmatch(r"[1-9][0-9]*", args.run_attempt)
                and re.fullmatch(r"[a-f0-9]{40}", args.workflow_commit), "Invalid workflow identity")
        require(args.window_deadline - args.window_start == 8400 and time.time() < args.window_deadline,
                "The shared qualification deadline expired")
        manifest_path = args.packet / "packet.json"
        require(sha(manifest_path) == args.packet_sha256, "Reviewed packet bytes differ")
        packet = read(manifest_path)
        require(packet["status"] == "bound", "Producer bindings are pending")
        for name, expected in packet["files"].items():
            require(re.fullmatch(r"[A-Za-z0-9_.-]+", name) and sha(args.packet / name) == expected,
                    "A checked helper differs")
        sys.dont_write_bytecode = True
        spec = importlib.util.spec_from_file_location("checked_windows_partition",
                args.packet / "checkpoint-windows-check-20261125.py")
        require(spec is not None and spec.loader is not None, "Cannot load checked coverage definitions")
        C = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(C)
        prefix = "checkpoint-windows-v8-" + args.run_id + "-" + args.run_attempt + "-part-"
        require({path.name for path in args.outputs.iterdir()} == {prefix + key for key in C.PARTITIONS},
                "Missing or unexpected partition output")
        same_request, same_release = None, None
        covered, grid, command_count = {}, [], 0
        for partition in C.PARTITIONS:
            root = args.outputs / (prefix + partition)
            completion = read(root / "supervisor-completion.json")
            require(completion["status"] == "passed" and completion["phase"] == "check"
                    and completion["partition"] == partition and completion["packet_sha256"] == args.packet_sha256
                    and completion["run_id"] == args.run_id and completion["run_attempt"] == args.run_attempt
                    and completion["workflow_commit"] == args.workflow_commit
                    and completion["supervisor_exit_code"] == 0
                    and completion["supervisor_process_exited"] is True
                    and completion["owned_job_empty_after_supervisor_exit"] is True, "Partition completion failed")
            inventory = completion["retained_files"]
            paths = [row["path"] for row in inventory]
            require(len(paths) == len(set(paths)) == len({name.casefold() for name in paths}), "Duplicate retained path")
            require({path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
                    == set(paths) | {"supervisor-completion.json"}, "Retained output set differs")
            for row in inventory:
                member(root, row)
            binding = packet["phase_inputs"]["check"][partition]
            request_path = args.packet / binding["path"]
            require(sha(request_path) == binding["sha256"], "Partition input differs")
            request = read(request_path)
            require(request["status"] == "bound" and request["partition"] == partition, "Wrong partition input")
            comparable = {key: value for key, value in request.items() if key != "partition"}
            if same_request is None:
                same_request = comparable
            require(comparable == same_request, "Partitions mix accepted producer bindings")
            receipt = read(root / "supervisor-result.json")
            result = read(root / "result.json")
            require(sha(root / "supervisor-result.json") == completion["supervisor_result_sha256"]
                    and receipt["status"] == "passed" and receipt["phase"] == "check"
                    and receipt["inputs_sha256"] == binding["sha256"]
                    and receipt["helper_sha256"] == packet["files"]["checkpoint-windows-check-20261125.py"]
                    and receipt["supervisor_sha256"] == packet["files"]["checkpoint-windows-supervisor-20261125.ps1"]
                    and receipt["helper_exit_code"] == 0 and receipt["owned_children_remaining"] == 0
                    and receipt["owned_child_pids_after"] == [] and receipt["owned_children_empty_before_outer_exit"] is True
                    and receipt["window_start_epoch"] == args.window_start
                    and receipt["window_deadline_epoch"] == args.window_deadline,
                    "Owned supervisor did not finish cleanly")
            require(result["status"] == "passed" and result["partition"] == partition
                    and result["source_commit"] == request["source_commit"] == packet["source_commit"]
                    and result["source_tree"] == request["source_tree"] == packet["source_tree"]
                    and result["target"] == request["target"] == "x86_64-pc-windows-msvc"
                    and result["artifact_id"] == request["artifact_id"] and result["build_run"] == request["run"]
                    and result["build_result_sha256"] == request["build_result_sha256"]
                    and result["input_sha256"] == binding["sha256"]
                    and result["helper_sha256"] == packet["files"]["checkpoint-windows-check-20261125.py"]
                    and result["run"]["id"] == args.run_id and result["run"]["attempt"] == args.run_attempt
                    and result["run"]["workflow_commit"] == args.workflow_commit
                    and result["window_start_epoch"] == args.window_start
                    and result["window_deadline_epoch"] == args.window_deadline
                    and result["finished_epoch"] < args.window_deadline
                    and result["inputs_and_source_unchanged"] is True and result["owned_children_quiescent"] is True,
                    "Partition source, timing or cleanup differs")
            completed_epoch = datetime.fromisoformat(completion["finished_utc"].replace("Z", "+00:00")).timestamp()
            require(args.window_start <= completed_epoch < args.window_deadline, "Completion exceeded the shared window")
            release = result["release_under_test"]
            for row in release.values():
                member(root, row)
            if same_release is None:
                same_release = release
            require(release == same_release, "Partitions mix native release bytes")
            selected = (C.CORE_HARNESSES if partition == "core" else C.EDITING_HARNESSES
                        if partition == "editing" else ("checkpoint_set_v2_conformance",))
            require(set(result["listings"]) == set(selected), "Partition target listing differs")
            lists = {}
            for key, listing in result["listings"].items():
                names = C.parse_list(member(root, listing["file"]).read_text(encoding="utf-8"))
                require(names == set(listing["tests"]) and len(names) == len(listing["tests"]), "Listing names differ")
                require(C.REQUIRED_TESTS.get(key, set()).issubset(names), "A required regression is missing")
                lists[key] = names
            commands = result["commands"]
            labels = [row["label"] for row in commands]
            require(len(labels) == len(set(labels)) and all(row.get("exit_code") == 0
                    and not row.get("error") and not row.get("timed_out") for row in commands),
                    "A command failed, timed out, or repeats a label")
            command_map = {row["label"]: row for row in commands}
            baseline = sorted(result["owned_job_baseline"]["pids"])
            require(all(row["outer_job_pids"] == baseline and row["job_pids_after"] == baseline for row in commands),
                    "A command did not return to the owned process baseline")
            seen_partition_cells, seen_cases, temporaries = [], set(), set()
            for row in result["test_results"]:
                key, label = row["target"], row["label"]
                require(key in lists and row["status"] == "passed" and row["exit_code"] == 0
                        and 0 <= row["duration_seconds"] <= 900 and label not in seen_cases
                        and row["temporary_directory"] not in temporaries, "Invalid or repeated test invocation")
                seen_cases.add(label)
                temporaries.add(row["temporary_directory"])
                expected = set(row["tests"])
                require(len(expected) == len(row["tests"]) and expected <= lists[key], "Case names differ")
                command = command_map[label]
                require(0 < command["limit_seconds"] <= 895
                        and command["stdout"] == row["stdout"]["path"] and command["stderr"] == row["stderr"]["path"],
                        "Case command or bound differs")
                filters = [next(iter(expected)), "--exact"] if key in ("lib", "checkpoint_set_v2_conformance") else []
                require(command["args"][1:] == filters + ["--test-threads=1", "--nocapture"],
                        "The executed case selection differs from coverage")
                parsed = C.parse_pass(member(root, row["stdout"]).read_text(encoding="utf-8"),
                                      expected, key, len(lists[key]))
                require(all(row[field] == value for field, value in parsed.items()), "Case summary differs")
                if partition.startswith("grid-"):
                    require(key == "checkpoint_set_v2_conformance" and expected == {C.GRID_TEST}, "Unexpected grid test")
                    cell = row["grid_cell"]
                    pair = (cell["scenario"], cell["fixture"])
                    require(pair in C.grid_cells(partition) and pair not in seen_partition_cells
                            and row["selectors"] == dict(zip(C.SELECTORS, pair)), "Grid selection differs")
                    actual = C.parse_oob(member(root, row["stderr"]).read_text(encoding="utf-8"), *pair)
                    require(actual == cell, "Grid classification differs from complete stderr")
                    seen_partition_cells.append(pair)
                    grid.append(cell)
                else:
                    require(row["selectors"] == {} and "grid_cell" not in row, "Selectors leaked into an ordinary test")
                    if key in ("lib", "checkpoint_set_v2_conformance"):
                        require(len(expected) == 1, "Focused case is not exact")
                    else:
                        require(expected == lists[key], "An integration target is incomplete")
                    previous = covered.setdefault(key, set())
                    require(not (previous & expected), "Duplicate ordinary test coverage")
                    previous.update(expected)
            expected_cells = C.grid_cells(partition)
            require(set(seen_partition_cells) == set(expected_cells) and len(seen_partition_cells) == len(expected_cells)
                    and result["grid_results"] == [row["grid_cell"] for row in result["test_results"] if "grid_cell" in row],
                    "Grid partition is incomplete")
            if partition == "editing":
                corpus = read(root / "corpus/result.json")
                require(sha(root / "corpus/result.json") == result["public_corpus"]["result_sha256"]
                        and corpus["status"] == "passed" and corpus["verification_restores"] == 4
                        and corpus["all_original_attempt_outcomes_preserved"] == 413,
                        "Original-corpus recovery is incomplete")
                smoke_paths = list((root / "smoke-output").glob("windows-native-smoke-*.json"))
                require(len(smoke_paths) == 1 and sha(smoke_paths[0]) == result["native_smoke"]["sha256"],
                        "Native editing smoke output differs")
                smoke = read(smoke_paths[0])
                require(smoke["status"] == "passed" and len(smoke["commands"]) == 55
                        and smoke["cleanup"] == "removed_owned_fixtures"
                        and smoke["expected_sha256"] == release["executable"]["sha256"], "Native smoke is incomplete")
                report["public_corpus"] = result["public_corpus"]
                report["native_smoke"] = result["native_smoke"]
            command_count += len(commands)
            report["partitions"][partition] = {"result_sha256": sha(root / "result.json"),
                "completion_sha256": sha(root / "supervisor-completion.json"), "test_invocations": len(result["test_results"]),
                "commands": len(commands), "finished_epoch": result["finished_epoch"]}
        require(set(covered) == set(C.HARNESSES) and covered["lib"] == C.EXPECTED_LIB
                and covered["checkpoint_set_v2_conformance"] == set(C.CONFORMANCE),
                "Ordinary conformance or required target coverage is incomplete")
        expected_grid = {(scenario, fixture) for scenario in C.SCENARIOS for fixture in C.FIXTURES}
        require(len(grid) == 12 and {(row["scenario"], row["fixture"]) for row in grid} == expected_grid,
                "Full grid coverage is missing or duplicated")
        require(time.time() < args.window_deadline, "Aggregation exceeded the shared window")
        report.update({"status": "passed", "source_commit": packet["source_commit"], "source_tree": packet["source_tree"],
                       "producer": same_request, "qualified_release": same_release, "command_count": command_count,
                       "ordinary_cases": sorted(C.CONFORMANCE), "grid_cells": grid,
                       "targets": {key: sorted(names) for key, names in covered.items()}})
    except BaseException as error:
        report["error"] = type(error).__name__ + ": " + str(error)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print("CHECKPOINT_WINDOWS_AGGREGATE_SHA256 " + sha(args.output), flush=True)
    print("CHECKPOINT_WINDOWS_AGGREGATE_BASE64 " + base64.b64encode(args.output.read_bytes()).decode("ascii"), flush=True)
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
