import assert from 'node:assert/strict';
import fs from 'node:fs';
import promises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sourceLoader } from './support/load-source-module.mjs';

for (const delayed of ['record', 'forget']) {
  test(`an in-flight old-tenure ${delayed} cannot overwrite or delete a newer issued credential`, async () => {
    const home = fs.mkdtempSync(path.join(process.env.SCOTTY_TEST_ROOT || os.tmpdir(), 'tenure-'));
    let resume;
    let entered;
    const paused = new Promise((resolve) => { resume = resolve; });
    const waiting = new Promise((resolve) => { entered = resolve; });
    let pause = false;
    try {
      const method = delayed === 'record' ? 'rename' : 'rm';
      const oldFs = { ...promises, [method]: async (...args) => {
        if (pause) { entered(); await paused; }
        return promises[method](...args);
      } };
      const load = (replacements = {}) => sourceLoader({ env: { XDG_CONFIG_HOME: home }, replacements })
        .load('lib/native-credentials.ts').nativeCredentials('/task/project', 'workspace');
      const oldStore = load({ 'node:fs/promises': oldFs });
      const newStore = load();
      await oldStore.record('issue', 'actor', 1);
      pause = true;
      const oldPending = delayed === 'record' ? oldStore.record('issue', 'actor', 1) : oldStore.forget('issue', 'actor', 1);
      await waiting;
      await newStore.record('issue', 'actor', 2);
      resume();
      await oldPending;
      assert.equal((await newStore.read('issue', 'actor', 2))?.epoch, 2);
      assert.equal(await newStore.read('issue', 'actor', 3), undefined);
    } finally { resume?.(); fs.rmSync(home, { recursive: true, force: true }); }
  });
}
