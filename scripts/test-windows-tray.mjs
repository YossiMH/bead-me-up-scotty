import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const fixtures = path.join(repository, 'scripts', 'fixtures');
const options = { skip: process.platform === 'win32', timeout: 12000 };

async function waitFor(check, description, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await delay(20);
  }
  assert.fail(description);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    // A killed parent can leave an exited helper awaiting the container's
    // reaper. Such a zombie no longer owns a tray, pipe or running code.
    if (process.platform === 'linux') {
      try { return !/\) Z /.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }
    return true;
  }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
}

/** Copy only the production entrypoints into an isolated, synthetic package. */
async function startController(t, entry, config = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scotty-tray-'));
  let cleanProcesses = async () => {};
  t.after(async () => {
    await cleanProcesses();
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.cpSync(path.join(repository, 'bin'), path.join(root, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(repository, 'scripts', 'serve.mjs'), path.join(root, 'scripts', 'serve.mjs'));
  fs.mkdirSync(path.join(root, '.next'));
  fs.writeFileSync(path.join(root, '.next', 'BUILD_ID'), 'tray-fixture');
  const nextRoot = path.join(root, 'node_modules', 'next');
  fs.mkdirSync(path.join(nextRoot, 'dist', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(nextRoot, 'package.json'), JSON.stringify({ name: 'next', type: 'module' }));
  fs.writeFileSync(path.join(nextRoot, 'dist', 'bin', 'next'),
    `import ${JSON.stringify(pathToFileURL(path.join(fixtures, 'tray-server.mjs')).href)};\n`);
  const localAppData = config.localAppData === undefined ? path.join(root, 'local-app-data') : config.localAppData;
  const temporaryDirectory = path.join(root, 'redirected-temp');
  fs.mkdirSync(temporaryDirectory);
  if (localAppData && path.isAbsolute(localAppData)) {
    fs.mkdirSync(localAppData, { recursive: true });
    fs.writeFileSync(path.join(localAppData, 'unrelated.txt'), 'keep unrelated local data');
    if (config.blockedCacheRoot) {
      fs.mkdirSync(path.join(localAppData, 'bead-me-up-scotty'), { recursive: true });
      fs.writeFileSync(path.join(localAppData, 'bead-me-up-scotty', 'tray'), 'keep existing file');
    }
  }
  const port = await unusedPort();
  let command;
  if (entry === 'global') {
    command = ['bin/bead-me-up-scotty.mjs', '--no-open', '--host', '127.0.0.1', '--port', String(port)];
  } else if (entry === 'start') {
    const script = JSON.parse(fs.readFileSync(path.join(repository, 'package.json'), 'utf8')).scripts.start;
    const [executable, ...args] = script.trim().split(/\s+/);
    assert.ok(['node', 'next'].includes(executable), 'start command must be exercised by this fixture');
    command = executable === 'node' ? args : [path.join(nextRoot, 'dist', 'bin', 'next'), ...args];
    command.push('--port', String(port), '--hostname', '127.0.0.1', '--keepAliveTimeout', '12345');
  } else {
    command = ['scripts/serve.mjs'];
  }
  const environment = {
    ...process.env, PORT: String(port), HOST: '127.0.0.1',
    BMUS_SERVE_CMD: '', BMUS_TRAY: config.disabled ? '0' : '1',
    TMP: temporaryDirectory, TEMP: temporaryDirectory, TMPDIR: temporaryDirectory,
    SCOTTY_TRAY_TEST_DIR: root,
    SCOTTY_TRAY_TEST_PLATFORM: config.platform || 'win32',
    SCOTTY_TRAY_TEST_SERVER_MODE: config.serverMode || 'serve',
    SCOTTY_TRAY_TEST_HELPER_MODE: config.helperMode || 'ready',
  };
  if (localAppData === null) delete environment.LOCALAPPDATA;
  else environment.LOCALAPPDATA = localAppData;
  const child = spawn(process.execPath, ['--import', path.join(fixtures, 'tray-process-boundary.mjs'), ...command], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: environment,
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  function events() {
    const file = path.join(root, 'events.jsonl');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  }
  cleanProcesses = async () => {
    // This session owns the complete process group, including a child left by
    // a failing controller. Never search or kill by executable name.
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    await exited;
  };
  return {
    child, exited, events, port, root, localAppData, temporaryDirectory,
    output: () => output,
    mark: name => fs.writeFileSync(path.join(root, name), ''),
    ready: () => waitFor(() => events().find(event => event.event === 'server_ready'), `server readiness missing: ${output}`),
    tray: () => waitFor(() => events().find(event => event.event === 'tray_started'),
      'running Windows controller never created its tray helper'),
  };
}

function helperCopy(run) {
  const event = run.events().find(event => event.event === 'tray_spawn');
  assert.ok(event, 'the real tray owner must reach the Windows process boundary');
  const script = event.args[event.args.indexOf('-File') + 1];
  const cacheRoot = path.join(run.localAppData, 'bead-me-up-scotty', 'tray');
  const relative = path.relative(cacheRoot, script);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    `the tray helper must be copied under absolute LOCALAPPDATA, not launched from its bundle or TEMP: ${script}`);
  assert.notEqual(path.dirname(script), cacheRoot, 'each tray owns a separate session directory');
  assert.equal(path.basename(script), 'windows-tray.ps1');
  assert.equal(event.scriptSha256, createHash('sha256').update(fs.readFileSync(path.join(run.root, 'bin', 'windows-tray.ps1'))).digest('hex'),
    'the launched copy must contain the exact bundled script bytes');
  assert.equal(event.args.some(arg => /bypass|executionpolicy|encodedcommand/i.test(arg)), false,
    'ordinary -File execution must retain the host execution policy');
  return script;
}

function assertCopyRemoved(run, script) {
  assert.equal(fs.existsSync(script), false, 'the owned script copy must be removed');
  assert.equal(fs.existsSync(path.dirname(script)), false, 'the owned session directory must be removed');
  assert.equal(fs.readFileSync(path.join(run.localAppData, 'unrelated.txt'), 'utf8'), 'keep unrelated local data');
  assert.ok(fs.existsSync(path.join(run.root, 'bin', 'windows-tray.ps1')), 'the bundled source must remain');
}

test('tray cache: exact LocalAppData copy survives until Exit and is then reclaimed', options, async t => {
  const run = await startController(t, 'serve');
  await run.ready();
  const script = helperCopy(run);
  assert.deepEqual(fs.readFileSync(script), fs.readFileSync(path.join(run.root, 'bin', 'windows-tray.ps1')));
  assert.deepEqual(fs.readdirSync(run.temporaryDirectory), [], 'redirected TEMP is not used for executable helper code');
  run.mark('click-exit');
  assert.deepEqual(await run.exited, { code: 0, signal: null });
  assertCopyRemoved(run, script);
});

for (const helperMode of ['failure', 'spawn-error']) {
  test(`tray cache: ${helperMode} reclaims its owned copy before reporting completion`, options, async t => {
    const run = await startController(t, 'serve', { helperMode });
    assert.notEqual((await run.exited).code, 0);
    const script = helperCopy(run);
    assertCopyRemoved(run, script);
    assert.equal(run.events().filter(event => event.event === 'server_started').length, 0);
  });
}

for (const localAppData of [null, 'relative-local-data']) {
  test(`tray cache: ${localAppData === null ? 'missing' : 'relative'} LOCALAPPDATA refuses before child launch`, options, async t => {
    // The failing boundary keeps the pre-fix run bounded while still exposing
    // its incorrect attempt to execute a helper without a valid local root.
    const run = await startController(t, 'serve', { localAppData, helperMode: 'failure' });
    assert.notEqual((await run.exited).code, 0);
    assert.equal(run.events().filter(event => event.event === 'tray_spawn').length, 0);
    assert.equal(run.events().filter(event => event.event === 'server_started').length, 0);
    assert.match(run.output(), /LOCALAPPDATA/i);
  });
}

test('tray cache: an unusable local cache preserves existing data and refuses child launch', options, async t => {
  const run = await startController(t, 'serve', { blockedCacheRoot: true, helperMode: 'failure' });
  assert.notEqual((await run.exited).code, 0);
  assert.equal(run.events().filter(event => event.event === 'tray_spawn').length, 0);
  assert.equal(fs.readFileSync(path.join(run.localAppData, 'bead-me-up-scotty', 'tray'), 'utf8'), 'keep existing file');
  assert.equal(fs.readFileSync(path.join(run.localAppData, 'unrelated.txt'), 'utf8'), 'keep unrelated local data');
});

test('tray cache: an explicit controller exit reclaims only its own script', options, async t => {
  const run = await startController(t, 'serve');
  await run.ready();
  const script = helperCopy(run);
  run.mark('exit-controller');
  assert.deepEqual(await run.exited, { code: 73, signal: null });
  assertCopyRemoved(run, script);
});

test('tray cache: concurrent controllers never remove another live session copy', options, async t => {
  const first = await startController(t, 'serve');
  await first.ready();
  const firstScript = helperCopy(first);
  const second = await startController(t, 'serve', { localAppData: first.localAppData });
  await second.ready();
  const secondScript = helperCopy(second);
  assert.notEqual(path.dirname(firstScript), path.dirname(secondScript));
  first.mark('click-exit');
  assert.deepEqual(await first.exited, { code: 0, signal: null });
  assertCopyRemoved(first, firstScript);
  assert.ok(fs.existsSync(secondScript), 'the other live controller retains its own helper');
  assert.equal(second.child.exitCode, null);
  second.mark('click-exit');
  assert.deepEqual(await second.exited, { code: 0, signal: null });
  assertCopyRemoved(second, secondScript);
});

for (const entry of ['global', 'serve', 'start']) {
  test(`${entry}: creates one hidden tray and Exit waits for owned server termination`, options, async t => {
    const run = await startController(t, entry);
    const server = await run.ready();
    const tray = await run.tray();
    const spawnEvent = run.events().find(event => event.event === 'tray_spawn');
    assert.equal(spawnEvent.windowsHide, true);
    assert.notEqual(spawnEvent.shell, true);
    assert.ok(spawnEvent.args.includes('-STA'), 'Windows Forms needs a single-threaded apartment');
    run.mark('click-exit');
    assert.deepEqual(await run.exited, { code: 0, signal: null }, run.output());
    assert.equal(alive(server.pid), false, 'the actual server child must have exited');
    assert.equal(alive(tray.pid), false, 'the actual tray helper must have exited');
    assert.equal(run.events().filter(event => event.event === 'tray_spawn').length, 1);
    assert.equal(run.events().filter(event => event.event === 'server_stop').length, 1);
    assert.ok(run.events().some(event => event.event === 'tray_disposed'));
    if (entry === 'start') {
      const args = run.events().find(event => event.event === 'server_started').args;
      assert.ok(args.includes('--keepAliveTimeout') && args.includes('12345'), 'npm start retains Next CLI options');
    }
  });
}

test('serve: code-75 restart retains the original tray and Exit prevents another restart', options, async t => {
  const run = await startController(t, 'serve', { serverMode: 'restart' });
  const tray = await run.tray();
  const replacement = await run.ready();
  assert.equal(run.events().filter(event => event.event === 'server_started').length, 2);
  assert.equal(run.events().filter(event => event.event === 'tray_spawn').length, 1);
  run.mark('click-exit');
  assert.deepEqual(await run.exited, { code: 0, signal: null });
  assert.equal(alive(replacement.pid), false);
  assert.equal(alive(tray.pid), false);
});

test('serve: an exit-75 child cannot restart after tray Exit', options, async t => {
  const run = await startController(t, 'serve', { serverMode: 'restart-on-stop' });
  await run.ready();
  await run.tray();
  run.mark('click-exit');
  assert.deepEqual(await run.exited, { code: 0, signal: null });
  assert.equal(run.events().filter(event => event.event === 'server_started').length, 1);
});

for (const entry of ['global', 'serve']) {
  test(`${entry}: failed tray initialization stops the owned server and reports failure`, options, async t => {
    const run = await startController(t, entry, { helperMode: 'failure' });
    await run.tray();
    assert.notEqual((await run.exited).code, 0);
    for (const event of run.events().filter(event => event.event === 'server_started')) {
      assert.equal(alive(event.pid), false);
    }
    assert.match(run.output(), /tray/i);
  });

  test(`${entry}: natural server failure disposes the tray and retains failure status`, options, async t => {
    const run = await startController(t, entry);
    await run.ready();
    const tray = await run.tray();
    run.mark('fail-server');
    assert.deepEqual(await run.exited, { code: 17, signal: null });
    assert.equal(alive(tray.pid), false);
    assert.ok(run.events().some(event => event.event === 'tray_disposed'));
  });

  test(`${entry}: unexpected tray loss stops the server and reports failure`, options, async t => {
    const run = await startController(t, entry);
    const server = await run.ready();
    await run.tray();
    run.mark('fail-helper');
    assert.notEqual((await run.exited).code, 0);
    assert.equal(alive(server.pid), false);
  });
}

test('tray process pipe closes when its owning controller disappears', options, async t => {
  const run = await startController(t, 'serve');
  await run.ready();
  const tray = await run.tray();
  run.child.kill('SIGKILL');
  await run.exited;
  await waitFor(() => !alive(tray.pid), 'tray survived the loss of its parent');
  assert.ok(run.events().some(event => event.event === 'tray_disposed'));
});

for (const config of [{ platform: 'linux' }, { disabled: true }]) {
  test(`serve: ${config.disabled ? 'explicit headless mode' : 'non-Windows'} needs no tray process`, options, async t => {
    const run = await startController(t, 'serve', { ...config, localAppData: null });
    const server = await run.ready();
    run.child.kill('SIGTERM');
    assert.deepEqual(await run.exited, { code: 0, signal: null });
    assert.equal(alive(server.pid), false);
    assert.equal(run.events().filter(event => event.event === 'tray_spawn').length, 0);
  });
}

test('batch launcher uses real lines and the tray-owning global controller', () => {
  const batch = fs.readFileSync(path.join(repository, 'launch-scotty.bat'), 'utf8');
  assert.ok(batch.split(/\r?\n/).length > 5);
  assert.ok(!batch.includes('\\r\\n'), 'literal escape sequences are not batch line endings');
  assert.match(batch, /node\s+"\.\\bin\\bead-me-up-scotty\.mjs"/i);
  assert.match(batch, /%\*/);
});
