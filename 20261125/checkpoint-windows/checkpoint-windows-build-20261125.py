#!/usr/bin/env python3
"""Build one reviewed Windows release and its tests under an inherited owned Job."""
import argparse
import atexit
import base64
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import stat
import struct
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone

BASELINE_COMMIT = "986f2a332aca9dd567eee41ce835917d56e29468"
TESTS_COMMIT = "a42d7dad5c3e2b31336c12c7c0f69a83db9a53b8"
TARGET = "x86_64-pc-windows-msvc"
TOOLCHAIN = "1.100.0"
JOB_SHA256 = "2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f"
JOB_QUERY_RETRIES = []
ARCHIVE_SCRIPT_SHA256 = "f51d6073336edf3f6f06834f28232f540aa9f268ea87de0918fd53808c9c5143"
EXPECTED_FILES = {
    "src/service/checkpoint/set_v2.rs": "M",
    "research/specs/checkpoint-set-v2.md": "M",
    "tests/attempt_receipt_checkpoint_integrity.rs": "M",
    "tests/checkpoint_set_v2_conformance.rs": "M",
    "tests/checkpoint_tail_generation_integrity.rs": "A",
}
TEST_TARGETS = {
    "attempt_receipt_checkpoint_integrity", "checkpoint_tail_generation_integrity",
    "checkpoint_set_v2_conformance", "attempt_outcome_round_trip", "r036_verified_restore",
}
COMMAND = ["cargo", "test", "--locked", "--no-run", "--lib",
           "--test", "attempt_receipt_checkpoint_integrity",
           "--test", "checkpoint_tail_generation_integrity",
           "--test", "checkpoint_set_v2_conformance",
           "--test", "attempt_outcome_round_trip",
           "--test", "r036_verified_restore",
           "--target", TARGET, "--message-format=json"]
SHA256 = re.compile(r"^[a-f0-9]{64}$")
SHA1 = re.compile(r"^[a-f0-9]{40}$")
MAX_SOURCE_BYTES = 1024 * 1024 * 1024
MAX_SOURCE_FILES = 100000
MAX_BUNDLE_BYTES = 3 * 1024 * 1024 * 1024
WORK_SECONDS = 2400


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


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())


def safe_existing(value, directory=False):
    path = Path(value)
    require(path.is_absolute() and re.match(r"^[A-Za-z]:[\\/]", str(path)),
            "An absolute local Windows path is required")
    require(path.resolve(strict=True) == path, "Redirected path: " + str(path))
    for item in (path, *path.parents):
        info = item.lstat()
        require(not (getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT),
                "Reparse path refused: " + str(item))
    mode = path.lstat().st_mode
    require(stat.S_ISDIR(mode) if directory else stat.S_ISREG(mode), "Unexpected path type: " + str(path))
    return path


def relative_path(value):
    require(isinstance(value, str) and value and "\\" not in value
            and all(ord(c) >= 32 and ord(c) != 127 for c in value), "Invalid archive path")
    parts = value.split("/")
    require(not value.startswith("/") and all(p not in ("", ".", "..") for p in parts),
            "Unsafe archive path")
    require(".git" not in (p.lower() for p in parts), "Git metadata is forbidden in archives")
    for part in parts:
        require(not any(c in part for c in ':<>|?*"') and not part.endswith((".", " ")),
                "Invalid Windows archive component")
        require(not re.fullmatch(r"(?i)(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", part),
                "Windows device component refused")
    return PurePosixPath(value)


def file_record(path, root):
    safe_existing(path)
    require(path.is_relative_to(root), "File leaves its owned root")
    return {"path": path.relative_to(root).as_posix(), "sha256": file_hash(path),
            "bytes": path.stat().st_size, "mode": stat.S_IMODE(path.stat().st_mode)}


def pe_x64(path):
    safe_existing(path)
    with path.open("rb") as stream:
        head = stream.read(64)
        require(len(head) == 64 and head[:2] == b"MZ", "Executable lacks an MZ header")
        offset = struct.unpack_from("<I", head, 60)[0]
        require(64 <= offset <= min(path.stat().st_size - 26, 1024 * 1024), "Invalid PE offset")
        stream.seek(offset)
        header = stream.read(26)
    require(header[:4] == b"PE\0\0" and struct.unpack_from("<H", header, 4)[0] == 0x8664
            and struct.unpack_from("<H", header, 24)[0] == 0x20b,
            "An AMD64 PE32+ executable is required")


def clean_environment(root):
    env = dict(os.environ)
    prefixes = ("BEAD", "GIT_", "CARGO_", "RUSTC_", "RUSTDOC_")
    exact = {"RUSTFLAGS", "RUSTDOCFLAGS", "RUSTC", "RUSTDOC", "RUSTUP_TOOLCHAIN",
             "TMPDIR", "TMP", "TEMP", "BASH_ENV", "ENV", "SHELLOPTS", "BASHOPTS",
             "MSYSTEM", "MSYS", "MSYS2_ARG_CONV_EXCL", "MSYS2_ENV_CONV_EXCL", "PYTHONPYCACHEPREFIX"}
    for key in list(env):
        if key.upper().startswith(prefixes) or key.upper() in exact:
            del env[key]
    env.update({"CARGO_BUILD_JOBS": "1", "CARGO_TARGET_DIR": str(root / "target"),
                "RUSTUP_TOOLCHAIN": TOOLCHAIN, "TMPDIR": str(root / "tmp"),
                "TMP": str(root / "tmp"), "TEMP": str(root / "tmp"),
                "GIT_OPTIONAL_LOCKS": "0", "LC_ALL": "C", "RUST_BACKTRACE": "0",
                "PYTHONPYCACHEPREFIX": str(root / "tmp" / "pycache")})
    return env


def job_pids():
    require(sys.platform == "win32" and ctypes.sizeof(ctypes.c_void_p) == 8, "Windows x64 is required")
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    query = kernel.QueryInformationJobObject
    query.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p,
                      wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    query.restype = wintypes.BOOL
    capacity, until, retry = 32, time.monotonic() + 0.5, None
    for attempt in range(8):
        buffer = ctypes.create_string_buffer(8 + 8 * capacity)
        used = wintypes.DWORD()
        ok = bool(query(None, 3, buffer, len(buffer), ctypes.byref(used)))
        error = 0 if ok else ctypes.get_last_error()
        assigned, count = struct.unpack_from("<II", buffer.raw)
        sample = {"attempt": attempt + 1, "capacity": capacity, "success": ok, "error": error,
                  "assigned": assigned, "count": count, "returned_bytes": used.value}
        complete = ok and 0 < assigned == count <= capacity and 8 + 8 * count <= used.value <= len(buffer)
        if complete:
            pids = set(struct.unpack_from("<" + "Q" * count, buffer.raw, 8))
            require(len(pids) == count and 0 not in pids, "Invalid Job process IDs: " + json.dumps(sample))
            if retry is not None:
                retry["samples"].append(sample)
                retry["complete_pids"] = sorted(pids)
            return pids
        if retry is None:
            require(len(JOB_QUERY_RETRIES) < 32, "Too many incomplete Job queries in one phase")
            retry = {"started": utc(), "samples": []}
            JOB_QUERY_RETRIES.append(retry)
        retry["samples"].append(sample)
        require(error in (0, 234) and 0 <= count <= capacity and 0 < assigned <= 1024,
                "Invalid or oversized Job query: " + json.dumps(retry))
        require(attempt < 7 and time.monotonic() < until,
                "Job query did not produce a complete bounded snapshot: " + json.dumps(retry))
        capacity = min(1024, max(capacity * 2, assigned))
        time.sleep(min(0.02, max(0, until - time.monotonic())))
    raise RuntimeError("Job query exhausted its bounded attempts")


class OwnedJobBaseline:
    """Retain handles for the supervisor, this Python, and its measured console host."""
    def __init__(self, supervisor_pid):
        self.kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self.handles = {}
        self.records = []
        kernel = self.kernel
        declarations = {
            "OpenProcess": ([wintypes.DWORD, wintypes.BOOL, wintypes.DWORD], wintypes.HANDLE),
            "CloseHandle": ([wintypes.HANDLE], wintypes.BOOL),
            "WaitForSingleObject": ([wintypes.HANDLE, wintypes.DWORD], wintypes.DWORD),
            "GetProcessId": ([wintypes.HANDLE], wintypes.DWORD),
            "GetProcessTimes": ([wintypes.HANDLE, *([ctypes.POINTER(wintypes.FILETIME)] * 4)], wintypes.BOOL),
            "QueryFullProcessImageNameW": ([wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR,
                                            ctypes.POINTER(wintypes.DWORD)], wintypes.BOOL),
            "GetSystemDirectoryW": ([wintypes.LPWSTR, wintypes.UINT], wintypes.UINT),
            "CreateToolhelp32Snapshot": ([wintypes.DWORD, wintypes.DWORD], wintypes.HANDLE),
        }
        for name, (arguments, result) in declarations.items():
            function = getattr(kernel, name)
            function.argtypes, function.restype = arguments, result
        self.pids = job_pids()
        expected = {os.getpid(), supervisor_pid}
        extra = self.pids - expected
        require(expected <= self.pids and len(extra) <= 1 and os.getppid() == supervisor_pid,
                "Unexpected initial Job membership or Python parent")

        class ProcessEntry(ctypes.Structure):
            _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD),
                        ("th32ProcessID", wintypes.DWORD), ("th32DefaultHeapID", ctypes.c_size_t),
                        ("th32ModuleID", wintypes.DWORD), ("cntThreads", wintypes.DWORD),
                        ("th32ParentProcessID", wintypes.DWORD), ("pcPriClassBase", wintypes.LONG),
                        ("dwFlags", wintypes.DWORD), ("szExeFile", wintypes.WCHAR * 260)]

        for name in ("Process32FirstW", "Process32NextW"):
            function = getattr(kernel, name)
            function.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
            function.restype = wintypes.BOOL
        try:
            for pid in sorted(self.pids):
                handle = kernel.OpenProcess(0x1000 | 0x100000, False, pid)
                require(handle, "Cannot retain a query/synchronization handle for an owned baseline process")
                self.handles[pid] = handle
            snapshot = kernel.CreateToolhelp32Snapshot(2, 0)
            require(snapshot not in (None, 0, ctypes.c_void_p(-1).value), "Cannot inspect owned process parents")
            rows = {}
            try:
                entry = ProcessEntry()
                entry.dwSize = ctypes.sizeof(entry)
                present = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
                examined = 0
                while present:
                    examined += 1
                    require(examined <= 8192, "Process snapshot exceeds its bound")
                    pid = int(entry.th32ProcessID)
                    if pid in self.pids:
                        require(pid not in rows, "Repeated process identity in the snapshot")
                        rows[pid] = {"pid": pid, "parent_pid": int(entry.th32ParentProcessID),
                                     "image_name": entry.szExeFile}
                    present = kernel.Process32NextW(snapshot, ctypes.byref(entry))
                require(ctypes.get_last_error() == 18 and set(rows) == self.pids,
                        "Incomplete owned process identity snapshot")
            finally:
                kernel.CloseHandle(snapshot)
            system_buffer = ctypes.create_unicode_buffer(32768)
            length = kernel.GetSystemDirectoryW(system_buffer, len(system_buffer))
            require(0 < length < len(system_buffer), "Cannot identify the Windows system directory")
            system = safe_existing(Path(system_buffer.value), directory=True)
            images = {os.getpid(): safe_existing(Path(sys.executable)),
                      supervisor_pid: safe_existing(system / "WindowsPowerShell" / "v1.0" / "powershell.exe")}
            if extra:
                console_pid = next(iter(extra))
                images[console_pid] = safe_existing(system / "conhost.exe")
                require(rows[console_pid]["parent_pid"] == os.getpid()
                        and rows[console_pid]["image_name"].lower() == "conhost.exe",
                        "The extra Job member is not this Python's console host")
            require(rows[os.getpid()]["parent_pid"] == supervisor_pid,
                    "Python's recorded parent differs from the supervisor")
            births = {}
            for pid, handle in self.handles.items():
                require(kernel.GetProcessId(handle) == pid
                        and kernel.WaitForSingleObject(handle, 0) == 258,
                        "An owned baseline process exited or changed before identity validation")
                image = ctypes.create_unicode_buffer(32768)
                image_size = wintypes.DWORD(len(image))
                require(kernel.QueryFullProcessImageNameW(handle, 0, image, ctypes.byref(image_size)),
                        "Cannot read an owned process image")
                actual_image = safe_existing(Path(image.value))
                require(actual_image == images[pid], "An owned baseline process image differs")
                created, exited, kernel_time, user_time = (wintypes.FILETIME() for _ in range(4))
                require(kernel.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(exited),
                                               ctypes.byref(kernel_time), ctypes.byref(user_time)),
                        "Cannot read an owned process creation time")
                births[pid] = (int(created.dwHighDateTime) << 32) | int(created.dwLowDateTime)
                self.records.append({**rows[pid], "image_path": str(actual_image),
                                     "creation_filetime": str(births[pid]),
                                     "query_and_synchronization_handle_retained": True})
            require(0 < births[supervisor_pid] <= births[os.getpid()], "Owned parent birth order differs")
            if extra:
                require(0 <= births[console_pid] - births[os.getpid()] <= 10 * 10_000_000,
                        "Console host was not created during this Python's startup")
            require(self.matches(job_pids()), "Owned Job changed during baseline validation")
        except BaseException:
            self.close()
            raise
        atexit.register(self.close)

    def matches(self, members):
        return members == self.pids and set(self.handles) == self.pids and all(
            self.kernel.WaitForSingleObject(handle, 0) == 258 for handle in self.handles.values())

    def close(self):
        for handle in self.handles.values():
            self.kernel.CloseHandle(handle)
        self.handles.clear()


class Runner:
    def __init__(self, root, env, deadline):
        self.root, self.env, self.deadline = root, env, deadline
        self.commands = []
        self.active = None
        require(os.environ.get("SCOTTY_CHECKPOINT_JOB_SHA256") == JOB_SHA256,
                "Reviewed outer Job helper was not identified")
        outer = os.environ.get("SCOTTY_CHECKPOINT_SUPERVISOR_PID", "")
        require(re.fullmatch(r"[1-9][0-9]*", outer), "Missing outer supervisor identity")
        self.owned_baseline = OwnedJobBaseline(int(outer))
        self.baseline = self.owned_baseline.pids
        self.baseline_record = {
            "schema_version": 1, "pids": sorted(self.baseline),
            "processes": self.owned_baseline.records, "validated_at": utc(),
            "policy": "supervisor, Python, and at most its one verified System32 console host"}

    def run(self, args, cwd, label, seconds=60, stdout_path=None, allowed_exits=(0,)):
        require(self.active is None and self.owned_baseline.matches(job_pids()),
                "Owned command tree is not quiescent or a retained baseline process exited")
        remaining = min(float(seconds), self.deadline - time.monotonic())
        require(remaining > 0, "Owned phase deadline expired")
        out = stdout_path or self.root / "logs" / (label + ".stdout")
        err = self.root / "logs" / (label + ".stderr")
        record = {"label": label, "args": [str(a) for a in args], "cwd": str(cwd),
                  "started": utc(), "limit_seconds": remaining, "outer_job_pids": sorted(self.baseline),
                  "stdout": out.relative_to(self.root).as_posix(), "stderr": err.relative_to(self.root).as_posix()}
        write_json(self.root / "logs" / (label + ".started.json"), record)
        failure = None
        process = None
        try:
            with out.open("xb") as stdout, err.open("xb") as stderr:
                process = subprocess.Popen(args, cwd=cwd, env=self.env, stdin=subprocess.DEVNULL,
                                           stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW)
                self.active = process
                record["pid"] = process.pid
                try:
                    process.wait(timeout=remaining)
                except subprocess.TimeoutExpired:
                    record["timed_out"] = True
                    process.kill()
                    raise TimeoutError(label + " exceeded its owned deadline; outer Job cleanup is required")
                stdout.flush()
                stderr.flush()
                os.fsync(stdout.fileno())
                os.fsync(stderr.fileno())
                record["exit_code"] = process.returncode
                require(process.returncode in allowed_exits, label + " exited " + str(process.returncode))
        except BaseException as error:
            failure = error
        finally:
            self.active = None
            if process is not None and process.poll() is None:
                process.kill()
            until = time.monotonic() + 5
            members = job_pids()
            while not self.owned_baseline.matches(members) and time.monotonic() < until:
                time.sleep(0.05)
                members = job_pids()
            record["job_pids_after"] = sorted(members)
            if not self.owned_baseline.matches(members):
                failure = RuntimeError("Owned descendants remain after " + label + "; outer Job cleanup is required")
            record["finished"] = utc()
            record["error"] = str(failure) if failure else None
            self.commands.append(record)
            write_json(self.root / "logs" / (label + ".exit.json"), record)
        if failure:
            raise failure
        return out


def extract_source(archive, source, tracked):
    source.mkdir()
    files, folded, total = {}, set(), 0
    with tarfile.open(archive, "r:") as tar:
        for member in tar:
            name = member.name.rstrip("/") if member.isdir() else member.name
            relative = relative_path(name)
            target = source.joinpath(*relative.parts)
            require(target.is_relative_to(source), "Source archive escapes its root")
            require(not member.issym() and not member.islnk() and (member.isdir() or member.isfile()),
                    "Source archive contains a link or special file")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                safe_existing(target, directory=True)
                continue
            require(name.lower() not in folded and name in tracked, "Unexpected or aliased archive file")
            folded.add(name.lower())
            total += member.size
            require(0 <= member.size and total <= MAX_SOURCE_BYTES and len(files) < MAX_SOURCE_FILES,
                    "Source archive exceeds reviewed bounds")
            target.parent.mkdir(parents=True, exist_ok=True)
            safe_existing(target.parent, directory=True)
            stream = tar.extractfile(member)
            require(stream is not None, "Missing source member data")
            with stream, target.open("xb") as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
                output.flush()
                os.fsync(output.fileno())
            require(target.stat().st_size == member.size, "Source archive length mismatch")
            mode = member.mode & 0o777
            require(mode == member.mode and mode & 0o600 == 0o600, "Unsafe source mode")
            require(bool(mode & 0o111) == (tracked[name]["git_mode"] == "100755"), "Source executable mode differs")
            os.chmod(target, mode)
            blob = hashlib.sha1(("blob " + str(member.size) + "\0").encode("ascii"))
            with target.open("rb") as stored:
                for chunk in iter(lambda: stored.read(1024 * 1024), b""):
                    blob.update(chunk)
            require(blob.hexdigest() == tracked[name]["git_blob"], "Source bytes differ from their Git object")
            files[name] = {**file_record(target, source), "git_blob": tracked[name]["git_blob"],
                           "git_mode": tracked[name]["git_mode"], "archive_mode": mode}
    require(set(files) == set(tracked) and not (source / ".git").exists(), "Incomplete source archive")
    return files


def compiled_outputs(log, source, target, root):
    found, finished = {}, []
    with log.open("r", encoding="utf-8") as output:
        for line in output:
            if not line.strip():
                continue
            message = json.loads(line, object_pairs_hook=unique_object)
            if message.get("reason") == "build-finished":
                finished.append(message.get("success"))
            if message.get("reason") != "compiler-artifact" or not message.get("executable"):
                continue
            info, profile = message["target"], message["profile"]
            key = None
            if profile["test"] and "lib" in info["kind"]:
                key = "lib"
            elif profile["test"] and "test" in info["kind"] and info["name"] in TEST_TARGETS:
                key = info["name"]
            elif not profile["test"] and "bin" in info["kind"] and info["name"] == "bead":
                key = "bead"
            else:
                continue
            require(key not in found, "Duplicate compiled output: " + key)
            require(safe_existing(Path(message["manifest_path"])) == source / "Cargo.toml",
                    "Cargo artifact belongs to a different package")
            binary = safe_existing(Path(message["executable"]))
            require(binary.is_relative_to(target), "Cargo executable leaves the owned target directory")
            if key == "bead":
                require(binary == target / TARGET / "debug" / "bead.exe", "Unexpected debug bead path")
            else:
                parts = binary.relative_to(target).parts
                name = "bead_rs" if key == "lib" else key
                require(info["name"] == name and len(parts) == 7
                        and parts[:4] == (TARGET, "debug", "build", "bead-rs")
                        and re.fullmatch(r"[a-f0-9]{16}", parts[4]) and parts[5] == "out"
                        and parts[6] == name + "-" + parts[4] + ".exe",
                        "Unexpected Cargo1.100 Windows test path: " + str(binary.relative_to(target)))
            pe_x64(binary)
            found[key] = file_record(binary, root)
    require(finished == [True] and set(found) == TEST_TARGETS | {"lib", "bead"},
            "Expected six compiled test harnesses plus the Windows debug bead")
    require(len({row["path"].lower() for row in found.values()}) == 7, "Compiled outputs alias one another")
    return found


def emit_receipt(prefix, path):
    data = path.read_bytes()
    require(len(data) <= 256 * 1024, "Receipt exceeds stdout metadata bound")
    print(prefix + "_SHA256 " + hashlib.sha256(data).hexdigest(), flush=True)
    print(prefix + "_BASE64 " + base64.b64encode(data).decode("ascii"), flush=True)


def emit_small_streams(root, directory):
    if not directory.exists():
        return
    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in (".stdout", ".stderr", ".log", ".jsonl"):
            continue
        safe_existing(path)
        require(path.is_relative_to(root), "Log leaves its owned output root")
        size = path.stat().st_size
        record = {"root": str(root), "filename": path.relative_to(root).as_posix(), "bytes": size, "sha256": file_hash(path)}
        if size <= 256 * 1024:
            record["base64"] = base64.b64encode(path.read_bytes()).decode("ascii")
        else:
            record["retained_in_artifact"] = True
        print("CHECKPOINT_WINDOWS_LOG " + json.dumps(record, sort_keys=True), flush=True)


def hosted_run():
    run_id, attempt = os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"]
    require(re.fullmatch(r"[0-9]+", run_id) and re.fullmatch(r"[1-9][0-9]*", attempt), "Invalid hosted run")
    require(SHA1.fullmatch(os.environ["GITHUB_SHA"]), "Invalid workflow commit")
    require(os.environ["GITHUB_REPOSITORY"] == "YossiMH/bead-me-up-scotty", "Unexpected workflow repository")
    return {"id": run_id, "attempt": attempt, "workflow_commit": os.environ["GITHUB_SHA"],
            "repository": os.environ["GITHUB_REPOSITORY"], "workflow_ref": os.environ.get("GITHUB_WORKFLOW_REF")}


def activate_msvc(runner, root):
    vswhere = safe_existing(Path(os.environ["ProgramFiles(x86)"]) /
                            "Microsoft Visual Studio" / "Installer" / "vswhere.exe")
    installation = runner.run([str(vswhere), "-latest", "-products", "*",
                               "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                               "-property", "installationPath"], root, "vswhere", 30).read_text().strip()
    vcvars = safe_existing(Path(installation) / "VC" / "Auxiliary" / "Build" / "vcvars64.bat")
    keys = ["PATH", "INCLUDE", "LIB", "LIBPATH", "VCINSTALLDIR", "VCToolsInstallDir",
            "VCToolsVersion", "WindowsSdkDir", "WindowsSDKVersion", "VSCMD_ARG_HOST_ARCH", "VSCMD_ARG_TGT_ARCH"]
    emitter = root / "emit-msvc-environment.py"
    emitter.write_text("import json, os\nprint(json.dumps({k: os.environ.get(k) for k in " + repr(keys) + "}))\n",
                       encoding="utf-8", newline="\n")
    command = root / "activate-msvc.cmd"
    for value in (str(vcvars), sys.executable, str(emitter)):
        require(not any(c in value for c in '"%!&^<>\r\n'), "Unsafe command-file path")
    with command.open("x", encoding="utf-8", newline="\r\n") as output:
        output.write('@echo off\ncall "' + str(vcvars) + '" >nul\nif errorlevel 1 exit /b %errorlevel%\n')
        output.write('"' + sys.executable + '" "' + str(emitter) + '"\n')
    cmd = safe_existing(Path(os.environ["SystemRoot"]) / "System32" / "cmd.exe")
    values = read_json(runner.run([str(cmd), "/d", "/c", str(command)], root, "activate-msvc", 60))
    require(set(values) == set(keys) and values["VSCMD_ARG_HOST_ARCH"] == "x64"
            and values["VSCMD_ARG_TGT_ARCH"] == "x64", "Visual C++ x64 environment was not selected")
    require(all(isinstance(values[k], str) and values[k] for k in keys), "Incomplete Visual C++ environment")
    for key in keys:
        for old in list(runner.env):
            if old.upper() == key.upper():
                del runner.env[old]
        runner.env[key] = values[key]
    return {"vswhere": str(vswhere), "vswhere_sha256": file_hash(vswhere),
            "vcvars64": str(vcvars), "vcvars64_sha256": file_hash(vcvars),
            "toolset_version": values["VCToolsVersion"], "sdk_version": values["WindowsSDKVersion"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--inputs-sha256", required=True)
    parser.add_argument("--helper-sha256", required=True)
    args = parser.parse_args()
    require(sys.platform == "win32" and ctypes.sizeof(ctypes.c_void_p) == 8, "Hosted Windows x64 only")
    require((3, 11) <= sys.version_info[:2] < (3, 15), "Supported Python3 is required")
    require(SHA256.fullmatch(args.inputs_sha256) and SHA256.fullmatch(args.helper_sha256), "Exact hashes required")
    helper = safe_existing(Path(__file__).absolute())
    request_path = safe_existing(Path(args.inputs))
    require(request_path.stat().st_size <= 1024 * 1024 and file_hash(request_path) == args.inputs_sha256,
            "Approved input bytes differ")
    require(file_hash(helper) == args.helper_sha256, "Reviewed helper bytes differ")
    request = read_json(request_path)
    require(request["schema_version"] == 1 and request["repository"] == "YossiMH/bead-rs"
            and request["baseline_commit"] == BASELINE_COMMIT and request["tests_commit"] == TESTS_COMMIT
            and request["target"] == TARGET and request["rust_toolchain"] == TOOLCHAIN
            and request["archive_script_sha256"] == ARCHIVE_SCRIPT_SHA256
            and request["job_helper_sha256"] == JOB_SHA256, "Unexpected approved build contract")
    for key in ("source_commit", "source_tree"):
        require(isinstance(request.get(key), str) and SHA1.fullmatch(request[key]), "Missing actual " + key)
    approved = request["approved_files"]
    require(isinstance(approved, dict) and set(approved) == set(EXPECTED_FILES), "Unexpected Green source delta")
    for name, row in approved.items():
        require(row["status"] == EXPECTED_FILES[name] and isinstance(row["sha256"], str)
                and SHA256.fullmatch(row["sha256"]), "Missing reviewed file pin: " + name)
    ancestry = request["source_ancestry"]
    require(isinstance(ancestry, list) and 3 <= len(ancestry) <= 8
            and all(isinstance(commit, str) and SHA1.fullmatch(commit) for commit in ancestry)
            and len(set(ancestry)) == len(ancestry) and ancestry[0] == request["source_commit"]
            and ancestry[-1] == BASELINE_COMMIT and TESTS_COMMIT in ancestry[1:-1],
            "A reviewed exact linear source ancestry is required")
    checkout = safe_existing(Path(args.checkout), directory=True)
    temp = safe_existing(Path(os.environ["RUNNER_TEMP"]), directory=True)
    run = hosted_run()
    root = temp / ("bead-checkpoint-windows-build-" + run["id"] + "-" + run["attempt"])
    require(not root.exists(), "Build root already exists; reconcile rather than replay")
    root.mkdir()
    for name in ("logs", "tmp", "target", "release", "archive-build-scratch"):
        (root / name).mkdir()
    for ancestor in (root, *root.parents):
        require(not (ancestor / ".git").exists(), "Build root inherits an unrelated Git workspace")
    source, target = root / "source", root / "target"
    began = time.monotonic()
    runner = Runner(root, clean_environment(root), began + WORK_SECONDS)
    status = {"schema_version": 1, "status": "failed", "operation": "checkpoint-windows-build",
              "run": run, "started": utc(), "build_root": str(root), "source_root": str(source),
              "target_root": str(target), "input_sha256": args.inputs_sha256,
              "helper_sha256": args.helper_sha256, "job_helper_sha256": JOB_SHA256,
              "target": TARGET, "compile_command": COMMAND, "tests_executed": False,
              "owned_job_baseline": runner.baseline_record,
              "job_query_retries": JOB_QUERY_RETRIES,
              "work_seconds": WORK_SECONDS, "python": sys.version, "python_executable": sys.executable,
              "runner_os": platform.platform(), "runner_image": {
                  "name": os.environ.get("ImageOS"), "version": os.environ.get("ImageVersion")}}
    outer = {"schema_version": 1, "status": "failed", "build_root": str(root)}
    write_json(root / "attempt-started.json", {"operation": status["operation"], "run": run,
              "started": status["started"], "input_sha256": args.inputs_sha256,
              "helper_sha256": args.helper_sha256})
    try:
        runner.run([sys.executable, "-m", "py_compile", str(helper)], root, "parse-build-helper", 60)
        shutil.copyfile(request_path, root / "build-inputs.json")
        require(file_hash(root / "build-inputs.json") == args.inputs_sha256, "Copied build inputs changed")

        def git(arguments, label, seconds=60, output=None):
            return runner.run(["git", "--no-optional-locks", "-C", str(checkout), *arguments],
                              checkout, label, seconds, output)

        require(Path(git(["rev-parse", "--show-toplevel"], "git-root").read_text().strip()) == checkout,
                "Checkout is not the Git root")
        require(not git(["status", "--porcelain=v1", "--untracked-files=all", "-z"], "git-status").read_bytes(),
                "Checkout is not clean")
        head = git(["rev-parse", "HEAD"], "git-head").read_text().strip()
        tree = git(["rev-parse", "HEAD^{tree}"], "git-tree").read_text().strip()
        require(head == request["source_commit"] and tree == request["source_tree"], "Checkout differs from approved source")
        for index, commit in enumerate(ancestry[:-1]):
            parent = git(["rev-list", "--parents", "-n", "1", commit], "git-parent-" + str(index)).read_text().split()
            require(parent == [commit, ancestry[index + 1]], "Reviewed linear source ancestry differs")
        git(["cat-file", "-e", BASELINE_COMMIT + "^{commit}"], "git-baseline")
        changes = git(["diff", "--name-status", "--no-renames", "-z", BASELINE_COMMIT, head, "--"],
                      "git-delta").read_bytes().split(b"\0")
        require(changes[-1] == b"" and (len(changes) - 1) % 2 == 0, "Malformed Git delta")
        delta = {}
        for index in range(0, len(changes) - 1, 2):
            change, name = changes[index].decode("ascii"), changes[index + 1].decode("utf-8")
            require(name not in delta, "Duplicate changed source path")
            delta[name] = change
        require(delta == EXPECTED_FILES, "Source delta exceeds the five reviewed files")
        git(["diff", "--check", BASELINE_COMMIT, head, "--"], "git-whitespace")
        entries = git(["ls-tree", "-r", "-z", "--full-tree", head], "git-files").read_bytes().split(b"\0")
        tracked, folded = {}, set()
        for entry in entries:
            if not entry:
                continue
            metadata, name_bytes = entry.split(b"\t", 1)
            mode, kind, blob = metadata.decode("ascii").split()
            name = name_bytes.decode("utf-8")
            relative_path(name)
            require(kind == "blob" and mode in ("100644", "100755"), "Unexpected Git object type")
            require(name.lower() not in folded and SHA1.fullmatch(blob), "Aliased or invalid Git file")
            folded.add(name.lower())
            tracked[name] = {"git_blob": blob, "git_mode": mode}
        require(0 < len(tracked) <= MAX_SOURCE_FILES, "Unexpected tracked file count")
        for index, (name, row) in enumerate(approved.items()):
            blob_path = git(["show", head + ":" + name], "approved-file-" + str(index))
            require(file_hash(blob_path) == row["sha256"], "Reviewed Green file differs: " + name)
        script = safe_existing(checkout / "scripts" / "build-from-archive.sh")
        require(file_hash(script) == ARCHIVE_SCRIPT_SHA256, "Archive build script changed")
        shutil.copyfile(script, root / "archive-build-script.sh")
        bash = safe_existing(Path(os.environ["ProgramFiles"]) / "Git" / "bin" / "bash.exe")
        cygpath = safe_existing(bash.parent.parent / "usr" / "bin" / "cygpath.exe")
        status["toolchain"] = {"git": runner.run(["git", "--version"], checkout, "git-version").read_text().strip(),
                               "bash": runner.run([str(bash), "--version"], root, "bash-version").read_text().strip(),
                               "visual_cpp": activate_msvc(runner, root)}
        python3 = runner.run([str(bash), "-c", "python3 --version"], root, "git-bash-python3").read_text().strip()
        require(re.fullmatch(r"Python 3\.[0-9]+\.[0-9]+", python3), "Git Bash requires a working Python3")
        status["toolchain"]["git_bash_python3"] = python3
        runner.run(["rustup", "toolchain", "install", TOOLCHAIN, "--profile", "minimal",
                    "--target", TARGET, "--no-self-update"], root, "rustup", 600)
        rustc = runner.run(["rustc", "--version"], root, "rustc-version").read_text().strip()
        cargo = runner.run(["cargo", "--version"], root, "cargo-version").read_text().strip()
        host = runner.run(["rustc", "-vV"], root, "rustc-host").read_text()
        require(re.fullmatch(r"rustc 1\.100\.0 \([^\r\n]+\)", rustc)
                and re.fullmatch(r"cargo 1\.100\.0 \([^\r\n]+\)", cargo)
                and re.search(r"(?m)^host: " + re.escape(TARGET) + r"\s*$", host), "Pinned MSVC Rust toolchain differs")
        status["toolchain"].update({"rustc": rustc, "cargo": cargo, "rustc_host": TARGET})
        paths = {}
        for label, path in (("script", script), ("out", root / "release"), ("scratch", root / "archive-build-scratch")):
            paths[label] = runner.run([str(cygpath), "-u", str(path)], root, "cygpath-" + label).read_text().strip()
            require(paths[label].startswith("/") and "\n" not in paths[label] and "\r" not in paths[label],
                    "Git Bash path conversion failed")
        runner.env["BEAD_BUILD_SCRATCH_ROOT"] = paths["scratch"]
        release_name = "bead-checkpoint-" + head[:12] + ".exe"
        release_args = [str(bash), paths["script"], head, "--target", TARGET,
                        "--name", release_name, "--out", paths["out"]]
        runner.run(release_args, checkout, "archive-release", WORK_SECONDS)
        del runner.env["BEAD_BUILD_SCRATCH_ROOT"]
        release = safe_existing(root / "release" / release_name)
        metadata_path = safe_existing(root / "release" / (release_name + ".metadata.json"))
        pe_x64(release)
        metadata = read_json(metadata_path)
        require(metadata["git_commit_sha"] == head and metadata["build_target"] == TARGET
                and metadata["build_host_target"] == TARGET and metadata["execution_verification"] == "executed"
                and metadata["source"] == "git-archive" and metadata["build_profile"] == "release"
                and metadata["build_features"] == "default" and metadata["binary_name"] == release_name
                and metadata["binary_sha256"] == file_hash(release)
                and metadata["binary_size_bytes"] == release.stat().st_size,
                "Archive release metadata differs from actual approved output")
        require(isinstance(metadata["embedded_version_string"], str) and metadata["embedded_version_string"].startswith("bead "),
                "Archive builder did not retain its host version check")
        require(not any((root / "archive-build-scratch").iterdir()), "Successful archive builder left its scratch tree")
        runner.run(["dumpbin.exe", "/DEPENDENTS", str(release)], root, "release-imports")
        status["release"] = {"executable": file_record(release, root), "metadata": file_record(metadata_path, root),
                             "archive_script": file_record(root / "archive-build-script.sh", root),
                             "builder_args": release_args, "builder_host_version_executed": True}
        archive = root / "source.tar"
        git(["archive", "--format=tar", head], "git-archive", 180, archive)
        require(0 < archive.stat().st_size <= MAX_SOURCE_BYTES, "Source archive exceeds its bound")
        files = extract_source(archive, source, tracked)
        for name, row in approved.items():
            require(files[name]["sha256"] == row["sha256"], "Archived approved source differs")
        write_json(root / "source-files.json", {"schema_version": 1, "source_commit": head,
                                               "source_tree": tree, "files": files})
        status["source"] = {"repository": request["repository"], "commit": head, "tree": tree,
                            "baseline_commit": BASELINE_COMMIT, "tests_commit": TESTS_COMMIT, "ancestry": ancestry,
                            "archive": file_record(archive, root),
                            "files_manifest": file_record(root / "source-files.json", root),
                            "approved_files": approved}
        cargo_log = runner.run(COMMAND, source, "cargo", WORK_SECONDS, root / "logs" / "cargo.stdout.jsonl")
        status["executables"] = compiled_outputs(cargo_log, source, target, root)
        for name, row in files.items():
            require(file_record(source / name, source) == {k: row[k] for k in ("path", "sha256", "bytes", "mode")},
                    "Compilation changed tracked source: " + name)
        require(not (source / ".git").exists(), "Compilation recreated Git metadata")
        require(file_hash(helper) == args.helper_sha256 and file_hash(request_path) == args.inputs_sha256,
                "Reviewed helper or input changed")
        require(runner.owned_baseline.matches(job_pids()) and time.monotonic() < runner.deadline,
                "Build deadline or owned process check failed")
        status.update({"status": "passed", "commands": runner.commands, "finished": utc(),
                       "duration_seconds": round(time.monotonic() - began, 3),
                       "cleanup": {"owned_job_quiescent": True, "remaining_pids": sorted(runner.baseline),
                                   "outer_windows_job_closure_required": True}})
        write_json(root / "build-result.json", status)
        names = ["source.tar", "source-files.json", "build-inputs.json", "build-result.json", "attempt-started.json",
                 "archive-build-script.sh", "activate-msvc.cmd", "emit-msvc-environment.py"]
        names.extend(path.relative_to(root).as_posix() for path in sorted((root / "logs").iterdir()))
        names.extend(row["path"] for row in status["executables"].values())
        names.extend(status["release"][key]["path"] for key in ("executable", "metadata"))
        require(len(names) == len({name.lower() for name in names}), "Bundle paths alias")
        bundle = root / "windows-build-bundle.tar.gz"
        total = 0
        with tarfile.open(bundle, "x:gz", compresslevel=1) as tar:
            for name in sorted(names):
                relative_path(name)
                path = safe_existing(root / name)
                total += path.stat().st_size
                require(total <= MAX_BUNDLE_BYTES and time.monotonic() < runner.deadline, "Bundle bound exceeded")
                tar.add(path, arcname=name, recursive=False)
        outer.update({"status": "passed", "build_result_sha256": file_hash(root / "build-result.json"),
                      "bundle": file_record(bundle, root)})
    except BaseException as error:
        outer["error"] = type(error).__name__ + ": " + str(error)
        status.update({"status": "failed", "error": outer["error"]})
    finally:
        status.update({"commands": runner.commands, "finished": utc(),
                       "duration_seconds": round(time.monotonic() - began, 3)})
        if not (root / "build-result.json").exists():
            write_json(root / "build-result.json", status)
        if time.monotonic() - began > WORK_SECONDS:
            outer.update({"status": "failed", "error": "Build phase exceeded its reviewed deadline"})
        outer.update({"finished": utc(), "duration_seconds": round(time.monotonic() - began, 3),
                      "logs_retention_days_required": 7, "outer_windows_job_closure_required": True})
        write_json(root / "result.json", outer)
        emit_receipt("CHECKPOINT_WINDOWS_BUILD_RESULT", root / "build-result.json")
        emit_receipt("CHECKPOINT_WINDOWS_BUILD_OUTER", root / "result.json")
        emit_small_streams(root, root / "logs")
    return 0 if outer["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
