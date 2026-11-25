// Real production HTTP -> native CLI, with disposable Git, config and input files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { startOwnedProcess } from './support/owned-process.mjs';
import { isolateFixtureGit, initializeGitFixture, createUnrelatedMarker, assertGitCheckpoint } from './support/git-fixture.mjs';

const execute = promisify(execFile);
const source = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.BEAD_BIN;
const root = process.env.SCOTTY_TEST_ROOT;
assert.ok(binary && path.isAbsolute(binary), 'BEAD_BIN must identify the qualified native executable');
assert.ok(root && path.isAbsolute(root), 'SCOTTY_TEST_ROOT must identify an isolated absolute directory');
const relativeRoot = path.relative(source, root);
assert.ok(relativeRoot === '..' || relativeRoot.startsWith('..' + path.sep) || path.isAbsolute(relativeRoot),
  'Create test data outside the source checkout');
isolateFixtureGit();
fs.mkdirSync(root, { recursive: true });
const run = fs.mkdtempSync(path.join(root, 'type-http-'));
const workspace = path.join(run, 'project');
const config = path.join(run, 'config');
const temporary = path.join(run, 'temporary');
for (const directory of [workspace, config, temporary]) fs.mkdirSync(directory);
const actor = 'scotty-type-http';
const configDirectory = path.join(config, 'bead-me-up-scotty');
fs.mkdirSync(configDirectory);
fs.writeFileSync(path.join(configDirectory, 'config.json'), JSON.stringify({
  humanActor: actor, humanAllowlist: [actor], humanActorChosen: true,
  projects: [], orders: {}, pollIntervalMs: 30000, gamification: false,
}), { flag: 'wx' });
const environment = { ...process.env, BEAD_BIN: binary, BEAD_ACTOR: actor, BEADS_ACTOR: actor,
  XDG_CONFIG_HOME: config, BEADS_REPO: '', SCOTTY_READ_ONLY: '0',
  TMP: temporary, TEMP: temporary, TMPDIR: temporary,
  NEXT_TELEMETRY_DISABLED: '1', POSTHOG_KEY: '', BMUS_TRAY: '0' };
const records = [];
const errors = [];
const cleanup = {};
const marker = createUnrelatedMarker(workspace);
let server;
let port;

/** Keep the real command output even when a native call fails. */
async function cli(args, format = 'json') {
  let result;
  try {
    result = await execute(binary, args, {
      cwd: workspace, env: environment, timeout: 60000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    });
  } catch (error) {
    records.push({ boundary: 'cli', args, exit: error.code ?? null, stdout: error.stdout, stderr: error.stderr });
    throw error;
  }
  records.push({ boundary: 'cli', args, exit: 0, ...result });
  return format === 'text' ? result.stdout : JSON.parse(result.stdout);
}

/** Reserve a free loopback port, then release it immediately for the owned server. */
async function availablePort() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const address = reservation.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return address.port;
}

/** A successful bind after server exit verifies that this run released its listener. */
async function checkPortReleased(value) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(value, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}

try {
  await initializeGitFixture(workspace);
  await cli(['init', '--prefix', 'typehttp'], 'text');
  const capabilities = await cli(['capabilities']);
  assert.equal(capabilities.issue_editing?.issue_type_file, true);
  const created = await cli(['create', '--title', 'Long type through production HTTP', '--json']);
  port = await availablePort();
  const base = 'http://127.0.0.1:' + port;
  const log = fs.openSync(path.join(run, 'server.log'), 'wx');
  try {
    server = await startOwnedProcess(process.execPath, [
      '--max-old-space-size=512', 'node_modules/next/dist/bin/next', 'start',
      '--hostname', '127.0.0.1', '--port', String(port),
    ], { cwd: source, env: environment, stdio: ['ignore', log, log], windowsHide: true });
    records.push({ boundary: 'server', pid: server.pid, port });
  } finally { fs.closeSync(log); }
  const deadline = Date.now() + 90000;
  for (;;) {
    assert.equal(server.exitCode, null, 'The production server must remain running');
    try {
      if ((await fetch(base + '/api/projects', { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch { /* Only the startup read is retried. */ }
    assert.ok(Date.now() < deadline, 'The production server did not start within 90 seconds');
    await delay(200);
  }

  /** Retain each real HTTP response; mutations are submitted only once. */
  async function request(route, method, body, expected = 200) {
    const response = await fetch(base + route, {
      method, headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
    const responseText = await response.text();
    records.push({ boundary: 'http', route, method, body, status: response.status, response: responseText });
    assert.equal(response.status, expected, responseText);
    return JSON.parse(responseText);
  }

  const project = await request('/api/projects', 'POST', { path: workspace, backend: 'bead-rs' }, 201);
  const item = '/api/p/' + project.id + '/beads/' + created.id;
  await request(item + '/status', 'POST', { status: 'in_progress' });
  const before = await cli(['show', created.id, '--json']);
  assert.equal(before.assignee, actor);
  assert.ok(Number.isSafeInteger(before.claim_epoch) && before.claim_epoch > 0);
  const cursor = await cli(['changes', '--latest', '--json']);
  const patch = { title: 'Claimed HTTP type file', issue_type: 'custom_界'.repeat(5000),
    description: 'Exact description 日本語\n', notes: 'Exact notes\n', priority: 0 };
  assert.ok(patch.issue_type.length > 32768);
  const updated = await request(item, 'PATCH', patch);
  for (const [field, value] of Object.entries(patch)) assert.equal(updated[field], value, field);
  const after = await cli(['show', created.id, '--json']);
  for (const field of ['title', 'description', 'notes', 'priority']) assert.equal(after[field], patch[field], field);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.assignee, actor);
  assert.equal(after.claim_epoch, before.claim_epoch);
  assert.deepEqual(after.labels, before.labels);
  assert.deepEqual(after.dependencies, before.dependencies);
  const metadata = await cli(['query', '--json', JSON.stringify({
    version: 'v1', predicates: [], sort: [], projection: { fields: ['id', 'issue_type'] },
  }), '--output-json']);
  assert.equal(metadata.find(row => row.Id === created.id)?.IssueType, patch.issue_type);
  const changes = await cli(['changes', '--since', String(cursor.max_sequence), '--json']);
  const edits = changes.mutations.filter(change => change.issue_id === created.id && change.kind === 'updated');
  const audit = changes.mutations.filter(change => change.issue_id === created.id && change.kind === 'priority_changed');
  assert.equal(edits.length, 1, 'The HTTP edit must dispatch one scalar transaction');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, actor);
  assert.equal(audit[0].detail.reason, 'Priority edited in Scotty');
  assert.equal(audit[0].detail.revision, after.revision);
  assert.deepEqual(audit[0].detail.changed_fields, ['priority']);
  assert.deepEqual(fs.readdirSync(temporary).filter(name => name.startsWith('scotty-edit-')), []);
  records.push({ boundary: 'checks', characters: patch.issue_type.length,
    utf8Bytes: Buffer.byteLength(patch.issue_type, 'utf8'),
    beforeRevision: before.revision, afterRevision: after.revision, claimEpoch: after.claim_epoch,
    git: await assertGitCheckpoint(workspace, marker) });
} catch (error) {
  errors.push(error);
} finally {
  if (server) {
    try { cleanup.serverExit = await server.stop(); }
    catch (error) { errors.push(error); }
  }
  if (port !== undefined) {
    try { await checkPortReleased(port); cleanup.portReleased = true; }
    catch (error) { errors.push(error); cleanup.portReleased = false; }
  }
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify({
    status: errors.length === 0 ? 'passed' : 'failed',
    binary, binarySha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),
    workspace, records, cleanup, errors: errors.map(error => ({ message: error.message, stack: error.stack })),
  }, null, 2));
  console.log('Saved native type results: ' + path.join(run, 'result.json'));
}
if (errors.length > 0) throw new AggregateError(errors, 'Native type HTTP check failed');
console.log('PASS real production HTTP custom-type file, claim, revision, priority audit and cleanup');
