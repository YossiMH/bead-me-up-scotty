// A readback may race another assignment. Visible epochs alone are not authority.
import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeIssue } from './fixtures/native-contract.mjs';
import { storeHarness } from './support/store-harness.mjs';

test('assignment readback cannot adopt an epoch minted after our own command', async () => {
  let assigned = false;
  const harness = storeHarness({ backend: 'bead-rs', reply: ({ args }) => {
    if (args[0] === 'update') {
      assigned = true;
      return 'work-a';
    }
    if (args[0] === 'show') {
      return nativeIssue('work-a', assigned
        ? { assignee: 'test-person', claim_epoch: 2, revision: 3 }
        : {});
    }
  } });
  const store = await harness.getStore();
  await assert.rejects(() => store.update('work-a', { assignee: 'test-person' }, 'test-person'),
    (error) => error.code === 'mutation_committed' && error.outcome.phase === 'credential');
});

test('own assignment survives restart, but a later same-actor tenure is not adopted', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const home = fs.mkdtempSync(path.join(process.env.SCOTTY_TEST_ROOT || os.tmpdir(), 'scotty-claim-restart-'));
  let issue = nativeIssue('owned-after-restart');
  const env = { XDG_CONFIG_HOME: home };
  const reply = ({ args }) => {
    if (args[0] === 'show') return issue;
    if (args[0] === 'list') return args.includes('--ready') ? [] : [issue];
    if (args[0] === 'query') return [{ Id: issue.id, IssueType: 'task', ClosedAt: null, CloseReason: null }];
    if (args[0] === 'update') {
      issue = nativeIssue(issue.id, { assignee: 'test-person', claim_epoch: 1, revision: 2, status: 'in_progress', effective_status: 'in_progress' });
      return issue.id;
    }
    if (args[0] === 'release') {
      assert.equal(args[args.indexOf('--fencing-token') + 1], '1');
      issue = nativeIssue(issue.id, { claim_epoch: 1, revision: 3 });
      return issue.id;
    }
  };
  try {
    const first = storeHarness({ backend: 'bead-rs', env, reply });
    await (await first.getStore()).setStatus(issue.id, 'in_progress', 'test-person');
    const restarted = storeHarness({ backend: 'bead-rs', env, reply });
    const result = await (await restarted.getStore()).setStatus(issue.id, 'open', 'test-person');
    assert.equal(result.assignee, '');
    assert.equal(result.status, 'open');
    issue = nativeIssue(issue.id, { assignee: 'test-person', claim_epoch: 2, revision: 4 });
    const foreignTenure = storeHarness({ backend: 'bead-rs', env, reply });
    await assert.rejects(() => foreignTenure.getStore().then((store) => store.setStatus(issue.id, 'closed', 'test-person', 'Done')),
      (error) => error.code === 'claim_conflict');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
