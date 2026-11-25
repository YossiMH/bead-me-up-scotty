import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

assert.equal(process.platform, 'win32');
const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(bead), '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const created = read('materialization-result-v4.json');
assert.equal(created.status, 'passed');
assert.equal(created.original_inventory_unchanged, true);
assert.equal(created.total_issues, 975);
assert.equal(created.blocking_edges, 34);
assert.equal(hash(path.join(root, 'revision-4/plan.json')), '887b5036b9b1f588baaeb9a0fd9537c030e661b80325bd871b6c8b97bfbae178');
const expected = new Map(read('revision-4/plan.json').tasks.map(task => [task.key, task]));
const originals = new Map(read('inventory-before-node-v3.json').map(row => [row.id, row]));
assert.equal(originals.size, 954);
const output = path.join(root, 'completed-v2');
fs.mkdirSync(output, { recursive: false });
const env = { ...process.env };
for (const key of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
env.TEMP = env.TMP = path.join(root, 'temp-materialize-v4');
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
assert.equal(before.length, 975);
const byId = new Map(before.map(row => [row.id, row]));
assert.equal(byId.size, 975);
for (const [id, row] of originals) assert.deepEqual(byId.get(id), row, 'Original record changed: ' + id);
const reasons = {
  'tray-repair': 'Published commit 38c21a77b4e875d75e17ee68683846601df33591 with the reviewed helper launch change and regression assertions. Two author inspections passed; exact module blob and SHA256 are recorded in results/tray-repair.json. Real Windows verification remains a separate task.',
  'tray-repair-checks': 'All 32 launcher cases passed with no skips. Lint passed for all three changed files and the diff check passed. The full lint attempt exited 137 without a lint diagnostic; the prior full-tree lint result covers unchanged files. See results/tray-repair-checks.json and retained logs.',
  'installer-repair': 'Published windows-install-tray-20261124.ps1 at SHA256 881386faf0ef828ebc68fa0a99e28183ad265b7da8587964934a704089153631. It accepts only the reviewed tray module blob and SHA256 beyond the prior paths. Two author inspections, independent static review and ordinary Windows parsing passed. The installer has not run. See results/installer-repair.json and pc-installer-parser.json.'
};
const operations = Object.entries(reasons).map(([key, reason]) => {
  const current = byId.get(created.tasks[key]);
  assert.ok(current, key);
  assert.equal(current.title, expected.get(key).title);
  assert.equal(current.description, expected.get(key).description);
  assert.equal(current.status, 'open');
  assert.equal(current.assignee, null);
  assert.equal(current.revision, 1);
  return { op: 'close', id: current.id, if_revision: current.revision, reason };
});
write('manifest.json', { manifest_version: 1, operations });
const manifest = path.join(output, 'manifest.json');
const dry = run(['manifest', 'dry-run', '--input', manifest, '--format', 'json'], 'dry-run');
assert.equal(dry.operations, 3); assert.equal(dry.semantic_changes, 3); assert.equal(dry.dry_run, true);
write('commit-started.json', { utc: new Date().toISOString(), manifest_sha256: hash(manifest), operations: 3, replay_allowed: false });
const commit = run(['manifest', 'commit', '--input', manifest, '--format', 'json', '--no-auto-flush'], 'commit');
assert.equal(commit.committed, true); assert.equal(commit.operations, 3); assert.equal(commit.semantic_changes, 3);
const after = run(['list', '--all', '--json'], 'after');
assert.equal(after.length, 975);
assert.equal(new Set(after.map(row => row.id)).size, 975);
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
const result = { status: 'passed', closed: Object.fromEntries(Object.keys(reasons).map(key => [key, created.tasks[key]])),
  original_954_unchanged: true, other_stored_fields_unchanged: true,
  owned_ready: ready.filter(row => own.has(row.id)).map(row => ({ id: row.id, title: row.title, revision: row.revision })),
  continuation: after.filter(row => own.has(row.id)).map(row => ({ id: row.id, status: row.status, revision: row.revision })),
  checkpoint_publication: 'Explicit flush and checked publication remain required.' };
write('result.json', result);
console.log(JSON.stringify(result, null, 2));
