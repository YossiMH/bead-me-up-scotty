import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const binaryHash = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798';
const planHash = '80b7381aa09378cf14d7bff2862de30afa11fa9041a914c8fef240dcbd18ab4c';
const basePlanHash = 'f078b507732c19d472ec2526baead24619e2503189888ccb6e4516da392dfb82';
const templateHash = '06b7a0b5ecd5ca8cbdee4c1fd405c7162a4ccb3a4405d58ad923f34b31afd33c';
const protocolHash = '74668403c9737383aa99af6aa13056e5c77a2586193a7ccc15c7b2c6505e3c17';
const priorResultHash = '6a46c9ddef4c847a0c8a5cf63c58bdec2e237a8bd04f4f4940467af8171f7d85';
const storeUuid = '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4';
const input = path.join(root, 'revision-6');
const output = path.join(root, 'materialization-v6');
const temp = path.join(root, 'temp-materialize-v6');
const finalFile = path.join(root, 'materialization-result-v6.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = file => digest(fs.readFileSync(file));
const writeFile = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const write = (name, value) => writeFile(path.join(output, name), value);
const inputs = new Map();
const deadline = Date.now() + 180000;
let phase = 'inputs', ownedOutput = false, mutationAttempted = false, descriptionCommitAttempted = false, env;
const attemptedReopens = [], verifiedReopens = [];

function read(file, expected) {
  const data = fs.readFileSync(file), actual = digest(data);
  if (expected) assert.equal(actual, expected, 'Input differs: ' + file);
  inputs.set(file, actual);
  return JSON.parse(data.toString('utf8'));
}
function unchangedInputs() {
  assert.equal(hash(bead), binaryHash, 'Native executable changed');
  for (const [file, expected] of inputs) assert.equal(hash(file), expected, 'Input changed: ' + file);
}
function rows(values, count = 986) {
  assert.ok(Array.isArray(values)); assert.equal(values.length, count);
  const result = new Map(values.map(row => [row.id, row]));
  assert.equal(result.size, count, 'Duplicate or missing issue IDs');
  for (const row of values) assert.ok(Number.isSafeInteger(row.revision) && row.revision > 0);
  return result;
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
function edges(byId, ids) {
  const result = [];
  for (const id of Object.values(ids)) {
    assert.ok(byId.has(id));
    for (const dep of stored(byId.get(id)).dependencies || []) {
      assert.deepEqual(Object.keys(dep).sort(), ['blocker', 'kind']);
      assert.equal(dep.kind, 'blocks');
      result.push([id, dep.blocker, dep.kind].join('|'));
    }
  }
  assert.equal(new Set(result).size, result.length);
  return result.sort();
}
function planEdges(plan, ids) {
  return plan.blocking_edges.map(edge => [ids[edge.blocked], ids[edge.blocker], 'blocks'].join('|')).sort();
}
function preserveOriginals(byId, originals) {
  for (const [id, row] of originals) assert.deepEqual(byId.get(id), row, 'Original record changed: ' + id);
}
function run(args, name, json = true) {
  const remaining = deadline - Date.now();
  assert.ok(remaining >= 1000, 'Deadline reached before ' + name);
  const argv = [...args, '--no-auto-flush'];
  write(name + '.started.json', { utc: new Date().toISOString(), argv, phase, replay_allowed: false });
  const result = spawnSync(bead, argv, { cwd: root, env, windowsHide: true, shell: false,
    timeout: Math.min(30000, remaining), maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, name + '.stdout'), result.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(output, name + '.stderr.log'), result.stderr || Buffer.alloc(0), { flag: 'wx' });
  write(name + '.exit.json', { status: result.status, signal: result.signal, error: result.error?.message || null });
  assert.equal(result.error, undefined, 'Command uncertain; reconcile saved output before any mutation: ' + name);
  assert.equal(result.status, 0, 'Command failed; reconcile saved output before any mutation: ' + name);
  const text = result.stdout.toString('utf8');
  if (!json) return text;
  return JSON.parse(text);
}
function completeTasks(byId, planned, ids, expectedEdges) {
  assert.deepEqual(edges(byId, ids), expectedEdges, 'Complete 51-edge graph differs');
  for (const [key, id] of Object.entries(ids)) {
    const row = byId.get(id), task = planned.get(key);
    assert.ok(row && task, key);
    assert.equal(row.title, task.title, 'Task title differs: ' + key);
    assert.equal(row.description, task.description, 'Literal task description differs: ' + key);
    assert.equal(row.assignee, null, 'Unexpected owner; no claim credential is authorized: ' + key);
    assert.deepEqual([...(row.resource_keys || [])].sort(), [...task.resource_keys].sort());
  }
}
function compareTransition(before, after, originals, targetId, change) {
  preserveOriginals(after, originals);
  for (const [id, prior] of before) {
    const current = after.get(id);
    assert.ok(current, 'Missing record: ' + id);
    const expected = stored(prior);
    if (id === targetId) {
      assert.ok(typeof current.updated_at === 'string' && current.updated_at.length > 0);
      expected.status = 'open';
      expected.assignee = null;
      expected.manual_blocked = false;
      expected.revision += 1;
      expected.updated_at = current.updated_at;
      for (const field of ['closed_at', 'close_reason']) if (Object.hasOwn(expected, field)) expected[field] = null;
      assert.equal(change, 'reopen');
    }
    assert.deepEqual(stored(current), expected, 'Unrequested stored change: ' + id);
  }
}
function reportCheck(report, committed, manifest, before) {
  assert.equal(report.manifest_version, 1);
  assert.equal(report.committed, committed); assert.equal(report.dry_run, !committed);
  assert.equal(report.operations, 12); assert.equal(report.semantic_changes, 12); assert.equal(report.results.length, 12);
  manifest.operations.forEach((op, index) => {
    const row = report.results[index];
    assert.equal(row.index, index); assert.equal(row.op, 'update'); assert.equal(row.semantic_change, true);
    assert.equal(row.outcome, 'updated'); assert.equal(row.id, op.id);
    assert.deepEqual(Object.keys(row.changes).sort(), ['description', 'revision']);
    assert.deepEqual(row.changes.revision, { before: op.if_revision, after: op.if_revision + 1 });
    const prior = before.get(op.id).description;
    assert.ok(row.changes.description.before === prior || row.changes.description.before === '[REDACTED:bead-rs]',
      'Report old description differs from literal stored text or the known redaction marker');
    assert.ok(row.changes.description.after === op.description || row.changes.description.after === '[REDACTED:bead-rs]',
      'Report new description differs from planned text or the known redaction marker');
  });
}

try {
  assert.equal(process.platform, 'win32');
  assert.equal(process.argv.length, 3, 'Supply the independently accepted revision-6 review file SHA256');
  const reviewHash = process.argv[2]; assert.match(reviewHash, /^[a-f0-9]{64}$/);
  assert.equal(hash(bead), binaryHash);
  const plan = read(path.join(input, 'plan.json'), planHash);
  const base = read(path.join(root, 'revision-5/plan.json'), basePlanHash);
  const template = read(path.join(input, 'delta-manifest.template.json'), templateHash);
  const protocol = read(path.join(input, 'native-update-protocol.json'), protocolHash);
  const review = read(path.join(input, 'plan-review.json'), reviewHash);
  assert.equal(review.status, 'PASS'); assert.equal(review.accepted, true);
  assert.equal(review.continuation_revision, 6); assert.equal(review.read_complete_plan, true);
  assert.equal(review.expanded_tasks_read, 32); assert.equal(review.blocking_edges_read, 51);
  assert.equal(review.reviewed_files['plan.json'], planHash);
  assert.equal(review.reviewed_files['delta-manifest.template.json'], templateHash);
  assert.equal(review.reviewed_files['native-update-protocol.json'], protocolHash);
  const previous = read(path.join(root, 'materialization-result-v5.json'), priorResultHash);
  assert.equal(previous.status, 'passed'); assert.equal(previous.continuation_revision, 5);
  assert.equal(previous.total_issues, 986); assert.equal(previous.blocking_edges, 51);
  assert.equal(previous.original_inventory_unchanged, true); assert.equal(previous.plan_sha256, basePlanHash);
  assert.equal(previous.source_store_uuid, storeUuid); assert.equal(previous.binary_sha256, binaryHash);
  assert.equal(plan.version, 6); assert.equal(plan.continuation_revision, 6);
  const revision = plan.revision_6, ids = revision.task_ids;
  assert.deepEqual(ids, previous.tasks);
  assert.equal(Object.keys(ids).length, 32); assert.equal(new Set(Object.values(ids)).size, 32);
  assert.equal(revision.base_plan_sha256, basePlanHash); assert.equal(protocol.base_plan_sha256, basePlanHash);
  assert.equal(protocol.root_is_sole_writer, true); assert.equal(protocol.required_before_install, true);
  assert.equal(revision.task_count, 32); assert.equal(revision.total_issues, 986); assert.equal(revision.blocking_edges, 51);
  assert.equal(revision.graph_changed, false); assert.deepEqual(revision.new_tasks, []); assert.deepEqual(revision.removed_tasks, []);
  assert.equal(plan.tasks.length, 32); assert.equal(base.tasks.length, 32); assert.equal(plan.blocking_edges.length, 51);
  assert.deepEqual(plan.blocking_edges, base.blocking_edges);
  const planned = new Map(plan.tasks.map(task => [task.key, task])), oldPlanned = new Map(base.tasks.map(task => [task.key, task]));
  assert.equal(planned.size, 32); assert.equal(oldPlanned.size, 32);
  assert.deepEqual([...planned.keys()].sort(), Object.keys(ids).sort());
  assert.deepEqual([...oldPlanned.keys()].sort(), Object.keys(ids).sort());
  const changed = revision.changed_task_keys, reopen = revision.reopen_task_keys;
  assert.equal(changed.length, 12); assert.equal(new Set(changed).size, 12);
  assert.deepEqual(reopen, ['tray-diagnose', 'tray-repair', 'tray-repair-checks', 'installer-repair']);
  assert.deepEqual(protocol.reopen.map(row => row.key), reopen);
  for (const key of Object.keys(ids)) {
    const next = planned.get(key), prior = oldPlanned.get(key);
    assert.equal(next.title, prior.title);
    assert.deepEqual(next.resource_keys, prior.resource_keys); assert.deepEqual(next.prerequisites, prior.prerequisites);
    if (changed.includes(key)) assert.notEqual(next.description, prior.description);
    else assert.deepEqual(next, prior, 'Unlisted plan task changed: ' + key);
  }
  for (const row of protocol.reopen) {
    assert.equal(row.id, ids[row.key]); assert.equal(row.expected_observed_status, 'closed');
    assert.equal(row.last_observed_revision, 2);
    assert.deepEqual(row.command, ['bead', 'reopen', row.id, '--if-revision', '@actual_current_revision']);
    assert.ok(changed.includes(row.key));
  }
  assert.deepEqual(template, { manifest_version: 1, operations: changed.map(key => ({
    op: 'update', id: ids[key], if_revision: '@current_post_reopen:' + key, description: planned.get(key).description
  })) });
  const originals = rows(read(path.join(root, 'inventory-before-node-v3.json')), 954);
  for (const id of Object.values(ids)) assert.equal(originals.has(id), false);
  const checkpointPointer = path.join(root, '.beads/checkpoint/current.json');
  const preservedFiles = [path.join(root, '.beads/config.json'), checkpointPointer];
  for (const file of preservedFiles) inputs.set(file, hash(file));
  const helperHash = hash(process.argv[1]); inputs.set(path.resolve(process.argv[1]), helperHash);
  for (const file of [output, temp, finalFile]) assert.equal(fs.existsSync(file), false, 'Existing attempt; reconcile before retry: ' + file);
  fs.mkdirSync(output, { recursive: false }); ownedOutput = true;
  fs.mkdirSync(temp, { recursive: false });
  env = { ...process.env };
  for (const key of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  env.TEMP = env.TMP = temp;
  write('started.json', { started_utc: new Date().toISOString(), helper_sha256: helperHash, plan_sha256: planHash,
    base_plan_sha256: basePlanHash, template_sha256: templateHash, protocol_sha256: protocolHash,
    review_sha256: reviewHash, binary_sha256: binaryHash, deadline_seconds: 180, replay_allowed: false });
  phase = 'current-state';
  const help = run(['reopen', '--help'], 'reopen-help', false);
  assert.ok(help.includes('--if-revision'), 'Installed reopen does not advertise the required guard');
  const before = rows(run(['list', '--all', '--json'], 'inventory-before'));
  preserveOriginals(before, originals);
  const expectedEdges = planEdges(plan, ids);
  completeTasks(before, oldPlanned, ids, expectedEdges);
  for (const key of reopen) {
    assert.equal(before.get(ids[key]).status, 'closed', 'Reopen target is no longer the reviewed closed task: ' + key);
    assert.equal(before.get(ids[key]).revision, 2, 'Reopen target changed after the reviewed failure: ' + key);
    assert.equal(before.get(ids[key]).manual_blocked, false);
  }
  for (const key of changed.filter(key => !reopen.includes(key))) assert.equal(before.get(ids[key]).status, 'open');
  write('bindings-before.json', { tasks: Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, {
    id, status: before.get(id).status, revision: before.get(id).revision, description_sha256: digest(before.get(id).description)
  }])), edges: expectedEdges, original_954_unchanged: true, checkpoint_pointer_sha256: hash(checkpointPointer) });
  unchangedInputs();
  let current = before;
  const histories = new Map();
  for (const key of reopen) {
    phase = 'reopen-' + key;
    const id = ids[key], prior = current.get(id);
    const history = run(['history', id, '--json'], 'history-before-' + key);
    assert.ok(Array.isArray(history) && history.length > 0);
    assert.equal(history.at(-1).kind, 'closed'); assert.equal(history.at(-1).revision, prior.revision);
    histories.set(id, history);
    const args = ['reopen', id, '--if-revision', String(prior.revision)];
    write('reopen-' + key + '.intent.json', { utc: new Date().toISOString(), id, key, current_revision: prior.revision,
      before_record: prior, history_sha256: hash(path.join(output, 'history-before-' + key + '.stdout')),
      command: [...args, '--no-auto-flush'], reason: revision.reason, replay_allowed: false });
    mutationAttempted = true; attemptedReopens.push(key);
    assert.equal(run(args, 'reopen-' + key, false).trim(), id, 'Reopen stdout is not the exact target ID');
    const after = rows(run(['list', '--all', '--json'], 'inventory-after-' + key));
    compareTransition(current, after, originals, id, 'reopen');
    completeTasks(after, oldPlanned, ids, expectedEdges);
    const historyAfter = run(['history', id, '--json'], 'history-after-' + key);
    assert.equal(historyAfter.length, history.length + 1);
    assert.deepEqual(historyAfter.slice(0, -1), history, 'Existing close/earlier history changed: ' + key);
    const last = historyAfter.at(-1);
    assert.equal(last.kind, 'reopened'); assert.equal(last.revision, prior.revision + 1);
    assert.ok(Number.isSafeInteger(last.sequence) && last.sequence > history.at(-1).sequence);
    assert.equal(last.time, after.get(id).updated_at);
    assert.deepEqual(last.changed_fields, ['base_status', 'assignee', 'closed_at', 'close_reason']);
    write('reopen-' + key + '.verified.json', { status: 'passed', key, id, revision: after.get(id).revision,
      existing_history_unchanged: true, appended_event: last, original_954_unchanged: true, other_stored_fields_unchanged: true });
    verifiedReopens.push(key);
    current = after;
  }
  phase = 'description-dry-run';
  const bound = structuredClone(template);
  for (const op of bound.operations) {
    assert.equal(current.get(op.id).status, 'open');
    assert.equal(current.get(op.id).assignee, null);
    op.if_revision = current.get(op.id).revision;
  }
  const manifest = path.join(output, 'manifest.json');
  writeFile(manifest, bound);
  const manifestHash = hash(manifest);
  reportCheck(run(['manifest', 'dry-run', '--input', manifest, '--format', 'json'], 'dry-run'), false, bound, current);
  const precommit = rows(run(['list', '--all', '--json'], 'inventory-precommit'));
  for (const [id, row] of current) assert.deepEqual(precommit.get(id), row, 'State changed during description dry-run: ' + id);
  unchangedInputs(); assert.equal(hash(manifest), manifestHash);
  phase = 'description-commit';
  write('commit-started.json', { utc: new Date().toISOString(), operations: 12, manifest_sha256: manifestHash, replay_allowed: false });
  descriptionCommitAttempted = true; mutationAttempted = true;
  reportCheck(run(['manifest', 'commit', '--input', manifest, '--format', 'json'], 'commit'), true, bound, current);
  phase = 'readback';
  const after = rows(run(['list', '--all', '--json'], 'inventory-after'));
  preserveOriginals(after, originals); completeTasks(after, planned, ids, expectedEdges);
  const changedIds = new Set(changed.map(key => ids[key]));
  const keyById = new Map(Object.entries(ids).map(([key, id]) => [id, key]));
  for (const [id, prior] of current) {
    const row = after.get(id), expected = stored(prior);
    if (changedIds.has(id)) {
      expected.description = planned.get(keyById.get(id)).description;
      expected.revision += 1; expected.updated_at = row.updated_at;
      assert.ok(typeof row.updated_at === 'string' && row.updated_at.length > 0);
    }
    assert.deepEqual(stored(row), expected, 'Unrequested stored field changed during description commit: ' + id);
  }
  for (const key of reopen) {
    const id = ids[key], history = run(['history', id, '--json'], 'history-final-' + key), originalHistory = histories.get(id);
    assert.equal(history.length, originalHistory.length + 2);
    assert.deepEqual(history.slice(0, originalHistory.length), originalHistory, 'Earlier close history changed: ' + key);
    assert.equal(history.at(-2).kind, 'reopened');
    assert.equal(history.at(-1).kind, 'updated'); assert.equal(history.at(-1).revision, after.get(id).revision);
    assert.deepEqual(history.at(-1).changed_fields, ['description']);
  }
  const ready = run(['list', '--ready', '--json', '--limit', '1000'], 'ready');
  unchangedInputs();
  assert.ok(Date.now() < deadline, 'Deadline exceeded before completion record');
  const result = { status: 'passed', continuation_revision: 6, source_store_uuid: storeUuid, original_issues: 954,
    total_issues: 986, tasks: ids, blocking_edges: 51, description_updates: 12, reopens: 4,
    new_creates: 0, dependency_additions: 0, plan_sha256: planHash, base_plan_sha256: basePlanHash,
    template_sha256: templateHash, protocol_sha256: protocolHash, plan_review_sha256: reviewHash,
    manifest_sha256: manifestHash, binary_sha256: binaryHash, helper_sha256: helperHash,
    original_inventory_unchanged: true, unrelated_stored_fields_unchanged: true, previous_close_history_preserved: true,
    complete_descriptions_match: true, complete_edges_match: true, config_and_checkpoint_pointer_unchanged: true,
    reopened: Object.fromEntries(reopen.map(key => [key, ids[key]])),
    owned_ready: ready.filter(row => keyById.has(row.id)).map(row => ({ key: keyById.get(row.id), id: row.id, title: row.title, revision: row.revision })),
    continuation: Object.entries(ids).map(([key, id]) => ({ key, id, status: after.get(id).status, revision: after.get(id).revision })),
    output_directory: output, temporary_directory: temp, current_accepted_plan: { path: path.join(input, 'plan.json'), sha256: planHash },
    publication: 'Explicit flush and checked Git publication remain required.', completed_utc: new Date().toISOString() };
  write('result.json', result); writeFile(finalFile, result); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { status: 'failed', phase, error: error?.message || String(error), mutation_attempted: mutationAttempted,
    attempted_reopens: attemptedReopens, verified_reopens: verifiedReopens, description_commit_attempted: descriptionCommitAttempted,
    replay_allowed: false, output_directory: ownedOutput ? output : null,
    next_action: 'Inspect every saved intent, raw stream and current native state. Reconcile each attempted operation; never replay this helper or any uncertain mutation.' };
  if (ownedOutput) { try { write('failure.json', result); } catch (saveError) { result.save_error = saveError.message; } }
  console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
