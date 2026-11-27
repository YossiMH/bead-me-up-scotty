import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { binding, digest, validateBoundRequest, closeOperations } from './record-accepted-tasks-v9.mjs';

// Supply the retained accepted plan and actual mapping explicitly. Tests create
// synthetic original rows in memory and never invoke a native process or store.
function readInput(variable) {
  assert.ok(process.env[variable] && path.isAbsolute(process.env[variable]), 'Set absolute ' + variable);
  return fs.readFileSync(process.env[variable]);
}
const planBytes = readInput('BEAD_COMPLETION_PLAN_PATH');
const mappingBytes = readInput('BEAD_COMPLETION_MAPPING_PATH');
const requestBytes = fs.readFileSync(new URL('./close-accepted-cloud-20261127.json', import.meta.url));
const requestHash = digest(requestBytes);
const { plan, mapping, request } = validateBoundRequest(planBytes, mappingBytes, requestBytes, requestHash);
const live = new Map(mapping.continuation.map(row => [row.id, row]));

function validateRequest(changed) {
  const bytes = Buffer.from(JSON.stringify(changed));
  return validateBoundRequest(planBytes, mappingBytes, bytes, digest(bytes));
}

function fixture() {
  const originalRows = Array.from({ length: 954 }, (_, index) => ({
    id: 'original-' + index, title: 'Unrelated original ' + index,
    description: 'Keep every original value.', status: 'open', revision: 1,
    dependencies: [], resource_keys: [], assignee: null,
  }));
  const ownRows = plan.tasks.map(task => ({
    id: mapping.tasks[task.key], title: task.title, description: task.description,
    resource_keys: structuredClone(task.resource_keys),
    dependencies: plan.blocking_edges.filter(edge => edge.blocked === task.key)
      .map(edge => ({ blocker: mapping.tasks[edge.blocker], kind: 'blocks' })),
    status: live.get(mapping.tasks[task.key]).status,
    revision: live.get(mapping.tasks[task.key]).revision, assignee: null,
  }));
  return { before: [...structuredClone(originalRows), ...ownRows], originals: new Map(originalRows.map(row => [row.id, row])) };
}

function taskRow(before, key = request.tasks[0].key) {
  return before.find(row => row.id === mapping.tasks[key]);
}

test('the actual mapping produces exactly the 27 dependency-ordered cloud closes', () => {
  const { before, originals } = fixture();
  const operations = closeOperations(before, originals, plan, mapping, request);
  assert.equal(operations.length, 27);
  assert.deepEqual(operations, request.tasks.map(task => ({
    op: 'close', id: mapping.tasks[task.key], if_revision: live.get(mapping.tasks[task.key]).revision, reason: task.reason,
  })));
  for (const key of ['windows-tray', 'tray-repair-review', 'candidate-review', 'type-install-binding', 'type-install-binding-review', 'install', 'preserve-and-clean']) {
    assert.equal(request.tasks.some(task => task.key === key), false, key + ' is still pending');
  }
});

test('a different mapping is refused even when its JSON contents are equivalent', () => {
  assert.throws(() => validateBoundRequest(planBytes, Buffer.concat([mappingBytes, Buffer.from('\n')]), requestBytes, requestHash), /Actual revision-9 mapping changed/);
});

test('a request naming another mapping is refused even with its correct request hash', () => {
  const altered = structuredClone(request);
  altered.materialization_sha256 = '0'.repeat(64);
  assert.throws(() => validateRequest(altered), /Request names another task mapping/);
  delete altered.materialization_sha256;
  assert.throws(() => validateRequest(altered), /Request names another task mapping/);
});

test('changed plan or request bytes are refused before their JSON is used', () => {
  assert.throws(() => validateBoundRequest(Buffer.concat([planBytes, Buffer.from('\n')]), mappingBytes, requestBytes, requestHash), /Accepted plan changed/);
  assert.throws(() => validateBoundRequest(planBytes, mappingBytes, Buffer.concat([requestBytes, Buffer.from('\n')]), requestHash), /Completion request changed/);
  const altered = structuredClone(request);
  altered.accepted_plan_sha256 = '0'.repeat(64);
  assert.throws(() => validateRequest(altered));
});

test('invalid task selections and completion metadata are refused', () => {
  const changes = [
    value => value.tasks.push(structuredClone(value.tasks[0])),
    value => { value.tasks[0].key = 'unrecognized-task'; },
    value => { value.tasks[0].key = 'preserve-and-clean'; },
    value => { value.tasks[0].revision = 1.5; },
    value => { value.tasks[0].reason = 'Too short'; },
    value => { value.root_is_sole_state_writer = false; },
  ];
  for (const change of changes) {
    const altered = structuredClone(request);
    change(altered);
    assert.throws(() => validateRequest(altered));
  }
});

test('a live revision change refuses the whole request', () => {
  const { before, originals } = fixture();
  taskRow(before).revision += 1;
  assert.throws(() => closeOperations(before, originals, plan, mapping, request), /Task revision changed/);
});

test('a task already closed refuses replay', () => {
  const { before, originals } = fixture();
  taskRow(before).status = 'closed';
  assert.throws(() => closeOperations(before, originals, plan, mapping, request), /Task is no longer open/);
});

test('an acquired claim refuses unassigned completion', () => {
  const { before, originals } = fixture();
  taskRow(before).assignee = 'another-worker';
  assert.throws(() => closeOperations(before, originals, plan, mapping, request), /Task has an owner/);
});

test('a request cannot close a task before an unfinished prerequisite', () => {
  const { before, originals } = fixture();
  const altered = structuredClone(request);
  const index = altered.tasks.findIndex(task => task.key === 'type-backend-change');
  altered.tasks.unshift(...altered.tasks.splice(index, 1));
  assert.throws(() => closeOperations(before, originals, plan, mapping, altered), /Unfinished prerequisite/);
});

test('an original issue change or incomplete inventory refuses every close', () => {
  const { before, originals } = fixture();
  before[0].title = 'Changed original';
  assert.throws(() => closeOperations(before, originals, plan, mapping, request), /Original record changed/);
  const complete = fixture();
  complete.before.pop();
  assert.throws(() => closeOperations(complete.before, complete.originals, plan, mapping, request));
});

test('a changed dependency kind or missing edge refuses every close', () => {
  for (const change of [row => { row.dependencies[0].kind = 'related'; }, row => { row.dependencies.pop(); }]) {
    const { before, originals } = fixture();
    change(taskRow(before, 'type-backend-change'));
    assert.throws(() => closeOperations(before, originals, plan, mapping, request), /Accepted dependency graph changed/);
  }
});

test('changed descriptions, titles or resource keys refuse every close', () => {
  for (const field of ['description', 'title', 'resource_keys']) {
    const { before, originals } = fixture();
    taskRow(before)[field] = field === 'resource_keys' ? ['different-resource'] : 'Changed task';
    assert.throws(() => closeOperations(before, originals, plan, mapping, request));
  }
});

test('successful and refused inspections leave every input value unchanged', () => {
  const { before, originals } = fixture();
  const snapshot = JSON.stringify({ before, originals: [...originals], plan, mapping, request });
  closeOperations(before, originals, plan, mapping, request);
  const altered = structuredClone(request);
  altered.tasks[0].revision += 1;
  assert.throws(() => closeOperations(before, originals, plan, mapping, altered));
  assert.equal(JSON.stringify({ before, originals: [...originals], plan, mapping, request }), snapshot);
  assert.equal(digest(planBytes), binding.plan_sha256);
  assert.equal(digest(mappingBytes), binding.materialization_sha256);
  assert.equal(digest(requestBytes), requestHash);
});
