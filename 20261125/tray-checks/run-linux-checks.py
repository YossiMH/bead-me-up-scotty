#!/usr/bin/env python3
"""Run the assigned serial launcher checks and full lint against the frozen app."""
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time

ROOT = Path('/workspace/scratch/3160e3ba3d24')
SOURCE = ROOT / 'worktrees/scotty-completion'
OUTPUT = ROOT / 'coordination/results/tray-checks-5232c8b-linux'
COMMIT = '5232c8b94804064ab71af571ee28797667bd72bd'
TREE = 'eadf3e74beb2422186f1b6ffb5ba632d0ad8d7d9'
BASE = '38c21a77b4e875d75e17ee68683846601df33591'
PINS = ROOT / 'coordination/revision-6/tray-candidate-files.json'


def require(value, message):
    if not value:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, value):
    with (OUTPUT / name).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def run(command, name, seconds, extra_env=None):
    env = dict(os.environ)
    for key in list(env):
        if key.startswith(('GIT_', 'SCOTTY_', 'BMUS_', 'BEAD_')) or key == 'NODE_OPTIONS':
            del env[key]
    env.update(extra_env or {})
    row = {'command': command, 'seconds': seconds, 'environment_overrides': extra_env or {}, 'started': time.time()}
    result['commands'].append(row)
    stdout, stderr = OUTPUT / (name + '.stdout'), OUTPUT / (name + '.stderr')
    process = None
    try:
        with stdout.open('xb') as out, stderr.open('xb') as err:
            process = subprocess.Popen(command, cwd=SOURCE, env=env, stdin=subprocess.DEVNULL,
                                       stdout=out, stderr=err, start_new_session=True)
            row['pid'] = process.pid
            row['exit_code'] = process.wait(timeout=seconds)
    except BaseException as error:
        row['error'] = str(error)
        if process is not None and process.poll() is None:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(process.pid, sig)
                    process.wait(timeout=3)
                    break
                except ProcessLookupError:
                    break
                except subprocess.TimeoutExpired:
                    continue
        raise
    finally:
        row['finished'] = time.time()
        row['streams'] = {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)}
                          for p in (stdout, stderr) if p.is_file()}
    require(row['exit_code'] == 0, name + ' exited ' + str(row['exit_code']))
    return stdout.read_text(), stderr.read_text()


require(os.name == 'posix' and not OUTPUT.exists(), 'Fresh cloud Linux output is required')
OUTPUT.mkdir(parents=True)
pins = json.loads(PINS.read_text())
require(len(pins) == 9, 'The frozen candidate must contain nine files')
result = {'schema_version': 1, 'status': 'failed', 'source_commit': COMMIT, 'source_tree': TREE,
          'baseline_commit': BASE, 'pins_manifest_sha256': digest(PINS), 'source_files': pins,
          'helper_sha256': digest(Path(__file__)), 'commands': [], 'started': time.time(),
          'scope': '39 serial cloud Linux launcher/host checks and full project lint; Windows is a separate result.'}
try:
    head, _ = run(['git', 'rev-parse', 'HEAD'], 'head', 30)
    tree, _ = run(['git', 'rev-parse', 'HEAD^{tree}'], 'tree', 30)
    status, _ = run(['git', 'status', '--porcelain=v1', '--untracked-files=all'], 'status-before', 30)
    require(head.strip() == COMMIT and tree.strip() == TREE and not status, 'Source is not the clean accepted candidate')
    for row in pins:
        require(digest(SOURCE / row['path']) == row['sha256'], 'A candidate file differs')
    run(['git', 'diff', '--check', BASE, COMMIT, '--'], 'diff-check', 30)
    result['node'], _ = run(['node', '--version'], 'node-version', 30)
    result['npm'], _ = run(['npm', '--version'], 'npm-version', 30)
    stdout, _ = run(['node', '--test', '--test-reporter=tap', '--test-concurrency=1',
        'scripts/test-bead-binary-option.mjs', 'scripts/test-serve.mjs',
        'scripts/test-windows-tray.mjs', 'scripts/test-windows-tray-host.mjs'], 'launchers', 600)
    counts = {key: int(value) for key, value in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$', stdout, re.M)}
    require(counts == {'tests': 39, 'pass': 39, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}, 'Launcher counts differ')
    result['launchers'] = counts
    stdout, stderr = run(['npm', 'run', 'lint'], 'lint', 300, {'NODE_OPTIONS': '--max-old-space-size=384'})
    warning_rows = [line for line in stdout.splitlines() if re.search(r'\d+:\d+\s+warning\s+', line)]
    require(len(warning_rows) <= 1 and all('@next/next/no-location-assign-relative-destination' in row for row in warning_rows), 'Unexpected lint warning')
    if warning_rows:
        require('hooks/use-notifications.ts' in stdout and '1 problem (0 errors, 1 warning)' in stdout, 'Expected baseline lint warning differs')
    result['lint_warning_rows'] = warning_rows
    result['status'] = 'passed'
except BaseException as error:
    result['error'] = type(error).__name__ + ': ' + str(error)
finally:
    try:
        for row in pins:
            require(digest(SOURCE / row['path']) == row['sha256'], 'A candidate source file changed')
        status, _ = run(['git', 'status', '--porcelain=v1', '--untracked-files=all'], 'status-after', 30)
        require(not status, 'Source status changed')
        result['source_unchanged'] = True
    except BaseException as error:
        result['status'] = 'failed'
        result['preservation_error'] = str(error)
    result['finished'] = time.time()
    write('result.json', result)
    print(json.dumps(result, indent=2), flush=True)
raise SystemExit(0 if result['status'] == 'passed' else 1)
