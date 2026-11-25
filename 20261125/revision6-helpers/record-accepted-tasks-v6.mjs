import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

assert.equal(process.platform, 'win32');
assert.equal(process.argv.length, 5, 'Expected request path, request SHA256 and fresh output basename');
const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(bead), '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const created = read('materialization-result-v6.json');
assert.equal(created.status, 'passed');
assert.equal(created.original_inventory_unchanged, true);
assert.equal(created.total_issues, 986);
assert.equal(created.blocking_edges, 51);
assert.equal(hash(path.join(root, 'revision-6/plan.json')), '80b7381aa09378cf14d7bff2862de30afa11fa9041a914c8fef240dcbd18ab4c');
const expected = new Map(read('revision-6/plan.json').tasks.map(task => [task.key, task]));
const originals = new Map(read('inventory-before-node-v3.json').map(row => [row.id, row]));
assert.equal(originals.size, 954);
const [requestPath, requestHash, outputName] = process.argv.slice(2);
assert.match(requestHash, /^[a-f0-9]{64}$/);
assert.match(outputName, /^completed-[0-9]{8}-[a-z][a-z0-9-]{1,40}$/);
const fullRequest = path.resolve(requestPath);
assert.ok(fullRequest.startsWith(path.resolve(root) + path.sep), 'Request must stay in the owned coordination directory');
assert.equal(hash(fullRequest), requestHash);
const request = JSON.parse(fs.readFileSync(fullRequest, 'utf8'));
assert.equal(request.schema_version, 1);
assert.ok(Array.isArray(request.tasks) && request.tasks.length > 0 && request.tasks.length <= 32);
assert.equal(new Set(request.tasks.map(task => task.key)).size, request.tasks.length);
const output = path.join(root, outputName);
fs.mkdirSync(output, { recursive: false });
const env = { ...process.env };
for (const key of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
env.TEMP = env.TMP = path.join(root, 'temp-materialize-v6');
assert.ok(fs.statSync(env.TEMP).isDirectory());
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function run(args, name) {
  const result = spawnSync(bead, args, { cwd: root, env, windowsHide: true, shell: false, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, name + '.json'), result.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(output, name + '.stderr.log'), result.stderr || Buffer.alloc(0), { flag: 'wx' });
  write(name + '.exit.json', { status: result.status, signal: result.signal, error: result.error?.message || null });
  assert.equal(result.error, undefined, 'Reconcile saved output before another mutation');
  assert.equal(result.status, 0, 'Reconcile saved output before another mutation');
  return JSON.parse(result.stdout.toString('utf8'));
}
function stored(row) {
  const value = structuredClone(row);
  delete value.effective_status;
  for (const dependency of value.dependencies || []) {
    delete dependency.blocker_status;
    delete dependency.finished;
  }
  return value;
}
const before = run(['list', '--all', '--json'], 'before');
assert.equal(before.length, 986);
const byId = new Map(before.map(row => [row.id, row]));
assert.equal(byId.size, 986);
for (const [id, row] of originals) assert.deepEqual(byId.get(id), row, 'Original record changed: ' + id);
const satisfied = new Set(before.filter(row => row.status === 'closed').map(row => row.id));
const operations = request.tasks.map(task => {
  assert.ok(expected.has(task.key), 'Unknown continuation task');
  assert.ok(Number.isInteger(task.revision) && task.revision > 0);
  assert.ok(typeof task.reason === 'string' && task.reason.trim().length >= 40 && task.reason.length <= 4096);
  const current = byId.get(created.tasks[task.key]);
  const planned = expected.get(task.key);
  assert.ok(current, task.key);
  assert.equal(current.title, planned.title);
  assert.equal(current.description, planned.description);
  assert.equal(current.status, 'open');
  assert.equal(current.assignee, null);
  assert.equal(current.revision, task.revision);
  for (const key of planned.prerequisites) assert.ok(satisfied.has(created.tasks[key]), 'Unfinished prerequisite: ' + key);
  satisfied.add(current.id);
  return { op: 'close', id: current.id, if_revision: current.revision, reason: task.reason };
});
write('request.json', request);
write('manifest.json', { manifest_version: 1, operations });
const manifest = path.join(output, 'manifest.json');
const dry = run(['manifest', 'dry-run', '--input', manifest, '--format', 'json'], 'dry-run');
assert.equal(dry.operations, operations.length); assert.equal(dry.semantic_changes, operations.length); assert.equal(dry.dry_run, true);
write('commit-started.json', { utc: new Date().toISOString(), manifest_sha256: hash(manifest), operations: operations.length, request_sha256: requestHash, replay_allowed: false });
const commit = run(['manifest', 'commit', '--input', manifest, '--format', 'json', '--no-auto-flush'], 'commit');
assert.equal(commit.committed, true); assert.equal(commit.operations, operations.length); assert.equal(commit.semantic_changes, operations.length);
const after = run(['list', '--all', '--json'], 'after');
assert.equal(after.length, 986);
assert.equal(new Set(after.map(row => row.id)).size, 986);
const closed = new Set(operations.map(op => op.id));
for (const current of after) {
  if (originals.has(current.id)) assert.deepEqual(current, originals.get(current.id));
  else {
    const expectedRow = stored(byId.get(current.id));
    if (closed.has(current.id)) {
      expectedRow.status = 'closed';
      expectedRow.revision += 1;
      assert.ok(typeof current.updated_at === 'string');
      expectedRow.updated_at = current.updated_at;
    }
    assert.deepEqual(stored(current), expectedRow, 'Unrequested stored change: ' + current.id);
  }
}
const ready = run(['list', '--ready', '--json', '--limit', '1000'], 'ready');
const own = new Set(Object.values(created.tasks));
const result = { status: 'passed', closed: Object.fromEntries(request.tasks.map(task => [task.key, created.tasks[task.key]])),
  original_954_unchanged: true, other_stored_fields_unchanged: true,
  owned_ready: ready.filter(row => own.has(row.id)).map(row => ({ id: row.id, title: row.title, revision: row.revision })),
  continuation: after.filter(row => own.has(row.id)).map(row => ({ id: row.id, status: row.status, revision: row.revision })),
  request_sha256: requestHash,
  checkpoint_publication: 'Explicit flush and checked publication remain required.' };
write('result.json', result);
console.log(JSON.stringify(result, null, 2));
