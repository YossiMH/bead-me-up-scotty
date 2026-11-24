import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
assert.equal(process.platform, 'win32');
const cwd = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(bead), '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798');
const manifestPath = path.join(cwd, 'manifest.json');
assert.equal(hash(manifestPath), 'acfd30c34729660220e50838a033905d63bbee03847ff629985e51f0ca6bc714');
const restore = JSON.parse(fs.readFileSync(path.join(cwd, 'restore-v3.json'), 'utf8'));
assert.equal(restore.local_recovery_succeeded, true);
assert.equal(restore.secret_quarantined, false);
assert.equal(restore.generation_id, 'gen-a569f746bbb268015d996c8ed4c76f57');
assert.equal(restore.source_root_sha256, '4f5571a1823810366d4a3274c9231604913905c6334c380bf116b110ae5d486d');
assert.equal(restore.target_store_uuid, '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4');
assert.equal(restore.issues_restored, 954);
assert.equal(restore.events_restored, 11264);
assert.equal(restore.non_empty_override, false);
assert.equal(fs.existsSync(path.join(cwd, 'manifest-commit-node.json')), false, 'Reconcile a previous commit attempt before running again');
const env = { ...process.env };
delete env.BEADS_REPO; delete env.BEAD_WORKSPACE_ROOT;
function run(args, name) {
  const p = spawnSync(bead, args, { cwd, env, windowsHide: true, shell: false, timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(cwd, name + '.json'), p.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(cwd, name + '.stderr.log'), p.stderr || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(cwd, name + '.exit.json'), JSON.stringify({ status: p.status, signal: p.signal, error: p.error?.message || null }, null, 2));
  assert.equal(p.error, undefined, name + ' process error; reconcile before retry');
  assert.equal(p.status, 0, name + ' failed; inspect saved output before retry');
  return JSON.parse(p.stdout.toString('utf8'));
}
const before = run(['list', '--all', '--json'], 'inventory-before-node');
assert.equal(before.length, 954);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const creates = manifest.operations.filter(x => x.op === 'create');
const edges = manifest.operations.filter(x => x.op === 'dep_add');
assert.equal(creates.length, 16); assert.equal(edges.length, 24);
for (const op of creates) {
  assert.deepEqual(run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', op.local_id, '--json'], 'ref-node-' + op.local_id), []);
}
const dry = run(['manifest', 'dry-run', '--input', manifestPath, '--format', 'json'], 'manifest-dry-run-node');
assert.equal(dry.dry_run, true); assert.equal(dry.operations, 40); assert.equal(dry.semantic_changes, 40);
assert.equal(dry.results.filter(x => x.op === 'create' && x.outcome === 'created').length, 16);
assert.equal(dry.results.filter(x => x.op === 'dep_add').length, 24);
const commit = run(['manifest', 'commit', '--input', manifestPath, '--format', 'json'], 'manifest-commit-node');
assert.equal(commit.committed, true); assert.equal(commit.operations, 40); assert.equal(commit.semantic_changes, 40);
const ids = Object.fromEntries(commit.results.filter(x => x.op === 'create').map(x => [x.local_id, x.issue_id]));
assert.equal(new Set(Object.values(ids)).size, 16);
const after = run(['list', '--all', '--json'], 'inventory-after-node');
assert.equal(after.length, 970);
const byId = new Map(after.map(x => [x.id, x]));
for (const op of creates) {
  const actual = byId.get(ids[op.local_id]); assert.ok(actual);
  assert.equal(actual.title, op.title); assert.equal(actual.description, op.description);
  assert.equal(actual.priority, op.priority); assert.equal(actual.issue_type, op.issue_type);
}
const expectedEdges = edges.map(x => [ids[x.blocked.slice(1)], ids[x.blocker.slice(1)], x.kind || 'blocks'].join('|')).sort();
const actualEdges = Object.values(ids).flatMap(id => (byId.get(id).dependencies || []).map(x => [id, x.depends_on_id, x.type].join('|'))).sort();
assert.deepEqual(actualEdges, expectedEdges);
const report = { status: 'passed', original_issues: 954, total_issues: after.length, tasks: ids, blocking_edges: actualEdges.length,
  restore_receipt_id: restore.restore_receipt_id, source_store_uuid: restore.target_store_uuid,
  manifest_sha256: hash(manifestPath), complete_descriptions_match: true, complete_edges_match: true };
fs.writeFileSync(path.join(cwd, 'materialization-result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
