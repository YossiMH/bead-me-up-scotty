"""Cloud-only checks of bounded read-only Job-query resampling; no Windows calls."""
import ast
import ctypes as real_ctypes
from ctypes import wintypes
import hashlib
import json
from pathlib import Path
import struct
import time
from types import SimpleNamespace

root = Path(__file__).resolve().parent
source = (root / "checkpoint-windows-build-20261125.py").read_bytes()
tree = ast.parse(source)
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "job_pids")
code = compile(ast.Module(body=[function], type_ignores=[]), "exact-job_pids", "exec")


def run_case(name, samples, expected=None, failure=None, expected_calls=1):
    class Query:
        def __init__(self):
            self.calls = 0
            self.error = 0

        def __call__(self, job, kind, buffer, length, used):
            assert job is None and kind == 3
            row = samples[min(self.calls, len(samples) - 1)]
            self.calls += 1
            assigned, count, self.error, pids, returned = row
            assert len(buffer) == length and len(pids) == count
            struct.pack_into("<II", buffer, 0, assigned, count)
            if count:
                struct.pack_into("<" + "Q" * count, buffer, 8, *pids)
            used._obj.value = returned
            return self.error == 0

    query = Query()
    fake_ctypes = SimpleNamespace(
        WinDLL=lambda *args, **kwargs: SimpleNamespace(QueryInformationJobObject=query),
        sizeof=real_ctypes.sizeof, c_void_p=real_ctypes.c_void_p, c_int=real_ctypes.c_int,
        POINTER=real_ctypes.POINTER, create_string_buffer=real_ctypes.create_string_buffer,
        byref=real_ctypes.byref, get_last_error=lambda: query.error)

    def require(value, message):
        if not value:
            raise RuntimeError(message)

    namespace = {"sys": SimpleNamespace(platform="win32"), "ctypes": fake_ctypes,
                 "wintypes": wintypes, "struct": struct, "time": time, "json": json,
                 "utc": lambda: "fixture", "require": require, "JOB_QUERY_RETRIES": []}
    exec(code, namespace)
    try:
        value = namespace["job_pids"]()
        assert failure is None and value == expected, (name, value)
    except RuntimeError as error:
        assert failure and failure in str(error), (name, str(error))
    assert query.calls == expected_calls, (name, query.calls)
    return {"name": name, "status": "passed", "queries": query.calls,
            "retry_records": len(namespace["JOB_QUERY_RETRIES"])}


complete = (3, 3, 0, [101, 102, 103], 32)
cases = [
    run_case("complete_snapshot", [complete], {101, 102, 103}),
    run_case("successful_incomplete_snapshot_then_complete", [(4, 3, 0, [101, 102, 103], 32), complete],
             {101, 102, 103}, expected_calls=2),
    run_case("more_data_resize_then_complete", [(40, 32, 234, list(range(1, 33)), 264),
                                                (40, 40, 0, list(range(1, 41)), 328)],
             set(range(1, 41)), expected_calls=2),
    run_case("incomplete_query_attempts_exhausted", [(4, 3, 0, [101, 102, 103], 32)],
             failure="did not produce a complete bounded snapshot", expected_calls=8),
    run_case("oversized_membership_refused", [(1025, 32, 234, list(range(1, 33)), 264)],
             failure="Invalid or oversized Job query"),
    run_case("duplicate_pid_refused", [(3, 3, 0, [101, 101, 103], 32)], failure="Invalid Job process IDs"),
    run_case("unrelated_api_error_refused", [(0, 0, 5, [], 0)], failure="Invalid or oversized Job query"),
]
result = {"status": "passed", "scope": "Mocked Win32 query responses only; exact function extracted from final helper.",
          "helper_sha256": hashlib.sha256(source).hexdigest(), "cases": cases,
          "commands_or_windows_calls_executed": 0}
(root / "query-checks-v4.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
