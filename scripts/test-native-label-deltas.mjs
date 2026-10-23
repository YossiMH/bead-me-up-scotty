import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue } from './fixtures/native-contract.mjs';
import { storeHarness, writes } from './support/store-harness.mjs';

for (const [action, label, labels] of [['add', 'B', ['A', 'B', 'C']], ['remove', 'A', ['C']], ['add', '--help', ['A', '--help', 'C']], ['remove', '--help', ['C']]]) {
  test(`native label ${action} ${label} preserves unrelated external C without a stale-set diff`, async () => {
    const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
      if (args[0] === 'label') {
        assert.deepEqual(args, ['label', action, 'work-a', `--label=${label}`]);
        return 'work-a';
      }
      if (args[0] === 'show') return nativeIssue('work-a', { labels, revision: 1 });
    } });
    const store = await harness.getStore();
    const bead = await store[action === 'add' ? 'addLabel' : 'removeLabel']('work-a', label, harness.actor);
    assert.deepEqual(bead.labels, labels);
    const commands = writes(harness.calls);
    assert.equal(commands.length, 1);
    assert.equal(commands[0].args[0], 'label');
    assert.ok(store.capabilities.operations.includes('label-delta'));
    assert.ok(!store.capabilities.editableFields.includes('labels'));
  });
}

for (const method of ['POST', 'DELETE']) {
  for (const body of [{ label: '' }, { label: '  ' }, { label: 'A', status: 'closed' }, { labels: ['A'] }]) {
    test(`native labels ${method} rejects invalid or compound input before CLI: ${JSON.stringify(body)}`, async () => {
      const harness = storeHarness({ backend: 'bead-rs' });
      const route = harness.loader.load('app/api/p/[projectId]/beads/[id]/labels/route.ts');
      const response = await route[method](new Request('http://localhost/labels', { method, body: JSON.stringify(body) }),
        { params: Promise.resolve({ projectId: 'contract', id: 'work-a' }) });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'invalid_input');
      assert.equal(harness.calls.length, 0);
    });
  }
}

test('original bd retains replace-all labels and does not advertise native deltas', async () => {
  const harness = storeHarness({ backend: 'bd' });
  const store = await harness.getStore();
  assert.ok(store.capabilities.editableFields.includes('labels'));
  assert.ok(!store.capabilities.operations.includes('label-delta'));
});

for (const method of ['POST', 'DELETE']) {
  test(`native label ${method} route dispatches exactly one delta and returns current labels`, async () => {
    const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
      if (args[0] === 'label') return 'work-a';
      if (args[0] === 'show') return nativeIssue('work-a', { labels: ['external-C'], revision: 1 });
    } });
    const route = harness.loader.load('app/api/p/[projectId]/beads/[id]/labels/route.ts');
    const response = await route[method](new Request('http://localhost/labels', { method, body: JSON.stringify({ label: 'B' }) }),
      { params: Promise.resolve({ projectId: 'contract', id: 'work-a' }) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).labels, ['external-C']);
    assert.deepEqual(writes(harness.calls).map(({ args }) => args), [['label', method === 'POST' ? 'add' : 'remove', 'work-a', '--label=B']]);
  });
}

test('original bd refuses the native-only label route without mutation', async () => {
  const harness = storeHarness({ backend: 'bd' });
  const route = harness.loader.load('app/api/p/[projectId]/beads/[id]/labels/route.ts');
  const response = await route.POST(new Request('http://localhost/labels', { method: 'POST', body: JSON.stringify({ label: 'B' }) }),
    { params: Promise.resolve({ projectId: 'contract', id: 'work-a' }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'unsupported_operation');
  assert.equal(writes(harness.calls).length, 0);
});
