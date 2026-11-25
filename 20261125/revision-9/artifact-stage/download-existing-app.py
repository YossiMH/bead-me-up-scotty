"""Download the existing app output as exact ZIP bytes for hosted copy validation."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ARTIFACT_ID = 15003467178
RUN_ID = 45573503400
BYTES = 7056005
SHA256 = "15a503c45ded58ea48fcce7dd293b563d741a3424b64a39a6bd05edf5b1d409d"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, url):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-sha256", required=True)
    args = parser.parse_args()
    packet = Path(__file__).resolve().parent
    manifest_bytes = (packet / "check-inputs.json").read_bytes()
    assert hashlib.sha256(manifest_bytes).hexdigest() == args.manifest_sha256
    manifest = json.loads(manifest_bytes)
    assert hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == manifest["files"][Path(__file__).name]
    assert os.environ.get("GITHUB_ACTIONS") == "true"
    root = Path(os.environ["RUNNER_TEMP"]) / (
        "scotty-stage-inputs-" + os.environ["GITHUB_RUN_ID"] + "-" + os.environ["GITHUB_RUN_ATTEMPT"])
    root.mkdir(exist_ok=False)
    result = {"status": "failed", "operation": "download-existing-app-output",
              "repository": "YossiMH/bead-me-up-scotty", "artifact_id": ARTIFACT_ID,
              "producer_run_id": RUN_ID, "app_or_native_execution": False}
    started = time.monotonic()
    try:
        opener = urllib.request.build_opener(NoRedirect)
        headers = {"Authorization": "Bearer " + os.environ["GITHUB_TOKEN"],
                   "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                   "User-Agent": "scotty-owned-archive-check"}
        api = "https://api.github.com/repos/YossiMH/bead-me-up-scotty/actions/artifacts/" + str(ARTIFACT_ID)
        with opener.open(urllib.request.Request(api, headers=headers), timeout=20) as response:
            metadata_bytes = response.read(65537)
        assert len(metadata_bytes) <= 65536
        metadata = json.loads(metadata_bytes)
        assert metadata["id"] == ARTIFACT_ID and metadata["workflow_run"]["id"] == RUN_ID
        assert metadata["size_in_bytes"] == BYTES and metadata["digest"] == "sha256:" + SHA256
        assert not metadata["expired"]
        location = None
        try:
            with opener.open(urllib.request.Request(api + "/zip", headers=headers), timeout=20):
                raise RuntimeError("Expected the artifact service's temporary download redirect")
        except urllib.error.HTTPError as error:
            if error.code != 302:
                raise RuntimeError("Artifact redirect request returned HTTP " + str(error.code)) from None
            location = error.headers.get("Location")
        parsed = urllib.parse.urlparse(location or "")
        assert parsed.scheme == "https" and parsed.hostname and parsed.username is None and parsed.password is None
        digest = hashlib.sha256()
        downloaded = 0
        target = root / "app-output.zip"
        # This second request has no API token or authorization header.
        with urllib.request.urlopen(urllib.request.Request(location), timeout=20) as response, target.open("xb") as output:
            while True:
                if time.monotonic() - started >= 90:
                    raise RuntimeError("Artifact download exceeded its 90-second bound")
                chunk = response.read(65536)
                if not chunk:
                    break
                downloaded += len(chunk)
                if downloaded > BYTES:
                    raise RuntimeError("Artifact download exceeded its measured size")
                output.write(chunk)
                digest.update(chunk)
        assert downloaded == BYTES and digest.hexdigest() == SHA256
        result.update(status="passed", archive="app-output.zip", bytes=downloaded,
                      sha256=digest.hexdigest(), output_name=metadata["name"])
    except Exception as error:
        # Retain the failure kind without credentials or temporary redirect URLs.
        result["error_type"] = type(error).__name__
        raise RuntimeError("Existing app artifact verification failed: " + type(error).__name__) from None
    finally:
        result["duration_seconds"] = round(time.monotonic() - started, 3)
        text = json.dumps(result, indent=2) + "\n"
        (root / "download-result.json").write_text(text, encoding="utf-8")
        print(text, flush=True)


if __name__ == "__main__":
    main()
