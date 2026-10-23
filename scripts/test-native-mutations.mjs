// Unit subprocess boundary; the real API/process suite verifies persisted effects.
import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue, nativeMetadata } from './fixtures/native-contract.mjs';
import { storeHarness, writes } from './support/store-harness.mjs';

const input = { title: "Task 日本語 '; $(echo unsafe)'", description: 'First line\nSecond line',
  issue_type: 'bug', priority: 1, assignee: '', labels: ['alpha', 'beta'], parent: '', backlog: false };

/** Simulate a single already-specified write result, without reimplementing CLI semantics. */
function transitionHarness(before, after, { result, metadata, command } = {}) {
  let successfulWrite;
  const harness = storeHarness({ backend: 'bead-rs', issues: [before],
    metadata: metadata || [nativeMetadata(before.id)], readyIds: [],
    reply: ({ args, options }) => {
      if (args[0] === command) {
        successfulWrite = args;
        assert.notEqual(options.shell, true, 'issue text must never enter a shell command');
        return result ?? before.id;
      }
      if (args[0] === 'show') return successfulWrite ? after : before;
    },
  });
  return harness;
}

test('native create passes title as an option and enriches the returned issue', async () => {
  const created = nativeIssue('new-task', { title: input.title, description: input.description, labels: input.labels, priority: 1 });
  const harness = transitionHarness(created, created, { command: 'create', result: created,
    metadata: [nativeMetadata('new-task', { IssueType: 'bug' })] });
  const bead = await (await harness.getStore()).create(input, harness.actor);
  assert.equal(bead.title, input.title);
  assert.equal(bead.description, input.description);
  assert.equal(bead.issue_type, 'bug');
  const [{ args }] = writes(harness.calls);
  assert.equal(args[0], 'create');
  assert.equal(args[args.indexOf('--title') + 1], input.title);
  assert.ok(args.includes('--issue-type=bug'));
  assert.equal(args[args.indexOf('--description') + 1], input.description);
  assert.ok(args.includes('--json'));
  assert.equal(harness.calls.some(({ binary }) => binary === '/test/original-bd'), false);
});

test('native backlog creation is one manifest transaction, never briefly ready', async () => {
  const created = nativeIssue('new-backlog', { title: input.title, status: 'deferred', effective_status: 'deferred' });
  const harness = transitionHarness(created, created, { command: 'manifest', result: {
    committed: true, dry_run: false, manifest_version: 1, operations: 2,
    results: [{ index: 0, op: 'create', local_id: 'created', issue_id: 'new-backlog', outcome: 'created', semantic_change: true }],
  } });
  const bead = await (await harness.getStore()).create({ ...input, backlog: true }, harness.actor);
  assert.equal(bead.status, 'deferred');
  const commands = writes(harness.calls);
  assert.equal(commands.length, 1, 'a separate create/update pair exposes a claim race');
  assert.deepEqual(commands[0].args.slice(0, 2), ['manifest', 'commit']);
  const manifestPath = commands[0].args[commands[0].args.indexOf('--input') + 1];
  // The command payload may have been removed after use; the integration suite
  // independently checks the persisted deferred result.
  assert.ok(manifestPath, 'manifest must be passed as a file or stdin, not shell text');
});

test('native comments use body and actor and preserve the returned comment author', async () => {
  const body = 'Comment 日本語\nsecond line';
  const before = nativeIssue('work-a');
  const after = nativeIssue('work-a', { comments: [{ id: 'comment-a', body, author: 'test-person',
    created_at: '2026-01-01T01:00:00Z', resolution_state: 'unresolved' }] });
  const harness = transitionHarness(before, after, { command: 'comment', result: {
    id: 'comment-a', issue_id: 'work-a', operation: 'created', author: 'test-person', semantic_change: true,
  } });
  const bead = await (await harness.getStore()).addComment('work-a', body, harness.actor);
  assert.equal(bead.comments[0].text, body);
  assert.equal(bead.comments[0].author, harness.actor);
  const [{ args }] = writes(harness.calls);
  assert.deepEqual(args.slice(0, 3), ['comment', 'create', 'work-a']);
  assert.ok(args.includes(`--body=${body}`));
  assert.ok(args.includes(`--actor=${harness.actor}`));
});

test('native add-dependency preserves blocked then blocker argument direction', async () => {
  const before = nativeIssue('dependent');
  const after = nativeIssue('dependent', { dependencies: [{ blocker: 'prerequisite', kind: 'verifies', blocker_status: 'open', finished: false }] });
  const harness = transitionHarness(before, after, { command: 'dep' });
  const bead = await (await harness.getStore()).addDep('dependent', 'prerequisite', 'verifies', harness.actor);
  assert.equal(bead.dependencies[0].depends_on_id, 'prerequisite');
  const [{ args }] = writes(harness.calls);
  assert.deepEqual(args.slice(0, 4), ['dep', 'add', 'dependent', 'prerequisite']);
  assert.equal(args[args.indexOf('--kind') + 1], 'verifies');
});

for (const [name, before, target, command, reason] of [
  ['close', nativeIssue('work-a'), 'closed', 'close', 'Verified with tests'],
  ['reopen', nativeIssue('work-a', { status: 'closed', effective_status: 'closed' }), 'open', 'reopen', undefined],
  ['clear open assignment', nativeIssue('work-a', { assignee: 'test-person' }), undefined, 'update', undefined],
]) {
  test(`native ${name} uses its distinct lifecycle command`, async () => {
    const after = nativeIssue('work-a', { status: target || 'open', effective_status: target || 'open', revision: 2 });
    const harness = transitionHarness(before, after, { command });
    const store = await harness.getStore();
    const bead = target ? await store.setStatus('work-a', target, harness.actor, reason)
      : await store.update('work-a', { assignee: '' }, harness.actor);
    assert.equal(bead.status, target || 'open');
    assert.equal(bead.assignee, '');
    const [{ args }] = writes(harness.calls);
    assert.equal(args[0], command);
    assert.equal(args[1], 'work-a');
    if (reason) assert.equal(args[args.indexOf('--reason') + 1], reason);
    if (!target) assert.ok(args.includes('--clear-assignee'));
    assert.ok(args.includes('--if-revision'), 'mutation must guard the observed issue revision');
  });
}

for (const action of ['release', 'close', 'reassign']) {
  test(`native ${action} cannot borrow another actor's claim epoch`, async () => {
    const before = nativeIssue('work-a', { status: 'in_progress', effective_status: 'in_progress', assignee: 'other-person', claim_epoch: 7 });
    const harness = storeHarness({ backend: 'bead-rs', issues: [before] });
    const store = await harness.getStore();
    const operation = action === 'reassign' ? () => store.update('work-a', { assignee: harness.actor }, harness.actor)
      : () => store.setStatus('work-a', action === 'close' ? 'closed' : 'open', harness.actor, 'Verified');
    await assert.rejects(operation, (error) => error.code === 'claim_conflict');
    assert.equal(writes(harness.calls).length, 0);
  });
}

for (const patch of [{ labels: [] }, { labels: ['B'] }, { labels: ['B'], status: 'deferred' }]) {
  test(`native replacement is refused before writes: ${JSON.stringify(patch)}`, async () => {
    const harness = storeHarness({ backend: 'bead-rs' });
    const store = await harness.getStore();
    await assert.rejects(() => store.update('work-a', patch, harness.actor),
      (error) => error.code === 'unsupported_operation');
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('native unsupported compound lifecycle patch cannot partially release or relabel', async () => {
  const before = nativeIssue('work-a', { status: 'in_progress', effective_status: 'in_progress', assignee: 'test-person', claim_epoch: 2, labels: ['old'] });
  const harness = storeHarness({ backend: 'bead-rs', issues: [before] });
  await assert.rejects(async () => (await harness.getStore()).update('work-a', { status: 'open', labels: ['new'] }, harness.actor),
    (error) => error.code === 'unsupported_operation');
  assert.equal(writes(harness.calls).length, 0);
});

test('native manifest rejection propagates, without retrying writes individually', async () => {
  const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
    if (args[0] === 'manifest') throw Object.assign(new Error('manifest rejected'), { code: 4, stderr: 'revision conflict' });
  } });
  await assert.rejects(async () => (await harness.getStore()).create({ ...input, backlog: true }, harness.actor));
  assert.deepEqual(writes(harness.calls).map(({ args }) => args[0]), ['manifest']);
});

// Actual native option parsing rejects a leading-dash value passed as a separate token.
test('native create preserves leading-dash type, assignee and label with equals-form argv', async () => {
  const created = nativeIssue('literal-create', { labels: ['--help'], assignee: '--help' });
  const harness = transitionHarness(created, created, { command: 'create', result: created, metadata: [nativeMetadata('literal-create', { IssueType: '--help' })] });
  const bead = await (await harness.getStore()).create({ ...input, issue_type: '--help', assignee: '--help', labels: ['--help'] }, harness.actor);
  assert.deepEqual(bead.labels, ['--help']);
  assert.equal(bead.issue_type, '--help');
  assert.equal(bead.assignee, '--help');
  for (const flag of ['label', 'issue-type', 'assignee']) assert.ok(writes(harness.calls)[0].args.includes(`--${flag}=--help`));
});

test('native comment preserves leading-dash body and actor with equals-form argv', async () => {
  const before = nativeIssue('work-a');
  const after = nativeIssue('work-a', { comments: [{ id: 'literal-comment', body: '--help', author: '--help',
    created_at: '2026-01-01T01:00:00Z', resolution_state: 'unresolved' }] });
  const harness = transitionHarness(before, after, { command: 'comment', result: { id: 'literal-comment', author: '--help' } });
  const bead = await (await harness.getStore()).addComment('work-a', '--help', '--help');
  assert.equal(bead.comments[0].text, '--help');
  assert.equal(bead.comments[0].author, '--help');
  for (const flag of ['body', 'actor']) assert.ok(writes(harness.calls)[0].args.includes(`--${flag}=--help`));
});

for (const start of [false, true]) {
  test(`native ${start ? 'start actor' : 'updated assignee'} preserves a leading-dash value`, async () => {
    const before = nativeIssue('work-a');
    const after = nativeIssue('work-a', { assignee: '--help', claim_epoch: 1, revision: 2,
      status: start ? 'in_progress' : 'open', effective_status: start ? 'in_progress' : 'open' });
    const harness = transitionHarness(before, after, { command: 'update' });
    const store = await harness.getStore();
    const bead = start ? await store.setStatus('work-a', 'in_progress', '--help')
      : await store.update('work-a', { assignee: '--help' }, harness.actor);
    assert.equal(bead.assignee, '--help');
    assert.ok(writes(harness.calls)[0].args.includes('--assignee=--help'));
  });
}
