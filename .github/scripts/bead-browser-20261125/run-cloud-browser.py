#!/usr/bin/env python3
"""Run the unchanged browser integration with a deadline and scoped cleanup."""

import argparse
import ctypes
import datetime
import json
import os
import pathlib
import signal
import socket
import subprocess
import time


def processes():
    result = {}
    for entry in pathlib.Path('/proc').iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            raw = (entry / 'stat').read_text(errors='replace')
            end = raw.rfind(')')
            fields = raw[end + 2:].split()
            pid = int(entry.name)
            result[pid] = {
                'pid': pid,
                'name': raw[raw.find('(') + 1:end],
                'state': fields[0],
                'parent_pid': int(fields[1]),
                'start_ticks': int(fields[19]),
            }
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
    return result


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            listener.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cwd', required=True)
    parser.add_argument('--binary', required=True)
    parser.add_argument('--chromium', required=True)
    parser.add_argument('--test-root', required=True)
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--deadline-seconds', type=int, default=900)
    args = parser.parse_args()
    if not 1 <= args.deadline_seconds <= 900:
        parser.error('deadline must be between 1 and 900 seconds')
    for filename in (args.cwd, args.binary, args.chromium, args.test_root, args.output):
        if not pathlib.Path(filename).is_absolute():
            parser.error('all supplied paths must be absolute')

    output = pathlib.Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    receipt = output / 'browser-execution.json'
    log = output / 'browser-execution.log'
    if receipt.exists() or log.exists():
        raise RuntimeError('Use a fresh output directory; prior evidence is retained')

    # Orphaned descendants, including the detached Next server, remain children
    # of this supervisor if the integration runner is terminated by its deadline.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), 'Could not enable child-subreaper cleanup')

    command = ['node', 'scripts/test-backend-integration.mjs', 'bead-rs', '--browser', '--native-ui']
    environment = {
        **os.environ,
        'BEAD_BIN': args.binary,
        'SCOTTY_TEST_CHROME': args.chromium,
        'SCOTTY_TEST_ROOT': args.test_root,
        'SCOTTY_TEST_PORT': str(args.port),
        'SCOTTY_TEST_SERVER_MODE': 'start',
        'POSTHOG_KEY': '',
        'NEXT_TELEMETRY_DISABLED': '1',
        'BD_DISABLE_METRICS': '1',
        'BD_DISABLE_EVENT_FLUSH': '1',
        'NODE_OPTIONS': '--max-old-space-size=512',
    }
    record = {
        'status': 'running',
        'command': command,
        'cwd': args.cwd,
        'binary': args.binary,
        'chromium': args.chromium,
        'test_root': args.test_root,
        'port': args.port,
        'deadline_seconds': args.deadline_seconds,
        'node_heap_mib': 512,
        'started_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'log': str(log),
        'boundary': 'Existing real CLI/API/browser tests; their HTTP response substitutions are unchanged',
    }
    known = {}
    cleanup_errors = []
    stop_requested = []
    child = None
    started = time.monotonic()

    def remember():
        snapshot = processes()
        parents = {os.getpid()}
        parents.update(pid for (pid, start) in known if pid in snapshot and snapshot[pid]['start_ticks'] == start)
        while True:
            added = {pid for pid, entry in snapshot.items() if entry['parent_pid'] in parents} - parents
            if not added:
                break
            parents.update(added)
        for pid in parents - {os.getpid()}:
            if pid in snapshot:
                entry = snapshot[pid]
                known.setdefault((pid, entry['start_ticks']), dict(entry))
        return {key: snapshot[key[0]] for key in known
                if key[0] in snapshot and snapshot[key[0]]['start_ticks'] == key[1]
                and snapshot[key[0]]['state'] != 'Z'}

    def reap():
        while True:
            try:
                pid, _ = os.waitpid(-1, os.WNOHANG)
                if pid == 0:
                    return
            except ChildProcessError:
                return

    def request_stop(signum, _frame):
        stop_requested.append(signum)

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    try:
        if not port_free(args.port):
            raise RuntimeError('The selected port is already occupied; no test was started')
        with log.open('x') as stream:
            child = subprocess.Popen(command, cwd=args.cwd, env=environment,
                                     stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            record['runner_pid'] = child.pid
            receipt.write_text(json.dumps(record, indent=2) + '\n')
            while child.poll() is None:
                remember()
                if stop_requested or time.monotonic() - started >= args.deadline_seconds:
                    record['status'] = 'interrupted' if stop_requested else 'timed_out'
                    break
                time.sleep(0.2)
            if child.returncode is not None:
                record['exit_code'] = child.returncode
                record['status'] = 'passed' if child.returncode == 0 else 'failed'
    except Exception as error:
        record['status'] = 'failed'
        record['error'] = str(error)
    finally:
        # Signal only recorded descendants whose PID and start time still match.
        # A subreaper also discovers descendants reparented during termination.
        for stop_signal, seconds in ((signal.SIGTERM, 4), (signal.SIGKILL, 3)):
            live = remember()
            for pid, start in live:
                current = processes().get(pid)
                if current is None or current['start_ticks'] != start:
                    continue
                try:
                    os.kill(pid, stop_signal)
                except ProcessLookupError:
                    pass
                except OSError as error:
                    cleanup_errors.append(f'{pid}: {error}')
            deadline = time.monotonic() + seconds
            while time.monotonic() < deadline:
                if child is not None:
                    child.poll()
                if not remember():
                    break
                time.sleep(0.1)
            if child is not None and child.poll() is not None:
                reap()
            if not remember():
                break
        remaining = list(remember().values())
        if child is not None and child.poll() is not None:
            record['exit_code'] = child.returncode
            reap()
        free_after = port_free(args.port)
        record.update({
            'elapsed_seconds': round(time.monotonic() - started, 3),
            'finished_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'process_identities': list(known.values()),
            'remaining_processes': remaining,
            'port_free_after': free_after,
            'cleanup_errors': cleanup_errors,
            'signals_received': stop_requested,
        })
        if remaining or cleanup_errors or not free_after:
            record['status'] = 'failed'
        receipt.write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(record, indent=2))
    return 0 if record['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
