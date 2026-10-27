import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));

/** Runs the real supervisor with an owned synthetic child, never Next.js. */
function startSupervisor(t, behavior) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scotty-serve-'));
  const supervisor = spawn(process.execPath, [path.join(directory, 'serve.mjs')], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: root,
      BMUS_SERVE_CMD: JSON.stringify([
        process.execPath, path.join(directory, 'fixtures/serve-child.mjs'),
        behavior, path.join(root, 'restart-marker'),
      ]),
    },
  });
  let output = '';
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  supervisor.stdout.on('data', chunk => {
    output += chunk;
    const match = output.match(/ready:(\d+)/);
    if (match) readyResolve(Number(match[1]));
  });
  supervisor.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise((resolve, reject) => {
    supervisor.once('error', reject);
    supervisor.once('exit', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    // The process group also owns a child orphaned by a failing supervisor.
    try { process.kill(-supervisor.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    await exited;
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { supervisor, ready, exited, output: () => output };
}

// These cases exercise POSIX signals and process groups, not Windows termination.
const options = { skip: process.platform === 'win32', timeout: 10000 };

test('serve preserves a natural child failure status', options, async t => {
  const run = startSupervisor(t, 'exit');
  assert.deepEqual(await run.exited, { code: 17, signal: null });
});

test('serve restarts on 75 and preserves the replacement child status', options, async t => {
  const run = startSupervisor(t, 'restart');
  assert.deepEqual(await run.exited, { code: 17, signal: null });
  assert.equal(run.output().match(/relaunching the server/g)?.length, 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`serve waits for graceful ${signal} shutdown`, options, async t => {
    const run = startSupervisor(t, 'graceful');
    const childPid = await run.ready;
    run.supervisor.kill(signal);
    assert.deepEqual(await run.exited, { code: 0, signal: null });
    assert.match(run.output(), new RegExp(`received:${signal}`));
    assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
  });

  test(`serve kills a child that does not drain after ${signal}`, options, async t => {
    const run = startSupervisor(t, 'stubborn');
    const childPid = await run.ready;
    run.supervisor.kill(signal);
    const result = await run.exited;
    assert.match(run.output(), new RegExp(`received:${signal}`));
    assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' },
      'the owned child must be gone before the supervisor exits');
    assert.deepEqual(result, { code: 1, signal: null },
      'forced termination must not report a graceful shutdown');
  });
}
