// Subprocess and HTTP doubles exercise the production adapter, routes and hooks.
// Persisted native edits are checked separately by test-backend-integration.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import promises from 'node:fs/promises';
import path from 'node:path';
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
    if (args[0] === 'query') return [nativeMetadata(current.id, { IssueType: current.issue_type || 'task',
      ClosedAt: current.closed_at ?? null, CloseReason: current.close_reason ?? null })];
  } });
}

function optionValue(args, name) {
  const equal = args.find(argument => argument.startsWith(`${name}=`));
  if (equal !== undefined) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

for (const [label, grant] of [['absent', undefined], ['false', false], ['malformed', 'true']]) {
  test('type-file grant ' + label + ' preserves short edits and description files', async () => {
    const capabilities = { ...editingNativeCapabilities,
      issue_editing: { ...editingNativeCapabilities.issue_editing, issue_type_file: grant } };
    const patch = { issue_type: '界'.repeat(2730) + 'xy', description: 'Long description 日本語\n'.repeat(1000) };
    const files = [];
    const harness = editingHarness({ after: nativeIssue('work-a', patch), reply: ({ args }) => {
      if (args[0] === 'capabilities') return capabilities;
      if (args[0] === 'update') {
        assert.equal(optionValue(args, '--issue-type'), patch.issue_type);
        assert.equal(optionValue(args, '--issue-type-file'), undefined);
        const filename = optionValue(args, '--description-file');
        assert.ok(filename && path.isAbsolute(filename));
        files.push(filename);
        assert.equal(fs.readFileSync(filename, 'utf8'), patch.description);
      }
    } });
    const store = await harness.getStore();
    for (const field of ['title', 'description', 'priority', 'issue_type', 'notes']) {
      assert.ok(store.capabilities.editableFields.includes(field), field);
    }
    const result = await store.update('work-a', patch, harness.actor);
    assert.equal(result.issue_type, patch.issue_type);
    assert.equal(result.description, patch.description);
    assert.equal(writes(harness.calls).length, 1);
    assert.equal(files.length, 1);
    assert.equal(fs.existsSync(path.dirname(files[0])), false);
  });

  test('type-file grant ' + label + ' refuses oversized types before any native write', async () => {
    const capabilities = { ...editingNativeCapabilities,
      issue_editing: { ...editingNativeCapabilities.issue_editing, issue_type_file: grant } };
    const harness = editingHarness({ reply: ({ args }) => args[0] === 'capabilities' ? capabilities : undefined });
    const store = await harness.getStore();
    await assert.rejects(store.update('work-a', {
      issue_type: '界'.repeat(2731), title: 'Must remain unchanged', priority: 0,
    }, harness.actor), error => error.code === 'unsupported_operation');
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('unsupported long native type creates no temporary input before refusal', async () => {
  const allocations = [];
  const commands = [];
  const loader = sourceLoader({ replacements: {
    'node:fs/promises': {
      ...promises,
      mkdtemp: async (...args) => { allocations.push('mkdtemp'); return promises.mkdtemp(...args); },
      writeFile: async (...args) => { allocations.push('writeFile'); return promises.writeFile(...args); },
    },
  } });
  const { runNativeEdit } = loader.load('lib/native-edit.ts');
  const { NativeMutation } = loader.load('lib/native-mutation.ts');
  const process = { run: async (...args) => { commands.push(args); return '{}'; } };
  await assert.rejects(runNativeEdit(process, ['update', 'work-a', '--if-revision', '7'], {
    issue_type: '界'.repeat(2731), description: 'd'.repeat(9000),
  }, 'test-person', new NativeMutation('update', 'work-a'), false),
  error => error.code === 'unsupported_operation');
  assert.deepEqual(allocations, [], 'Unsupported input must be refused before temporary directory or file creation');
  assert.deepEqual(commands, [], 'Unsupported input must never reach the native executable');
});

for (const [bytes, issueType] of [[8192, '界'.repeat(2730) + 'xy'], [8193, '界'.repeat(2731)]]) {
  test('native type transport observes the ' + bytes + '-byte UTF-8 boundary', async () => {
    assert.equal(Buffer.byteLength(issueType, 'utf8'), bytes);
    const files = [];
    const patch = { issue_type: issueType };
    const harness = editingHarness({ after: nativeIssue('work-a', patch), reply: ({ args }) => {
      if (args[0] !== 'update') return;
      if (bytes === 8192) {
        assert.equal(optionValue(args, '--issue-type'), issueType);
        assert.equal(optionValue(args, '--issue-type-file'), undefined);
      } else {
        const filename = optionValue(args, '--issue-type-file');
        assert.ok(filename && path.isAbsolute(filename), 'The type must use a request-owned input file');
        files.push(filename);
        assert.equal(fs.readFileSync(filename, 'utf8'), issueType);
        assert.equal(optionValue(args, '--issue-type'), undefined);
      }
    } });
    assert.equal((await (await harness.getStore()).update('work-a', patch, harness.actor)).issue_type, issueType);
    assert.equal(writes(harness.calls).length, 1);
    for (const filename of files) assert.equal(fs.existsSync(path.dirname(filename)), false);
  });
}

for (const bytes of [8192, 8193]) {
  test('native text transport counts type description and notes together at ' + bytes + ' bytes', async () => {
    const patch = { issue_type: 't'.repeat(4096), description: 'd'.repeat(4095), notes: bytes === 8192 ? 'n' : 'nn' };
    assert.equal(Object.values(patch).reduce((total, value) => total + Buffer.byteLength(value, 'utf8'), 0), bytes);
    const files = [];
    const harness = editingHarness({ after: nativeIssue('work-a', patch), reply: ({ args }) => {
      if (args[0] !== 'update') return;
      for (const [field, flag] of [['issue_type', 'issue-type'], ['description', 'description'], ['notes', 'notes']]) {
        if (bytes === 8192) {
          assert.equal(optionValue(args, '--' + flag), patch[field]);
          assert.equal(optionValue(args, '--' + flag + '-file'), undefined);
        } else {
          const filename = optionValue(args, '--' + flag + '-file');
          assert.ok(filename && path.isAbsolute(filename), field + ' must use the combined file budget');
          files.push(filename);
          assert.equal(fs.readFileSync(filename, 'utf8'), patch[field]);
          assert.equal(optionValue(args, '--' + flag), undefined);
        }
      }
    } });
    const result = await (await harness.getStore()).update('work-a', patch, harness.actor);
    for (const [field, value] of Object.entries(patch)) assert.equal(result[field], value);
    assert.equal(writes(harness.calls).length, 1);
    for (const filename of files) assert.equal(fs.existsSync(path.dirname(filename)), false);
  });
}

for (const outcome of ['success', 'command failure', 'readback failure']) {
  test('long native custom types use exact UTF-8 files and clean up after ' + outcome, async () => {
    const patch = { issue_type: 'custom_界'.repeat(5000), description: 'Description 日本語\n', notes: 'Retained notes\n' };
    assert.ok(patch.issue_type.length > 32768, 'This value cannot fit a Windows inline command');
    const files = [];
    const harness = editingHarness({ after: nativeIssue('work-a', patch), reply: ({ args }, calls) => {
      if (args[0] === 'update') {
        for (const [field, flag] of [['issue_type', 'issue-type'], ['description', 'description'], ['notes', 'notes']]) {
          const filename = optionValue(args, '--' + flag + '-file');
          assert.ok(filename && path.isAbsolute(filename), field + ' must use a request-owned input file');
          files.push(filename);
          assert.equal(fs.readFileSync(filename, 'utf8'), patch[field]);
          assert.equal(optionValue(args, '--' + flag), undefined);
        }
        if (outcome === 'command failure') throw Object.assign(new Error('Timed out after dispatch'), { code: 'ETIMEDOUT' });
      }
      if (outcome === 'readback failure' && args[0] === 'show' && calls.some(call => call.args[0] === 'update')) {
        throw Object.assign(new Error('Read timed out'), { code: 'ETIMEDOUT' });
      }
    } });
    const store = await harness.getStore();
    if (outcome === 'success') {
      assert.equal((await store.update('work-a', patch, harness.actor)).issue_type, patch.issue_type);
    } else {
      await assert.rejects(store.update('work-a', patch, harness.actor), error =>
        error.code === (outcome === 'command failure' ? 'mutation_uncertain' : 'mutation_committed'));
    }
    assert.equal(writes(harness.calls).length, 1, 'An uncertain update must never be replayed');
    assert.equal(files.length, 3, 'Every supplied text field must use a file');
    for (const filename of files) assert.equal(fs.existsSync(path.dirname(filename)), false);
  });
}

test('a long native type edit retains the claim acquired by this store and its revision guard', async () => {
  const before = nativeIssue('work-a', { revision: 7, claim_epoch: 0 });
  const claimed = { ...before, assignee: 'test-person', claim_epoch: 1,
    status: 'in_progress', effective_status: 'in_progress', revision: 8 };
  const patch = { issue_type: 'claimed_界'.repeat(5000), priority: 0 };
  const after = { ...claimed, ...patch, revision: 9 };
  const files = [];
  const harness = editingHarness({ before, after, reply: ({ args }, calls) => {
    const updates = calls.filter(call => call.args[0] === 'update');
    const document = updates.length === 0 ? before : updates.length === 1 ? claimed : after;
    if (args[0] === 'show') return document;
    if (args[0] === 'list') return [document];
    if (args[0] === 'query') return [nativeMetadata(document.id, { IssueType: document.issue_type || 'task' })];
    if (args[0] === 'update') {
      if (updates.length === 2) {
        assert.equal(optionValue(args, '--if-revision'), '8');
        assert.equal(optionValue(args, '--fencing-token'), '1');
        assert.equal(optionValue(args, '--priority'), '0');
        assert.equal(optionValue(args, '--reason'), 'Priority edited in Scotty');
        const filename = optionValue(args, '--issue-type-file');
        assert.ok(filename && path.isAbsolute(filename), 'The claimed type edit must use its input file');
        files.push(filename);
        assert.equal(fs.readFileSync(filename, 'utf8'), patch.issue_type);
      }
      return {};
    }
  } });
  const store = await harness.getStore();
  await store.setStatus('work-a', 'in_progress', harness.actor);
  const result = await store.update('work-a', patch, harness.actor);
  assert.equal(result.issue_type, patch.issue_type);
  assert.equal(result.assignee, harness.actor);
  assert.equal(writes(harness.calls).length, 2, 'One claim acquisition followed by one scalar update');
  assert.equal(files.length, 1);
  assert.equal(fs.existsSync(path.dirname(files[0])), false);
});

test('native type validation retains the complete four-MiB input allowance', () => {
  const { nativeUpdateInputSchema } = sourceLoader().load('lib/schema.ts');
  const issueType = 't'.repeat(4 * 1024 * 1024);
  assert.equal(nativeUpdateInputSchema.parse({ issue_type: issueType }).issue_type, issueType);
  assert.equal(nativeUpdateInputSchema.safeParse({ issue_type: issueType + 'x' }).success, false);
});

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

for (const outcome of ['success', 'command failure', 'readback failure']) {
  test(`long native descriptions and notes use owned UTF-8 files and clean up after ${outcome}`, async () => {
    const patch = { description: 'Long description 日本語\n'.repeat(3000), notes: 'Long notes\n'.repeat(4000) };
    const inputFiles = [];
    const harness = editingHarness({ after: nativeIssue('work-a', patch), reply: ({ args }, calls) => {
      if (args[0] === 'update') {
        for (const [field, flag] of [['description', '--description-file'], ['notes', '--notes-file']]) {
          const filename = optionValue(args, flag);
          assert.ok(filename && path.isAbsolute(filename), `${field} must use an owned input file`);
          inputFiles.push(filename);
          assert.equal(fs.readFileSync(filename, 'utf8'), patch[field]);
          assert.equal(args.some(argument => argument.includes(patch[field])), false);
        }
        if (outcome === 'command failure') throw Object.assign(new Error('Timed out after dispatch'), { code: 'ETIMEDOUT' });
      }
      if (outcome === 'readback failure' && args[0] === 'show' && calls.some(call => call.args[0] === 'update')) {
        throw Object.assign(new Error('Read timed out'), { code: 'ETIMEDOUT' });
      }
    } });
    const store = await harness.getStore();
    if (outcome === 'success') {
      const bead = await store.update('work-a', patch, harness.actor);
      assert.equal(bead.description, patch.description);
      assert.equal(bead.notes, patch.notes);
    } else {
      await assert.rejects(() => store.update('work-a', patch, harness.actor), error =>
        error.code === (outcome === 'command failure' ? 'mutation_uncertain' : 'mutation_committed'));
    }
    assert.equal(writes(harness.calls).length, 1);
    assert.equal(inputFiles.length, 2);
    for (const filename of inputFiles) assert.equal(fs.existsSync(filename), false, 'Input files must be reclaimed');
  });
}

test('closed native scalar corrections preserve completion metadata and lifecycle', async () => {
  const before = nativeIssue('work-a', { status: 'closed', effective_status: 'closed', revision: 5,
    closed_at: '2026-01-02T00:00:00Z', close_reason: 'Verified earlier' });
  const patch = { title: 'Corrected title', description: 'Corrected description', issue_type: 'review_check', notes: 'Correction' };
  const harness = editingHarness({ before, after: { ...before, ...patch, revision: 6 } });
  const bead = await (await harness.getStore()).update(before.id, patch, harness.actor);
  assert.equal(bead.status, 'closed');
  assert.equal(bead.closed_at, before.closed_at);
  assert.equal(bead.close_reason, before.close_reason);
  for (const [field, value] of Object.entries(patch)) assert.equal(bead[field], value);
  assert.deepEqual(writes(harness.calls).map(({ args }) => args[0]), ['update']);
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

test('notes editing requires an explicit grant even on a legacy original server', () => {
  const { canEdit } = sourceLoader().load('lib/beads-view.ts');
  for (const metadata of [undefined, { kind: 'bd' }, { kind: 'demo' }]) {
    assert.equal(canEdit(metadata, 'notes'), false);
    assert.equal(canEdit(metadata, 'title'), true);
    assert.equal(canEdit(metadata, 'issue_type'), true);
  }
  assert.equal(canEdit({ kind: 'bead-rs', capabilities: { editableFields: ['notes'] } }, 'notes'), true);
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
