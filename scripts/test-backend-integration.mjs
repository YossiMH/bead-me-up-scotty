// Real CLI -> real Scotty HTTP API. This script never substitutes a CLI double.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const runFile = promisify(execFile);
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const backend = process.argv[2];
assert.ok(['bd', 'bead-rs'].includes(backend), 'Usage: node scripts/test-backend-integration.mjs bd|bead-rs [--browser]');
const root = process.env.SCOTTY_TEST_ROOT;
assert.ok(root && path.isAbsolute(root), 'SCOTTY_TEST_ROOT must be an absolute, isolated fixture directory');
const relativeRoot = path.relative(sourceRoot, path.resolve(root));
assert.ok(relativeRoot.startsWith(`..${path.sep}`) || relativeRoot === '..' || path.isAbsolute(relativeRoot),
  'Do not create issue fixtures inside the source repository');
fs.mkdirSync(root, { recursive: true });
const runDirectory = fs.mkdtempSync(path.join(root, `${backend}-`));
const workspace = path.join(runDirectory, 'project');
const home = path.join(runDirectory, 'home');
const config = path.join(runDirectory, 'config');
for (const directory of [workspace, home, config]) fs.mkdirSync(directory);
const binary = process.env[backend === 'bd' ? 'BD_BIN' : 'BEAD_BIN'];
assert.ok(binary && path.isAbsolute(binary), 'Set the selected backend binary to its qualified absolute path');
const port = process.env.SCOTTY_TEST_PORT || '3196';
const base = `http://127.0.0.1:${port}`;
const environment = { ...process.env, HOME: home, XDG_CONFIG_HOME: config,
  BEADS_REPO: '', BEADS_ACTOR: 'contract-person', POSTHOG_KEY: '', NEXT_TELEMETRY_DISABLED: '1',
  BD_DISABLE_METRICS: '1', BD_DISABLE_EVENT_FLUSH: '1', BD_NON_INTERACTIVE: '1',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', SCOTTY_READ_ONLY: '0' };
const evidence = [];

/** Retain each real subprocess result before propagating a failure. */
async function cli(args) {
  try {
    const result = await runFile(binary, args, { cwd: workspace, env: environment, maxBuffer: 32 * 1024 * 1024 });
    evidence.push({ boundary: 'cli', args, exit: 0, stdout: result.stdout, stderr: result.stderr });
    return result.stdout;
  } catch (error) {
    evidence.push({ boundary: 'cli', args, exit: error.code, stdout: error.stdout, stderr: error.stderr });
    throw error;
  }
}

/** Retain request and response, including refused mutations, before assertions. */
async function request(route, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${route}`, {
    method, headers: { 'content-type': 'application/json', origin: base },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  evidence.push({ boundary: 'http', route, method, body, status: response.status, response: text });
  if (expected !== null) assert.equal(response.status, expected, `${method} ${route}: ${text}`);
  return { status: response.status, data: JSON.parse(text) };
}

/** Native issue-document reads, not a direct database or checkpoint inspection. */
async function nativeShow(id) {
  return JSON.parse(await cli(['show', id, '--comments', 'all', '--json']));
}

await runFile('git', ['init', '--quiet'], { cwd: workspace, env: environment });
await cli(backend === 'bd' ? ['init', '--prefix', 'contract', '--skip-hooks', '--skip-agents', '--non-interactive'] : ['init', '--prefix', 'contract']);
if (backend === 'bd') await cli(['config', 'set', 'dolt.local-only', 'true']);
const seeded = {};
if (backend === 'bead-rs') {
  const operations = [
    { op: 'create', local_id: 'ready', title: 'Ready custom issue', issue_type: 'review_check' },
    { op: 'create', local_id: 'assigned', title: 'Assigned open issue', assignee: 'another-person' },
    { op: 'create', local_id: 'manual', title: 'Manually blocked issue' },
    { op: 'update', id: '$manual', status: 'blocked' },
    { op: 'create', local_id: 'dependent', title: 'Dependency blocked issue' },
    { op: 'dep_add', blocked: '$dependent', blocker: '$ready', kind: 'blocks' },
    ...Array.from({ length: 105 }, (_, index) => ({ op: 'create', title: `Volume issue ${index}` })),
  ];
  const manifestPath = path.join(runDirectory, 'seed.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ manifest_version: 1, operations }));
  const result = JSON.parse(await cli(['manifest', 'commit', '--input', manifestPath, '--format', 'json']));
  for (const entry of result.results) if (entry.local_id) seeded[entry.local_id] = entry.issue_id;
}

const fingerprintBefore = backend === 'bead-rs' ? JSON.parse(await cli(['changes', '--snapshot', '--json'])) : null;
fs.writeFileSync(path.join(runDirectory, 'fingerprint-before.json'), JSON.stringify({ configPresent: fs.existsSync(path.join(workspace, '.beads/config.json')), snapshot: fingerprintBefore }, null, 2));

const log = fs.openSync(path.join(runDirectory, 'server.log'), 'w');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next',
  process.env.SCOTTY_TEST_SERVER_MODE || 'start', '--hostname', '127.0.0.1', '--port', port],
{ cwd: sourceRoot, env: environment, stdio: ['ignore', log, log], detached: true });
fs.closeSync(log);
let serverError;
server.on('error', (error) => { serverError = error; });
try {
  const deadline = Date.now() + 90000;
  for (;;) {
    if (serverError) throw serverError;
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Scotty exited: ${server.exitCode}; see ${runDirectory}/server.log`);
    try {
      const response = await fetch(`${base}/api/projects`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) break;
    } catch { /* Startup may not have bound its socket yet. */ }
    assert.ok(Date.now() < deadline, 'Scotty did not start within 90 seconds');
    await delay(250);
  }
  const registered = (await request('/api/projects', 'POST', { path: workspace, backend }, 201)).data;
  const projectId = registered.id;
  const prefix = `/api/p/${projectId}/beads`;
  const listed = (await request(prefix)).data;
  assert.equal(listed.meta.kind, backend, 'explicit backend selection must survive registration');
  if (backend === 'bead-rs') {
    assert.equal(listed.beads.length, 109, 'all records, not the native default 100');
    assert.equal(listed.beads.find(({ id }) => id === seeded.ready).issue_type, 'review_check');
    const readyIds = JSON.parse(await cli(['list', '--ready', '--all', '--json'])).map(({ id }) => id).sort();
    assert.deepEqual([...listed.meta.readyIds].sort(), readyIds);
    for (const id of [seeded.assigned, seeded.manual, seeded.dependent]) assert.ok(!listed.meta.readyIds.includes(id));
  }
  const title = 'API round trip 日本語';
  const created = (await request(prefix, 'POST', { title, description: 'First line\nSecond line', issue_type: 'bug', priority: 1, labels: backend === 'bead-rs' ? ['alpha', 'beta', '--help'] : ['alpha', 'beta'] }, 201)).data;
  const item = `${prefix}/${created.id}`;
  assert.equal(created.title, title);
  assert.equal(created.issue_type, 'bug');
  if (backend === 'bead-rs') {
    assert.ok((await nativeShow(created.id)).labels.includes('--help'));
    await request(`${item}/labels`, 'DELETE', { label: '--help' });
    assert.ok(!(await nativeShow(created.id)).labels.includes('--help'));
    await request(`${item}/labels`, 'POST', { label: '--help' });
    assert.ok((await nativeShow(created.id)).labels.includes('--help'));
    await request(`${item}/labels`, 'DELETE', { label: '--help' });
    await request(`${item}/comments`, 'POST', { text: '--help' });
    assert.ok((await nativeShow(created.id)).comments.some(({ body }) => body === '--help'));
  }
  await request(`${item}/comments`, 'POST', { text: 'Persisted comment 日本語' });
  const refreshed = (await request(prefix)).data;
  assert.ok(refreshed.beads.find(({ id }) => id === created.id).comments.some(({ text }) => text === 'Persisted comment 日本語'));
  if (backend === 'bead-rs') {
    assert.ok((await nativeShow(created.id)).comments.some(({ body }) => body === 'Persisted comment 日本語'));
    for (const field of ['title', 'description', 'priority', 'issue_type', 'notes']) {
      assert.ok(listed.meta.capabilities.editableFields.includes(field), `The qualified binary must expose ${field} editing`);
    }
    const scalarPatch = { title: 'Edited native 日本語', description: '- [ ] Editable checklist\nSecond line',
      priority: 0, issue_type: 'review_check', notes: 'Native notes\nKeep this line' };
    const beforeEdit = await nativeShow(created.id);
    const edited = (await request(item, 'PATCH', scalarPatch)).data;
    for (const [field, value] of Object.entries(scalarPatch)) assert.equal(edited[field], value, field);
    const persistedEdit = await nativeShow(created.id);
    assert.equal(persistedEdit.revision, beforeEdit.revision + 1, 'One scalar patch is one revision');
    for (const field of ['title', 'description', 'priority', 'notes']) assert.equal(persistedEdit[field], scalarPatch[field], field);
    assert.deepEqual(persistedEdit.labels, beforeEdit.labels);
    assert.deepEqual(persistedEdit.dependencies, beforeEdit.dependencies);
    const cleared = (await request(item, 'PATCH', { description: '', notes: '' })).data;
    assert.equal(cleared.description, '');
    assert.equal(cleared.notes, '');
    assert.equal((await nativeShow(created.id)).notes, '');
    const longText = { description: 'Long native description 日本語\n'.repeat(3000), notes: 'Long native notes\n'.repeat(3000) };
    const longEdit = (await request(item, 'PATCH', longText)).data;
    assert.equal(longEdit.description, longText.description);
    assert.equal(longEdit.notes, longText.notes);
    const persistedLongEdit = await nativeShow(created.id);
    assert.equal(persistedLongEdit.description, longText.description);
    assert.equal(persistedLongEdit.notes, longText.notes);
    const before = await nativeShow(created.id);
    for (const [suffix, method, body] of [
      ['', 'PATCH', { title: 'Forbidden', labels: ['must-not-write'] }],
      ['', 'PATCH', { labels: [] }], ['', 'PATCH', { labels: ['only'] }],
      ['', 'PATCH', { labels: ['only'], status: 'deferred' }],
      ['', 'PATCH', { parent: seeded.ready }], ['', 'DELETE', undefined],
      ['/gate', 'POST', { reason: 'No native gate' }], ['/archive', 'POST', {}],
      ['/deps', 'POST', { depends_on_id: seeded.ready, type: 'parent-child' }],
    ]) {
      const refused = await request(item + suffix, method, body, null);
      assert.equal(refused.data.code, 'unsupported_operation');
      assert.ok(refused.status >= 400);
      assert.deepEqual(await nativeShow(created.id), before, 'unsupported request must have no persisted effect');
    }
    const refused = await request(`${item}/status`, 'POST', { status: 'closed' }, 400);
    assert.equal(refused.data.code, 'invalid_input');
    await request(`${item}/deps`, 'POST', { depends_on_id: seeded.ready, type: 'verifies' });
    assert.ok((await nativeShow(created.id)).dependencies.some(({ blocker, kind }) => blocker === seeded.ready && kind === 'verifies'));
    const backlog = (await request(prefix, 'POST', { title: 'Atomic backlog issue', issue_type: 'task', priority: 2, backlog: true }, 201)).data;
    assert.equal((await nativeShow(backlog.id)).status, 'deferred');
  } else {
    const edited = (await request(item, 'PATCH', { title: 'Edited original issue', description: 'Editable', priority: 0, issue_type: 'feature' })).data;
    assert.equal(edited.title, 'Edited original issue');
    assert.equal(edited.issue_type, 'feature');
  }
  if (backend === 'bead-rs') {
    assert.ok(listed.meta.capabilities.operations.includes('label-delta'));
    assert.ok(!listed.meta.capabilities.editableFields.includes('labels'));
    // The external writer changes metadata without incrementing the issue revision.
    const revision = (await nativeShow(created.id)).revision;
    await cli(['label', 'add', created.id, '--label=external-C']);
    assert.equal((await nativeShow(created.id)).revision, revision);
    const added = (await request(`${item}/labels`, 'POST', { label: 'delta-B' })).data;
    assert.deepEqual([...added.labels].sort(), ['alpha', 'beta', 'delta-B', 'external-C']);
    const removed = (await request(`${item}/labels`, 'DELETE', { label: 'alpha' })).data;
    assert.deepEqual([...removed.labels].sort(), ['beta', 'delta-B', 'external-C']);
    assert.deepEqual([...(await nativeShow(created.id)).labels].sort(), ['beta', 'delta-B', 'external-C']);
    const beforeInvalid = await nativeShow(created.id);
    for (const body of [{ label: '' }, { label: ' ' }, { label: 'B', status: 'closed' }]) {
      assert.equal((await request(`${item}/labels`, 'POST', body, 400)).data.code, 'invalid_input');
      assert.deepEqual(await nativeShow(created.id), beforeInvalid);
    }
  } else {
    const cleared = (await request(item, 'PATCH', { labels: [] })).data;
    assert.deepEqual(cleared.labels, []);
  }
  const closed = (await request(`${item}/status`, 'POST', { status: 'closed', reason: 'API lifecycle verified' })).data;
  assert.equal(closed.status, 'closed');
  const closedList = (await request(prefix)).data.beads.find(({ id }) => id === created.id);
  assert.equal(closedList.close_reason, 'API lifecycle verified');
  if (backend === 'bead-rs') {
    const corrected = (await request(item, 'PATCH', { title: 'Corrected closed native issue', notes: 'Completion retained' })).data;
    assert.equal(corrected.status, 'closed');
    assert.equal(corrected.title, 'Corrected closed native issue');
    assert.equal(corrected.notes, 'Completion retained');
    assert.equal(corrected.closed_at, closedList.closed_at);
    assert.equal(corrected.close_reason, closedList.close_reason);
    const beforeRejectedReopen = await nativeShow(created.id);
    const refused = await request(item, 'PATCH', { status: 'open', title: 'Must not disappear' }, 400);
    assert.equal(refused.data.code, 'unsupported_operation');
    assert.deepEqual(await nativeShow(created.id), beforeRejectedReopen);
  }
  await request(`${item}/status`, 'POST', { status: 'open' });
  if (backend === 'bead-rs') {
    await request(`${item}/status`, 'POST', { status: 'in_progress' });
    assert.equal((await nativeShow(created.id)).assignee, 'contract-person');
    await request(`${item}/status`, 'POST', { status: 'open' });
    assert.equal((await nativeShow(created.id)).assignee, null, 'release clears ownership');
  }
  if (process.argv.includes('--browser')) {
    const { checkBackendBrowser } = await import('./test-backend-browser.mjs');
    await checkBackendBrowser({ base, projectId, backend, issueId: created.id, runDirectory, seeded });
  }
  if (backend === 'bead-rs' && process.argv.includes('--native-ui')) {
    for (const script of ['test-native-ui-flows.mjs', 'test-native-ui-recovery.mjs']) {
      try {
        const result = await runFile(process.execPath, [`scripts/${script}`], {
          cwd: sourceRoot, env: { ...environment, SCOTTY_TEST_URL: base, SCOTTY_TEST_PROJECT: projectId,
            SCOTTY_TEST_OUTPUT: path.join(runDirectory, script.replace('.mjs', '')) },
          timeout: 180000, maxBuffer: 8 * 1024 * 1024,
        });
        evidence.push({ boundary: 'browser-harness', script, exit: 0, ...result });
      } catch (error) {
        evidence.push({ boundary: 'browser-harness', script, exit: error.code, stdout: error.stdout, stderr: error.stderr });
        throw error;
      }
    }
  }
  if (backend === 'bd') {
    await request(item, 'DELETE');
    await request(item, 'GET', undefined, 400); // Original bd 1.1.0 baseline.
  }
  assert.equal((await request('/api/p/demo/beads')).data.meta.kind, 'demo');
  console.log(`PASS: ${backend} real process/API contract. Evidence: ${runDirectory}`);
} finally {
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    process.kill(-server.pid, 'SIGTERM');
    const deadline = Date.now() + 10000;
    while (server.exitCode === null && server.signalCode === null && Date.now() < deadline) await delay(100);
    if (server.exitCode === null && server.signalCode === null) process.kill(-server.pid, 'SIGKILL');
  }
  let fingerprintValid = true;
  if (backend === 'bead-rs') {
    const configPresent = fs.existsSync(path.join(workspace, '.beads/config.json'));
    let snapshot;
    let readError;
    try { snapshot = JSON.parse(await cli(['changes', '--snapshot', '--json'])); }
    catch (error) { readError = error.message; }
    fs.writeFileSync(path.join(runDirectory, 'fingerprint-after.json'), JSON.stringify({ configPresent, snapshot, readError }, null, 2));
    fingerprintValid = configPresent && snapshot?.workspace_uuid === fingerprintBefore?.workspace_uuid;
  }
  fs.writeFileSync(path.join(runDirectory, 'evidence.json'), JSON.stringify({ backend, binary,
    binarySha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),
    workspace, evidence }, null, 2));
  console.log(`Saved evidence: ${runDirectory}/evidence.json`);
  assert.ok(fingerprintValid, 'Native workspace fingerprint must survive the entire run');
}
