// Run with an explicit local binary and disposable root:
// BEAD_BIN=... SCOTTY_TEST_ROOT=... node --conditions=react-server
//   --import ./scripts/support/register-source.mjs --test scripts/test-local-bead-rs.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createNativeStore } from '../lib/native-store.ts';
import { isolateFixtureGit, initializeGitFixture, createUnrelatedMarker, assertGitCheckpoint } from './support/git-fixture.mjs';

const execute = promisify(execFile);
const binary = process.env.BEAD_BIN;
const root = process.env.SCOTTY_TEST_ROOT;
assert.ok(binary && path.isAbsolute(binary), 'BEAD_BIN must name the real local bead-rs binary');
assert.ok(root && path.isAbsolute(root), 'SCOTTY_TEST_ROOT must be an isolated absolute directory');
isolateFixtureGit();
fs.mkdirSync(root, { recursive: true });
const run = fs.mkdtempSync(path.join(root, 'local-contract-'));
const workspace = path.join(run, 'project');
fs.mkdirSync(workspace);
const unrelatedMarker = createUnrelatedMarker(workspace);
const commands = [];
async function cli(args) {
  const result = await execute(binary, args, { cwd: workspace, env: process.env, timeout: 60000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  commands.push({ args, stdout: result.stdout, stderr: result.stderr });
  fs.writeFileSync(path.join(run, 'commands.json'), JSON.stringify(commands, null, 2));
  return result.stdout;
}

test('local bead-rs supports complete reads and native edits through the real store', async () => {
  await initializeGitFixture(workspace);
  await cli(['init', '--prefix', 'local']);
  const capabilities = JSON.parse(await cli(['capabilities']));
  fs.writeFileSync(path.join(run, 'capabilities.json'), JSON.stringify(capabilities, null, 2));
  const id = (await cli(['create', '--title', 'Local Scotty compatibility'])).trim();
  const store = await createNativeStore(workspace);
  const listed = await store.listSnapshot();
  assert.deepEqual(listed.beads.map((issue) => issue.id), [id]);
  assert.equal((await store.get(id)).title, 'Local Scotty compatibility');
  assert.ok(store.capabilities.operations.includes('create'));
  const manifest = path.join(run, 'volume.json');
  fs.writeFileSync(manifest, JSON.stringify({ manifest_version: 1, operations: Array.from({ length: 105 }, (_, index) => ({ op: 'create', title: `Volume ${index}` })) }));
  await cli(['manifest', 'commit', '--input', manifest, '--format', 'json']);
  assert.equal((await store.listSnapshot()).beads.length, 106, 'read beyond the CLI default page');
  const created = await store.create({ title: 'Created by Scotty', description: 'Two lines\nRetained', priority: 2, issue_type: 'task', labels: ['initial'] }, 'scotty-test');
  assert.equal(created.description, 'Two lines\nRetained');
  assert.ok((await store.addComment(created.id, 'Real comment', 'scotty-test')).comments.some((comment) => comment.text === 'Real comment'));
  assert.ok((await store.addLabel(created.id, 'delta', 'scotty-test')).labels.includes('delta'));
  assert.ok(!(await store.removeLabel(created.id, 'delta', 'scotty-test')).labels.includes('delta'));
  assert.ok((await store.addDep(created.id, id, 'verifies', 'scotty-test')).dependencies.some((dep) => dep.depends_on_id === id && dep.type === 'verifies'));
  await store.removeDep(created.id, id, 'scotty-test', 'verifies');
  assert.equal((await store.setStatus(created.id, 'closed', 'scotty-test', 'Verified close')).close_reason, 'Verified close');
  await store.setStatus(created.id, 'open', 'scotty-test');
  assert.equal((await store.setStatus(created.id, 'in_progress', 'scotty-test')).assignee, 'scotty-test');
  assert.equal((await store.setStatus(created.id, 'open', 'scotty-test')).assignee, '');
  fs.writeFileSync(path.join(run, 'git-result.json'), JSON.stringify(await assertGitCheckpoint(workspace, unrelatedMarker), null, 2));
});
