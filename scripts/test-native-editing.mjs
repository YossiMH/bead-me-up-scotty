// Subprocess and HTTP doubles exercise the production adapter, routes and hooks.
// Persisted native edits are checked separately by test-backend-integration.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { editingNativeCapabilities, nativeCapabilities, nativeIssue, nativeMetadata } from './fixtures/native-contract.mjs';
import { storeHarness, writes } from './support/store-harness.mjs';
import { sourceLoader } from './support/load-source-module.mjs';

/** Supply explicit before/after documents without implementing a substitute native database. */
function editingHarness({ before = nativeIssue('work-a'), after = before, reply } = {}) {
  let current = before;
  return storeHarness({ backend: 'bead-rs', issues: [before], reply: async (call, calls) => {
    const supplied = await reply?.(call, calls);
    if (supplied !== undefined) return supplied;
    const { args } = call;
    if (args[0] === 'capabilities') return editingNativeCapabilities;
    if (args[0] === 'update') { current = after; return {}; }
    if (args[0] === 'show') return current;
    if (args[0] === 'list') return [current];
    if (args[0] === 'query') return [nativeMetadata(current.id, { IssueType: current.issue_type || 'task' })];
  } });
}

function optionValue(args, name) {
  const equal = args.find(argument => argument.startsWith(`${name}=`));
  if (equal !== undefined) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

test('editing capabilities enable only the declared native scalar fields', async () => {
  const store = await editingHarness().getStore();
  assert.deepEqual([...store.capabilities.editableFields].sort(),
    ['assignee', 'description', 'issue_type', 'notes', 'priority', 'status', 'title']);
  assert.equal(store.capabilities.editableFields.includes('labels'), false);
  assert.equal(store.capabilities.editableFields.includes('parent'), false);
});

test('an older native executable keeps its existing controls and rejects edits before writes', async () => {
  const harness = editingHarness({ reply: ({ args }) => args[0] === 'capabilities' ? nativeCapabilities : undefined });
  const store = await harness.getStore();
  assert.deepEqual([...store.capabilities.editableFields].sort(), ['assignee', 'status']);
  for (const patch of [{ title: 'Changed' }, { notes: 'Notes' }, { issue_type: 'review_check' }]) {
    await assert.rejects(() => store.update('work-a', patch, harness.actor), error => error.code === 'unsupported_operation');
  }
  assert.equal(writes(harness.calls).length, 0);
});

test('partial native editing declarations do not grant undeclared fields', async () => {
  const capabilities = { ...editingNativeCapabilities,
    issue_editing: { ...editingNativeCapabilities.issue_editing, fields: ['title', 'status', 'assignee'] } };
  const harness = editingHarness({ reply: ({ args }) => args[0] === 'capabilities' ? capabilities : undefined });
  const store = await harness.getStore();
  assert.deepEqual([...store.capabilities.editableFields].sort(), ['assignee', 'status', 'title']);
  await assert.rejects(() => store.update('work-a', { priority: 0 }, harness.actor), error => error.code === 'unsupported_operation');
  assert.equal(writes(harness.calls).length, 0);
});

test('one guarded native update carries every scalar field and the priority audit reason', async () => {
  const patch = { title: 'Changed 日本語', description: 'First line\n- [ ] Keep the checklist',
    priority: 0, issue_type: 'review_check', notes: 'Remember\nsecond line', status: 'deferred' };
  const before = nativeIssue('work-a', { revision: 13, labels: ['keep'],
    dependencies: [{ blocker: 'upstream', kind: 'verifies', blocker_status: 'closed', finished: true }] });
  const after = { ...before, ...patch, effective_status: 'deferred', revision: 14 };
  const harness = editingHarness({ before, after });
  const result = await (await harness.getStore()).update(before.id, patch, harness.actor);
  const commands = writes(harness.calls);
  assert.equal(commands.length, 1, 'A scalar request must be one native transaction');
  const [{ args, options }] = commands;
  assert.deepEqual(args.slice(0, 2), ['update', 'work-a']);
  for (const [field, flag] of [['title', '--title'], ['description', '--description'], ['priority', '--priority'],
    ['issue_type', '--issue-type'], ['notes', '--notes'], ['status', '--status']]) {
    assert.equal(optionValue(args, flag), String(patch[field]), field);
    assert.equal(result[field], patch[field], `${field} must survive the readback`);
  }
  assert.equal(optionValue(args, '--if-revision'), '13');
  assert.equal(optionValue(args, '--reason'), 'Priority edited in Scotty');
  assert.equal(options.env.BEAD_ACTOR, harness.actor);
  assert.deepEqual(result.labels, ['keep']);
  assert.deepEqual(result.dependencies.map(({ depends_on_id, type }) => [depends_on_id, type]), [['upstream', 'verifies']]);
});

test('native editing clears description and notes without omitting empty fields', async () => {
  const before = nativeIssue('work-a', { description: 'Old description', notes: 'Old notes' });
  const after = { ...before, description: '', notes: '', revision: 2 };
  const harness = editingHarness({ before, after });
  const bead = await (await harness.getStore()).update(before.id, { description: '', notes: '' }, harness.actor);
  const [{ args }] = writes(harness.calls);
  assert.equal(optionValue(args, '--description'), '');
  assert.equal(optionValue(args, '--notes'), '');
  assert.equal(optionValue(args, '--priority'), undefined);
  assert.equal(optionValue(args, '--reason'), undefined);
  assert.equal(bead.description, '');
  assert.equal(bead.notes, '');
});

test('literal leading-dash scalar values remain single option values', async () => {
  const patch = { title: '--help', description: '--help', notes: '--help', issue_type: '--help' };
  const harness = editingHarness({ after: nativeIssue('work-a', patch) });
  await (await harness.getStore()).update('work-a', patch, harness.actor);
  const [{ args }] = writes(harness.calls);
  for (const flag of ['title', 'description', 'notes', 'issue-type']) assert.ok(args.includes(`--${flag}=--help`), flag);
});

for (const status of ['closed', 'in_progress']) {
  for (const patch of [{ title: 'Keep this edit' }, { notes: '' }, { priority: 0 }, { issue_type: 'review_check' }]) {
    test(`native ${status} to open rejects an accompanying ${Object.keys(patch)[0]} edit`, async () => {
      const before = nativeIssue('work-a', { status, effective_status: status });
      const harness = editingHarness({ before });
      await assert.rejects(async () => (await harness.getStore()).update(before.id, { status: 'open', ...patch }, harness.actor),
        error => error.code === 'unsupported_operation');
      assert.equal(writes(harness.calls).length, 0, 'The lifecycle command must not discard an accepted scalar field');
    });
  }
}

for (const assignee of ['other-person', 'test-person']) {
  test(`scalar editing cannot use an unacquired ${assignee} claim`, async () => {
    const before = nativeIssue('work-a', { assignee, claim_epoch: 7, status: 'in_progress', effective_status: 'in_progress' });
    const harness = editingHarness({ before });
    await assert.rejects(async () => (await harness.getStore()).update(before.id, { title: 'Forbidden' }, harness.actor),
      error => error.code === 'claim_conflict');
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('native PATCH preserves a custom type, notes and a title longer than the original backend limit', async () => {
  const patch = { title: 'N'.repeat(600), issue_type: 'review_check', notes: 'Notes 日本語', description: '' };
  const harness = editingHarness({ after: nativeIssue('work-a', patch) });
  const route = harness.loader.load('app/api/p/[projectId]/beads/[id]/route.ts');
  const response = await route.PATCH(new Request('http://localhost/api/p/contract/beads/work-a', {
    method: 'PATCH', body: JSON.stringify(patch),
  }), { params: Promise.resolve({ projectId: 'contract', id: 'work-a' }) });
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  const body = await response.json();
  for (const field of Object.keys(patch)) assert.equal(body[field], patch[field]);
  assert.equal(writes(harness.calls).length, 1);
});

for (const patch of [{ title: 'a'.repeat(4097) }, { title: '界'.repeat(1366) }, { issue_type: '' }, { priority: 5 }, { notes: 1 }]) {
  test(`native PATCH rejects invalid ${Object.keys(patch)[0]} before any native write`, async () => {
    const harness = editingHarness();
    const route = harness.loader.load('app/api/p/[projectId]/beads/[id]/route.ts');
    const response = await route.PATCH(new Request('http://localhost/api/p/contract/beads/work-a', {
      method: 'PATCH', body: JSON.stringify(patch),
    }), { params: Promise.resolve({ projectId: 'contract', id: 'work-a' }) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'invalid_input');
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('the original update schema retains its type enum and title limit', () => {
  const { updateInputSchema } = sourceLoader().load('lib/schema.ts');
  assert.equal(updateInputSchema.safeParse({ title: 'a'.repeat(501) }).success, false);
  assert.equal(updateInputSchema.safeParse({ issue_type: 'review_check' }).success, false);
  assert.deepEqual(updateInputSchema.parse({ title: 'Original', priority: 0, issue_type: 'bug' }),
    { title: 'Original', priority: 0, issue_type: 'bug' });
});

for (const phase of ['command', 'readback']) {
  test(`a scalar ${phase} failure retains its outcome and never replays the update`, async () => {
    const harness = editingHarness({ reply: ({ args }, calls) => {
      if (phase === 'command' && args[0] === 'update') throw Object.assign(new Error('Timed out after dispatch'), { code: 'ETIMEDOUT' });
      if (phase === 'readback' && args[0] === 'show' && calls.some(call => call.args[0] === 'update')) {
        throw Object.assign(new Error('Read timed out'), { code: 'ETIMEDOUT' });
      }
    } });
    await assert.rejects(async () => (await harness.getStore()).update('work-a', { title: 'Changed' }, harness.actor), error => {
      assert.equal(error.code, phase === 'command' ? 'mutation_uncertain' : 'mutation_committed');
      assert.equal(error.outcome.issueId, 'work-a');
      assert.equal(error.outcome.operation, 'update');
      assert.equal(error.outcome.phase, phase);
      return true;
    });
    assert.equal(writes(harness.calls).length, 1);
  });
}

test('native edit transport failure is uncertain and original edit errors remain unchanged', async context => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const failure = new TypeError('Connection lost');
  globalThis.fetch = async () => { throw failure; };
  const { api } = sourceLoader().load('lib/api-client.ts');
  await assert.rejects(api.update('native', 'work-a', { title: 'Changed' }, true), error =>
    error.code === 'mutation_uncertain' && error.outcome.issueId === 'work-a' && error.outcome.operation === 'update');
  await assert.rejects(api.update('bd', 'work-a', { title: 'Changed' }), error => error === failure);
});

test('read-only native edit hooks refuse before sending the request', async () => {
  const requests = [];
  const loader = sourceLoader({ replacements: {
    '@tanstack/react-query': { useMutation: options => options, useQueryClient: () => ({}) },
    '@/components/app-context': { useApp: () => ({ projectId: 'native', readOnly: true,
      meta: { kind: 'bead-rs', capabilities: { editableFields: ['title', 'notes'] } } }) },
    '@/lib/api-client': { api: { update: (...args) => requests.push(args) }, nativeMutationOutcome: () => undefined },
  } });
  const update = loader.load('hooks/use-beads.ts').useUpdateBead();
  await assert.rejects(() => update.mutationFn({ id: 'work-a', patch: { title: 'Changed', notes: 'Notes' } }), /read-only/i);
  assert.deepEqual(requests, []);
});
