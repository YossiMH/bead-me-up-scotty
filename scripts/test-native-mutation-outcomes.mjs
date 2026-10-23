import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue } from './fixtures/native-contract.mjs';
import { storeHarness, writes } from './support/store-harness.mjs';

for (const operation of ['create', 'comment']) {
  test(`${operation} retains its committed receipt when readback fails without replay`, async () => {
    const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
      if (args[0] === 'create') return nativeIssue('created-once');
      if (args[0] === 'comment') return { id: 'comment-once', author: 'test-person' };
      if (args[0] === 'show') throw Object.assign(new Error('Read timed out'), { code: 'ETIMEDOUT' });
    } });
    const store = await harness.getStore();
    const action = operation === 'create'
      ? () => store.create({ title: 'Once', description: '', priority: 2, issue_type: 'task', labels: [] }, 'test-person')
      : () => store.addComment('work-a', 'Once', 'test-person');
    await assert.rejects(action, (error) => {
      assert.equal(error.code, 'mutation_committed');
      assert.equal(error.outcome.state, 'committed');
      assert.equal(error.outcome.operation, operation);
      assert.equal(error.outcome.issueId, operation === 'create' ? 'created-once' : 'work-a');
      if (operation === 'comment') assert.equal(error.outcome.receiptId, 'comment-once');
      assert.equal(error.outcome.phase, 'readback');
      assert.match(error.message, /do not resubmit/i);
      return true;
    });
    assert.equal(writes(harness.calls).length, 1);
  });
}

test('malformed create receipt remains a committed outcome rather than a retryable parse error', async () => {
  const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => args[0] === 'create' ? '{' : undefined });
  const store = await harness.getStore();
  await assert.rejects(() => store.create({ title: 'Once', description: '', priority: 2, issue_type: 'task', labels: [] }, 'test-person'),
    (error) => error.code === 'mutation_committed' && error.outcome.phase === 'receipt');
  assert.equal(writes(harness.calls).length, 1);
});

test('a command timeout is uncertain and cannot trigger a replay', async () => {
  const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
    if (args[0] === 'create') throw Object.assign(new Error('Timeout after dispatch'), { code: 'ETIMEDOUT' });
  } });
  await assert.rejects(() => harness.getStore().then((store) => store.create({ title: 'Once', description: '', priority: 2, issue_type: 'task', labels: [] }, 'test-person')),
    (error) => error.code === 'mutation_uncertain' && error.outcome.phase === 'command');
  assert.equal(writes(harness.calls).length, 1);
});

test('manifest cleanup failure retains the committed issue identity', async () => {
  const { sourceLoader } = await import('./support/load-source-module.mjs');
  const loader = sourceLoader({ replacements: {
    'node:fs/promises': {
      mkdtemp: async () => '/synthetic/request', writeFile: async () => {},
      rm: async () => { throw new Error('Cleanup unavailable'); },
    },
  } });
  const { NativeMutation } = loader.load('lib/native-mutation.ts');
  const { commitNativeManifest } = loader.load('lib/native-manifest.ts');
  let calls = 0;
  const process = { run: async () => { calls += 1; return JSON.stringify({ committed: true, dry_run: false,
    manifest_version: 1, results: [{ local_id: 'created', issue_id: 'kept-id' }] }); } };
  await assert.rejects(() => commitNativeManifest(process, [], 'actor', new NativeMutation('create')),
    (error) => error.code === 'mutation_committed' && error.outcome.issueId === 'kept-id' && error.outcome.phase === 'cleanup');
  assert.equal(calls, 1);
});

test('API failure body preserves the known committed receipt with HTTP 409', async () => {
  const harness = storeHarness({ backend: 'bead-rs' });
  const { NativeMutationError } = harness.loader.load('lib/native-mutation.ts');
  const { fail } = harness.loader.load('lib/api.ts');
  const outcome = { state: 'committed', operation: 'comment', issueId: 'work-a', receiptId: 'receipt', phase: 'readback' };
  const response = fail(new NativeMutationError(outcome, new Error('Retry when writes settle.')));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.code, 'mutation_committed');
  assert.deepEqual(body.outcome, outcome);
  assert.doesNotMatch(body.error, /Retry when writes settle/);
});
