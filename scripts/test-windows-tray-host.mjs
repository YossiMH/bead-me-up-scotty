import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const fixture = path.join(repository, 'scripts', 'fixtures', 'tray-process-boundary.mjs');
const options = { skip: process.platform === 'win32', timeout: 10000 };
function alive(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') {
      try { return !/\) Z /.test(fs.readFileSync('/proc/' + pid + '/stat', 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }
    return true;
  } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function start(t, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scotty-host-'));
  const cache = path.join(root, 'cache');
  fs.mkdirSync(cache);
  const script = path.join(cache, 'windows-tray.ps1');
  fs.copyFileSync(path.join(repository, 'bin', 'windows-tray.ps1'), script);
  const child = spawn(process.execPath, ['--import', pathToFileURL(fixture).href,
    path.join(repository, 'bin', 'windows-tray-host.mjs'), script, String(process.pid),
    'http://127.0.0.1:43971', cache], {
    detached: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SCOTTY_TRAY_TEST_DIR: root,
      SCOTTY_TRAY_TEST_PLATFORM: 'win32', SCOTTY_TRAY_TEST_HELPER_MODE: mode },
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; });
  child.stderr.on('data', bytes => { stderr += bytes; });
  child.stdin.on('error', () => {});
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (Number.isInteger(child.pid)) {
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await exited;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const events = () => {
    const file = path.join(root, 'events.jsonl');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').slice(0, -1).filter(Boolean).map(JSON.parse) : [];
  };
  return { child, exited, events, stdout: () => stdout, stderr: () => stderr,
    async ready() {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && !stdout.includes('READY\n')) {
        if (child.exitCode !== null) assert.fail('Host exited before readiness: ' + stderr);
        await delay(20);
      }
      assert(stdout.includes('READY\n'), 'No readiness: ' + stderr);
      const spawned = events().find(e => e.event === 'tray_spawn');
      assert(spawned);
      assert.equal(spawned.detached, false);
      assert.equal(spawned.windowsHide, true);
      assert.equal(spawned.shell, false);
      assert.deepEqual(spawned.stdio, ['pipe', 'pipe', 'pipe']);
      return events().find(e => e.event === 'tray_started');
    } };
}

for (const control of ['STOP\n', '']) {
  test('tray host relays readiness and disposes its child on ' + (control ? 'STOP' : 'controller EOF'), options, async t => {
    const run = await start(t, 'ready');
    const helper = await run.ready();
    run.child.stdin.end(control);
    assert.deepEqual(await run.exited, { code: 0, signal: null }, run.stderr());
    assert.equal(alive(helper.pid), false);
    assert(run.events().some(e => e.event === 'tray_disposed'));
  });
}
test('tray host preserves a helper initialization error and exit code', options, async t => {
  const run = await start(t, 'failure');
  assert.deepEqual(await run.exited, { code: 23, signal: null });
  assert.match(run.stderr(), /fixture initialization failed/);
  const helper = run.events().find(e => e.event === 'tray_started');
  assert.equal(alive(helper.pid), false);
});
test('tray host reports a failed OS spawn without hanging on its input', options, async t => {
  const run = await start(t, 'spawn-error');
  assert.deepEqual(await run.exited, { code: 1, signal: null });
  assert.match(run.stderr(), /could not start.*ENOENT/);
  assert.equal(run.events().filter(e => e.event === 'tray_started').length, 0);
});
test('tray host drains helper cleanup after its controller output pipe breaks', options, async t => {
  const run = await start(t, 'write-on-close');
  const helper = await run.ready();
  run.child.stdout.destroy();
  run.child.stdin.end();
  assert.deepEqual(await run.exited, { code: 0, signal: null }, run.stderr());
  assert.equal(alive(helper.pid), false);
  assert(run.events().some(e => e.event === 'tray_disposed'));
});
test('tray host bounds an unresponsive helper and reports forced termination', options, async t => {
  const run = await start(t, 'ignore-stop');
  const helper = await run.ready();
  const started = Date.now();
  run.child.stdin.end('STOP\n');
  assert.deepEqual(await run.exited, { code: 1, signal: null });
  assert(Date.now() - started < 5000, 'Forced stop exceeded its bound');
  assert.match(run.stderr(), /required forced termination/);
  assert.equal(alive(helper.pid), false);
});
