// Unit contract: subprocess replies are synthetic, not native integration proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue, nativeMetadata, nativeCapabilities } from './fixtures/native-contract.mjs';
import { storeHarness, snapshotOf, writes } from './support/store-harness.mjs';

const native = (options = {}) => storeHarness({ backend: 'bead-rs', ...options });

/** Accept only the intended machine-readable adapter error, not a setup exception. */
const codeIs = (expected) => (error) => {
  assert.equal(error.code, expected, error.stack);
  return true;
};

test('an unconfigured project retains original bd and BD_BIN', async () => {
  const harness = storeHarness();
  const store = await harness.getStore();
  assert.equal(store.kind, 'bd');
  assert.equal((await store.list())[0].id, 'work-a');
  assert.ok(harness.calls.some(({ binary, args }) => binary === '/test/original-bd' && args.join(' ') === 'export --json'));
  assert.ok(harness.calls.every(({ binary }) => binary !== '/test/native-bead'));
});

test('demo remains explicit and does not invoke a CLI', async () => {
  const harness = native();
  const store = await harness.getStore('demo');
  assert.equal(store.kind, 'demo');
  assert.ok((await store.list()).length > 0);
  assert.equal(harness.calls.length, 0);
});

test('explicit native selection uses BEAD_BIN without changing BD_BIN', async () => {
  const harness = native();
  const store = await harness.getStore();
  assert.equal(store.kind, 'bead-rs');
  await store.list();
  assert.ok(harness.calls.some(({ binary }) => binary === '/test/native-bead'));
  assert.ok(harness.calls.every(({ binary }) => binary !== '/test/original-bd'));
});

test('native reads request every record and all comments, including resolved comments', async () => {
  const issues = Array.from({ length: 137 }, (_, index) => nativeIssue(`work-${index}`));
  issues[0].comments = [{ id: 'comment-a', author: 'reviewer', body: 'Resolved 日本語\nSecond line',
    created_at: '2026-01-01T01:00:00Z', resolution_state: 'resolved' }];
  const harness = native({ issues, readyIds: [] });
  const listed = await (await harness.getStore()).list();
  assert.equal(listed.length, 137);
  assert.deepEqual(new Set(listed.map(({ id }) => id)), new Set(issues.map(({ id }) => id)));
  assert.equal(listed[0].comments[0].text, 'Resolved 日本語\nSecond line');
  assert.equal(listed[0].comments[0].author, 'reviewer');
  const listCalls = harness.calls.filter(({ args }) => args[0] === 'list' && !args.includes('--ready'));
  assert.ok(listCalls.length > 0);
  for (const { args } of listCalls) {
    assert.ok(args.includes('--all'), 'default limit=100 must not truncate a project');
    assert.equal(args[args.indexOf('--comments') + 1], 'all');
    assert.ok(args.includes('--json'));
  }
});

test('native enrichment preserves custom type and close metadata without fabricated attribution', async () => {
  const harness = native({
    issues: [nativeIssue('review-a', { status: 'closed', effective_status: 'closed' })],
    metadata: [nativeMetadata('review-a', { IssueType: 'review_check', ClosedAt: '2026-01-02T00:00:00Z', CloseReason: 'Verified output' })],
    readyIds: [],
  });
  const [bead] = await (await harness.getStore()).list();
  assert.equal(bead.issue_type, 'review_check');
  assert.equal(bead.closed_at, '2026-01-02T00:00:00Z');
  assert.equal(bead.close_reason, 'Verified output');
  assert.equal(bead.assignee, '');
  assert.ok(bead.created_by === undefined || bead.created_by === '');
  assert.ok(bead.owner === undefined || bead.owner === '');
  assert.ok(harness.calls.some(({ args }) => args[0] === 'query' && args.includes('--output-json')));
});

test('native dependencies preserve target direction and exact kinds', async () => {
  const harness = native({ issues: [nativeIssue('dependent', { dependencies: [
    { blocker: 'prerequisite', kind: 'blocks', blocker_status: 'open', finished: false },
    { blocker: 'reference', kind: 'relates_to', blocker_status: 'closed', finished: true },
    { blocker: 'review', kind: 'verifies', blocker_status: 'open', finished: false },
  ] })] });
  const [bead] = await (await harness.getStore()).list();
  assert.deepEqual(bead.dependencies.map(({ depends_on_id, type }) => [depends_on_id, type]),
    [['prerequisite', 'blocks'], ['reference', 'relates_to'], ['review', 'verifies']]);
});

test('native readiness excludes assigned-open, manual, dependency and resource blockers', async () => {
  const harness = native({ issues: [
    nativeIssue('ready'),
    nativeIssue('assigned', { assignee: 'another-worker' }),
    nativeIssue('manual', { manual_blocked: true, effective_status: 'blocked' }),
    nativeIssue('dependent', { dependencies: [{ blocker: 'ready', kind: 'blocks', blocker_status: 'open', finished: false }] }),
    nativeIssue('resource', { resource_keys: ['device:shared'] }),
  ], readyIds: ['ready'] });
  const snapshot = await snapshotOf(await harness.getStore());
  assert.deepEqual(snapshot.readyIds, ['ready']);
  assert.equal(snapshot.beads.find(({ id }) => id === 'manual').status, 'blocked');
  assert.equal(snapshot.beads.length, 5, 'non-ready records remain visible');
  assert.ok(harness.calls.some(({ args }) => args[0] === 'list' && args.includes('--ready') && args.includes('--all')));
});

test('an empty native frontier is authoritative, not missing readiness data', async () => {
  const harness = native({ readyIds: [] });
  const snapshot = await snapshotOf(await harness.getStore());
  assert.deepEqual(snapshot.readyIds, []);
  assert.equal(snapshot.beads.length, 1);
});

test('observation timestamp/checksum changes do not invalidate unchanged native state', async () => {
  const harness = native();
  const snapshot = await snapshotOf(await harness.getStore());
  assert.equal(snapshot.beads[0].id, 'work-a');
  assert.deepEqual(snapshot.readyIds, ['work-a']);
});

test('an external edit during enrichment retries the whole native read', async () => {
  let sequence = 1;
  let queryReads = 0;
  const harness = native({ reply: ({ args }) => {
    if (args[0] === 'changes') return { workspace_uuid: 'workspace', max_sequence: sequence, checksum: `seen-${queryReads}`, timestamp: '2026-01-01T00:00:00Z' };
    if (args[0] === 'query') {
      queryReads += 1;
      sequence = 2;
      return [nativeMetadata('work-a', { IssueType: queryReads === 1 ? 'task' : 'feature' })];
    }
  } });
  const snapshot = await snapshotOf(await harness.getStore());
  assert.equal(snapshot.beads[0].issue_type, 'feature', 'must not publish the mixed first read');
  assert.ok(queryReads >= 2);
});

test('persistent concurrent changes fail explicitly instead of publishing mixed state', async () => {
  let sequence = 0;
  const harness = native({ reply: ({ args }) => {
    if (args[0] === 'changes') return { workspace_uuid: 'workspace', max_sequence: ++sequence, checksum: 'x', timestamp: '2026-01-01T00:00:00Z' };
  } });
  await assert.rejects(async () => snapshotOf(await harness.getStore()), codeIs('snapshot_conflict'));
});

for (const [name, replacement] of [
  ['invalid JSON', '{'], ['null list', 'null'], ['wrong envelope', '{"data":[]}'],
  ['missing ID', JSON.stringify([{ title: 'No ID' }])],
  ['null title', JSON.stringify([nativeIssue('work-a', { title: null })])],
  ['invalid priority', JSON.stringify([nativeIssue('work-a', { priority: 9 })])],
]) {
  test(`native output validation rejects ${name}`, async () => {
    const harness = native({ reply: ({ args }) => args[0] === 'list' ? replacement : undefined });
    await assert.rejects(async () => (await harness.getStore()).list(), codeIs('parse_error'));
  });
}

for (const [name, metadata] of [
  ['missing metadata', []],
  ['duplicate metadata', [nativeMetadata('work-a'), nativeMetadata('work-a')]],
  ['missing type', [{ Id: 'work-a', ClosedAt: null, CloseReason: null }]],
  ['null type', [nativeMetadata('work-a', { IssueType: null })]],
]) {
  test(`native enrichment rejects ${name} instead of inventing a task`, async () => {
    const harness = native({ metadata });
    await assert.rejects(async () => (await harness.getStore()).list(), codeIs('parse_error'));
  });
}

for (const [name, reply] of [
  ['old release', ({ args }) => args[0] === '--version' ? 'bead 0.2.6' : args[0] === 'capabilities' ? { ...nativeCapabilities, version: '0.2.6', agent_ergonomics: undefined } : undefined],
  ['missing binary', () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); }],
  ['invalid capability document', ({ args }) => args[0] === 'capabilities' ? '{}' : undefined],
]) {
  test(`native ${name} fails without falling back to bd or demo`, async () => {
    const harness = native({ reply });
    await assert.rejects(async () => (await harness.getStore()).list());
    assert.ok(harness.calls.every(({ binary }) => binary !== '/test/original-bd'));
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('native get treats an actual not-found error as null, not arbitrary CLI failures', async () => {
  const harness = native({ reply: ({ args }) => {
    if (args[0] === 'show') throw Object.assign(new Error('Issue not found'), { stderr: 'Issue not found: missing', code: 3 });
  } });
  assert.equal(await (await harness.getStore()).get('missing'), null);
});

test('native capability arrays disable only unsupported operations', async () => {
  const store = await native().getStore();
  assert.ok(store.capabilities, 'native store must declare capabilities');
  assert.deepEqual([...store.capabilities.editableFields].sort(), ['assignee', 'status']);
  assert.deepEqual([...store.capabilities.dependencyTypes].sort(), ['blocks', 'relates_to', 'verifies']);
  assert.equal(store.capabilities.closeReason, 'required');
  assert.equal(store.capabilities.attribution, 'unavailable');
  for (const operation of ['create', 'comment', 'dependencies']) assert.ok(store.capabilities.operations.includes(operation));
  for (const operation of ['delete', 'parent', 'gate', 'archive', 'refine', 'attachments', 'publish']) assert.ok(!store.capabilities.operations.includes(operation));
});

for (const [name, operation] of [
  ['title', (store) => store.update('work-a', { title: 'Changed' }, 'test-person')],
  ['description plus labels', (store) => store.update('work-a', { description: 'Changed', labels: ['must-not-write'] }, 'test-person')],
  ['priority', (store) => store.update('work-a', { priority: 1 }, 'test-person')],
  ['type', (store) => store.update('work-a', { issue_type: 'bug' }, 'test-person')],
  ['parent', (store) => store.update('work-a', { parent: 'other' }, 'test-person')],
  ['delete', (store) => store.remove('work-a', 'test-person')],
  ['gate', (store) => store.createGate('work-a', 'Approval', 'test-person')],
  ['archive', (store) => store.archive('work-a', 'test-person')],
  ['foreign dependency kind', (store) => store.addDep('work-a', 'other', 'parent-child', 'test-person')],
  ['unsupported status', (store) => store.setStatus('work-a', 'hooked', 'test-person')],
]) {
  test(`native ${name} rejects before mutating anything`, async () => {
    const harness = native();
    await assert.rejects(async () => operation(await harness.getStore()), codeIs('unsupported_operation'));
    assert.equal(writes(harness.calls).length, 0);
  });
}

for (const reason of [undefined, '', '  \n']) {
  test(`native close rejects empty reason ${JSON.stringify(reason)}`, async () => {
    const harness = native();
    await assert.rejects(async () => (await harness.getStore()).setStatus('work-a', 'closed', 'test-person', reason), codeIs('invalid_input'));
    assert.equal(writes(harness.calls).length, 0);
  });
}

test('without BD_BIN the original backend resolves bd from PATH', async () => {
  const harness = storeHarness({ env: { BD_BIN: undefined } });
  assert.equal((await harness.getStore()).kind, 'bd');
  await (await harness.getStore()).list();
  assert.ok(harness.calls.every(({ binary }) => binary === 'bd'));
});
