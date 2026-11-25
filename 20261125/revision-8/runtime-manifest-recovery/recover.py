"""Recover exact existing app build metadata without executing app or native code."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
import zipfile

SOURCE_FILES = {
    "package.json", "package-lock.json", "next.config.ts", "lib/native-process.ts",
    "lib/native-store.ts", "lib/native-edit.ts", "docs/backend-compatibility.md",
    "scripts/fixtures/native-contract.mjs", "scripts/test-native-editing.mjs",
    "scripts/test-local-bead-rs.mjs", "scripts/test-native-type-roundtrip.mjs",
}


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    for name in ("source", "download", "inputs", "retainer", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    request = json.loads(args.inputs.read_text(encoding="utf-8"))
    assert digest(args.retainer) == request["retainer_sha256"]
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("accepted_text_retainer", args.retainer)
    assert spec is not None and spec.loader is not None
    retainer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(retainer)
    assert not args.output.exists()
    args.output.mkdir(parents=True)
    result = {"status": "failed", "operation": "existing-runtime-metadata-recovery",
              "inputs": request, "source_files": [], "runtime_files": 0,
              "app_or_native_execution": False, "rebuild": False}
    started = time.monotonic()

    def git(*arguments):
        return subprocess.check_output(["git", "-C", str(args.source), *arguments],
                                       text=True, timeout=10).strip()

    try:
        assert request["schema_version"] == 1
        assert git("rev-parse", "HEAD") == request["app_source_commit"]
        assert git("rev-parse", "HEAD^{tree}") == request["app_source_tree"]
        manifest_path = args.download / "scotty-runtime.json"
        assert digest(manifest_path) == request["runtime_manifest_sha256"]
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest["source_commit"] == request["app_source_commit"]
        assert manifest["build_id"] == request["runtime_build_id"]
        archive = retainer.checked_file(args.download, {
            "path": "scotty-runtime.zip", "sha256": request["runtime_zip_sha256"],
            "bytes": request["runtime_zip_bytes"]})
        assert manifest["sha256"] == request["runtime_zip_sha256"]
        assert manifest["bytes"] == request["runtime_zip_bytes"]
        assert digest(args.source / "package-lock.json") == manifest["dependency_lock_sha256"]
        assert git("rev-parse", "HEAD:package-lock.json") == manifest["dependency_lock_git_blob"]
        sources = json.loads((args.download / "source-sha256.json").read_text(encoding="utf-8"))
        assert len(sources) == len(SOURCE_FILES) and {row["path"] for row in sources} == SOURCE_FILES
        for row in sources:
            retainer.checked_file(args.source, row)
            assert git("rev-parse", "HEAD:" + row["path"]) == row["git_blob"]
        result["source_files"] = sources
        records = {row["path"]: row for row in manifest["files"]}
        assert len(records) == len(manifest["files"]) == request["runtime_files"]
        assert len({name.casefold() for name in records}) == len(records)
        with zipfile.ZipFile(archive) as package:
            assert len(package.infolist()) == len(records) and set(package.namelist()) == set(records)
            for name, row in records.items():
                assert name.startswith(".next/") and "\\" not in name and ":" not in name
                assert not any(part in ("", ".", "..") for part in name.split("/"))
                assert package.getinfo(name).file_size == row["bytes"]
                with package.open(name) as stream:
                    observed = hashlib.file_digest(stream, "sha256").hexdigest()
                assert observed == row["sha256"], name
            assert package.read(".next/BUILD_ID").decode("utf-8").strip() == request["runtime_build_id"]
        result["runtime_files"] = len(records)
        producer_result = json.loads((args.download / "result.json").read_text(encoding="utf-8"))
        assert producer_result["status"] == "passed"
        assert producer_result["source_commit"] == request["app_source_commit"]
        assert producer_result["source_tree"] == request["app_source_tree"]
        assert producer_result["adapter_tests"] == {
            "tests": 115, "pass": 115, "fail": 0, "cancelled": 0, "skipped": 0, "todo": 0}
        assert len(producer_result["commands"]) == 8 and all(row["exit"] == 0 for row in producer_result["commands"])
        assert producer_result["remaining_edit_directories"] == []
        assert producer_result["runtime"]["manifest_sha256"] == request["runtime_manifest_sha256"]
        assert producer_result["runtime"]["archive_sha256"] == request["runtime_zip_sha256"]
        assert producer_result["runtime"]["file_count"] == request["runtime_files"]
        assert git("status", "--porcelain=v1", "--untracked-files=all") == ""
        result["retained"] = []
        for name in ("source-sha256.json", "scotty-runtime.json", "result.json"):
            target = args.output / ("linux-" + name)
            shutil.copyfile(args.download / name, target)
            assert digest(target) == digest(args.download / name)
            result["retained"].append({"path": target.name, "bytes": target.stat().st_size,
                                       "sha256": digest(target)})
            retainer.retain_text(target, target.name)
        result["status"] = "passed"
    except BaseException as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    finally:
        result["duration_seconds"] = round(time.monotonic() - started, 3)
        target = args.output / "recovery-result.json"
        target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
        retainer.retain_text(target, target.name)
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
