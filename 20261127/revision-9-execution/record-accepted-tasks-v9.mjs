import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// These immutable inputs identify the observed revision-9 transition. This
// runner owns only completion writes in its isolated coordination store.
export const binding = Object.freeze({
  root: 'F:/Dev/.bead-edit-20261111/coordination-20261124',
  bead: 'F:/Dev/.bead-edit-20261111/stage-v6/backend/bead-editing-539cdd0.exe',
  binary_sha256: '25a05bdfd8feaea92faf6827e9268e597d25432826f1082c7ebadc3af8658798',
  plan_sha256: '18130e44ab27047dcb397de53caa0a9006c56cfd478d417f884e42452ff62582',
  materialization_sha256: '6d1cca5e2495011ae3dac4320e622f67c6f871186ef112edd8f51f8c98d1e5b3',
  store_uuid: '1c4f5d56-dcff-cbc5-ddf9-c536653c45f4',
});

/** Hash the exact input bytes before decoding a request or native result. */
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Validate immutable plan/mapping bytes and one request before any output or
 * native command. The request author supplies current revisions and reasons;
 * this function cannot attest that their referenced work has passed review. */
export function validateBoundRequest(planBytes, mappingBytes, requestBytes, requestHash) {
  assert.match(requestHash, /^[a-f0-9]{64}$/);
  assert.equal(digest(planBytes), binding.plan_sha256, 'Accepted plan changed');
  assert.equal(digest(mappingBytes), binding.materialization_sha256, 'Actual revision-9 mapping changed');
  assert.equal(digest(requestBytes), requestHash, 'Completion request changed');
  const plan = JSON.parse(planBytes.toString('utf8'));
  const mapping = JSON.parse(mappingBytes.toString('utf8'));
  const request = JSON.parse(requestBytes.toString('utf8'));
  assert.equal(plan.continuation_revision, 9);
  assert.equal(plan.tasks.length, 55);
  assert.equal(plan.blocking_edges.length, 91);
  assert.equal(mapping.status, 'passed');
  assert.equal(mapping.continuation_revision, 9);
  assert.equal(mapping.total_issues, 1009);
  assert.equal(mapping.blocking_edges, 91);
  assert.equal(mapping.original_inventory_unchanged, true);
  assert.equal(mapping.complete_descriptions_match, true);
  assert.equal(mapping.complete_edges_match, true);
  assert.equal(mapping.source_store_uuid, binding.store_uuid);
  assert.equal(mapping.binary_sha256, binding.binary_sha256);
  assert.equal(mapping.plan_sha256, binding.plan_sha256);
  assert.equal(new Set(Object.values(mapping.tasks)).size, 55);
  assert.deepEqual(Object.keys(mapping.tasks).sort(), plan.tasks.map(task => task.key).sort());
  assert.equal(request.schema_version, 1);
  assert.equal(request.accepted_plan_sha256, binding.plan_sha256);
  assert.equal(request.materialization_sha256, binding.materialization_sha256, 'Request names another task mapping');
  assert.equal(request.root_is_sole_state_writer, true);
  assert.ok(Array.isArray(request.tasks) && request.tasks.length > 0 && request.tasks.length < 55);
  assert.equal(new Set(request.tasks.map(task => task.key)).size, request.tasks.length);
  for (const task of request.tasks) {
    assert.ok(Object.hasOwn(mapping.tasks, task.key), 'Unknown continuation task');
    assert.notEqual(task.key, 'preserve-and-clean', 'Final cleanup belongs to the original-store handoff');
    assert.ok(Number.isSafeInteger(task.revision) && task.revision > 0);
    assert.ok(typeof task.reason === 'string' && task.reason.trim().length >= 40 && task.reason.length <= 4096);
  }
  return { plan, mapping, request };
}

// Native list projections include derived dependency states. Compare saved
// values without treating another task's completion as a relationship change.
function stored(row) {
  const value = structuredClone(row);
  delete value.effective_status;
  for (const dependency of value.dependencies || []) {
    delete dependency.blocker_status;
    delete dependency.finished;
  }
  return value;
}

/** Produce revision-guarded close operations from one complete live inventory.
 * All originals, accepted descriptions, resource keys and directed edges must
 * agree before a requested task can satisfy a later task in the same request. */
export function closeOperations(before, originals, plan, mapping, request) {
  assert.equal(before.length, 1009);
  const byId = new Map(before.map(row => [row.id, row]));
  assert.equal(byId.size, 1009);
  assert.equal(originals.size, 954);
  for (const [id, row] of originals) assert.deepEqual(byId.get(id), row, 'Original record changed: ' + id);
  const expected = new Map(plan.tasks.map(task => [task.key, task]));
  const edges = [];
  for (const task of plan.tasks) {
    const id = mapping.tasks[task.key], row = byId.get(id);
    assert.ok(row, task.key);
    assert.equal(originals.has(id), false, 'Continuation overlaps an original issue');
    assert.equal(row.title, task.title, 'Task title changed: ' + task.key);
    assert.equal(row.description, task.description, 'Task description changed: ' + task.key);
    assert.deepEqual([...(row.resource_keys || [])].sort(), [...task.resource_keys].sort());
    for (const dependency of row.dependencies || []) edges.push([id, dependency.blocker, dependency.kind].join('|'));
  }
  assert.deepEqual(edges.sort(), plan.blocking_edges.map(edge => [mapping.tasks[edge.blocked], mapping.tasks[edge.blocker], 'blocks'].join('|')).sort(), 'Accepted dependency graph changed');
  const satisfied = new Set(before.filter(row => row.status === 'closed').map(row => row.id));
  return request.tasks.map(task => {
    const current = byId.get(mapping.tasks[task.key]);
    assert.equal(current.status, 'open', 'Task is no longer open: ' + task.key);
    assert.equal(current.assignee, null, 'Task has an owner: ' + task.key);
    assert.equal(current.revision, task.revision, 'Task revision changed: ' + task.key);
    for (const prerequisite of expected.get(task.key).prerequisites) {
      assert.ok(satisfied.has(mapping.tasks[prerequisite]), 'Unfinished prerequisite: ' + prerequisite);
    }
    satisfied.add(current.id);
    return { op: 'close', id: current.id, if_revision: current.revision, reason: task.reason };
  });
}

/** Run one reviewed request in the existing store. Exclusive output files and
 * commit intent records preserve uncertain results for root reconciliation.
 * The separately reviewed supervisor owns the process and memory limits. */
function main() {
  assert.equal(process.platform, 'win32');
  assert.equal(process.argv.length, 5, 'Expected request path, request SHA256 and fresh output basename');
  const [requestPath, requestHash, outputName] = process.argv.slice(2);
  assert.match(outputName, /^completed-[0-9]{8}-[a-z][a-z0-9-]{1,40}$/);
  const root = binding.root;
  const fullRequest = path.resolve(requestPath);
  assert.ok(fullRequest.startsWith(path.resolve(root) + path.sep), 'Request must stay in the coordination directory');
  // Read complete bytes so input identity is checked independently of JSON parsing.
  const hash = file => digest(fs.readFileSync(file));
  const planPath = path.join(root, 'revision-9/plan.json');
  const mappingPath = path.join(root, 'materialization-result-v9.json');
  const helperPath = fileURLToPath(import.meta.url);
  const helperHash = hash(helperPath);
  const { plan, mapping, request } = validateBoundRequest(fs.readFileSync(planPath), fs.readFileSync(mappingPath), fs.readFileSync(fullRequest), requestHash);
  assert.equal(hash(binding.bead), binding.binary_sha256);
  const inventoryPath = path.join(root, 'inventory-before-node-v3.json');
  const originals = new Map(JSON.parse(fs.readFileSync(inventoryPath, 'utf8')).map(row => [row.id, row]));
  const freezeMarker = path.join(root, 'checkpoint-authority-freeze-20261125.json');
  assert.equal(fs.existsSync(freezeMarker), false, 'Isolated task authority is frozen');
  const preserved = [inventoryPath, path.join(root, '.beads/config.json'), path.join(root, '.beads/checkpoint/current.json')].map(file => [file, hash(file)]);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (['temp', 'tmp', 'beads_repo', 'bead_workspace_root'].includes(key.toLowerCase())) delete env[key];
  env.TEMP = env.TMP = path.join(root, 'temp-materialize-v9');
  assert.ok(fs.statSync(env.TEMP).isDirectory());
  const output = path.join(root, outputName);
  fs.mkdirSync(output, { recursive: false });
  // Exclusive writes retain a prior attempt even when its native result is uncertain.
  const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

  // Each native call retains its exact output and exit. A timeout is an
  // uncertain operation, so the caller must inspect this directory to resume.
  function run(args, name) {
    const argv = [...args, '--no-auto-flush'];
    write(name + '.started.json', { utc: new Date().toISOString(), argv, replay_allowed: false });
    const result = spawnSync(binding.bead, argv, { cwd: root, env, windowsHide: true, shell: false, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, name + '.json'), result.stdout || Buffer.alloc(0), { flag: 'wx' });
    fs.writeFileSync(path.join(output, name + '.stderr.log'), result.stderr || Buffer.alloc(0), { flag: 'wx' });
    write(name + '.exit.json', { status: result.status, signal: result.signal, error: result.error?.message || null });
    assert.equal(result.error, undefined, 'Reconcile saved output before another mutation');
    assert.equal(result.status, 0, 'Reconcile saved output before another mutation');
    return JSON.parse(result.stdout.toString('utf8'));
  }
  // Re-read every file that can change the intended transaction or original-state comparison.
  function unchangedInputs() {
    assert.equal(hash(planPath), binding.plan_sha256);
    assert.equal(hash(mappingPath), binding.materialization_sha256);
    assert.equal(hash(fullRequest), requestHash);
    assert.equal(hash(helperPath), helperHash);
    assert.equal(hash(binding.bead), binding.binary_sha256);
    assert.equal(fs.existsSync(freezeMarker), false, 'Isolated task authority is frozen');
    for (const [file, expectedHash] of preserved) assert.equal(hash(file), expectedHash, 'Preserved input changed: ' + file);
  }

  write('request.json', request);
  const before = run(['list', '--all', '--json'], 'before');
  const operations = closeOperations(before, originals, plan, mapping, request);
  const byId = new Map(before.map(row => [row.id, row]));
  write('manifest.json', { manifest_version: 1, operations });
  const manifest = path.join(output, 'manifest.json'), manifestHash = hash(manifest);
  const dry = run(['manifest', 'dry-run', '--input', manifest, '--format', 'json'], 'dry-run');
  assert.equal(dry.operations, operations.length); assert.equal(dry.semantic_changes, operations.length); assert.equal(dry.dry_run, true);
  assert.deepEqual(run(['list', '--all', '--json'], 'precommit'), before, 'State changed during dry-run');
  unchangedInputs(); assert.equal(hash(manifest), manifestHash);
  write('commit-started.json', { utc: new Date().toISOString(), manifest_sha256: manifestHash, operations: operations.length, request_sha256: requestHash, replay_allowed: false });
  const commit = run(['manifest', 'commit', '--input', manifest, '--format', 'json'], 'commit');
  assert.equal(commit.committed, true); assert.equal(commit.operations, operations.length); assert.equal(commit.semantic_changes, operations.length);
  const after = run(['list', '--all', '--json'], 'after');
  assert.equal(after.length, 1009);
  assert.equal(new Set(after.map(row => row.id)).size, 1009);
  const closed = new Set(operations.map(operation => operation.id));
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
  unchangedInputs();
  const own = new Set(Object.values(mapping.tasks));
  const result = { status: 'passed', continuation_revision: 9, closed: Object.fromEntries(request.tasks.map(task => [task.key, mapping.tasks[task.key]])),
    original_954_unchanged: true, other_stored_fields_unchanged: true,
    owned_ready: ready.filter(row => own.has(row.id)).map(row => ({ id: row.id, title: row.title, revision: row.revision })),
    continuation: after.filter(row => own.has(row.id)).map(row => ({ id: row.id, status: row.status, revision: row.revision })),
    request_sha256: requestHash, materialization_sha256: binding.materialization_sha256, plan_sha256: binding.plan_sha256,
    helper_sha256: helperHash, config_and_checkpoint_pointer_unchanged: true,
    checkpoint_publication: 'Explicit flush and checked publication remain required.' };
  write('result.json', result);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
