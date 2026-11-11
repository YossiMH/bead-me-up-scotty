import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { startOwnedProcess } from './support/owned-process.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const fixture = path.join(source, 'scripts', 'fixtures', 'owned-process-tree.mjs');

function running(pid) {
  try { process.kill(pid, 0); return 'running'; }
  catch (error) { if (error.code === 'ESRCH') return 'exited'; throw error; }
}

async function waitFor(check, description) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, description);
    await delay(10);
  }
}

test('browser command cleanup ends its descendant and preserves another process', {
  skip: process.platform !== 'win32', timeout: 20000,
}, async (t) => {
  const base = process.env.SCOTTY_CLEANUP_TEST_ROOT || path.join(source, '.temp', 'owned-process-tests');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'owned-tree-'));
  const owned = path.join(root, 'owned');
  const siblingDirectory = path.join(root, 'sibling');
  fs.mkdirSync(owned);
  fs.mkdirSync(siblingDirectory);
  const sibling = spawn(process.execPath, [fixture, 'leaf', siblingDirectory], { stdio: 'ignore', windowsHide: true });
  const siblingExit = once(sibling, 'exit');
  const observations = { root, siblingPid: sibling.pid };
  let command;
  t.after(async () => {
    fs.writeFileSync(path.join(owned, 'stop'), 'stop');
    fs.writeFileSync(path.join(siblingDirectory, 'stop'), 'stop');
    if (command) observations.commandExit = await command.stop();
    observations.siblingExit = await siblingExit;
    if (fs.existsSync(path.join(owned, 'leaf.json'))) {
      const leaf = JSON.parse(fs.readFileSync(path.join(owned, 'leaf.json'), 'utf8'));
      await waitFor(() => running(leaf.pid) === 'exited', 'fixture leaf must exit after its stop file');
      observations.finalLeafState = running(leaf.pid);
    }
    fs.writeFileSync(path.join(root, 'observations.json'), JSON.stringify(observations, null, 2));
  });
  command = await startOwnedProcess(process.execPath, [fixture, 'root', owned], {
    cwd: source, stdio: 'ignore', windowsHide: true,
  });
  observations.rootPid = command.pid;
  await waitFor(() => fs.existsSync(path.join(owned, 'leaf.json')) && fs.existsSync(path.join(siblingDirectory, 'leaf.json')), 'both real children must start');
  const leaf = JSON.parse(fs.readFileSync(path.join(owned, 'leaf.json'), 'utf8'));
  observations.leafPid = leaf.pid;
  assert.equal(running(leaf.pid), 'running');
  observations.commandExit = await command.stop();
  observations.leafAfterCommandStop = running(leaf.pid);
  observations.siblingAfterCommandStop = sibling.exitCode === null ? 'running' : 'exited';
  assert.equal(running(leaf.pid), 'exited', 'stopping the launcher must also end its owned descendant');
  assert.equal(sibling.exitCode, null, 'an unrelated sibling must remain running');
});
