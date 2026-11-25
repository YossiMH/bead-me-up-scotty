import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const binaryHash = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798';
const planHash = '18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582';
const basePlanHash = '80b7381aa09378cf14d7bff2862de30afa11fa9041a914c8fef240dcbd18ab4c';
const storeUuid = '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4';
const input = path.join(root, 'revision-9');
const output = path.join(root, 'materialization-v9');
const temp = path.join(root, 'temp-materialize-v9');
const finalFile = path.join(root, 'materialization-result-v9.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = file => digest(fs.readFileSync(file));
const writeFile = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const write = (name, value) => writeFile(path.join(output, name), value);
const inputs = new Map();
const deadline = Date.now() + 180000;
let phase = 'inputs', ownedOutput = false, mutationAttempted = false, manifestCommitAttempted = false, env;
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
  assert.deepEqual(edges(byId, ids), expectedEdges, 'Complete task graph differs');
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
function reportCheck(report, committed, manifest, before, newKeys) {
  assert.equal(report.manifest_version, 1);
  assert.equal(report.committed, committed); assert.equal(report.dry_run, !committed);
  assert.equal(report.operations, 78); assert.equal(report.semantic_changes, 78); assert.equal(report.results.length, 78);
  const added = {};
  manifest.operations.forEach((op, index) => {
    const row = report.results[index];
    assert.equal(row.index, index); assert.equal(row.op, op.op); assert.equal(row.semantic_change, true);
    if (op.op === 'create') {
      assert.equal(row.outcome, 'created'); assert.equal(row.local_id, op.local_id);
      assert.ok(typeof row.issue_id === 'string' && row.issue_id.length > 0);
      assert.equal(before.has(row.issue_id), false);
      assert.equal(row.issue.id, row.issue_id); assert.equal(row.issue.issue_type, 'task'); assert.equal(row.issue.base_status, 'open');
      added[op.local_id] = row.issue_id;
    } else if (op.op === 'update') {
      assert.equal(row.outcome, 'updated'); assert.equal(row.id, op.id);
      assert.deepEqual(Object.keys(row.changes).sort(), ['description', 'revision']);
      assert.deepEqual(row.changes.revision, { before: op.if_revision, after: op.if_revision + 1 });
      const prior = before.get(op.id).description;
      assert.ok(row.changes.description.before === prior || row.changes.description.before === '[REDACTED:bead-rs]');
      assert.ok(row.changes.description.after === op.description || row.changes.description.after === '[REDACTED:bead-rs]');
    } else {
      assert.equal(op.op, 'dep_add'); assert.equal(row.outcome, 'added');
      const resolve = id => id.startsWith('$') ? added[id.slice(1)] : id;
      assert.equal(row.blocked, resolve(op.blocked)); assert.equal(row.blocker, resolve(op.blocker)); assert.equal(row.kind, 'blocks');
    }
  });
  assert.deepEqual(Object.keys(added).sort(), [...newKeys].sort());
  assert.equal(new Set(Object.values(added)).size, 23);
  return added;
}

try {
  assert.equal(process.platform, 'win32');
  assert.equal(process.argv.length, 3, 'Supply the independently accepted revision-9 review file SHA256');
  const reviewHash = process.argv[2]; assert.match(reviewHash, /^[a-f0-9]{64}$/);
  assert.equal(hash(bead), binaryHash);
  const plan = read(path.join(input, 'plan.json'), planHash);
  const base = read(path.join(root, 'revision-6/plan.json'), basePlanHash);
  const review = read(path.join(input, 'plan-review.json'), reviewHash);
  assert.equal(review.status, 'PASS'); assert.equal(review.accepted, true);
  assert.equal(review.continuation_revision, 9); assert.equal(review.read_complete_plan, true);
  assert.equal(review.expanded_tasks_read, 55); assert.equal(review.blocking_edges_read, 91);
  assert.equal(review.reviewed_files['plan.json'], planHash);
  const previous = read(path.join(root, 'materialization-result-v6.json'));
  assert.equal(previous.status, 'passed'); assert.equal(previous.continuation_revision, 6);
  assert.equal(previous.total_issues, 986); assert.equal(previous.blocking_edges, 51);
  assert.equal(previous.original_inventory_unchanged, true); assert.equal(previous.plan_sha256, basePlanHash);
  assert.equal(previous.source_store_uuid, storeUuid); assert.equal(previous.binary_sha256, binaryHash);
  assert.equal(plan.version, 9); assert.equal(plan.continuation_revision, 9);
  const revision = plan.revision_9, ids = plan.revision_6.task_ids;
  assert.deepEqual(ids, previous.tasks);
  assert.equal(Object.keys(ids).length, 32); assert.equal(new Set(Object.values(ids)).size, 32);
  assert.equal(revision.base_actual_plan_sha256, basePlanHash);
  assert.equal(plan.tasks.length, 55); assert.equal(base.tasks.length, 32); assert.equal(plan.blocking_edges.length, 91);
  const planned = new Map(plan.tasks.map(task => [task.key, task])), oldPlanned = new Map(base.tasks.map(task => [task.key, task]));
  assert.equal(planned.size, 55); assert.equal(oldPlanned.size, 32);
  assert.deepEqual([...oldPlanned.keys()].sort(), Object.keys(ids).sort());
  const newKeys = revision.all_unmaterialized_keys, reopen = revision.reopen_existing;
  assert.equal(newKeys.length, 23); assert.equal(new Set(newKeys).size, 23);
  assert.deepEqual([...planned.keys()].filter(key => !oldPlanned.has(key)).sort(), [...newKeys].sort());
  assert.deepEqual(reopen, ['checkpoint-linux-build', 'checkpoint-linux-checks', 'checkpoint-full-suite']);
  const changed = Object.keys(ids).filter(key => planned.get(key).description !== oldPlanned.get(key).description);
  assert.equal(changed.length, 15);
  const edgeKey = edge => edge.blocked + '|' + edge.blocker;
  const oldEdgeKeys = new Set(base.blocking_edges.map(edgeKey));
  const newEdgeKeys = new Set(plan.blocking_edges.map(edgeKey));
  assert.equal(oldEdgeKeys.size, 51); assert.equal(newEdgeKeys.size, 91);
  for (const key of oldEdgeKeys) assert.ok(newEdgeKeys.has(key), 'An existing dependency was removed');
  const addedEdges = plan.blocking_edges.filter(edge => !oldEdgeKeys.has(edgeKey(edge)));
  assert.equal(addedEdges.length, 40);
  for (const [key, prior] of oldPlanned) {
    const next = planned.get(key);
    assert.equal(next.title, prior.title); assert.deepEqual(next.resource_keys, prior.resource_keys);
    const oldRest = { ...prior }, newRest = { ...next };
    delete oldRest.description; delete newRest.description; delete oldRest.prerequisites; delete newRest.prerequisites;
    assert.deepEqual(newRest, oldRest, 'Unrequested existing task definition change: ' + key);
  }
  for (const task of plan.tasks) {
    assert.deepEqual([...task.prerequisites].sort(), plan.blocking_edges.filter(edge => edge.blocked === task.key).map(edge => edge.blocker).sort());
    for (const key of task.prerequisites) assert.ok(planned.has(key));
  }
  const refer = key => ids[key] || '$' + key;
  const template = { manifest_version: 1, operations: [
    ...newKeys.map(key => ({ op: 'create', local_id: key, unique_ref: 'bead-edit-20261124:' + key,
      title: planned.get(key).title, description: planned.get(key).description, issue_type: 'task', priority: 1,
      labels: ['bead-edit-20261124'], resource_keys: planned.get(key).resource_keys })),
    ...changed.map(key => ({ op: 'update', id: ids[key], if_revision: '@current_post_reopen:' + key, description: planned.get(key).description })),
    ...addedEdges.map(edge => ({ op: 'dep_add', blocked: refer(edge.blocked), blocker: refer(edge.blocker), kind: 'blocks' }))
  ] };
  assert.equal(template.operations.length, 78);
  const originals = rows(read(path.join(root, 'inventory-before-node-v3.json')), 954);
  for (const id of Object.values(ids)) assert.equal(originals.has(id), false);
  const checkpointPointer = path.join(root, '.beads/checkpoint/current.json');
  const preservedFiles = [path.join(root, '.beads/config.json'), checkpointPointer];
  for (const file of preservedFiles) inputs.set(file, hash(file));
  const helperHash = hash(process.argv[1]); inputs.set(path.resolve(process.argv[1]), helperHash);
  for (const name of ['materialization-v7', 'temp-materialize-v7', 'materialization-result-v7.json', 'materialization-v7-supervisor', 'materialization-v8', 'temp-materialize-v8', 'materialization-result-v8.json', 'materialization-v8-supervisor']) {
    assert.equal(fs.existsSync(path.join(root, name)), false, 'Unexpected revision-7 or revision-8 attempt; reconcile before any mutation: ' + name);
  }
  for (const file of [output, temp, finalFile]) assert.equal(fs.existsSync(file), false, 'Existing attempt; reconcile before retry: ' + file);
  fs.mkdirSync(output, { recursive: false }); ownedOutput = true;
  fs.mkdirSync(temp, { recursive: false });
  env = { ...process.env };
  for (const key of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  env.TEMP = env.TMP = temp;
  write('started.json', { started_utc: new Date().toISOString(), helper_sha256: helperHash, plan_sha256: planHash,
    base_plan_sha256: basePlanHash,
    review_sha256: reviewHash, binary_sha256: binaryHash, deadline_seconds: 180, replay_allowed: false });
  phase = 'current-state';
  const help = run(['reopen', '--help'], 'reopen-help', false);
  assert.ok(help.includes('--if-revision'), 'Installed reopen does not advertise the required guard');
  const before = rows(run(['list', '--all', '--json'], 'inventory-before'));
  preserveOriginals(before, originals);
  const expectedEdges = planEdges(base, ids);
  completeTasks(before, oldPlanned, ids, expectedEdges);
  for (const key of reopen) {
    assert.equal(before.get(ids[key]).status, 'closed', 'Reopen target is no longer the reviewed closed task: ' + key);
    assert.equal(before.get(ids[key]).manual_blocked, false);
  }
  for (const key of changed.filter(key => !reopen.includes(key))) assert.equal(before.get(ids[key]).status, 'open');
  for (const [key, id] of Object.entries(ids)) {
    assert.deepEqual(run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-before-' + key), [id]);
  }
  for (const key of newKeys) {
    assert.deepEqual(run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-absent-' + key), []);
  }
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
  phase = 'manifest-dry-run';
  const bound = structuredClone(template);
  for (const op of bound.operations) {
    if (op.op !== 'update') continue;
    assert.equal(current.get(op.id).status, 'open');
    assert.equal(current.get(op.id).assignee, null);
    op.if_revision = current.get(op.id).revision;
  }
  const manifest = path.join(output, 'manifest.json');
  writeFile(manifest, bound);
  const manifestHash = hash(manifest);
  reportCheck(run(['manifest', 'dry-run', '--input', manifest, '--format', 'json'], 'dry-run'), false, bound, current, newKeys);
  const precommit = rows(run(['list', '--all', '--json'], 'inventory-precommit'));
  for (const [id, row] of current) assert.deepEqual(precommit.get(id), row, 'State changed during manifest dry-run: ' + id);
  unchangedInputs(); assert.equal(hash(manifest), manifestHash);
  phase = 'manifest-commit';
  write('commit-started.json', { utc: new Date().toISOString(), operations: 78, manifest_sha256: manifestHash, replay_allowed: false });
  manifestCommitAttempted = true; mutationAttempted = true;
  const addedIds = reportCheck(run(['manifest', 'commit', '--input', manifest, '--format', 'json'], 'commit'), true, bound, current, newKeys);
  const allIds = { ...ids, ...addedIds };
  phase = 'readback';
  const after = rows(run(['list', '--all', '--json'], 'inventory-after'), 1009);
  preserveOriginals(after, originals); completeTasks(after, planned, allIds, planEdges(plan, allIds));
  const changedIds = new Set(changed.map(key => ids[key]));
  const keyById = new Map(Object.entries(allIds).map(([key, id]) => [id, key]));
  for (const [id, prior] of current) {
    const row = after.get(id), expected = stored(prior);
    if (changedIds.has(id)) {
      expected.description = planned.get(keyById.get(id)).description;
      expected.revision += 1; expected.updated_at = row.updated_at;
      assert.ok(typeof row.updated_at === 'string' && row.updated_at.length > 0);
    }
    const actual = stored(row); delete actual.dependencies; delete expected.dependencies;
    assert.deepEqual(actual, expected, 'Unrequested stored field changed during manifest commit: ' + id);
  }
  for (const id of Object.values(addedIds)) {
    const row = after.get(id);
    assert.equal(row.status, 'open'); assert.equal(row.assignee, null); assert.equal(row.revision, 1);
    assert.equal(row.priority, 1); assert.equal(row.notes, ''); assert.equal(row.manual_blocked, false);
    assert.deepEqual(row.labels, ['bead-edit-20261124']);
  }
  for (const [key, id] of Object.entries(allIds)) {
    assert.deepEqual(run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-after-' + key), [id]);
  }
  for (const key of reopen) {
    const id = ids[key], history = run(['history', id, '--json'], 'history-final-' + key), originalHistory = histories.get(id);
    const dependencies = addedEdges.filter(edge => edge.blocked === key).length;
    assert.equal(history.length, originalHistory.length + 2 + dependencies);
    assert.deepEqual(history.slice(0, originalHistory.length), originalHistory, 'Earlier close history changed: ' + key);
    const appended = history.slice(originalHistory.length);
    assert.equal(appended[0].kind, 'reopened'); assert.equal(appended[1].kind, 'updated');
    assert.equal(appended[1].revision, after.get(id).revision); assert.deepEqual(appended[1].changed_fields, ['description']);
    for (const event of appended.slice(2)) assert.equal(event.kind, 'dependency_added');
  }
  const ready = run(['list', '--ready', '--json', '--limit', '1000'], 'ready');
  unchangedInputs();
  assert.ok(Date.now() < deadline, 'Deadline exceeded before completion record');
  const result = { status: 'passed', continuation_revision: 9, source_store_uuid: storeUuid, original_issues: 954,
    total_issues: 1009, tasks: allIds, blocking_edges: 91, description_updates: 15, reopens: 3,
    new_creates: 23, dependency_additions: 40, plan_sha256: planHash, base_plan_sha256: basePlanHash,
    plan_review_sha256: reviewHash,
    manifest_sha256: manifestHash, binary_sha256: binaryHash, helper_sha256: helperHash,
    original_inventory_unchanged: true, unrelated_stored_fields_unchanged: true, previous_close_history_preserved: true,
    complete_descriptions_match: true, complete_edges_match: true, config_and_checkpoint_pointer_unchanged: true,
    reopened: Object.fromEntries(reopen.map(key => [key, ids[key]])),
    owned_ready: ready.filter(row => keyById.has(row.id)).map(row => ({ key: keyById.get(row.id), id: row.id, title: row.title, revision: row.revision })),
    continuation: Object.entries(allIds).map(([key, id]) => ({ key, id, status: after.get(id).status, revision: after.get(id).revision })),
    output_directory: output, temporary_directory: temp, current_accepted_plan: { path: path.join(input, 'plan.json'), sha256: planHash },
    publication: 'Explicit flush and checked Git publication remain required.', completed_utc: new Date().toISOString() };
  write('result.json', result); writeFile(finalFile, result); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { status: 'failed', phase, error: error?.message || String(error), mutation_attempted: mutationAttempted,
    attempted_reopens: attemptedReopens, verified_reopens: verifiedReopens, manifest_commit_attempted: manifestCommitAttempted,
    replay_allowed: false, output_directory: ownedOutput ? output : null,
    next_action: 'Inspect every saved intent, raw stream and current native state. Reconcile each attempted operation; never replay this helper or any uncertain mutation.' };
  if (ownedOutput) { try { write('failure.json', result); } catch (saveError) { result.save_error = saveError.message; } }
  console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
