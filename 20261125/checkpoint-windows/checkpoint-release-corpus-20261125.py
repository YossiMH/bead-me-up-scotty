#!/usr/bin/env python3
"""Verify exact public checkpoint recovery with qualified Linux or Windows release bytes."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import time
from datetime import datetime, timezone

ORIGINAL_COMMIT = "afac9fa0ce9533a707d745018d16a25e4ccff492"
ORIGINAL_POINTER_SHA256 = "f1a2009037599216140c8a6832480e4d869d596f8001c29a6fc0f1788f42aa43"
ORIGINAL_ROOT_SHA256 = "4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d"
ORIGINAL_ROOT_PATH = "objects/" + ORIGINAL_ROOT_SHA256 + ".jsonl"
ORIGINAL_ROOT_BYTES = 8569277
ORIGINAL_GENERATION = "gen-a569f746bbb268015d996c8ed4c76f57"
ORIGINAL_UUID = "1c4f5d56-dcff-cbc5-ddf9-c536653c45f4"
ORIGINAL_COUNTS = {"issue": 954, "event": 11264, "provenance_receipt": 5, "attempt_outcome": 413}
COUNT_FIELDS = {"issue": "issue_count", "event": "event_count",
                "provenance_receipt": "receipt_count", "attempt_outcome": "attempt_outcome_count"}
SHA256 = re.compile(r"^[a-f0-9]{64}$")
SHA1 = re.compile(r"^[a-f0-9]{40}$")
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TREE_BYTES = 128 * 1024 * 1024
MAX_TREE_FILES = 10000
MAX_RECORDS = 15000
COMMAND_SECONDS = 120
PHASE_SECONDS = 900
WINDOWS_JOB_HELPER_SHA256 = "2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f"
FIXTURE_TITLE = "checkpoint release recovery fixture"


def require(value, message):
    if not value:
        raise RuntimeError(message)


def utc():
    return datetime.now(timezone.utc).isoformat()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON key: " + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError("Non-JSON numeric constant: " + value)


def parse_json(data):
    return json.loads(data, object_pairs_hook=unique_object, parse_constant=invalid_constant)


def canonical_bytes(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def value_hash(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())


def safe_existing(path, directory=False):
    path = Path(path)
    require(path.is_absolute(), "Absolute path required")
    require(os.path.normcase(str(path.resolve(strict=True))) == os.path.normcase(str(path)),
            "Redirected or symbolic path: " + str(path))
    mode = path.lstat().st_mode
    require(stat.S_ISDIR(mode) if directory else stat.S_ISREG(mode),
            "Unexpected file type: " + str(path))
    return path


def relative_path(value):
    require(isinstance(value, str) and value and "\\" not in value and ":" not in value
            and all(ord(c) >= 32 and ord(c) != 127 for c in value), "Invalid relative path")
    parts = value.split("/")
    require(not value.startswith("/") and all(p not in ("", ".", "..") for p in parts),
            "Unsafe relative path: " + value)
    return PurePosixPath(value)


def checked_file(root, relative):
    parts = relative_path(relative).parts
    path = root.joinpath(*parts)
    require(path.is_relative_to(root), "File leaves its owned source")
    return safe_existing(path)


def read_bytes(path, bound=MAX_FILE_BYTES):
    safe_existing(path)
    require(0 <= path.stat().st_size <= bound, "File exceeds its reviewed bound: " + str(path))
    return path.read_bytes()


def file_record(path, root):
    safe_existing(path)
    return {"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size,
            "sha256": file_hash(path)}


def tree_fingerprint(root):
    safe_existing(root, directory=True)
    files = {}
    directories = []
    total = 0
    for directory, subdirs, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        safe_existing(parent, directory=True)
        for name in sorted(subdirs):
            child = safe_existing(parent / name, directory=True)
            directories.append(child.relative_to(root).as_posix())
        for name in sorted(names):
            child = safe_existing(parent / name)
            require(child.stat().st_size <= MAX_FILE_BYTES, "Source-tree file exceeds bound")
            total += child.stat().st_size
            require(total <= MAX_TREE_BYTES and len(files) < MAX_TREE_FILES, "Source tree exceeds bound")
            row = file_record(child, root)
            files[row["path"]] = row
    value = {"files": files, "directories": sorted(directories), "bytes": total}
    return {"sha256": value_hash(value), **value}


def record_key(kind, payload):
    require(isinstance(payload, dict), "Record payload must be an object")
    if kind == "issue":
        key = payload.get("id")
    elif kind == "event":
        origin = payload.get("origin_store_uuid")
        sequence = payload.get("origin_event_sequence")
        require(isinstance(origin, str) and origin and type(sequence) is int and sequence > 0,
                "Invalid canonical event identity")
        key = origin + ":" + str(sequence)
    elif kind == "provenance_receipt":
        key = payload.get("receipt_id")
    elif kind == "attempt_outcome":
        key = payload.get("attempt_id")
    else:
        raise RuntimeError("Unexpected record class in the public recovery fixture: " + str(kind))
    require(isinstance(key, str) and key, "Missing record identity")
    return key


def load_checkpoint(root, pointer_name="current.json"):
    safe_existing(root, directory=True)
    pointer_path = checked_file(root, pointer_name)
    pointer_bytes = read_bytes(pointer_path, 1024 * 1024)
    pointer = parse_json(pointer_bytes)
    require(pointer.get("schema_version") == 1, "Unexpected pointer schema")
    require(re.fullmatch(r"gen-[a-f0-9]{32}", pointer.get("generation_id", "")), "Invalid generation")
    require(pointer.get("store_uuid") == ORIGINAL_UUID, "Checkpoint changed the original store UUID")
    mode = pointer.get("mode")
    require(mode in ("monolithic", "set-v2"), "Unexpected fixture checkpoint mode")
    root_row = pointer["active_root"]
    require(SHA256.fullmatch(root_row["sha256"]), "Invalid manifest/root hash")
    root_path = checked_file(root, root_row["path"])
    require(root_row["path"].startswith("objects/" if mode == "monolithic" else "set/"),
            "Root path has the wrong namespace")
    root_bytes = read_bytes(root_path)
    require(hashlib.sha256(root_bytes).hexdigest() == root_row["sha256"], "Selected root hash differs")
    closure = {pointer_name: file_record(pointer_path, root),
               root_row["path"]: file_record(root_path, root)}
    maps = {kind: {} for kind in ORIGINAL_COUNTS}
    hashes = {kind: {} for kind in ORIGINAL_COUNTS}
    seen_outcome_receipts = set()
    corpus_digest = hashlib.sha256()
    visited_rows = set()

    def verified_artifact(row):
        relative = row["path"]
        require(relative.startswith("set/"), "Set artifact leaves its namespace")
        path = checked_file(root, relative)
        data = read_bytes(path)
        require(SHA256.fullmatch(row["sha256"]), "Invalid set artifact hash")
        require(hashlib.sha256(data).hexdigest() == row["sha256"], "Selected artifact hash differs: " + relative)
        require(type(row.get("byte_length")) is int and len(data) == row["byte_length"],
                "Selected artifact byte length differs: " + relative)
        record = file_record(path, root)
        require(relative not in closure or closure[relative] == record, "Artifact identity changed while reading")
        closure[relative] = record
        return data

    def consume(data, row=None):
        count = 0
        kinds = []
        for raw in data.splitlines(keepends=True):
            line = raw[:-1] if raw.endswith(b"\n") else raw
            line = line[:-1] if line.endswith(b"\r") else line
            if not line.strip():
                continue
            record = parse_json(line)
            if record.get("ref") is True:
                require(mode == "set-v2", "Oversize reference outside set-v2")
                reference_kind = record.get("record_type")
                body = verified_artifact(record)
                record = parse_json(body)
                require(record.get("ref") is not True, "Nested oversize reference refused")
                require(record.get("record_type") == reference_kind, "Oversize reference class differs")
                corpus_digest.update(body)
            else:
                corpus_digest.update(line)
            corpus_digest.update(b"\n")
            kind = record.get("record_type")
            require(kind in maps, "Unexpected record type: " + str(kind))
            payload = record.get(kind)
            key = record_key(kind, payload)
            require(key not in maps[kind], "Duplicate " + kind + " identity: " + key)
            if kind == "attempt_outcome":
                receipt = payload.get("receipt_id")
                require(isinstance(receipt, str) and receipt and receipt not in seen_outcome_receipts,
                        "Duplicate or missing attempt receipt identity")
                seen_outcome_receipts.add(receipt)
            maps[kind][key] = record
            hashes[kind][key] = value_hash(record)
            count += 1
            kinds.append(kind)
            require(sum(len(values) for values in maps.values()) <= MAX_RECORDS, "Record count exceeds fixture bound")
        if row is not None:
            if "record_count" in row:
                require(type(row["record_count"]) is int and row["record_count"] == count,
                        "Shard record count differs")
                require(all(kind == row["class"] for kind in kinds), "Shard class differs")
            else:
                require(type(row.get("event_count")) is int and row["event_count"] == count
                        and all(kind == "event" for kind in kinds), "Segment/tail event count differs")
        return count

    manifest = None
    if mode == "monolithic":
        consume(root_bytes)
    else:
        manifest = parse_json(root_bytes)
        require(manifest.get("format") == "checkpoint-set-v2" and manifest.get("schema_version") == 1,
                "Unexpected set-v2 manifest")
        require(manifest["store_uuid"] == pointer["store_uuid"]
                and manifest["snapshot_sequence"] == pointer["snapshot_sequence"], "Manifest identity differs")
        rows = list(manifest["shards"]) + list(manifest["segments"])
        if manifest["tail"] is not None:
            rows.append(manifest["tail"])
        for row in rows:
            require(row["path"] not in visited_rows, "Repeated artifact row")
            visited_rows.add(row["path"])
            consume(verified_artifact(row), row)

    counts = {kind: len(values) for kind, values in maps.items()}
    for container in (pointer,) if manifest is None else (pointer, manifest):
        for kind, field in COUNT_FIELDS.items():
            require(type(container.get(field)) is int and container[field] == counts[kind],
                    "Published " + field + " differs from actual records")
        require(container.get("redaction_record_count") == 0, "Unexpected redaction records")
        require(container.get("total_record_count") == sum(counts.values()), "Published total count differs")
    summary = {"generation_id": pointer["generation_id"], "mode": mode, "counts": counts,
               "snapshot_sequence": pointer["snapshot_sequence"], "store_uuid": pointer["store_uuid"],
               "pointer_name": pointer_name, "pointer_sha256": hashlib.sha256(pointer_bytes).hexdigest(),
               "root_path": root_row["path"], "root_sha256": root_row["sha256"],
               "imported_record_corpus_sha256": corpus_digest.hexdigest(),
               "complete_record_index_sha256": value_hash(hashes), "closure": closure}
    return {"root": root, "pointer": pointer, "pointer_bytes": pointer_bytes,
            "manifest": manifest, "records": maps, "record_hashes": hashes, "summary": summary}


def compare_preserved(before, after, expected_extras):
    extras = {}
    comparisons = {}
    for kind, original in before["record_hashes"].items():
        recovered = after["record_hashes"][kind]
        missing = sorted(set(original) - set(recovered))
        changed = sorted(key for key in original.keys() & recovered.keys() if original[key] != recovered[key])
        require(not missing and not changed, "Original " + kind + " records changed: missing="
                + repr(missing[:5]) + " changed=" + repr(changed[:5]))
        added = sorted(set(recovered) - set(original))
        require(len(added) == expected_extras[kind], "Unexpected additional " + kind + " records")
        extras[kind] = added
        comparisons[kind] = {"original_members_checked": len(original), "missing": missing,
                             "changed": changed, "added_ids": added}
    return {"status": "passed", "complete_original_record_index_sha256": before["summary"]["complete_record_index_sha256"],
            "recovered_record_index_sha256": after["summary"]["complete_record_index_sha256"],
            "comparisons": comparisons}, extras


def clean_environment(root):
    env = dict(os.environ)
    for key in list(env):
        upper = key.upper()
        if upper.startswith(("BEAD", "GIT_", "CARGO_", "RUSTC_", "RUSTDOC_")) or upper in {
            "RUSTFLAGS", "RUSTDOCFLAGS", "RUSTC", "RUSTDOC", "RUSTUP_TOOLCHAIN",
            "TMPDIR", "TMP", "TEMP", "LD_PRELOAD", "LD_LIBRARY_PATH",
        }:
            del env[key]
    env.update({"TMPDIR": str(root / "tmp"), "TMP": str(root / "tmp"),
                "TEMP": str(root / "tmp"), "GIT_OPTIONAL_LOCKS": "0",
                "GIT_CEILING_DIRECTORIES": str(root.parent)})
    if os.name != "nt":
        env["LC_ALL"] = "C.UTF-8"
    return env


class NativeRunner:
    def __init__(self, binary, binary_hash, root, deadline, supervision):
        self.binary = binary
        self.binary_hash = binary_hash
        self.root = root
        self.deadline = deadline
        self.env = clean_environment(root)
        self.supervision = supervision
        self.commands = []
        self.active = None
        self.cleanup = []

    def stop_owned_group(self, process, label):
        record = {"label": label, "pid": process.pid, "signals": [], "remaining": False}
        if os.name == "nt":
            record["outer_job_cleanup_verification_required"] = True
            record["child_exit_code"] = process.poll()
            self.cleanup.append(record)
            return record
        for sig, grace in ((signal.SIGTERM, 2.0), (signal.SIGKILL, 2.0)):
            try:
                os.killpg(process.pid, 0)
            except ProcessLookupError:
                break
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                break
            record["signals"].append(sig.name)
            until = time.monotonic() + grace
            while time.monotonic() < until:
                process.poll()
                try:
                    os.killpg(process.pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(0.05)
        process.poll()
        try:
            os.killpg(process.pid, 0)
            record["remaining"] = True
        except ProcessLookupError:
            pass
        self.cleanup.append(record)
        return record

    def run(self, args, cwd, label):
        require(self.active is None, "Concurrent native commands are forbidden")
        require(file_hash(self.binary) == self.binary_hash, "Release binary changed")
        remaining = self.deadline - time.monotonic()
        require(remaining > 0, "Public-corpus verification deadline reached")
        command = [str(self.binary), *args]
        out = self.root / "logs" / (label + ".stdout")
        err = self.root / "logs" / (label + ".stderr")
        record = {"label": label, "args": command, "cwd": str(cwd), "started": utc(),
                  "timeout_seconds": min(COMMAND_SECONDS, remaining),
                  "stdout": out.relative_to(self.root).as_posix(),
                  "stderr": err.relative_to(self.root).as_posix()}
        write_json(self.root / "logs" / (label + ".started.json"), record)
        process = None
        failure = None
        try:
            with out.open("xb") as stdout, err.open("xb") as stderr:
                options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW} \
                    if os.name == "nt" else {"start_new_session": True}
                process = subprocess.Popen(command, cwd=cwd, env=self.env, stdin=subprocess.DEVNULL,
                                           stdout=stdout, stderr=stderr, **options)
                self.active = process
                record["pid"] = process.pid
                process.wait(timeout=record["timeout_seconds"])
                stdout.flush()
                stderr.flush()
                os.fsync(stdout.fileno())
                os.fsync(stderr.fileno())
            require(process.returncode == 0, label + " exited " + str(process.returncode))
        except BaseException as error:
            failure = error
        finally:
            if process is not None:
                cleanup = self.stop_owned_group(process, label)
                record["exit_code"] = process.poll()
                record["cleanup"] = cleanup
                if os.name != "nt" and (cleanup["remaining"] or cleanup["signals"]) and failure is None:
                    failure = RuntimeError("Unexpected native descendants after " + label)
            self.active = None
            record["finished"] = utc()
            record["error"] = None if failure is None else type(failure).__name__ + ": " + str(failure)
            if out.exists():
                record["stdout_file"] = file_record(out, self.root)
            if err.exists():
                record["stderr_file"] = file_record(err, self.root)
            self.commands.append(record)
            write_json(self.root / "logs" / (label + ".exit.json"), record)
        if failure is not None:
            raise failure
        return out.read_bytes()


def retain_snapshot(snapshot, label, output):
    evidence = output / "evidence"
    directory = evidence / label
    directory.mkdir()
    for relative, expected in sorted(snapshot["summary"]["closure"].items()):
        source = checked_file(snapshot["root"], relative)
        require(file_record(source, snapshot["root"]) == expected, "Snapshot changed before retention")
        destination = directory.joinpath(*relative_path(relative).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with source.open("rb") as reader, destination.open("xb") as writer:
            shutil.copyfileobj(reader, writer, 1024 * 1024)
            writer.flush()
            os.fsync(writer.fileno())
        require(file_hash(destination) == expected["sha256"], "Retained selected file differs")
    write_json(evidence / (label + "-record-index.json"), snapshot["record_hashes"])
    write_json(evidence / (label + "-selection.json"), snapshot["summary"])


def verify_restore_report(report, source, actor):
    pointer = source["pointer"]
    require(report["generation_id"] == pointer["generation_id"] and report["mode"] == pointer["mode"],
            "Restore selected a different generation")
    require(report["source_root_path"] == pointer["active_root"]["path"]
            and report["source_root_sha256"] == pointer["active_root"]["sha256"], "Restore root binding differs")
    require(report["source_store_uuid"] == ORIGINAL_UUID and report["target_store_uuid"] == ORIGINAL_UUID,
            "Restore changed original identity")
    require(report["snapshot_sequence"] == pointer["snapshot_sequence"] and report["actor"] == actor,
            "Restore report identity differs")
    require(report["issues_restored"] == pointer["issue_count"]
            and report["events_restored"] == pointer["event_count"]
            and report["provenance_receipts_restored"] == pointer["receipt_count"], "Restore report counts differ")
    require(report["non_empty_override"] is False and report["local_recovery_succeeded"] is True
            and report["secret_quarantined"] is False
            and report["checkpoint_publication_withheld"] is False, "Restore did not publish a clean fresh target")
    require(isinstance(report["displaced"], dict)
            and set(report["displaced"]) == {"issues", "events", "provenance_receipts",
                                              "attempt_outcomes", "redaction_records",
                                              "saved_views", "recurrence_templates"}
            and all(type(v) is int and v == 0 for v in report["displaced"].values()),
            "Restore displaced existing target state")
    require(type(report["summary_event_sequence"]) is int and report["summary_event_sequence"] > 0,
            "Missing actual restore summary sequence")
    require(isinstance(report["restore_receipt_id"], str) and report["restore_receipt_id"]
            and SHA256.fullmatch(report["restore_receipt_sha256"]), "Missing actual restore receipt")


def verify_restore_additions(source, restored, extras, report, actor):
    event = restored["records"]["event"][extras["event"][0]]["event"]
    receipt_key = extras["provenance_receipt"][0]
    receipt = restored["records"]["provenance_receipt"][receipt_key]["provenance_receipt"]
    require(receipt_key == report["restore_receipt_id"]
            and receipt["receipt_sha256"] == report["restore_receipt_sha256"], "Restore receipt identity differs")
    require(receipt["kind"] == "restore" and receipt["actor"] == actor and receipt["result"] == "success",
            "Unexpected new provenance receipt")
    require(receipt["source_store_uuid"] == ORIGINAL_UUID and receipt["target_store_uuid"] == ORIGINAL_UUID
            and receipt["source_root_sha256"] == source["summary"]["root_sha256"], "Receipt source binding differs")
    expected_counts = {"issues": source["summary"]["counts"]["issue"],
                       "events": source["summary"]["counts"]["event"],
                       "provenance_receipts": source["summary"]["counts"]["provenance_receipt"]}
    require(canonical_bytes(receipt["counts"]) == canonical_bytes(expected_counts), "Restore receipt counts differ")
    require(receipt["summary_event_identity"] == "local-" + str(report["summary_event_sequence"]),
            "Receipt does not identify the reported local summary")
    recipe = "".join((receipt_key, "restore", source["summary"]["root_sha256"], actor,
                      receipt["created_at"], "success"))
    require(hashlib.sha256(recipe.encode("utf-8")).hexdigest() == receipt["receipt_sha256"],
            "New receipt canonical hash differs")
    require(event["kind"] == "checkpoint_restored" and event["actor"] == actor
            and event["issue_id"] is None and event["origin_store_uuid"] == ORIGINAL_UUID,
            "Unexpected new restore event")
    expected_detail = {"source_store_uuid": ORIGINAL_UUID, "source_root_sha256": source["summary"]["root_sha256"],
                       "snapshot_sequence": source["pointer"]["snapshot_sequence"],
                       "issues_restored": expected_counts["issues"], "events_restored": expected_counts["events"],
                       "provenance_receipts_restored": expected_counts["provenance_receipts"],
                       "replaced_non_empty_target": False}
    require(canonical_bytes(event["detail"]) == canonical_bytes(expected_detail), "Restore summary detail differs")
    old_max = max(record["event"]["origin_event_sequence"]
                  for record in source["records"]["event"].values()
                  if record["event"]["origin_store_uuid"] == ORIGINAL_UUID)
    require(event["origin_event_sequence"] == old_max + 1, "Restore reused or skipped a canonical origin identity")
    return {"restore_event_identity": extras["event"][0], "restore_receipt_id": receipt_key,
            "reported_local_summary_sequence": report["summary_event_sequence"],
            "local_and_origin_sequences_compared_as_distinct_fields": True}


def restore_and_compare(runner, source, target, label, output):
    require(not target.exists(), "Recovery target already exists")
    target.mkdir()
    actor = "checkpoint-release-" + label
    before = tree_fingerprint(source["root"])
    write_json(output / "reports" / (label + "-source-before.json"), before)
    failure = None
    stdout = None
    try:
        stdout = runner.run(["--skip-foreign-workspace", "restore", "--source", str(source["root"]),
                             "--generation", source["pointer"]["generation_id"],
                             "--actor", actor, "--format", "json"], target, label + "-restore")
    except BaseException as error:
        failure = error
    after = tree_fingerprint(source["root"])
    write_json(output / "reports" / (label + "-source-after.json"), after)
    require(before == after, "Verification restore changed its source checkpoint tree")
    if failure is not None:
        raise failure
    report = parse_json(stdout)
    verify_restore_report(report, source, actor)
    write_json(output / "reports" / (label + "-restore-report.json"), report)
    restored = load_checkpoint(target / ".beads" / "checkpoint")
    require(restored["pointer"]["mode"] == "set-v2", "Fresh restore did not publish set-v2")
    comparison, extras = compare_preserved(
        source, restored, {"issue": 0, "event": 1, "provenance_receipt": 1, "attempt_outcome": 0})
    comparison["restore_additions"] = verify_restore_additions(source, restored, extras, report, actor)
    comparison["source_fingerprint_sha256"] = before["sha256"]
    comparison["source_unchanged"] = True
    write_json(output / "reports" / (label + "-complete-comparison.json"), comparison)
    retain_snapshot(restored, label, output)
    return restored, comparison


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--original-checkpoint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    parser.add_argument("--supervision", choices=("owned-process-groups", "outer-windows-job"), required=True)
    args = parser.parse_args()
    require(os.environ.get("GITHUB_ACTIONS") == "true", "This qualification route requires a hosted runner")
    require(sys.platform.startswith("linux") or os.name == "nt", "Unsupported qualification host")
    require(args.supervision == ("outer-windows-job" if os.name == "nt" else "owned-process-groups"),
            "Wrong platform supervision contract")
    require(SHA256.fullmatch(args.inputs_sha256) and SHA256.fullmatch(args.helper_sha256),
            "Exact helper and input hashes are required")
    helper = safe_existing(Path(__file__).absolute())
    require(file_hash(helper) == args.helper_sha256, "Portable verifier bytes changed")
    inputs_path = safe_existing(Path(args.inputs))
    require(file_hash(inputs_path) == args.inputs_sha256, "Qualification inputs changed")
    inputs = parse_json(read_bytes(inputs_path, 1024 * 1024))
    require(inputs.get("schema_version") == 1, "Unexpected qualification input schema")
    for name in ("source_commit", "source_tree"):
        require(isinstance(inputs.get(name), str) and SHA1.fullmatch(inputs[name]), "Missing exact " + name)
    for name in ("release_sha256", "metadata_sha256"):
        require(isinstance(inputs.get(name), str) and SHA256.fullmatch(inputs[name]), "Missing exact " + name)
    require(inputs.get("original_public_commit") == ORIGINAL_COMMIT, "Wrong public corpus source")
    if os.name == "nt":
        require(inputs.get("windows_job_helper_sha256") == WINDOWS_JOB_HELPER_SHA256,
                "Windows outer Job contract is not bound")
        require(inputs["target"] in ("x86_64-pc-windows-msvc", "x86_64-pc-windows-gnu"),
                "Wrong Windows target")
    else:
        require(inputs["target"] == "x86_64-unknown-linux-gnu", "Wrong Linux target")
    binary = safe_existing(Path(args.binary))
    metadata_path = safe_existing(Path(args.metadata))
    require(file_hash(binary) == inputs["release_sha256"]
            and binary.stat().st_size == inputs["release_bytes"], "Release bytes differ")
    require(file_hash(metadata_path) == inputs["metadata_sha256"], "Build metadata differs")
    metadata = parse_json(read_bytes(metadata_path, 1024 * 1024))
    require(metadata["git_commit_sha"] == inputs["source_commit"]
            and metadata["build_target"] == inputs["target"]
            and metadata["binary_sha256"] == inputs["release_sha256"]
            and metadata["binary_size_bytes"] == inputs["release_bytes"], "Release/source/target metadata differs")
    require(metadata["source"] == "git-archive" and metadata["build_features"] == "default"
            and metadata["build_profile"] == "release", "Expected the unchanged default archive-build route")
    original_input = safe_existing(Path(args.original_checkpoint), directory=True)
    original_pointer = checked_file(original_input, "current.json")
    original_object = checked_file(original_input, ORIGINAL_ROOT_PATH)
    require(file_hash(original_pointer) == ORIGINAL_POINTER_SHA256, "Original public pointer differs")
    require(original_object.stat().st_size == ORIGINAL_ROOT_BYTES
            and file_hash(original_object) == ORIGINAL_ROOT_SHA256, "Original public object differs")
    runner_temp = safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    output = Path(args.output)
    require(output.is_absolute() and output.parent == runner_temp and not output.exists(),
            "Output must be a fresh direct child of the hosted temporary directory")
    for ancestor in (output.parent, *output.parent.parents):
        require(not (ancestor / ".git").exists(), "Fixtures would inherit a Git workspace")
    output.mkdir()
    for name in ("logs", "reports", "evidence", "workspaces", "tmp", "probes"):
        (output / name).mkdir()
    began = time.monotonic()
    runner = NativeRunner(binary, inputs["release_sha256"], output, began + PHASE_SECONDS - 10, args.supervision)
    result = {"schema_version": 1, "status": "failed", "operation": "public-original-checkpoint-recovery",
              "started": utc(), "phase_seconds": PHASE_SECONDS, "command_seconds": COMMAND_SECONDS,
              "input_sha256": args.inputs_sha256, "helper_sha256": args.helper_sha256,
              "release_sha256": inputs["release_sha256"], "metadata_sha256": inputs["metadata_sha256"],
              "source_commit": inputs["source_commit"], "source_tree": inputs["source_tree"],
              "target": inputs["target"], "output": str(output), "supervision": args.supervision,
              "run": {"id": os.environ.get("GITHUB_RUN_ID"), "attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
                      "workflow_commit": os.environ.get("GITHUB_SHA"), "repository": os.environ.get("GITHUB_REPOSITORY")},
              "original_public_source": {"commit": ORIGINAL_COMMIT, "pointer_sha256": ORIGINAL_POINTER_SHA256,
                                         "root_sha256": ORIGINAL_ROOT_SHA256, "root_bytes": ORIGINAL_ROOT_BYTES,
                                         "generation": ORIGINAL_GENERATION, "store_uuid": ORIGINAL_UUID,
                                         "counts": ORIGINAL_COUNTS},
              "sqlite_access": "Native CLI only against four newly created public-data fixture workspaces.",
              "cleanup": {"fixtures": "Retained under the owned hosted output directory.",
                          "outer_windows_job_verification_required": os.name == "nt"}}
    write_json(output / "attempt-started.json", result)
    old_term = None
    old_alarm = None
    if os.name != "nt":
        def phase_timeout(_signal, _frame):
            raise TimeoutError("Portable corpus phase deadline or supervisor stop")
        old_term = signal.signal(signal.SIGTERM, phase_timeout)
        old_alarm = signal.signal(signal.SIGALRM, phase_timeout)
        signal.setitimer(signal.ITIMER_REAL, PHASE_SECONDS - 5)
    try:
        write_json(output / "reports" / "bound-inputs.json", inputs)
        write_json(output / "reports" / "bound-build-metadata.json", metadata)
        original_copy = output / "evidence" / "original-public-source"
        original_copy.mkdir()
        for relative in ("current.json", ORIGINAL_ROOT_PATH):
            source = checked_file(original_input, relative)
            destination = original_copy.joinpath(*relative_path(relative).parts)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with source.open("rb") as reader, destination.open("xb") as writer:
                shutil.copyfileobj(reader, writer, 1024 * 1024)
                writer.flush()
                os.fsync(writer.fileno())
        original = load_checkpoint(original_copy)
        require(original["summary"]["pointer_sha256"] == ORIGINAL_POINTER_SHA256
                and original["summary"]["root_sha256"] == ORIGINAL_ROOT_SHA256
                and original["pointer"]["generation_id"] == ORIGINAL_GENERATION
                and original["pointer"]["snapshot_sequence"] == 29609
                and original["pointer"]["mode"] == "monolithic"
                and original["summary"]["counts"] == ORIGINAL_COUNTS, "Original checkpoint identity/counts differ")
        sequences = sorted(record["event"]["origin_event_sequence"]
                           for record in original["records"]["event"].values()
                           if record["event"]["origin_store_uuid"] == ORIGINAL_UUID)
        require(sequences == list(range(1, 11265)), "Original canonical event identities differ")
        write_json(output / "evidence" / "original-record-index.json", original["record_hashes"])
        write_json(output / "evidence" / "original-selection.json", original["summary"])
        version = runner.run(["--version"], output / "probes", "version").decode("utf-8").strip()
        require(version, "Empty native version output")
        if metadata.get("embedded_version_string") is not None:
            require(version == metadata["embedded_version_string"], "Executed version differs from archive metadata")
        runner.run(["capabilities"], output / "probes", "capabilities")
        runner.run(["update", "--help"], output / "probes", "update-help")
        result["version"] = version

        workspace = output / "workspaces" / "restored-original"
        initial, original_comparison = restore_and_compare(runner, original, workspace, "restored-original", output)
        config_path = workspace / ".beads" / "config.json"
        original_config = read_bytes(config_path, 1024 * 1024)
        runner.run(["sync", "flush-only"], workspace, "publish-restored-original")
        before_append = load_checkpoint(workspace / ".beads" / "checkpoint")
        unchanged_publish, _ = compare_preserved(initial, before_append, dict.fromkeys(ORIGINAL_COUNTS, 0))
        require(read_bytes(config_path, 1024 * 1024) == original_config, "Publication changed checkpoint settings")
        require(before_append["pointer"]["mode"] == "set-v2", "Default publication is not set-v2")
        retain_snapshot(before_append, "selected-before-append", output)
        write_json(output / "reports" / "publication-preserves-records.json", unchanged_publish)
        _, current_before_comparison = restore_and_compare(
            runner, before_append, output / "workspaces" / "verify-current-before", "verify-current-before", output)

        runner.run(["create", "--title", FIXTURE_TITLE, "--no-auto-flush"], workspace, "create-fixture")
        runner.run(["sync", "flush-only"], workspace, "publish-after-create")
        require(read_bytes(config_path, 1024 * 1024) == original_config, "Isolated creation changed checkpoint settings")
        current = load_checkpoint(workspace / ".beads" / "checkpoint", "current.json")
        previous = load_checkpoint(workspace / ".beads" / "checkpoint", "previous.json")
        require(current["pointer"]["generation_id"] != before_append["pointer"]["generation_id"],
                "Creation did not publish a new generation")
        require(previous["pointer_bytes"] == before_append["pointer_bytes"], "Previous pointer bytes changed")
        previous_comparison, _ = compare_preserved(before_append, previous, dict.fromkeys(ORIGINAL_COUNTS, 0))
        create_comparison, extras = compare_preserved(
            before_append, current, {"issue": 1, "event": 1, "provenance_receipt": 0, "attempt_outcome": 0})
        issue_id = extras["issue"][0]
        issue = current["records"]["issue"][issue_id]["issue"]
        event = current["records"]["event"][extras["event"][0]]["event"]
        require(issue["title"] == FIXTURE_TITLE and event["kind"] == "created"
                and event["issue_id"] == issue_id and event["detail"]["title"] == FIXTURE_TITLE,
                "Unexpected isolated create effect")
        prior_max = max(record["event"]["origin_event_sequence"]
                        for record in before_append["records"]["event"].values())
        require(event["origin_store_uuid"] == ORIGINAL_UUID and event["origin_event_sequence"] == prior_max + 1,
                "Isolated create did not append one fresh canonical event")
        for selected in (current, previous):
            tail = selected["manifest"]["tail"]
            if tail is not None:
                require(tail["path"] == "set/tail/" + tail["sha256"] + ".jsonl",
                        "New selected tail is not content-addressed")
        retain_snapshot(current, "current-after-append", output)
        retain_snapshot(previous, "previous-after-append", output)
        write_json(output / "reports" / "previous-generation-preservation.json", previous_comparison)
        write_json(output / "reports" / "isolated-create-comparison.json", create_comparison)
        _, current_comparison = restore_and_compare(
            runner, current, output / "workspaces" / "verify-current-after", "verify-current-after", output)
        _, previous_restore_comparison = restore_and_compare(
            runner, previous, output / "workspaces" / "verify-previous-after", "verify-previous-after", output)

        require(file_hash(original_pointer) == ORIGINAL_POINTER_SHA256
                and file_hash(original_object) == ORIGINAL_ROOT_SHA256, "Original public input changed")
        require(file_hash(binary) == inputs["release_sha256"]
                and file_hash(metadata_path) == inputs["metadata_sha256"]
                and file_hash(inputs_path) == args.inputs_sha256
                and file_hash(helper) == args.helper_sha256, "Qualification inputs changed during execution")
        require(read_bytes(config_path, 1024 * 1024) == original_config, "Verification changed source settings")
        result.update({"status": "passed", "original_public_input_unchanged": True,
                       "checkpoint_configuration_unchanged": True,
                       "original_complete_record_index_sha256": original["summary"]["complete_record_index_sha256"],
                       "generations": {name: {key: value for key, value in snapshot["summary"].items()
                                               if key != "closure"}
                                       for name, snapshot in (("original", original), ("before_append", before_append),
                                                              ("current", current), ("previous", previous))},
                       "isolated_issue_id": issue_id,
                       "comparisons": {"original_restore": original_comparison,
                                       "published_current_restore": current_before_comparison,
                                       "previous_preserved": previous_comparison,
                                       "isolated_create": create_comparison,
                                       "current_restore_after_append": current_comparison,
                                       "previous_restore_after_append": previous_restore_comparison},
                       "verification_restores": 4, "all_original_attempt_outcomes_preserved": 413,
                       "evidence_directories": ["evidence", "reports", "logs"]})
    except BaseException as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if runner.active is not None:
            runner.stop_owned_group(runner.active, "final-cleanup")
        if os.name != "nt":
            signal.setitimer(signal.ITIMER_REAL, 0)
            signal.signal(signal.SIGTERM, old_term)
            signal.signal(signal.SIGALRM, old_alarm)
        result["commands"] = runner.commands
        result["process_cleanup"] = runner.cleanup
        result["finished"] = utc()
        result["duration_seconds"] = round(time.monotonic() - began, 3)
        if result["duration_seconds"] > PHASE_SECONDS:
            result["status"] = "failed"
            result["error"] = "Portable corpus phase exceeded its 900-second deadline"
        if any(row.get("remaining") for row in runner.cleanup):
            result["status"] = "failed"
            result["error"] = "Owned native processes remain"
        write_json(output / "result.json", result)
        data = (output / "result.json").read_bytes()
        require(len(data) <= 256 * 1024, "Result metadata exceeds stdout bound")
        print("CHECKPOINT_CORPUS_RESULT_SHA256 " + hashlib.sha256(data).hexdigest(), flush=True)
        print("CHECKPOINT_CORPUS_RESULT_BASE64 " + base64.b64encode(data).decode("ascii"), flush=True)
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
