import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const binaryHash = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798';
const planHash = 'f078b507732c19d472ec2526baead24619e2503189888ccb6e4516da392dfb82';
const templateHash = '6e8fce15f4867c7599b1aaa169b61cd7f3b2d7ce9723e89be2c60a81443adf93';
const basePlanHash = '887b5036b9b1f588baaeb9a0fd9537c030e661b80325bd871b6c8b97bfbae178';
const storeUuid = '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4';
const input = path.join(root, 'revision-5');
const output = path.join(root, 'materialization-v5-v2');
const temp = path.join(root, 'temp-materialize-v5-v2');
const finalFile = path.join(root, 'materialization-result-v5.json');
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = file => digest(fs.readFileSync(file));
const writeFile = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const write = (name, value) => writeFile(path.join(output, name), value);
const inputs = new Map();
let phase = 'inputs', ownedOutput = false, commitAttempted = false, env;
const deadline = Date.now() + 180000;
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
function rows(values, count) {
  assert.ok(Array.isArray(values)); assert.equal(values.length, count);
  const result = new Map(values.map(row => [row.id, row]));
  assert.equal(result.size, count, 'Duplicate or missing issue IDs');
  for (const row of values) assert.ok(Number.isSafeInteger(row.revision) && row.revision > 0);
  return result;
}
function stored(row) {
  const value = structuredClone(row);
  delete value.effective_status;
  for (const dependency of value.dependencies || []) { delete dependency.blocker_status; delete dependency.finished; }
  return value;
}
function edgeRows(byId, ids) {
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
function expectedEdges(plan, ids) {
  return plan.blocking_edges.map(edge => [ids[edge.blocked], ids[edge.blocker], 'blocks'].join('|')).sort();
}
function originalRows(byId, originals) {
  for (const [id, row] of originals) assert.deepEqual(byId.get(id), row, 'Original record changed: ' + id);
}
function run(args, name) {
  const remaining = deadline - Date.now(); assert.ok(remaining >= 1000, 'Deadline reached before ' + name);
  const r = spawnSync(bead, args, { cwd: root, env, windowsHide: true, shell: false,
    timeout: Math.min(30000, remaining), maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, name + '.json'), r.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(output, name + '.stderr.log'), r.stderr || Buffer.alloc(0), { flag: 'wx' });
  write(name + '.exit.json', { status: r.status, signal: r.signal, error: r.error?.message || null });
  assert.equal(r.error, undefined, 'Command uncertain; reconcile before another mutation: ' + name);
  assert.equal(r.status, 0, 'Command failed; reconcile before another mutation: ' + name);
  return JSON.parse(r.stdout.toString('utf8'));
}
function reportCheck(report, committed, manifest, oldIds, newKeys) {
  assert.equal(report.manifest_version, 1); assert.equal(report.committed, committed); assert.equal(report.dry_run, !committed);
  assert.equal(report.operations, 37); assert.equal(report.semantic_changes, 37); assert.equal(report.results.length, 37);
  const added = {};
  manifest.operations.forEach((op, index) => {
    const row = report.results[index];
    assert.equal(row.index, index); assert.equal(row.op, op.op); assert.equal(row.semantic_change, true);
    if (op.op === 'create') {
      assert.equal(row.outcome, 'created'); assert.equal(row.local_id, op.local_id);
      assert.ok(typeof row.issue_id === 'string' && row.issue_id.length > 0);
      assert.ok(!Object.values(oldIds).includes(row.issue_id));
      assert.equal(row.issue.id, row.issue_id); assert.equal(row.issue.issue_type, 'task'); assert.equal(row.issue.base_status, 'open');
      added[op.local_id] = row.issue_id;
    } else if (op.op === 'update') {
      assert.equal(row.outcome, 'updated'); assert.equal(row.id, op.id);
      assert.deepEqual(Object.keys(row.changes).sort(), ['description', 'revision']);
      assert.deepEqual(row.changes.revision, { before: op.if_revision, after: op.if_revision + 1 });
      assert.ok(row.changes.description.after === op.description || row.changes.description.after === '[REDACTED:bead-rs]',
        'Manifest description projection differs from planned text or the native redaction marker');
    } else {
      assert.equal(op.op, 'dep_add'); assert.equal(row.outcome, 'added');
      const resolve = id => id.startsWith('$') ? added[id.slice(1)] : id;
      assert.equal(row.blocked, resolve(op.blocked)); assert.equal(row.blocker, resolve(op.blocker)); assert.equal(row.kind, 'blocks');
    }
  });
  assert.deepEqual(Object.keys(added).sort(), [...newKeys].sort());
  assert.equal(new Set(Object.values(added)).size, 11);
  return added;
}
try {
  assert.equal(process.platform, 'win32');
  assert.equal(process.argv.length, 3, 'Supply the independently accepted review file SHA256');
  const reviewHash = process.argv[2]; assert.match(reviewHash, /^[a-f0-9]{64}$/);
  assert.equal(hash(bead), binaryHash);
  const plan = read(path.join(input, 'plan.json'), planHash);
  const template = read(path.join(input, 'delta-manifest.template.json'), templateHash);
  const review = read(path.join(input, 'plan-review.json'), reviewHash);
  assert.equal(review.status, 'PASS'); assert.equal(review.accepted, true); assert.equal(review.continuation_revision, 5);
  assert.equal(review.read_complete_plan, true); assert.equal(review.expanded_tasks_read, 32); assert.equal(review.blocking_edges_read, 51);
  assert.equal(review.reviewed_files['plan.json'], planHash);
  assert.equal(review.reviewed_files['delta-manifest.template.json'], templateHash);
  const priorSupervisor = read(path.join(root, 'materialization-v5-supervisor/result.json'),
    'c2aff965112bf4b772fa94bf9f2c80a205a759e2bdede71b147572ecd32715b8');
  const priorFailure = read(path.join(root, 'materialization-v5-supervisor/stderr.log'),
    '8500c7d5a2dced8e56098d7d36954e27c8753104e56582030960320b1ae0ad94');
  assert.equal(priorSupervisor.status, 'failed'); assert.equal(priorSupervisor.exit_code, 1);
  assert.equal(priorSupervisor.timed_out, false);
  assert.equal(priorFailure.status, 'failed'); assert.equal(priorFailure.phase, 'dry-run');
  assert.equal(priorFailure.commit_attempted, false);
  assert.equal(fs.existsSync(path.join(root, 'materialization-v5/commit-started.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'materialization-v5/commit.json')), false);
  const base = read(path.join(root, 'revision-4/plan.json'), basePlanHash);
  const previous = read(path.join(root, 'materialization-result-v4.json'));
  assert.equal(previous.status, 'passed'); assert.equal(previous.total_issues, 975); assert.equal(previous.blocking_edges, 34);
  assert.equal(previous.original_inventory_unchanged, true); assert.equal(previous.plan_sha256, basePlanHash);
  assert.equal(previous.source_store_uuid, storeUuid); assert.equal(previous.binary_sha256, binaryHash);
  const ids = plan.revision_5.base_task_ids;
  assert.deepEqual(ids, previous.tasks); assert.equal(Object.keys(ids).length, 21); assert.equal(new Set(Object.values(ids)).size, 21);
  const newKeys = plan.revision_5.new_task_keys, changed = plan.revision_5.changed_existing_task_keys;
  assert.equal(newKeys.length, 11); assert.equal(changed.length, 9);
  assert.equal(plan.tasks.length, 32); assert.equal(plan.blocking_edges.length, 51);
  assert.equal(template.manifest_version, 1); assert.equal(template.operations.length, 37);
  const planned = new Map(plan.tasks.map(t => [t.key, t])), oldPlanned = new Map(base.tasks.map(t => [t.key, t]));
  assert.equal(planned.size, 32); assert.equal(oldPlanned.size, 21);
  const refer = key => ids[key] || '$' + key;
  const expectedTemplate = { manifest_version: 1, operations: [
    ...newKeys.map(key => ({ op: 'create', local_id: key, unique_ref: 'bead-edit-20261124:' + key,
      title: planned.get(key).title, description: planned.get(key).description, issue_type: 'task', priority: 1,
      labels: ['bead-edit-20261124'], resource_keys: planned.get(key).resource_keys })),
    ...changed.map(key => ({ op: 'update', id: ids[key], if_revision: '@revision:' + key, description: planned.get(key).description })),
    ...plan.revision_5.added_blocking_edges.map(e => ({ op: 'dep_add', blocked: refer(e.blocked), blocker: refer(e.blocker), kind: 'blocks' }))
  ] };
  assert.deepEqual(template, expectedTemplate, 'Manifest differs from complete accepted plan');
  const originals = rows(read(path.join(root, 'inventory-before-node-v3.json')), 954);
  for (const target of [output, temp, finalFile]) assert.equal(fs.existsSync(target), false, 'Existing attempt; reconcile before retry: ' + target);
  fs.mkdirSync(output, { recursive: false }); ownedOutput = true;
  fs.mkdirSync(temp, { recursive: false });
  env = { ...process.env };
  for (const key of Object.keys(env)) if (['temp','tmp','beads_repo','bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  env.TEMP = env.TMP = temp;
  write('started.json', { started_utc: new Date().toISOString(), helper_sha256: hash(process.argv[1]), plan_sha256: planHash,
    template_sha256: templateHash, review_sha256: reviewHash, binary_sha256: binaryHash, deadline_seconds: 180, retry_allowed: false });
  phase = 'current-state';
  const before = rows(run(['list','--all','--json'], 'inventory-before'), 975);
  originalRows(before, originals);
  assert.deepEqual(edgeRows(before, ids), expectedEdges(base, ids), 'Existing34-edge graph differs');
  for (const [key, id] of Object.entries(ids)) {
    const row = before.get(id), task = oldPlanned.get(key);
    assert.ok(row && task); assert.equal(row.title, task.title); assert.equal(row.description, task.description);
    assert.deepEqual([...(row.resource_keys || [])].sort(), [...task.resource_keys].sort());
    if (changed.includes(key)) { assert.equal(row.status, 'open'); assert.equal(row.assignee, null); }
    const matches = run(['ref','find','--namespace','bead-edit-20261124','--value',key,'--json'], 'ref-before-' + key);
    assert.deepEqual(matches, [id]);
  }
  for (const key of newKeys) {
    assert.equal(Object.hasOwn(ids, key), false);
    assert.deepEqual(run(['ref','find','--namespace','bead-edit-20261124','--value',key,'--json'], 'ref-absent-' + key), []);
  }
  const bound = structuredClone(template);
  for (const op of bound.operations) if (op.op === 'update') op.if_revision = before.get(op.id).revision;
  const manifestFile = path.join(output, 'manifest.json'); writeFile(manifestFile, bound);
  const manifestHash = hash(manifestFile);
  write('bindings.json', { tasks: Object.fromEntries(Object.entries(ids).map(([key,id]) => [key, {
    id, revision: before.get(id).revision, status: before.get(id).status, description_sha256: digest(before.get(id).description)
  }])), plan_sha256: planHash, manifest_sha256: manifestHash });
  phase = 'dry-run';
  reportCheck(run(['manifest','dry-run','--input',manifestFile,'--format','json'], 'dry-run'), false, bound, ids, newKeys);
  const precommit = rows(run(['list','--all','--json'], 'inventory-precommit'), 975);
  for (const [id, row] of before) assert.deepEqual(precommit.get(id), row, 'State changed during preflight: ' + id);
  unchangedInputs(); assert.equal(hash(manifestFile), manifestHash);
  phase = 'commit';
  write('commit-started.json', { utc: new Date().toISOString(), operations:37, manifest_sha256: manifestHash, retry_allowed:false });
  commitAttempted = true;
  const newIds = reportCheck(run(['manifest','commit','--input',manifestFile,'--format','json','--no-auto-flush'], 'commit'), true, bound, ids, newKeys);
  const allIds = { ...ids, ...newIds };
  phase = 'readback';
  const after = rows(run(['list','--all','--json'], 'inventory-after'), 986);
  originalRows(after, originals);
  assert.deepEqual(edgeRows(after, allIds), expectedEdges(plan, allIds), 'Final complete51-edge graph differs');
  for (const [key, id] of Object.entries(allIds)) {
    const row = after.get(id), task = planned.get(key);
    assert.ok(row); assert.equal(row.title, task.title); assert.equal(row.description, task.description);
    assert.deepEqual([...(row.resource_keys || [])].sort(), [...task.resource_keys].sort());
    if (Object.hasOwn(ids, key)) {
      const expected = stored(before.get(id)), actual = stored(row);
      if (changed.includes(key)) {
        expected.description = task.description; expected.revision += 1;
        assert.ok(typeof row.updated_at === 'string' && row.updated_at.length > 0);
        expected.updated_at = row.updated_at;
        delete expected.dependencies; delete actual.dependencies;
      }
      assert.deepEqual(actual, expected, 'Unrequested stored field changed: ' + key);
    } else {
      assert.equal(row.status, 'open'); assert.equal(row.assignee, null); assert.equal(row.revision,1);
      assert.equal(row.priority,1); assert.equal(row.notes,''); assert.equal(row.manual_blocked,false);
      assert.deepEqual(row.labels,['bead-edit-20261124']);
    }
    assert.deepEqual(run(['ref','find','--namespace','bead-edit-20261124','--value',key,'--json'], 'ref-after-' + key), [id]);
  }
  const ready = run(['list','--ready','--json','--limit','1000'], 'ready');
  const keyById = new Map(Object.entries(allIds).map(([key,id]) => [id,key]));
  const result = { status:'passed',continuation_revision:5,source_store_uuid:storeUuid,original_issues:954,total_issues:986,
    tasks:allIds,new_tasks:newIds,blocking_edges:51,prior_blocking_edges_retained:34,description_updates:9,new_creates:11,dependency_additions:17,
    plan_sha256:planHash,template_sha256:templateHash,plan_review_sha256:reviewHash,manifest_sha256:manifestHash,
    binary_sha256:binaryHash,helper_sha256:hash(process.argv[1]),original_inventory_unchanged:true,existing_statuses_preserved:true,
    complete_descriptions_match:true,complete_edges_match:true,restore_replayed:false,closure_replayed:false,
    owned_ready:ready.filter(row => keyById.has(row.id)).map(row => ({key:keyById.get(row.id),id:row.id,title:row.title,revision:row.revision})),
    continuation:Object.entries(allIds).map(([key,id]) => ({key,id,status:after.get(id).status,revision:after.get(id).revision})),
    output_directory:output,temporary_directory:temp,publication:'Explicit flush and checked Git publication remain required.',
    completed_utc:new Date().toISOString() };
  write('result.json',result); writeFile(finalFile,result); console.log(JSON.stringify(result,null,2));
} catch (error) {
  const result = {status:'failed',phase,error:error?.message || String(error),commit_attempted:commitAttempted,retry_allowed:false,
    output_directory:ownedOutput ? output : null,next_action:'Read retained results and current native state before any further mutation. Never replay an uncertain commit.'};
  if (ownedOutput) { try { write('failure.json',result); } catch(saveError) { result.save_error=saveError.message; } }
  console.error(JSON.stringify(result,null,2)); process.exitCode=1;
}
