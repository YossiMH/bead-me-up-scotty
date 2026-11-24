import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

assert.equal(process.platform, 'win32');
const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const digest = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(digest(bead), '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798');
const created = JSON.parse(fs.readFileSync(path.join(root, 'materialization-result-v3.json'), 'utf8'));
assert.equal(created.status, 'passed');
assert.equal(created.original_inventory_unchanged, true);
assert.equal(created.manifest_sha256, 'ea1f4c44703ee5b9fc4f3ccd62ef78bac557299046ea81cc2a520358b8dd6aed');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'manifest-v3.json'), 'utf8'));
assert.equal(digest(path.join(root, 'manifest-v3.json')), created.manifest_sha256);
const expected = new Map(plan.operations.filter(x => x.op === 'create').map(x => [x.local_id, x]));
const output = path.join(root, 'completed-v1');
fs.mkdirSync(output, { recursive: false });
const env = { ...process.env };
for (const k of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(k.toLowerCase())) delete env[k];
env.TEMP = env.TMP = path.join(root, 'temp-materialize-v3');
assert.ok(fs.statSync(env.TEMP).isDirectory());
const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function run(args, name) {
  const r = spawnSync(bead, args, { cwd: root, env, windowsHide: true, shell: false, timeout: 20000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, name + '.json'), r.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(output, name + '.stderr.log'), r.stderr || Buffer.alloc(0), { flag: 'wx' });
  write(name + '.exit.json', { status: r.status, signal: r.signal, error: r.error?.message || null });
  assert.equal(r.error, undefined, 'Inspect the saved result before another attempt');
  assert.equal(r.status, 0, 'Inspect the saved result before another attempt');
  return JSON.parse(r.stdout.toString('utf8'));
}
const before = run(['list', '--all', '--json'], 'before');
assert.equal(before.length, 971);
const byId = new Map(before.map(x => [x.id, x]));
const reasons = {
  'plan-review': 'All 17 expanded tasks and 26 dependencies passed independent review. Accepted plan revision 3; see plan-review-v3.json.',
  'reconcile': 'Restored 954 prior issues and added 17 tasks with 26 dependencies in one transaction. Complete readback preserved every original issue. See materialization-result-v3.json and results/reconcile.json.',
  'cloud-checks': '32 launcher tests and 161 editor adapter tests passed. Typecheck and lint passed; one prior lint warning remains. See results/cloud-checks.json and its saved command logs.',
  'browser-prepare': 'Prepared exact native, app and browser inputs with a bounded Windows runner and early output capture. All five local execution files matched their hashes and parsed successfully. See windows-browser-capture-handoff.json and results/pc-browser-local-stage.json. Actual browser checks remain open.',
  'browser-runner-review': 'The complete browser runner, local input manifest and early capture wrapper passed independent static review. See results/windows-browser-capture-review.json. Actual browser checks remain open.',
  'tray-diagnose': 'The installed Node v25.2.1 and libuv 1.51.0 terminate non-detached Windows children when their Node parent exits. The helper needs detached:true to finish its cleanup. See results/tray-diagnose.json and tray-repair-instructions.md. Repair and real Windows checks remain open.'
};
const operations = [];
for (const [key, reason] of Object.entries(reasons)) {
  const current = byId.get(created.tasks[key]);
  assert.ok(current, key);
  assert.equal(current.title, expected.get(key).title, key);
  assert.equal(current.description, expected.get(key).description, key);
  assert.equal(current.status, 'open', 'Reconcile changed task state: ' + key);
  assert.equal(current.assignee, null, key);
  assert.ok(Number.isInteger(current.revision), key);
  operations.push({ op: 'close', id: current.id, reason, if_revision: current.revision });
}
const manifestPath = path.join(output, 'manifest.json');
write('manifest.json', { manifest_version: 1, operations });
const dry = run(['manifest', 'dry-run', '--input', manifestPath, '--format', 'json'], 'dry-run');
assert.equal(dry.operations, 6); assert.equal(dry.semantic_changes, 6); assert.equal(dry.dry_run, true);
write('commit-started.json', { utc: new Date().toISOString(), manifest_sha256: digest(manifestPath), operations: 6 });
const commit = run(['manifest', 'commit', '--input', manifestPath, '--format', 'json', '--no-auto-flush'], 'commit');
assert.equal(commit.committed, true); assert.equal(commit.operations, 6); assert.equal(commit.semantic_changes, 6);
const after = run(['list', '--all', '--json'], 'after');
assert.equal(after.length, 971);
const completedIds = new Set(operations.map(x => x.id));
const continuationIds = new Set(Object.values(created.tasks));
for (const current of after) {
  if (completedIds.has(current.id)) {
    assert.equal(current.status, 'closed');
    assert.equal(current.revision, byId.get(current.id).revision + 1);
    assert.equal(current.description, byId.get(current.id).description);
  } else if (continuationIds.has(current.id)) {
    // Closing prerequisites changes this derived value without editing the issue.
    const { effective_status: beforeEffective, ...beforeStored } = byId.get(current.id);
    const { effective_status: afterEffective, ...afterStored } = current;
    assert.deepEqual(afterStored, beforeStored, 'Other task fields changed: ' + current.id);
  } else assert.deepEqual(current, byId.get(current.id), 'Unrelated record changed: ' + current.id);
}
const ready = run(['list', '--ready', '--json', '--limit', '1000'], 'ready');
const report = { status: 'passed', closed: Object.fromEntries(Object.keys(reasons).map(k => [k, created.tasks[k]])),
  owned_ready: ready.filter(x => continuationIds.has(x.id)).map(x => ({ id: x.id, title: x.title, revision: x.revision })),
  continuation: after.filter(x => continuationIds.has(x.id)).map(x => ({ id: x.id, title: x.title, status: x.status, revision: x.revision })),
  publication: 'Deferred per invocation; explicit flush and checked Git publication remain required.' };
write('result.json', report);
console.log(JSON.stringify(report, null, 2));
