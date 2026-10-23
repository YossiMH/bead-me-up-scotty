import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';
const { createUpdater } = sourceLoader().load('lib/update-service.ts');
const root = process.env.SCOTTY_TEST_ROOT;
assert.ok(root, 'Set SCOTTY_TEST_ROOT to an isolated temporary test directory');
fs.mkdirSync(root, { recursive: true });
const cwd = fs.mkdtempSync(path.join(root, 'fork-updater-'));
fs.mkdirSync(path.join(cwd, '.git'));
const sha = 'a'.repeat(40);
function harness(origin) {
  const calls = [];
  const updater = createUpdater({ cwd, version: '0.1.0', repository: 'brendan-appstart/bead-me-up-scotty',
    fetch: async () => { calls.push(['http']); return Response.json({ tag_name: 'v0.2.0' }); },
    run: async (command, args) => {
      calls.push([command, ...args]);
      if (args.join(' ') === 'remote get-url origin') {
        if (origin === null) throw new Error('No origin remote');
        return { stdout: origin, stderr: '' };
      }
      if (args[0] === 'branch') return { stdout: 'main', stderr: '' };
      if (args[0] === 'status') return { stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { stdout: sha, stderr: '' };
      if (args[0] === 'ls-remote') return { stdout: `${sha}\trefs/tags/v0.2.0`, stderr: '' };
      throw new Error(`Unexpected updater action: ${command} ${args.join(' ')}`);
    },
  });
  return { updater, calls };
}
test.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
test('fork discovery stops before fetching upstream metadata or objects', async () => {
  const { updater, calls } = harness('https://github.com/team/scotty-fork.git');
  for (const channel of ['stable', 'development']) {
    const status = await updater.check(channel);
    assert.equal(status.canUpdate, false);
    assert.equal(status.target, undefined);
    assert.match(status.manualReason, /fork|origin/i);
  }
  assert.ok(calls.every(call => call.join(' ') === 'git remote get-url origin'));
});
test('direct update cannot bypass fork origin policy', async () => {
  const { updater, calls } = harness('git@github.com:team/scotty-fork.git');
  await assert.rejects(updater.update({ channel: 'stable', sha, tag: 'v0.2.0' }), /fork|origin/i);
  assert.equal(calls.some(call => ['fetch', 'merge'].includes(call[1]) || call[0] === 'npm'), false);
});
test('missing origin is manual rather than assumed upstream', async () => {
  const { updater } = harness(null);
  const status = await updater.check();
  assert.equal(status.canUpdate, false);
  assert.match(status.manualReason, /origin/i);
});
test('upstream SSH and HTTPS origins retain stable update discovery', async () => {
  for (const origin of ['git@github.com:brendan-appstart/bead-me-up-scotty.git', 'https://github.com/brendan-appstart/bead-me-up-scotty.git', 'ssh://git@github.com/brendan-appstart/bead-me-up-scotty.git']) {
    const { updater } = harness(origin);
    const status = await updater.check();
    assert.equal(status.canUpdate, true, origin);
    assert.equal(status.target.sha, sha);
  }
});
