// Keep a real native priority write owned by its palette until read-only reconciliation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.SCOTTY_TEST_URL;
const projectId = process.env.SCOTTY_TEST_PROJECT;
const output = process.env.SCOTTY_TEST_OUTPUT;
assert.ok(base && projectId && output, 'Set isolated SCOTTY_TEST_URL, SCOTTY_TEST_PROJECT and SCOTTY_TEST_OUTPUT');
fs.mkdirSync(output, { recursive: true });
const prefix = `${base}/api/p/${encodeURIComponent(projectId)}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const evidence = { boundary: 'HTTP response replaced after a real successful native priority write', updates: 0 };
try {
  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
  const created = await context.request.post(`${prefix}/beads`, { data: { title: `Palette priority recovery ${Date.now()}`, priority: 2 } });
  assert.equal(created.status(), 201);
  const bead = await created.json();
  evidence.issueId = bead.id;
  const itemUrl = `${prefix}/beads/${bead.id}`;
  await page.route(itemUrl, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    evidence.updates++;
    assert.equal(evidence.updates, 1, 'Palette priority must not be replayed');
    assert.deepEqual(route.request().postDataJSON(), { priority: 1 });
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 200);
    evidence.updateReadback = await response.json();
    await route.fulfill({ status: 409, json: { error: 'Injected uncertain native priority UI boundary', code: 'mutation_uncertain',
      outcome: { state: 'uncertain', operation: 'update', issueId: bead.id, phase: 'command' } } });
  });
  await page.goto(`${base}/p/${encodeURIComponent(projectId)}?view=board`);
  const item = page.locator(`[data-keyboard-bead-id="${bead.id}"]`);
  await item.waitFor();
  await item.focus();
  await page.keyboard.press('p');
  const palette = page.getByRole('dialog');
  await Promise.all([
    page.waitForResponse(response => response.url() === itemUrl && response.request().method() === 'PATCH' && response.status() === 409),
    palette.locator('[cmdk-item]').filter({ hasText: /P1/ }).click(),
  ]);
  await palette.getByRole('alert').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await palette.getByRole('alert').isVisible(), true, 'Escape must retain an unverified priority submission');
  await page.keyboard.press('Control+k');
  assert.equal(await palette.getByRole('alert').isVisible(), true, 'The palette shortcut must retain the pending recovery');
  await page.keyboard.press('Enter');
  assert.equal(evidence.updates, 1);
  await page.screenshot({ path: path.join(output, 'native-palette-priority-recovery.png'), fullPage: true });
  await palette.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await palette.waitFor({ state: 'hidden' });
  const persisted = await (await context.request.get(itemUrl)).json();
  assert.equal(persisted.priority, 1);
  assert.equal(persisted.title, bead.title);
  assert.equal(evidence.updates, 1);
  evidence.persisted = persisted;
  console.log('PASS native palette priority remains owned through uncertain response and refresh without a second write');
} finally {
  fs.writeFileSync(path.join(output, 'native-priority-recovery-evidence.json'), JSON.stringify(evidence, null, 2));
  await context.tracing.stop({ path: path.join(output, 'native-priority-recovery-trace.zip') });
  await browser.close();
}
