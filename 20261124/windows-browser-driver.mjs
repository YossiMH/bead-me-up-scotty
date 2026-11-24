// Temporary Windows execution harness. The imported product test is unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.platform, 'win32', 'This reviewed fallback is Windows-only');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const manifest = JSON.parse(fs.readFileSync(input.manifest_path, 'utf8').replace(/^\uFEFF/, ''));
const flows = {
  flows: 'scripts/test-native-ui-flows.mjs',
  recovery: 'scripts/test-native-ui-recovery.mjs',
  priority: 'scripts/test-native-priority-recovery.mjs',
};
assert.ok(Object.hasOwn(flows, input.flow));
const root = input.evidence_directory;
const source = manifest.repository_path;
const workspace = path.join(root, 'native-workspace');
const home = path.join(root, 'home');
const config = path.join(root, 'config');
const temp = path.join(root, 'temp');
const output = path.join(root, 'ui');
const base = `http://127.0.0.1:${input.port}`;
const execute = promisify(execFile);
const hash = (filename) => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const recordPath = path.join(root, 'execution.jsonl');
fs.writeFileSync(recordPath, '', { flag: 'wx' });
function record(boundary, details) {
  fs.appendFileSync(recordPath, JSON.stringify({ utc: new Date().toISOString(), boundary, ...details }) + '\n');
}
function errorValue(error) {
  return { name: error.name, message: error.message, stack: error.stack, code: error.code, actual: error.actual, expected: error.expected, operator: error.operator };
}
function remaining() {
  const value = input.work_deadline_ms - Date.now();
  assert.ok(value > 0, 'The browser work deadline expired');
  return value;
}
async function bounded(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
const result = {
  schema_version: 1, status: 'failed', flow: input.flow, started_utc: new Date().toISOString(),
  source_commit: manifest.source_commit, accepted_source_commit: manifest.accepted_source_commit,
  staged_source_commit: manifest.staged_source_commit,
  runtime_source_commit: manifest.runtime_source_commit, binary_source_commit: manifest.binary_source_commit,
  source, workspace, config, base, test: flows[input.flow], node: process.version,
  launch_count: 0, context_count: 0, maximum_live_contexts: 0, cleanup_errors: [],
  boundary: input.flow === 'flows' ? 'Real native CLI, HTTP API, and browser UI' :
    'Real native writes; existing UI tests replace the HTTP response to test recovery and prevent replay',
};
let server, serverError, browser, projectId, liveContexts = 0, originalLaunch, chromium;
let registrationAttempted = false;
const marker = 'This unrelated native fixture file must remain unchanged.\n';
async function command(file, args, kind, timeout = 12000) {
  record('command-start', { kind, file, args });
  try {
    const response = await execute(file, args, {
      cwd: workspace, env: process.env, timeout: Math.min(timeout, remaining()),
      maxBuffer: 2 * 1024 * 1024, windowsHide: true, encoding: 'utf8',
    });
    record('command-result', { kind, exit: 0, ...response });
    return response.stdout;
  } catch (error) {
    record('command-result', { kind, exit: error.code, killed: error.killed, stdout: error.stdout, stderr: error.stderr, error: errorValue(error) });
    throw error;
  }
}
async function request(route, method = 'GET', body, expected = 200, timeout = 5000) {
  record('request-start', { route, method, body });
  const response = await fetch(base + route, {
    method, headers: { 'content-type': 'application/json', origin: base },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  record('response', { route, method, status: response.status, body: text });
  assert.equal(response.status, expected, `${method} ${route}: ${text}`);
  return JSON.parse(text);
}

try {
  for (const filename of Object.values(flows)) {
    assert.equal(hash(path.join(source, filename)), manifest.source_files[filename], `Unchanged test source: ${filename}`);
  }
  for (const [filename, expected] of Object.entries(manifest.source_files)) {
    assert.equal(hash(path.join(source, filename)), expected, `Source input differs: ${filename}`);
  }
  assert.equal(hash(manifest.bead_exe), manifest.bead_sha256);
  assert.equal(fs.readFileSync(path.join(source, '.next', 'BUILD_ID'), 'utf8').trim(), manifest.build_id);
  for (const entry of manifest.runtime_files) {
    assert.ok(entry.path.startsWith('.next/') && !entry.path.split('/').includes('..'));
    assert.equal(hash(path.join(source, entry.path)), entry.sha256, `Prebuilt runtime differs: ${entry.path}`);
  }
  const require = createRequire(path.join(source, 'package.json'));
  result.packages = Object.fromEntries(['next', 'react', 'playwright', 'playwright-core'].map(name => [name, require(`${name}/package.json`).version]));
  for (const [name, expected] of Object.entries(manifest.package_versions)) assert.equal(result.packages[name], expected, `${name} version`);
  for (const directory of [workspace, home, config, temp, output]) fs.mkdirSync(directory);
  for (const name of Object.keys(process.env)) {
    if (name.toUpperCase().startsWith('GIT_') || ['NODE_OPTIONS', 'NODE_PATH'].includes(name.toUpperCase())) delete process.env[name];
  }
  Object.assign(process.env, {
    HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: config, APPDATA: home, LOCALAPPDATA: home,
    TEMP: temp, TMP: temp, TMPDIR: temp, BEAD_BIN: manifest.bead_exe, BEADS_REPO: '',
    BEADS_ACTOR: 'scotty-browser-check', POSTHOG_KEY: '', NEXT_TELEMETRY_DISABLED: '1',
    GIT_CONFIG_GLOBAL: 'NUL', GIT_CONFIG_NOSYSTEM: '1', GIT_CEILING_DIRECTORIES: root, GIT_TERMINAL_PROMPT: '0',
    SCOTTY_READ_ONLY: '0', BMUS_TRAY: '0', SCOTTY_TEST_ROOT: root,
    SCOTTY_TEST_URL: base, SCOTTY_TEST_OUTPUT: output, SCOTTY_TEST_CHROME: manifest.chrome_path,
  });
  const configDirectory = path.join(config, 'bead-me-up-scotty');
  fs.mkdirSync(configDirectory);
  fs.writeFileSync(path.join(configDirectory, 'config.json'), JSON.stringify({
    humanActor: 'scotty-browser-check', humanAllowlist: ['scotty-browser-check'], humanActorChosen: true,
    pollIntervalMs: 300000, projects: [], orders: {}, gamification: false,
  }, null, 2), { flag: 'wx' });
  await command('git.exe', ['init', '--quiet', '--initial-branch=codex/scotty-browser-fixture', '--template='], 'git-init');
  fs.writeFileSync(path.join(workspace, 'unrelated-keep.txt'), marker, { flag: 'wx' });
  await command(manifest.bead_exe, ['init', '--prefix', 'browser'], 'native-init');
  result.seed = JSON.parse(await command(manifest.bead_exe, ['create', '--title', 'Open unassigned UI dependency target', '--json'], 'native-create'));
  result.snapshot_before = JSON.parse(await command(manifest.bead_exe, ['changes', '--snapshot', '--json'], 'native-before'));
  const stdout = fs.openSync(path.join(root, 'server.stdout.log'), 'wx');
  const stderr = fs.openSync(path.join(root, 'server.stderr.log'), 'wx');
  const serverArgs = ['--max-old-space-size=96', path.join(source, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '--hostname', '127.0.0.1', '--port', String(input.port)];
  try {
    server = spawn(process.execPath, serverArgs, { cwd: source, env: process.env, windowsHide: true, detached: false, stdio: ['ignore', stdout, stderr] });
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  server.on('error', error => { serverError = error; });
  result.server = { pid: server.pid, executable: process.execPath, args: serverArgs };
  record('server-start', result.server);
  const startupEnd = Math.min(Date.now() + 30000, input.work_deadline_ms);
  let projects;
  for (;;) {
    if (serverError) throw serverError;
    assert.equal(server.exitCode, null, 'Direct Next server exited during startup');
    assert.equal(server.signalCode, null, 'Direct Next server was terminated during startup');
    try {
      const response = await fetch(base + '/api/projects', { signal: AbortSignal.timeout(1500) });
      if (response.ok) { projects = await response.json(); break; }
    } catch { /* Repeat only this startup read. */ }
    assert.ok(Date.now() < startupEnd, 'Direct Next server startup timed out');
    await delay(150);
  }
  assert.deepEqual(projects.projects.filter(project => project.id !== 'demo'), [], 'Fresh configuration must contain no registered projects');
  record('initial-projects', { response: projects });
  registrationAttempted = true;
  const registered = await request('/api/projects', 'POST', { path: workspace, backend: 'bead-rs' }, 201);
  projectId = registered.id;
  assert.equal(typeof projectId, 'string');
  result.project_id = projectId;
  process.env.SCOTTY_TEST_PROJECT = projectId;
  const initial = await request(`/api/p/${encodeURIComponent(projectId)}/beads`);
  assert.equal(initial.meta.kind, 'bead-rs');
  assert.ok(initial.beads.some(bead => bead.id === result.seed.id && bead.status === 'open' && !bead.assignee));
  chromium = require('playwright').chromium;
  originalLaunch = chromium.launch;
  chromium.launch = async function (options = {}) {
    assert.equal(result.launch_count, 0, 'One browser launch per flow');
    result.launch_count++;
    assert.equal(options.executablePath, manifest.chrome_path);
    const launchOptions = { ...options, executablePath: manifest.chrome_path, headless: true,
      timeout: Math.min(15000, remaining()), args: [...(options.args || []), '--disable-gpu', '--disable-software-rasterizer', '--renderer-process-limit=1'] };
    record('browser-launch', { options: launchOptions });
    browser = await originalLaunch.call(this, launchOptions);
    result.browser_version = browser.version();
    const originalContext = browser.newContext.bind(browser);
    browser.newContext = async function (options) {
      assert.equal(liveContexts, 0, 'Only one browser context may be active');
      assert.equal(result.context_count, 0, 'One context is permitted in this existing flow');
      result.context_count++;
      const context = await originalContext(options);
      liveContexts++;
      result.maximum_live_contexts = Math.max(result.maximum_live_contexts, liveContexts);
      context.on('close', () => { liveContexts--; });
      return context;
    };
    return browser;
  };
  record('test-start', { path: flows[input.flow], sha256: manifest.source_files[flows[input.flow]] });
  await bounded(import(pathToFileURL(path.join(source, flows[input.flow])).href), remaining(), 'Existing UI test exceeded its work deadline');
  assert.equal(result.launch_count, 1);
  assert.equal(result.context_count, 1);
  assert.equal(result.maximum_live_contexts, 1);
  assert.equal(browser.isConnected(), false, 'The unchanged test must close its browser');
  result.assertions_passed = true;
  result.snapshot_after = JSON.parse(await command(manifest.bead_exe, ['changes', '--snapshot', '--json'], 'native-after'));
  assert.equal(result.snapshot_after.workspace_uuid, result.snapshot_before.workspace_uuid);
  assert.equal(fs.readFileSync(path.join(workspace, 'unrelated-keep.txt'), 'utf8'), marker);
  result.status = 'passed';
} catch (error) {
  result.error = errorValue(error);
  record('failure', result.error);
  console.error(error.stack || error);
} finally {
  if (chromium && originalLaunch) chromium.launch = originalLaunch;
  if (browser?.isConnected()) {
    try { await bounded(browser.close(), 2500, 'Browser cleanup did not finish'); }
    catch (error) { result.cleanup_errors.push(errorValue(error)); }
  }
  if (server && server.exitCode === null && server.signalCode === null && registrationAttempted) {
    try {
      if (!projectId) {
        const projects = await request('/api/projects', 'GET', undefined, 200, 1500);
        const matches = projects.projects.filter(project => path.resolve(project.path || '').toLowerCase() === workspace.toLowerCase() && project.backend === 'bead-rs');
        assert.ok(matches.length <= 1, 'Unique fixture registration must be unambiguous');
        projectId = matches[0]?.id;
      }
      if (projectId) await request(`/api/projects/${encodeURIComponent(projectId)}`, 'DELETE', undefined, 200, 1500);
      const remainingProjects = await request('/api/projects', 'GET', undefined, 200, 1500);
      assert.deepEqual(remainingProjects.projects.filter(project => project.id !== 'demo'), []);
      result.registration_cleanup = 'removed-or-never-created';
    } catch (error) { result.cleanup_errors.push(errorValue(error)); }
  }
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    for (let count = 0; count < 15 && server.exitCode === null && server.signalCode === null; count++) await delay(100);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGKILL');
      for (let count = 0; count < 5 && server.exitCode === null && server.signalCode === null; count++) await delay(100);
    }
    if (server.exitCode === null && server.signalCode === null) result.cleanup_errors.push({ message: 'Next server remains live; outer Job cleanup required' });
  }
  if (server) result.server_exit = { code: server.exitCode, signal: server.signalCode };
  if (result.cleanup_errors.length) result.status = 'failed';
  result.finished_utc = new Date().toISOString();
  result.artifacts = fs.existsSync(output) ? fs.readdirSync(output).map(name => ({ name, bytes: fs.statSync(path.join(output, name)).size, sha256: hash(path.join(output, name)) })) : [];
  fs.writeFileSync(path.join(root, 'driver-result.json'), JSON.stringify(result, null, 2) + '\n');
  record('driver-finished', { status: result.status });
}
process.exit(result.status === 'passed' ? 0 : 1);
