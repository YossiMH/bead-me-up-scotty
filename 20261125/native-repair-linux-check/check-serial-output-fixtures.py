#!/usr/bin/env python3
"""Check the serial-output parser using exact previously retained output blocks."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HELPER_SHA256 = "989e1cb6631af8e9181ec4e28e15175c1bc65f7480b5b3615cea33a5d1cd22a7"
FIXTURES_SHA256 = "82a8a476f6705b4849e63dc5a89818eca800dc2c6261e79fe8ed9b874af44f15"
ROOT = Path(__file__).resolve().parent


def require(value, message):
    if not value:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    helper = ROOT / "checkpoint-full-suite-20261125.py"
    fixture_path = ROOT / "serial-output-fixtures.json"
    require(digest(helper) == HELPER_SHA256, "Reviewed parser helper differs")
    require(digest(fixture_path) == FIXTURES_SHA256, "Reviewed output fixtures differ")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("accepted_suite_parser", helper)
    require(spec is not None and spec.loader is not None, "Cannot import checked parser")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))
    require(fixtures["source_run"] == "45581211706"
            and fixtures["source_job"] == "139091460269"
            and fixtures["source_stdout_sha256"]
            == "4de96772dc2e860a38c72d4662a0168181d2a0b4217c02a6f6584724c5707175",
            "Actual output fixture provenance differs")
    require([row["target"] for row in fixtures["cases"]]
            == ["test:checkpoint_set_v2_conformance", "test:binary_variant_integration"],
            "Expected both interrupted and ignored output fixtures")
    checked = []
    for row in fixtures["cases"]:
        require(hashlib.sha256(row["body"].encode()).hexdigest() == row["sha256"],
                "Actual output block differs")
        actual = module.serial_test_names(row["body"])
        require(actual == [tuple(pair) for pair in row["expected"]], "Names/statuses differ from actual result")
        checked.append({"target": row["target"], "names": len(actual), "sha256": row["sha256"]})
    conformance = fixtures["cases"][0]["body"]
    require(conformance.count("bead-") == 3, "The two actual child-output interruptions are absent")
    malformed = {
        "missing_last_status": conformance.rsplit("ok", 1)[0],
        "duplicate_test_name": conformance + "test set_v2_crash_ordering ... ok\n",
        "failed_status": "test set_v2_concurrent_publication ... FAILED\n",
        "incomplete_interrupted_status": "test set_v2_oversize_record_once_cost ... bead-9fe3d653\n",
    }
    for name, body in malformed.items():
        try:
            module.serial_test_names(body)
        except RuntimeError:
            continue
        raise RuntimeError("Malformed output was accepted: " + name)
    require(module.serial_test_names("") == [], "Empty harness output should retain zero names")
    print(json.dumps({"status": "passed", "operation": "serial-output-parser-fixtures",
                      "helper_sha256": HELPER_SHA256, "fixtures_sha256": FIXTURES_SHA256,
                      "actual_blocks": checked, "rejected_mutations": sorted(malformed),
                      "empty_group": "passed"}, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
