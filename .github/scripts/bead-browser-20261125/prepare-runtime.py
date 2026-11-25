#!/usr/bin/env python3
"""Verify the fixed test inputs and restore the already-built Next runtime."""

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import urllib.request
import zipfile

APP_COMMIT = "38c21a77b4e875d75e17ee68683846601df33591"
BACKEND_COMMIT = "539cdd0b4c54665c2db01da08fdf9f3871f7148a"
TRANSFER_COMMIT = "55a733db99f8ae4200766738af273f97e9d2b27b"
RUNTIME_SOURCE = "fbb09312e43ec8094da6db04f126a16e8c5746f7"
RUNTIME_SHA = "6a399adb2567757db1f69cb4a1cd6ce1148e6a315a798999932f2b2339ab7dc7"
MANIFEST_SHA = "948194c2eda868f879152111570f52ce6f643dc6f4c4fe79f8f4eef8043a510a"
BUILD_ID = "Eox2_s2VuIuWWAISvMqKK"
PARTS = [
    (524288, "9f6b7d635189d1ad256b36b348bd59dd20e21b56582f4d83b29abf8f7668508e"),
    (524288, "b8c3eff6c2320cb0df0bb925d18d7b45b3b8b20270566309cdee2ab31ff35054"),
    (524288, "57e493becd2a8ef8e7323cc359e30fb06e8f7f4b6eb80cfaf4d80ec8c5d53b51"),
    (386322, "432e3a59303df9812aab31c7ebd8f3aee79a651bb8ea53c84bb6f00bf7310f0f"),
]
SOURCE_FILES = {
    "package.json": "3299658793499d4da1fff8a2bf1a56c2f12a370c463c32b1586b4024bb11b137",
    "package-lock.json": "545c1dd88f005d1b7337907f311f8bf979bbbd34e3930cfabef1fe5f8d57f050",
    "next.config.ts": "8be4b27befd08072ca0f8179434b4b8de3f4c9f3c6437e977dfc11ebf6af858a",
    "scripts/test-backend-integration.mjs": "c92f8e6ca110cd30d74cb848ab2344ca40feb49c35cd9095b8aeeec8eb30a71d",
    "scripts/test-backend-browser.mjs": "d8154680f8c6c827025927dac9e78d63ecd6fe5d10347b3b194ae9002604c14f",
    "scripts/test-native-ui-flows.mjs": "e75daad7fd6f4ff8101b68eb6ab0e6dc2701ed212ee7b170b4bab415d0f12a40",
    "scripts/test-native-ui-recovery.mjs": "a0d395b9c9b19ce4794548a5d544a8eeab8b01905b280021a8d4dac6e87a6fd2",
    "scripts/test-native-priority-recovery.mjs": "9fe8b9bd2b4623cb3fa70ecf2960ab1d65e91a3e3be18086978f73e59b807cc0",
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(repository, *arguments):
    return subprocess.check_output(
        ["git", "-C", str(repository), *arguments], text=True, timeout=15
    ).strip()


def main():
    workspace = Path(os.environ["GITHUB_WORKSPACE"]).resolve()
    root = Path(os.environ["SCOTTY_CI_ROOT"]).resolve()
    product, backend = workspace / "product", workspace / "backend"
    results = root / "results"
    require(root.is_absolute() and root.is_dir() and results.is_dir(), "CI root must exist")
    require(not (product / ".next").exists(), "Refusing to replace an existing Next runtime")
    require(git(product, "rev-parse", "HEAD") == APP_COMMIT, "Unexpected app source commit")
    require(git(backend, "rev-parse", "HEAD") == BACKEND_COMMIT, "Unexpected native source commit")
    require(git(backend, "rev-parse", "HEAD:scripts/build-from-archive.sh") ==
            "27a87aa74ff4c2d6c3ef93f4dff77fa649dfdfaf", "Unexpected archive builder")
    require(git(backend, "rev-parse", "HEAD:Cargo.lock") ==
            "e969d93705157d1a7ccf6185c0b55e8edd61c082", "Unexpected native lockfile")
    for name, expected in SOURCE_FILES.items():
        require(sha((product / name).read_bytes()) == expected, f"Changed source: {name}")

    downloads = root / "runtime-downloads"
    downloads.mkdir()

    def download(name, size, expected):
        url = ("https://raw.githubusercontent.com/YossiMH/bead-me-up-scotty/"
               f"{TRANSFER_COMMIT}/{name}")
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read(size + 1)
        require(len(data) == size and sha(data) == expected, f"Download mismatch: {name}")
        (downloads / name).write_bytes(data)
        return data

    manifest_bytes = download("scotty-runtime.json", 43600, MANIFEST_SHA)
    manifest = json.loads(manifest_bytes)
    require(manifest["source_commit"] == RUNTIME_SOURCE, "Unexpected runtime source")
    require(manifest["build_id"] == BUILD_ID and manifest["sha256"] == RUNTIME_SHA,
            "Unexpected runtime identity")
    combined = b"".join(download(f"scotty-runtime.zip.part{index}", size, expected)
                        for index, (size, expected) in enumerate(PARTS))
    require(len(combined) == manifest["bytes"] == 1959186 and sha(combined) == RUNTIME_SHA,
            "Reconstructed runtime archive mismatch")
    archive_path = downloads / "scotty-runtime.zip"
    archive_path.write_bytes(combined)
    files = manifest["files"]
    names = [entry["path"] for entry in files]
    require(len(names) == len(set(names)) == 230, "Runtime file count mismatch")
    with zipfile.ZipFile(archive_path) as archive:
        require(len(archive.namelist()) == 230 and set(archive.namelist()) == set(names),
                "Archive members differ from the manifest")
        for entry in files:
            name = entry["path"]
            relative = PurePosixPath(name)
            require(not relative.is_absolute() and relative.parts[0] == ".next" and
                    ".." not in relative.parts and "\\" not in name,
                    f"Unsafe archive path: {name}")
            info = archive.getinfo(name)
            require(not info.is_dir() and (info.external_attr >> 16) & 0o170000 != 0o120000,
                    f"Unexpected archive entry type: {name}")
            data = archive.read(info)
            require(len(data) == entry["bytes"] and sha(data) == entry["sha256"],
                    f"Runtime file mismatch: {name}")
            target = product.joinpath(*relative.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    require((product / ".next/BUILD_ID").read_text().strip() == BUILD_ID,
            "Restored BUILD_ID mismatch")
    (results / "scotty-runtime.json").write_bytes(manifest_bytes)
    (results / "inputs.json").write_text(json.dumps({
        "app_commit": APP_COMMIT, "backend_commit": BACKEND_COMMIT,
        "transfer_commit": TRANSFER_COMMIT, "runtime_source": RUNTIME_SOURCE,
        "runtime_sha256": RUNTIME_SHA, "runtime_manifest_sha256": MANIFEST_SHA,
        "runtime_build_id": BUILD_ID, "runtime_files": len(files),
        "source_file_sha256": SOURCE_FILES,
        "workflow_commit": os.environ["GITHUB_SHA"],
        "run_id": os.environ["GITHUB_RUN_ID"],
        "run_attempt": os.environ["GITHUB_RUN_ATTEMPT"],
    }, indent=2) + "\n")
    print(f"Verified source pins and restored {len(files)} runtime files ({BUILD_ID})")


if __name__ == "__main__":
    main()
