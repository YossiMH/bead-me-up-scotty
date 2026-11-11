// Real launcher -> HTTP API -> real bead-rs -> real browser. Use disposable data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { startOwnedProcess } from './support/owned-process.mjs';
import { isolateFixtureGit, initializeGitFixture, createUnrelatedMarker, assertGitCheckpoint } from './support/git-fixture.mjs';

const execute = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.BEAD_BIN;
const root = process.env.SCOTTY_TEST_ROOT;
assert.ok(binary && path.isAbsolute(binary));
assert.ok(root && path.isAbsolute(root));
isolateFixtureGit();
fs.mkdirSync(root, { recursive: true });
const run = fs.mkdtempSync(path.join(root, 'browser-contract-'));
const workspace = path.join(run, 'project');
fs.mkdirSync(workspace);
const unrelatedMarker = createUnrelatedMarker(workspace);
const records = [];
function record(step, value) {
  records.push({ step, value });
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(records, null, 2));
}
async function cli(args) {
  const result = await execute(binary, args, { cwd: workspace, env: process.env, timeout: 60000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  record('cli', { args, ...result });
  return result.stdout;
}
const reservation = net.createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
await initializeGitFixture(workspace);
await cli(['init', '--prefix', 'browser']);
const issue = JSON.parse(await cli(['create', '--title', 'Fork selected by launcher', '--json']));
const log = fs.openSync(path.join(run, 'server.log'), 'wx');
const serverEnvironment = { ...process.env, BEAD_BIN: path.join(run, 'unselected-missing-bead.exe') };
const configuration = process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME ? 'clone-default' : 'isolated';
// Optional check of an installation's own .env.local configuration. The test's
// HOME remains disposable if that configuration fails to load.
if (configuration === 'clone-default') {
  delete serverEnvironment.XDG_CONFIG_HOME;
  delete serverEnvironment.BEAD_BIN;
}
const launcher = await startOwnedProcess(process.execPath, ['bin/bead-me-up-scotty.mjs',
  ...(configuration === 'clone-default' ? [] : ['--bead-bin', binary]),
  '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
  cwd: source, windowsHide: true, stdio: ['ignore', log, log],
  env: serverEnvironment,
});
fs.closeSync(log);
let browser;
let registeredProject;
try {
  const deadline = Date.now() + 90000;
  for (;;) {
    assert.equal(launcher.exitCode, null, 'launcher must remain running');
    try {
      if ((await fetch(`${base}/api/projects`, { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch { /* Retry only the startup read. */ }
    assert.ok(Date.now() < deadline, 'server startup timed out');
    await delay(200);
  }
  if (process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME) {
    const configFile = path.join(process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME, 'bead-me-up-scotty', 'config.json');
    const initial = await (await fetch(`${base}/api/projects`, { signal: AbortSignal.timeout(10000) })).json();
    assert.deepEqual(initial.projects.filter((project) => project.id !== 'demo'), [], 'default installation config must be independent of existing registrations');
    record('default-config', { configFile, projects: [] });
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SCOTTY_TEST_CHROME ? { executablePath: process.env.SCOTTY_TEST_CHROME } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Backend').selectOption('bead-rs');
  await page.getByLabel('Folder path').fill(workspace);
  await page.getByLabel('Folder path').press('Enter');
  await page.getByText('This folder has a').waitFor();
  const registrationResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/projects' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add this folder' }).click({ noWaitAfter: true });
  const registration = await registrationResponse;
  const registered = await registration.json();
  assert.equal(registration.status(), 201, JSON.stringify(registered));
  registeredProject = registered.id;
  await page.getByRole('heading', { name: 'Board', exact: true }).waitFor();
  if (process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME) {
    const configFile = path.join(process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME, 'bead-me-up-scotty', 'config.json');
    assert.equal(JSON.parse(fs.readFileSync(configFile, 'utf8')).projects.find((project) => project.id === registeredProject)?.path, workspace,
      'registration must be persisted in the clone-local config');
  }
  await page.locator(`[data-keyboard-bead-id="${issue.id}"]`).click();
  await page.getByRole('heading', { name: issue.title, exact: true }).waitFor();
  const projectId = registeredProject;
  const route = `${base}/api/p/${projectId}/beads`;
  const options = { headers: { 'content-type': 'application/json', origin: base }, signal: AbortSignal.timeout(60000) };
  const listed = await fetch(route, options);
  const snapshot = await listed.json();
  assert.equal(listed.status, 200);
  assert.equal(snapshot.meta.kind, 'bead-rs');
  assert.ok(snapshot.meta.capabilities.operations.includes('create'));
  assert.equal(snapshot.beads[0].id, issue.id);
  const response = await fetch(route, { ...options, method: 'POST', body: JSON.stringify({ title: 'Browser server write', issue_type: 'task', priority: 2 }) });
  const created = await response.json();
  assert.equal(response.status, 201, JSON.stringify(created));
  assert.equal(JSON.parse(await cli(['show', created.id, '--json'])).title, 'Browser server write');
  record('git-checkpoint', await assertGitCheckpoint(workspace, unrelatedMarker));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(run, 'fork-detail.png'), fullPage: true });
  record('PASS', { base, projectId, issueId: issue.id, createdId: created.id, pageErrors: errors,
    selection: configuration === 'clone-default'
      ? 'Installation .env.local selects the backend and clone-local configuration'
      : 'CLI flag overrides an invalid inherited BEAD_BIN' });
} catch (error) {
  record('FAIL', { message: error.message });
  throw error;
} finally {
  try {
    if (!registeredProject) {
      // A click can succeed before its result is observed. Reconcile only the
      // unique disposable workspace before deciding whether cleanup is needed.
      const projects = await (await fetch(`${base}/api/projects`, { signal: AbortSignal.timeout(10000) })).json();
      const matches = projects.projects.filter((project) => project.path === workspace && project.backend === 'bead-rs');
      assert.ok(matches.length <= 1, 'unique disposable workspace must have at most one registration');
      registeredProject = matches[0]?.id;
    }
    if (registeredProject) {
      const response = await fetch(`${base}/api/projects/${registeredProject}`, {
        method: 'DELETE', headers: { origin: base }, signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200, 'remove only the test-created registration');
      record('registration-removed', { projectId: registeredProject });
      if (process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME) {
        const configFile = path.join(process.env.SCOTTY_TEST_DEFAULT_CONFIG_HOME, 'bead-me-up-scotty', 'config.json');
        assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')).projects, []);
      }
    }
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      const exit = await launcher.stop();
      record('launcher-stopped', { pid: launcher.pid, ...exit });
    }
  }
}
