import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Root runs these exact independently reviewed bytes once. This helper changes
// only the accepted native task graph; it never executes product checks.
const cwd = 'F:/Dev/.bead-edit-20261111/coordination-20261124';
const bead = 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe';
const inputDirectory = path.join(cwd, 'revision-4');
const outputDirectory = path.join(cwd, 'materialization-v4');
const temporaryDirectory = path.join(cwd, 'temp-materialize-v4');
const finalResultPath = path.join(cwd, 'materialization-result-v4.json');
const expectedBinaryHash = '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798';
const expectedPlanHash = '887b5036b9b1f588baaeb9a0fd9537c030e661b80325bd871b6c8b97bfbae178';
const expectedTemplateHash = '6217b3df27ad05f23e370ba1211850d946c254cd6eb97796f1170750e41fd3f1';
const expectedReviewHash = 'e3b10fa4afbed9000b3977478615c9e0b96b272dfbde2996087352c7f93f7664';
const expectedV3ManifestHash = 'ea1f4c44703ee5b9fc4f3ccd62ef78bac557299046ea81cc2a520358b8dd6aed';
const expectedStore = '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4';
const closedKeys = ['plan-review', 'reconcile', 'cloud-checks', 'browser-prepare', 'browser-runner-review', 'tray-diagnose'];
const expectedNewKeys = ['tray-repair', 'tray-repair-checks', 'installer-repair', 'tray-repair-review'];
const expectedChangedKeys = ['windows-tray', 'candidate-review', 'install', 'configured-launch', 'app-handoff', 'app-text-review', 'preserve-and-clean'];
const inputHashes = new Map();
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = file => hashBytes(fs.readFileSync(file));
const same = (actual, expected, message) => assert.ok(isDeepStrictEqual(actual, expected), message);
const writeJsonPath = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const writeJson = (name, value) => writeJsonPath(path.join(outputDirectory, name), value);
let phase = 'input-preflight';
let ownOutputDirectory = false;
let commitAttempted = false;
let env;
let started;
const deadline = Date.now() + 180000;

function input(file, expectedHash) {
  const bytes = fs.readFileSync(file);
  const digest = hashBytes(bytes);
  if (expectedHash) assert.equal(digest, expectedHash, 'Input hash differs: ' + file);
  inputHashes.set(file, digest);
  return JSON.parse(bytes.toString('utf8'));
}

function inventoryMap(rows, count, name) {
  assert.ok(Array.isArray(rows), name + ' must be an array');
  assert.equal(rows.length, count, name + ' must be complete');
  const byId = new Map(rows.map(row => [row.id, row]));
  assert.equal(byId.size, count, name + ' has duplicate IDs');
  for (const row of rows) {
    assert.ok(typeof row.id === 'string' && row.id.length > 0, name + ' contains an invalid ID');
    assert.ok(Number.isSafeInteger(row.revision) && row.revision > 0, 'Invalid native revision: ' + row.id);
  }
  return byId;
}

// Remove only the three read-time derived fields. Every other unknown field
// remains in comparisons, including notes, claims, attempts and extra data.
function storedProjection(row) {
  const value = structuredClone(row);
  delete value.effective_status;
  if (Array.isArray(value.dependencies)) {
    for (const dependency of value.dependencies) {
      delete dependency.blocker_status;
      delete dependency.finished;
    }
  }
  return value;
}

function checkOriginals(byId, originals, where) {
  for (const [id, original] of originals) {
    same(byId.get(id), original, 'Original record differs ' + where + ': ' + id);
  }
}

function edgesOf(byId, ids) {
  const edges = [];
  for (const id of Object.values(ids)) {
    assert.ok(byId.has(id), 'Missing continuation record: ' + id);
    const dependencies = storedProjection(byId.get(id)).dependencies || [];
    for (const dependency of dependencies) {
      same(Object.keys(dependency).sort(), ['blocker', 'kind'], 'Unexpected dependency field: ' + id);
      assert.equal(dependency.kind, 'blocks', 'Unexpected continuation dependency kind: ' + id);
      edges.push([id, dependency.blocker, dependency.kind].join('|'));
    }
  }
  assert.equal(new Set(edges).size, edges.length, 'Duplicate continuation dependencies');
  return edges.sort();
}

function run(args, name) {
  const remaining = deadline - Date.now();
  assert.ok(remaining >= 1000, 'Materialization deadline reached before ' + name);
  const result = spawnSync(bead, args, {
    cwd, env, windowsHide: true, shell: false,
    timeout: Math.min(30000, remaining), maxBuffer: 16 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(outputDirectory, name + '.json'), result.stdout || Buffer.alloc(0), { flag: 'wx' });
  fs.writeFileSync(path.join(outputDirectory, name + '.stderr.log'), result.stderr || Buffer.alloc(0), { flag: 'wx' });
  writeJson(name + '.exit.json', {
    status: result.status, signal: result.signal, error: result.error?.message || null,
  });
  assert.equal(result.error, undefined, name + ' process error; reconcile saved output before retry');
  assert.equal(result.status, 0, name + ' failed; reconcile saved output before retry');
  return JSON.parse(result.stdout.toString('utf8'));
}

function assertInputHashes() {
  assert.equal(hash(bead), expectedBinaryHash, 'Native executable changed');
  for (const [file, expected] of inputHashes) assert.equal(hash(file), expected, 'Input changed: ' + file);
}

function reconcileClosures(ids, originals, oldCreates, v3After) {
  const directory = path.join(cwd, 'completed-v1');
  const before = inventoryMap(input(path.join(directory, 'before.json')), 971, 'Six-close before inventory');
  const after = inventoryMap(input(path.join(directory, 'after.json')), 971, 'Six-close after inventory');
  const manifest = input(path.join(directory, 'manifest.json'));
  const start = input(path.join(directory, 'commit-started.json'));
  const commit = input(path.join(directory, 'commit.json'));
  const exit = input(path.join(directory, 'commit.exit.json'));
  assert.equal(exit.status, 0, 'The retained six-close native command did not exit successfully');
  assert.equal(exit.error, null);
  assert.equal(start.operations, 6);
  assert.equal(start.manifest_sha256, inputHashes.get(path.join(directory, 'manifest.json')));
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.operations.length, 6);
  assert.equal(commit.manifest_version, 1);
  assert.equal(commit.committed, true);
  assert.equal(commit.dry_run, false);
  assert.equal(commit.operations, 6);
  assert.equal(commit.semantic_changes, 6);
  assert.equal(commit.results.length, 6);
  const closedIds = new Set(closedKeys.map(key => ids[key]));
  same(manifest.operations.map(op => op.id).sort(), [...closedIds].sort(), 'Unexpected six-close IDs');
  same(commit.results.map(op => op.id).sort(), [...closedIds].sort(), 'Unexpected committed closure IDs');
  for (const operation of manifest.operations) {
    same(Object.keys(operation).sort(), ['id', 'if_revision', 'op', 'reason'], 'Unexpected six-close field');
    assert.equal(operation.op, 'close');
    assert.ok(typeof operation.reason === 'string' && operation.reason.trim().length > 0);
    const old = before.get(operation.id);
    const current = after.get(operation.id);
    assert.ok(old && current, 'Missing saved closure record');
    assert.equal(old.status, 'open');
    assert.equal(old.assignee, null);
    assert.equal(operation.if_revision, old.revision);
    assert.equal(current.status, 'closed');
    assert.equal(current.revision, old.revision + 1);
    const result = commit.results.find(item => item.id === operation.id);
    assert.equal(result.op, 'close');
    assert.equal(result.outcome, 'closed');
    assert.equal(result.semantic_change, true);
    same(result.changes.base_status, { before: 'open', after: 'closed' }, 'Closure status change differs');
    same(result.changes.revision, { before: old.revision, after: current.revision }, 'Closure revision differs');
    same(result.changes.close_reason, { before: null, after: operation.reason }, 'Closure reason differs');
    same(Object.keys(result.changes).sort(), ['base_status', 'close_reason', 'revision'], 'Unexpected committed closure change');
    const expected = storedProjection(old);
    expected.status = 'closed';
    expected.revision = old.revision + 1;
    assert.ok(typeof current.updated_at === 'string' && current.updated_at.length > 0);
    expected.updated_at = current.updated_at;
    same(storedProjection(current), expected, 'Unexpected saved closure field change: ' + old.id);
  }
  checkOriginals(v3After, originals, 'after v3 materialization');
  checkOriginals(before, originals, 'before six closes');
  checkOriginals(after, originals, 'after six closes');
  for (const [key, id] of Object.entries(ids)) {
    assert.ok(before.has(id) && after.has(id) && v3After.has(id), 'Missing old task: ' + key);
    const expected = oldCreates.get(key);
    for (const row of [before.get(id), after.get(id), v3After.get(id)]) {
      assert.ok(row.title === expected.title && row.description === expected.description, 'Old task text changed: ' + key);
      same([...(row.resource_keys || [])].sort(), [...expected.resource_keys].sort(), 'Old resource keys changed: ' + key);
    }
    if (!closedIds.has(id)) {
      same(storedProjection(after.get(id)), storedProjection(before.get(id)), 'Unrelated continuation changed during six closes: ' + key);
    }
  }
  return {
    rows: new Map(Object.values(ids).map(id => [id, after.get(id)])),
    report: {
      status: 'passed', committed_closures: Object.fromEntries(closedKeys.map(key => [key, ids[key]])),
      semantic_changes: 6, closure_replayed: false,
      original_records_unchanged: true,
      comparison_normalization: ['effective_status', 'dependencies[].blocker_status', 'dependencies[].finished'],
      retained_commit_path: path.join(directory, 'commit.json'),
      retained_manifest_sha256: start.manifest_sha256,
      explanation: 'The earlier helper stopped during its post-commit comparison of derived dependency status. The six native closes committed successfully and are retained.',
    },
  };
}

function verifyManifestReport(report, isCommit, rendered, ids) {
  assert.equal(report.manifest_version, 1);
  assert.equal(report.committed, isCommit);
  assert.equal(report.dry_run, !isCommit);
  assert.equal(report.operations, 19);
  assert.equal(report.semantic_changes, 19);
  assert.equal(report.results.length, 19);
  const newIds = {};
  for (let index = 0; index < rendered.operations.length; index++) {
    const operation = rendered.operations[index];
    const result = report.results[index];
    assert.equal(result.index, index);
    assert.equal(result.op, operation.op);
    assert.equal(result.semantic_change, true, 'A fresh delta operation became a no-op');
    if (operation.op === 'create') {
      assert.equal(result.outcome, 'created');
      assert.equal(result.local_id, operation.local_id);
      assert.ok(typeof result.issue_id === 'string' && result.issue_id.length > 0);
      assert.ok(!Object.values(ids).includes(result.issue_id), 'A new task reused an old ID');
      newIds[operation.local_id] = result.issue_id;
      assert.equal(result.issue.id, result.issue_id);
      assert.equal(result.issue.issue_type, 'task');
      assert.equal(result.issue.base_status, 'open');
    } else if (operation.op === 'update') {
      assert.equal(result.outcome, 'updated');
      assert.equal(result.id, operation.id);
      same(Object.keys(result.changes).sort(), ['description', 'revision'], 'Unexpected native update result');
      same(result.changes.revision, { before: operation.if_revision, after: operation.if_revision + 1 }, 'Update revision differs');
      assert.ok(result.changes.description.after === operation.description, 'Native update returned a different description');
    } else {
      assert.equal(result.outcome, 'added');
      const resolve = value => value.startsWith('$') ? newIds[value.slice(1)] : value;
      assert.equal(result.blocked, resolve(operation.blocked));
      assert.equal(result.blocker, resolve(operation.blocker));
      assert.equal(result.kind, 'blocks');
    }
  }
  same(Object.keys(newIds).sort(), [...expectedNewKeys].sort(), 'New task key mapping differs');
  assert.equal(new Set(Object.values(newIds)).size, 4);
  return newIds;
}

try {
  assert.equal(process.platform, 'win32');
  assert.equal(hash(bead), expectedBinaryHash);
  const plan = input(path.join(inputDirectory, 'plan.json'), expectedPlanHash);
  const template = input(path.join(inputDirectory, 'delta-manifest.template.json'), expectedTemplateHash);
  const review = input(path.join(inputDirectory, 'plan-review.json'), expectedReviewHash);
  assert.equal(review.status, 'PASS');
  assert.equal(review.accepted, true);
  assert.equal(review.continuation_revision, 4);
  assert.equal(review.read_complete_plan, true);
  assert.equal(review.expanded_tasks_read, 21);
  assert.equal(review.blocking_edges_read, 34);
  assert.equal(review.reviewed_files['plan.json'], expectedPlanHash);
  assert.equal(review.reviewed_files['delta-manifest.template.json'], expectedTemplateHash);
  const oldManifest = input(path.join(cwd, 'manifest-v3.json'), expectedV3ManifestHash);
  const oldResult = input(path.join(cwd, 'materialization-result-v3.json'));
  const restore = input(path.join(cwd, 'restore-v3.json'));
  assert.equal(oldResult.status, 'passed');
  assert.equal(oldResult.original_inventory_unchanged, true);
  assert.equal(oldResult.manifest_sha256, expectedV3ManifestHash);
  assert.equal(oldResult.binary_sha256, expectedBinaryHash);
  assert.equal(oldResult.source_store_uuid, expectedStore);
  assert.equal(oldResult.total_issues, 971);
  assert.equal(restore.target_store_uuid, expectedStore);
  assert.equal(restore.local_recovery_succeeded, true);
  assert.equal(restore.secret_quarantined, false);
  assert.equal(restore.non_empty_override, false);
  assert.equal(restore.generation_id, 'gen-a569f746bbb268015d996c8ed4c76f57');
  assert.equal(restore.issues_restored, 954);
  assert.equal(restore.events_restored, 11264);
  const ids = plan.revision_4.base_task_ids;
  same(ids, oldResult.tasks, 'Accepted actual 17-ID mapping differs');
  assert.equal(Object.keys(ids).length, 17);
  assert.equal(new Set(Object.values(ids)).size, 17);
  same(plan.revision_4.new_task_keys, expectedNewKeys, 'New task keys differ');
  same(plan.revision_4.changed_existing_task_keys, expectedChangedKeys, 'Changed task keys differ');
  assert.equal(plan.tasks.length, 21);
  assert.equal(plan.blocking_edges.length, 34);
  const planned = new Map(plan.tasks.map(task => [task.key, task]));
  const oldCreates = new Map(oldManifest.operations.filter(op => op.op === 'create').map(op => [op.local_id, op]));
  assert.equal(oldCreates.size, 17);
  assert.equal(template.manifest_version, 1);
  assert.equal(template.operations.length, 19);
  same(template.operations.filter(op => op.op === 'create').map(op => op.local_id), expectedNewKeys, 'Only four new creates are allowed');
  same(template.operations.filter(op => op.op === 'update').map(op => op.id), expectedChangedKeys.map(key => ids[key]), 'Guarded old IDs differ');
  assert.equal(template.operations.filter(op => op.op === 'dep_add').length, 8);
  assert.ok(template.operations.every(op => ['create', 'update', 'dep_add'].includes(op.op)), 'Unexpected mutation type');
  for (const operation of template.operations) {
    if (operation.op === 'create') {
      assert.equal(operation.unique_ref, 'bead-edit-20261124:' + operation.local_id);
      assert.equal(operation.description, planned.get(operation.local_id).description);
    } else if (operation.op === 'update') {
      same(Object.keys(operation).sort(), ['description', 'id', 'if_revision', 'op'], 'Only guarded descriptions may change');
      const key = expectedChangedKeys.find(key => ids[key] === operation.id);
      assert.equal(operation.if_revision, '@revision:' + key);
      assert.equal(operation.description, planned.get(key).description);
    }
  }
  for (const file of [outputDirectory, temporaryDirectory, finalResultPath, path.join(cwd, 'materialization-started-v4.json'), path.join(cwd, 'manifest-commit-node-v4.json')]) {
    assert.equal(fs.existsSync(file), false, 'Reconcile the prior v4 attempt before any retry: ' + file);
  }
  const originals = inventoryMap(input(path.join(cwd, 'inventory-before-node-v3.json')), 954, 'Original pre-v3 inventory');
  const closure = reconcileClosures(ids, originals, oldCreates,
    inventoryMap(input(path.join(cwd, 'inventory-after-node-v3.json')), 971, 'Post-v3 inventory'));
  fs.mkdirSync(outputDirectory, { recursive: false });
  ownOutputDirectory = true;
  fs.mkdirSync(temporaryDirectory, { recursive: false });
  env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  }
  env.TEMP = temporaryDirectory;
  env.TMP = temporaryDirectory;
  started = {
    status: 'started', started_utc: new Date().toISOString(), process_id: process.pid,
    helper_sha256: hash(fileURLToPath(import.meta.url)), plan_sha256: expectedPlanHash,
    template_sha256: expectedTemplateHash, review_sha256: expectedReviewHash,
    binary_sha256: expectedBinaryHash, temporary_directory: temporaryDirectory,
    whole_helper_deadline_seconds: 180, per_native_command_max_seconds: 30,
    restore_replayed: false, closure_replayed: false,
  };
  writeJson('started.json', started);
  phase = 'fresh-current-reconciliation';
  const before = inventoryMap(run(['list', '--all', '--json'], 'inventory-before'), 971, 'Fresh before inventory');
  checkOriginals(before, originals, 'before v4 delta');
  for (const [key, id] of Object.entries(ids)) {
    const current = before.get(id);
    assert.ok(current, 'Missing existing ID: ' + key);
    same(storedProjection(current), storedProjection(closure.rows.get(id)), 'Current task differs from saved six-close result: ' + key);
    const old = oldCreates.get(key);
    assert.ok(current.title === old.title && current.description === old.description, 'Live old text differs: ' + key);
    same([...(current.resource_keys || [])].sort(), [...old.resource_keys].sort(), 'Live resource keys differ: ' + key);
    if (expectedChangedKeys.includes(key)) {
      assert.equal(current.status, 'open', 'Changed task must remain open: ' + key);
      assert.equal(current.assignee, null, 'Changed task must remain unassigned: ' + key);
    }
  }
  for (const key of closedKeys) assert.equal(before.get(ids[key]).status, 'closed', 'Completed task reopened: ' + key);
  const resolveOld = value => value.startsWith('$') ? ids[value.slice(1)] : value;
  const oldEdges = oldManifest.operations.filter(op => op.op === 'dep_add')
    .map(op => [resolveOld(op.blocked), resolveOld(op.blocker), op.kind].join('|')).sort();
  assert.equal(oldEdges.length, 26);
  same(edgesOf(before, ids), oldEdges, 'Existing 26 blocking edges differ');
  writeJson('six-close-reconciliation.json', closure.report);
  const beforeRefs = {};
  for (const [key, id] of Object.entries(ids)) {
    const matches = run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-before-' + key);
    same(matches, [id], 'Existing unique reference differs: ' + key);
    beforeRefs[key] = matches;
  }
  for (const key of expectedNewKeys) {
    const matches = run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-before-' + key);
    same(matches, [], 'New unique reference already exists; reconcile instead of replaying: ' + key);
    beforeRefs[key] = matches;
  }
  phase = 'bind-and-dry-run';
  const rendered = structuredClone(template);
  for (const operation of rendered.operations) {
    if (operation.op === 'update') operation.if_revision = before.get(operation.id).revision;
  }
  assert.ok(!JSON.stringify(rendered).includes('"@revision:'), 'Unresolved revision marker');
  const manifestPath = path.join(outputDirectory, 'bound-manifest.json');
  writeJson('bound-manifest.json', rendered);
  const renderedHash = hash(manifestPath);
  writeJson('bindings.json', {
    store_uuid: expectedStore, inventory_sha256: hash(path.join(outputDirectory, 'inventory-before.json')),
    tasks: Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, {
      id, revision: before.get(id).revision, status: before.get(id).status,
      description_sha256: hashBytes(Buffer.from(before.get(id).description)), ref_matches: beforeRefs[key],
    }])), new_references: Object.fromEntries(expectedNewKeys.map(key => [key, beforeRefs[key]])),
    manifest_sha256: renderedHash, input_hashes: Object.fromEntries(inputHashes),
  });
  const dry = run(['manifest', 'dry-run', '--input', manifestPath, '--format', 'json'], 'manifest-dry-run');
  verifyManifestReport(dry, false, rendered, ids);
  const precommit = inventoryMap(run(['list', '--all', '--json'], 'inventory-precommit'), 971, 'After-dry-run inventory');
  for (const [id, old] of before) same(precommit.get(id), old, 'State changed during dry-run/preflight: ' + id);
  assertInputHashes();
  assert.equal(hash(manifestPath), renderedHash, 'Bound manifest changed');
  phase = 'native-commit';
  writeJson('commit-started.json', { utc: new Date().toISOString(), operations: 19, manifest_sha256: renderedHash, retry_allowed: false });
  commitAttempted = true;
  const commit = run(['manifest', 'commit', '--input', manifestPath, '--format', 'json', '--no-auto-flush'], 'manifest-commit');
  const newIds = verifyManifestReport(commit, true, rendered, ids);
  const allIds = { ...ids, ...newIds };
  phase = 'full-post-commit-readback';
  const after = inventoryMap(run(['list', '--all', '--json'], 'inventory-after'), 975, 'Final full inventory');
  checkOriginals(after, originals, 'after v4 delta');
  const expectedEdges = plan.blocking_edges.map(edge => [allIds[edge.blocked], allIds[edge.blocker], 'blocks'].join('|')).sort();
  assert.equal(expectedEdges.length, 34);
  same(edgesOf(after, allIds), expectedEdges, 'Final complete 34-edge graph differs');
  for (const [key, id] of Object.entries(allIds)) {
    const actual = after.get(id);
    const task = planned.get(key);
    assert.ok(actual.title === task.title && actual.description === task.description, 'Final expanded text differs: ' + key);
    same([...(actual.resource_keys || [])].sort(), [...task.resource_keys].sort(), 'Final resources differ: ' + key);
    if (Object.hasOwn(ids, key)) {
      const old = before.get(id);
      assert.equal(actual.status, old.status, 'Existing status changed: ' + key);
      if (expectedChangedKeys.includes(key)) {
        const expected = storedProjection(old);
        const projected = storedProjection(actual);
        expected.description = task.description;
        expected.revision = old.revision + 1;
        assert.ok(typeof actual.updated_at === 'string' && actual.updated_at.length > 0);
        expected.updated_at = actual.updated_at;
        // The complete dependency collection was compared immediately above.
        delete expected.dependencies;
        delete projected.dependencies;
        same(projected, expected, 'Unrequested existing field changed: ' + key);
      } else {
        same(storedProjection(actual), storedProjection(old), 'Unchanged old task differs: ' + key);
      }
    } else {
      const create = template.operations.find(op => op.op === 'create' && op.local_id === key);
      assert.equal(actual.status, 'open');
      assert.equal(actual.assignee, null);
      assert.equal(actual.priority, create.priority);
      assert.equal(actual.revision, 1);
      assert.equal(actual.notes, '');
      assert.equal(actual.manual_blocked, false);
      same(actual.labels, create.labels, 'New task labels differ: ' + key);
    }
  }
  const afterRefs = {};
  for (const [key, id] of Object.entries(allIds)) {
    const matches = run(['ref', 'find', '--namespace', 'bead-edit-20261124', '--value', key, '--json'], 'ref-after-' + key);
    same(matches, [id], 'Final unique reference differs: ' + key);
    afterRefs[key] = matches;
  }
  const ready = run(['list', '--ready', '--json', '--limit', '1000'], 'ready');
  assert.ok(Array.isArray(ready));
  const keyById = new Map(Object.entries(allIds).map(([key, id]) => [id, key]));
  const report = {
    status: 'passed', continuation_revision: 4, original_issues: 954,
    total_issues: after.size, tasks: allIds, new_tasks: newIds,
    blocking_edges: 34, prior_blocking_edges_retained: 26,
    description_updates: 7, new_creates: 4, dependency_additions: 8,
    source_store_uuid: expectedStore, reused_restore_receipt_id: restore.restore_receipt_id,
    plan_sha256: expectedPlanHash, template_sha256: expectedTemplateHash,
    plan_review_sha256: expectedReviewHash, manifest_sha256: renderedHash,
    binary_sha256: expectedBinaryHash, helper_sha256: started.helper_sha256,
    six_close_reconciliation: closure.report,
    original_inventory_unchanged: true, existing_statuses_preserved: true,
    complete_descriptions_match: true, complete_edges_match: true,
    current_reference_matches: afterRefs,
    owned_ready: ready.filter(row => keyById.has(row.id)).map(row => ({
      key: keyById.get(row.id), id: row.id, title: row.title, revision: row.revision,
    })),
    readiness_statement: 'The ready list is filtered to these 21 continuation tasks; it is not a global completion claim.',
    continuation: Object.entries(allIds).map(([key, id]) => ({ key, id, status: after.get(id).status, revision: after.get(id).revision })),
    output_directory: outputDirectory, temporary_directory: temporaryDirectory,
    temporary_directory_retained: true, restore_replayed: false, closure_replayed: false,
    publication: 'Only this commit used --no-auto-flush. Explicit checkpoint flush and checked Git publication remain required; host settings were not changed.',
    completed_utc: new Date().toISOString(),
  };
  writeJson('result.json', report);
  writeJsonPath(finalResultPath, report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const failure = {
    status: 'failed', phase, error: error?.message || String(error),
    commit_attempted: commitAttempted, retry_allowed: false,
    output_directory: ownOutputDirectory ? outputDirectory : null,
    restore_replayed: false, closure_replayed: false,
    next_action: 'Read retained outputs and current native state before another mutation. Never replay the successful six closes or an uncertain revision-4 commit.',
  };
  if (ownOutputDirectory) {
    try { writeJson('failure.json', failure); } catch (saveError) { failure.failure_record_error = saveError.message; }
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
