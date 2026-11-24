import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

assert.equal(process.platform, 'win32');
const cwd = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const manifestPath = path.join(cwd, 'manifest-v3.json');
const temporaryDirectory = path.join(cwd, 'temp-materialize-v3');
const expectedManifestHash = 'ea1f4c44703ee5b9fc4f3ccd62ef78bac557299046ea81cc2a520358b8dd6aed';
const expectedBinaryHash = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

assert.equal(hash(bead), expectedBinaryHash);
assert.equal(hash(manifestPath), expectedManifestHash);
const restore = readJson(path.join(cwd, 'restore-v3.json'));
assert.equal(restore.local_recovery_succeeded, true);
assert.equal(restore.secret_quarantined, false);
assert.equal(restore.generation_id, 'gen-a569f746bbb268015d996c8ed4c76f57');
assert.equal(restore.source_root_sha256, '4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d');
assert.equal(restore.target_store_uuid, '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4');
assert.equal(restore.issues_restored, 954);
assert.equal(restore.events_restored, 11264);
assert.equal(restore.non_empty_override, false);

// The first helper stopped on inventory before any manifest mutation.
assert.equal(fs.existsSync(path.join(cwd, 'manifest-commit-node.json')), false,
  'Reconcile an original commit attempt before using the revised manifest');
for (const name of ['materialization-started-v2.json', 'manifest-commit-node-v2.json', 'materialization-result-v2.json']) {
  assert.equal(fs.existsSync(path.join(cwd, name)), false,
    'Reconcile any earlier revision-2 attempt before revision 3: ' + name);
}
const originalInventoryExit = readJson(path.join(cwd, 'inventory-before-node.exit.json'));
assert.equal(originalInventoryExit.status, 1,
  'The previous inventory result differs from the reviewed aborted attempt');

const manifest = readJson(manifestPath);
assert.equal(manifest.manifest_version, 1);
assert.equal(manifest.operations.length, 43);
const creates = manifest.operations.filter(operation => operation.op === 'create');
const edges = manifest.operations.filter(operation => operation.op === 'dep_add');
assert.equal(creates.length, 17);
assert.equal(edges.length, 26);
const localIds = creates.map(operation => operation.local_id);
assert.equal(new Set(localIds).size, 17);
for (const operation of creates) {
  assert.match(operation.local_id, /^[a-z][a-z0-9-]*$/);
  assert.equal(operation.unique_ref, 'bead-edit-20261124:' + operation.local_id);
}
for (const operation of edges) {
  assert.equal(operation.kind, 'blocks');
  assert.ok(localIds.includes(operation.blocked.slice(1)) && operation.blocked.startsWith('$'));
  assert.ok(localIds.includes(operation.blocker.slice(1)) && operation.blocker.startsWith('$'));
}

const outputNames = [
  'inventory-before-node-v3',
  ...localIds.map(id => 'ref-node-v3-' + id),
  'manifest-dry-run-node-v3',
  'manifest-commit-node-v3',
  'inventory-after-node-v3',
];
for (const name of outputNames) {
  for (const suffix of ['.json', '.stderr.log', '.exit.json']) {
    assert.equal(fs.existsSync(path.join(cwd, name + suffix)), false,
      'Reconcile an existing revised-run output before retrying: ' + name + suffix);
  }
}
for (const name of ['materialization-started-v3.json', 'materialization-result-v3.json']) {
  assert.equal(fs.existsSync(path.join(cwd, name)), false,
    'Reconcile an existing revised-run record before retrying: ' + name);
}

// The exact Windows inventory succeeded with an owned temporary directory.
// Keep that workaround child-local; complete inventory still precedes any mutation.
// Preserve this fresh directory for reconciliation and final task cleanup.
fs.mkdirSync(temporaryDirectory, { recursive: false });
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) {
    delete env[key];
  }
}
env.TEMP = temporaryDirectory;
env.TMP = temporaryDirectory;
writeJson(path.join(cwd, 'materialization-started-v3.json'), {
  status: 'started',
  started_utc: new Date().toISOString(),
  process_id: process.pid,
  manifest_sha256: expectedManifestHash,
  binary_sha256: expectedBinaryHash,
  reused_restore_receipt_id: restore.restore_receipt_id,
  temporary_directory: temporaryDirectory,
  restore_replayed: false,
});

function run(args, name) {
  const processResult = spawnSync(bead, args, {
    cwd, env, windowsHide: true, shell: false,
    timeout: 30000, maxBuffer: 32 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(cwd, name + '.json'), processResult.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(cwd, name + '.stderr.log'), processResult.stderr || Buffer.alloc(0), { flag: 'wx' });
  writeJson(path.join(cwd, name + '.exit.json'), {
    status: processResult.status,
    signal: processResult.signal,
    error: processResult.error?.message || null,
  });
  assert.equal(processResult.error, undefined, name + ' process error; reconcile before retry');
  assert.equal(processResult.status, 0, name + ' failed; inspect saved output before retry');
  return JSON.parse(processResult.stdout.toString('utf8'));
}

const before = run(['list', '--all', '--json'], 'inventory-before-node-v3');
assert.ok(Array.isArray(before));
assert.equal(before.length, 954);
assert.equal(new Set(before.map(issue => issue.id)).size, 954);
for (const operation of creates) {
  const matchingIds = run([
    'ref', 'find', '--namespace', 'bead-edit-20261124',
    '--value', operation.local_id, '--json',
  ], 'ref-node-v3-' + operation.local_id);
  assert.deepEqual(matchingIds, [], 'A continuation reference already exists: ' + operation.local_id);
}

const dry = run(['manifest', 'dry-run', '--input', manifestPath, '--format', 'json'], 'manifest-dry-run-node-v3');
assert.equal(dry.dry_run, true);
assert.equal(dry.committed, false);
assert.equal(dry.operations, 43);
assert.equal(dry.semantic_changes, 43);
assert.equal(dry.results.filter(result => result.op === 'create' && result.outcome === 'created').length, 17);
assert.equal(dry.results.filter(result => result.op === 'dep_add').length, 26);

// Reject input replacement between preflight and the one native transaction.
assert.equal(hash(manifestPath), expectedManifestHash);
assert.equal(hash(bead), expectedBinaryHash);
const commit = run(['manifest', 'commit', '--input', manifestPath, '--format', 'json'], 'manifest-commit-node-v3');
assert.equal(commit.committed, true);
assert.equal(commit.dry_run, false);
assert.equal(commit.operations, 43);
assert.equal(commit.semantic_changes, 43);
const createdResults = commit.results.filter(result => result.op === 'create');
assert.equal(createdResults.length, 17);
assert.equal(createdResults.filter(result => result.outcome === 'created').length, 17);
assert.equal(commit.results.filter(result => result.op === 'dep_add').length, 26);
const ids = Object.fromEntries(createdResults.map(result => [result.local_id, result.issue_id]));
assert.deepEqual(Object.keys(ids).sort(), [...localIds].sort());
assert.equal(new Set(Object.values(ids)).size, 17);

const after = run(['list', '--all', '--json'], 'inventory-after-node-v3');
assert.ok(Array.isArray(after));
assert.equal(after.length, 971);
const byId = new Map(after.map(issue => [issue.id, issue]));
assert.equal(byId.size, 971);
for (const original of before) {
  assert.deepEqual(byId.get(original.id), original, 'An original inventory record changed: ' + original.id);
}
for (const operation of creates) {
  const actual = byId.get(ids[operation.local_id]);
  assert.ok(actual);
  assert.equal(actual.title, operation.title);
  assert.equal(actual.description, operation.description);
  assert.equal(actual.priority, operation.priority);
  assert.equal(actual.status, 'open');
  assert.deepEqual([...(actual.resource_keys || [])].sort(), [...operation.resource_keys].sort());
  assert.deepEqual(actual.labels, operation.labels);
  const created = createdResults.find(result => result.local_id === operation.local_id);
  assert.equal(created.issue.issue_type, operation.issue_type);
}
const expectedEdges = edges.map(operation => [
  ids[operation.blocked.slice(1)], ids[operation.blocker.slice(1)], operation.kind,
].join('|')).sort();
const actualEdges = Object.values(ids).flatMap(id => (byId.get(id).dependencies || []).map(dependency => [
  id, dependency.blocker, dependency.kind,
].join('|'))).sort();
assert.deepEqual(actualEdges, expectedEdges);
const report = {
  status: 'passed',
  continuation_revision: 3,
  original_issues: 954,
  total_issues: after.length,
  tasks: ids,
  blocking_edges: actualEdges.length,
  restore_receipt_id: restore.restore_receipt_id,
  source_store_uuid: restore.target_store_uuid,
  manifest_sha256: hash(manifestPath),
  binary_sha256: hash(bead),
  complete_descriptions_match: true,
  complete_edges_match: true,
  original_inventory_unchanged: true,
  temporary_directory: temporaryDirectory,
  temporary_directory_retained: true,
  restore_replayed: false,
};
writeJson(path.join(cwd, 'materialization-result-v3.json'), report);
console.log(JSON.stringify(report, null, 2));
