// The qualified native API emits label events without changing issue revision.
import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue } from './fixtures/native-contract.mjs';
import { storeHarness, writes } from './support/store-harness.mjs';

test('same-label concurrency returns current state, not a promised replacement set', async () => {
  const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
    if (args[0] === 'label') return 'work-a';
    // Another native writer removed B after this request added B, with no revision bump.
    if (args[0] === 'show') return nativeIssue('work-a', { labels: ['external'], revision: 1 });
  } });
  const bead = await (await harness.getStore()).addLabel('work-a', 'B', 'test-person');
  assert.deepEqual(bead.labels, ['external']);
  assert.deepEqual(writes(harness.calls).map(({ args }) => args), [['label', 'add', 'work-a', '--label=B']]);
});
