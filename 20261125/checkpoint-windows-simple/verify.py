"""Verify every downloaded build artifact against the producing job's hash."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath


def file_hash(path):
    """Stream downloaded bytes to avoid loading the source archive in memory."""
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    """Check an exact successful build; emit a retained download-verification receipt."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--manifest-sha256", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    root = args.directory.resolve()
    manifest = root / "artifact-manifest.json"
    if file_hash(manifest) != args.manifest_sha256:
        raise RuntimeError("Downloaded artifact manifest differs from the producing job")
    recorded = json.loads(manifest.read_text(encoding="utf-8"))
    if recorded["source_commit"] != args.source_commit or recorded["target"] != "x86_64-pc-windows-msvc":
        raise RuntimeError("Downloaded source or target differs")
    expected = set()
    for row in recorded["files"]:
        relative = PurePosixPath(row["path"])
        if relative.is_absolute() or ".." in relative.parts or row["path"] in expected:
            raise RuntimeError("Invalid or duplicate artifact path")
        path = root.joinpath(*relative.parts).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.is_symlink():
            raise RuntimeError("Missing artifact file: " + row["path"])
        if path.stat().st_size != row["bytes"] or file_hash(path) != row["sha256"]:
            raise RuntimeError("Downloaded artifact bytes differ: " + row["path"])
        expected.add(row["path"])
    actual = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
    if actual != expected | {"artifact-manifest.json"}:
        raise RuntimeError("Unexpected files in downloaded artifact")
    build = json.loads((root / "build-result.json").read_text(encoding="utf-8"))
    if build["status"] != "passed" or build["source_commit"] != args.source_commit:
        raise RuntimeError("Downloaded build did not succeed")
    receipt = {"status": "passed", "source_commit": args.source_commit, "target": recorded["target"],
               "manifest_sha256": args.manifest_sha256, "verified_files": len(expected),
               "verified_bytes": sum(row["bytes"] for row in recorded["files"]),
               "build_run_id": build["run_id"], "build_run_attempt": build["run_attempt"],
               "workflow_commit": build["workflow_commit"], "release": build["release"],
               "executables": build["executables"]}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n",
                            encoding="utf-8", newline="\n")
    print("CHECKPOINT_WINDOWS_DOWNLOAD_VERIFICATION " + json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
