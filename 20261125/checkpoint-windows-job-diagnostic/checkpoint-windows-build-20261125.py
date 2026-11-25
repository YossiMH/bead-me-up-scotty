#!/usr/bin/env python3
"""Measure the owned Windows Job boundary without invoking the product or compiler."""
import argparse
import base64
import ctypes
from ctypes import wintypes
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import time

BUILD_SHA256 = "38772767cebbe735f996cb15c4c2ba3b7d37b8a4bf342f723e618053a210658d"
JOB_SHA256 = "2758a6ff94c0eecdfa360363469069dfa8470efc1f91228812146919a978921f"

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def raw_job():
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    query = kernel.QueryInformationJobObject
    query.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    query.restype = wintypes.BOOL
    buffer = ctypes.create_string_buffer(8 + 8 * 1024)
    used = wintypes.DWORD()
    if not query(None, 3, buffer, len(buffer), ctypes.byref(used)):
        raise ctypes.WinError(ctypes.get_last_error())
    assigned, count = struct.unpack_from("<II", buffer.raw)
    if not 0 < count == assigned <= 1024:
        raise RuntimeError("Incomplete immediate Job PID list")
    return {"assigned": assigned, "count": count, "returned_bytes": used.value,
            "header_hex": buffer.raw[:8].hex(),
            "pids": sorted(struct.unpack_from("<" + "Q" * count, buffer.raw, 8))}

def identities(pids):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    class ProcessEntry(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("pid", wintypes.DWORD),
                    ("heap", ctypes.c_size_t), ("module", wintypes.DWORD), ("threads", wintypes.DWORD),
                    ("parent_pid", wintypes.DWORD), ("priority", wintypes.LONG), ("flags", wintypes.DWORD),
                    ("exe_name", wintypes.WCHAR * 260)]
    snapshot = kernel.CreateToolhelp32Snapshot
    snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    snapshot.restype = wintypes.HANDLE
    first, next_entry = kernel.Process32FirstW, kernel.Process32NextW
    for function in (first, next_entry):
        function.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
        function.restype = wintypes.BOOL
    close = kernel.CloseHandle
    close.argtypes = [wintypes.HANDLE]
    close.restype = wintypes.BOOL
    handle = snapshot(2, 0)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    selected = {}
    try:
        entry = ProcessEntry()
        entry.dwSize = ctypes.sizeof(entry)
        exists = first(handle, ctypes.byref(entry))
        scanned = 0
        while exists:
            scanned += 1
            if scanned > 8192:
                raise RuntimeError("Process metadata scan exceeded bound")
            if entry.pid in pids:
                selected[entry.pid] = {"pid": entry.pid, "parent_pid": entry.parent_pid, "image_name": entry.exe_name}
            exists = next_entry(handle, ctypes.byref(entry))
    finally:
        close(handle)
    opening = kernel.OpenProcess
    opening.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    opening.restype = wintypes.HANDLE
    image = kernel.QueryFullProcessImageNameW
    image.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    image.restype = wintypes.BOOL
    times = kernel.GetProcessTimes
    times.argtypes = [wintypes.HANDLE] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    times.restype = wintypes.BOOL
    for pid in sorted(pids):
        row = selected.setdefault(pid, {"pid": pid, "snapshot_entry_missing": True})
        handle = opening(0x1000, False, pid)
        if not handle:
            row["open_error"] = ctypes.get_last_error()
            continue
        try:
            buffer, size = ctypes.create_unicode_buffer(32768), wintypes.DWORD(32768)
            if image(handle, 0, buffer, ctypes.byref(size)):
                row["image_path"] = buffer.value
            else:
                row["image_error"] = ctypes.get_last_error()
            creation, end, kernel_time, user_time = (wintypes.FILETIME() for _ in range(4))
            if times(handle, ctypes.byref(creation), ctypes.byref(end), ctypes.byref(kernel_time), ctypes.byref(user_time)):
                row["creation_filetime"] = str((creation.dwHighDateTime << 32) | creation.dwLowDateTime)
            else:
                row["time_error"] = ctypes.get_last_error()
        finally:
            close(handle)
    return [selected[pid] for pid in sorted(selected)]

def main():
    parser = argparse.ArgumentParser()
    for name in ("inputs", "inputs-sha256", "helper-sha256", "checkout"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    own, inputs = Path(__file__), Path(args.inputs)
    if sha(own) != args.helper_sha256 or sha(inputs) != args.inputs_sha256:
        raise RuntimeError("Probe identity differs")
    request = json.loads(inputs.read_text(encoding="utf-8"))
    if request != {"schema_version": 1, "operation": "checkpoint-windows-job-diagnostic", "original_build_helper_sha256": BUILD_SHA256}:
        raise RuntimeError("Unexpected diagnostic inputs")
    original = own.parent / "original-build-helper.py"
    if sha(original) != BUILD_SHA256:
        raise RuntimeError("Original build helper differs")
    spec = importlib.util.spec_from_file_location("owned_build_contract", original)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.require(sys.platform == "win32" and ctypes.sizeof(ctypes.c_void_p) == 8, "Windows x64 required")
    module.require(os.environ.get("SCOTTY_CHECKPOINT_JOB_SHA256") == JOB_SHA256, "Owned outer Job identity missing")
    supervisor = int(os.environ["SCOTTY_CHECKPOINT_SUPERVISOR_PID"])
    run = module.hosted_run()
    root = Path(os.environ["RUNNER_TEMP"]) / ("bead-checkpoint-windows-build-" + run["id"] + "-" + run["attempt"])
    root.mkdir()
    result = {"schema_version": 1, "status": "failed", "operation": "checkpoint-windows-job-diagnostic",
              "run": run, "helper_sha256": sha(own), "input_sha256": sha(inputs), "original_helper_sha256": sha(original),
              "python": {"pid": os.getpid(), "parent_pid": os.getppid(), "executable": sys.executable,
                         "base_executable": getattr(sys, "_base_executable", None), "prefix": sys.prefix,
                         "base_prefix": sys.base_prefix, "version": sys.version, "pointer_bytes": ctypes.sizeof(ctypes.c_void_p)},
              "expected_supervisor_pid": supervisor, "observations": [], "no_product_or_compiler_execution": True}
    began = time.monotonic()
    try:
        for after in (0.0, 0.1, 0.5, 1.5, 3.0):
            delay = after - (time.monotonic() - began)
            if delay > 0:
                time.sleep(delay)
            observed = raw_job()
            imported = sorted(module.job_pids())
            known = set(observed["pids"]) | set(imported) | {os.getpid(), os.getppid(), supervisor}
            result["observations"].append({"elapsed_seconds": round(time.monotonic() - began, 6),
                                            "raw_job": observed, "original_helper_pids": imported,
                                            "consecutive_queries_equal": observed["pids"] == imported,
                                            "processes": identities(known)})
        result["status"] = "diagnostic_collected"
    except BaseException as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    finally:
        result["duration_seconds"] = round(time.monotonic() - began, 6)
        output = root / "result.json"
        with output.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
        data = output.read_bytes()
        print("CHECKPOINT_WINDOWS_JOB_DIAGNOSTIC_SHA256 " + hashlib.sha256(data).hexdigest(), flush=True)
        print("CHECKPOINT_WINDOWS_JOB_DIAGNOSTIC_BASE64 " + base64.b64encode(data).decode("ascii"), flush=True)
    return 0 if result["status"] == "diagnostic_collected" else 1

if __name__ == "__main__":
    sys.exit(main())
