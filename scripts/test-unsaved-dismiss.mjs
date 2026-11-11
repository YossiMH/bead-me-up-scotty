// Isolated server only; project data and writes are intercepted.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.SCOTTY_TEST_URL;
assert.ok(base, 'Set SCOTTY_TEST_URL to an isolated app server');
const bead = (id, extra = {}) => ({ id, title: `Draft ${id}`, description: 'Original text', status: 'open', issue_type: 'task', priority: 2, labels: [], dependencies: [], created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', ...extra });
const beads = [bead('alpha'), bead('beta', { status: 'in_progress' })];
const writes = [];
const browser = await chromium.launch({ executablePath: process.env.SCOTTY_TEST_CHROME || undefined });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  // Unlock editing for this browser session regardless of the server default.
  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/p/demo/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') { writes.push(path); return route.fulfill({ json: {} }); }
    if (path.endsWith('/beads/stream')) return route.abort();
    if (path.endsWith('/beads')) return route.fulfill({ json: { beads, meta: { kind: 'demo', humanActor: 'reviewer', humanAllowlist: ['reviewer'], pollIntervalMs: 300000 } } });
    return route.fulfill({ json: beads.find((b) => path.endsWith(`/beads/${b.id}`)) ?? {} });
  });
  await page.goto(`${base}/p/demo`);
  const item = (id) => page.locator(`[data-keyboard-bead-id="${id}"]`).first();
  await item('alpha').waitFor();
  const dialog = page.getByRole('dialog');
  const clickOutside = () => page.mouse.click(8, 990);

  // ── Create dialog ──────────────────────────────────────────────────────────
  await page.keyboard.press('n');
  await dialog.waitFor();
  await clickOutside();
  await dialog.waitFor({ state: 'detached' }); // an empty form still closes on a stray click

  await page.keyboard.press('n');
  const title = page.getByPlaceholder('What needs doing?');
  await title.fill('Half-written bead');
  await clickOutside();
  await page.getByText("Your new bead isn't saved yet").waitFor();
  assert.equal(await dialog.count(), 1, 'a dirty create dialog survives an outside click');
  assert.equal(await title.inputValue(), 'Half-written bead');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' }); // Esc is deliberate and still discards

  // ── Detail drawer: comment draft ───────────────────────────────────────────
  await item('alpha').focus();
  await page.keyboard.press('o');
  const comment = page.getByPlaceholder(/^Comment as/);
  await comment.fill('Unsent comment');
  await clickOutside();
  await page.getByText('You have unsaved changes').waitFor();
  assert.equal(await dialog.count(), 1, 'a drawer with a comment draft survives an outside click');
  assert.equal(await comment.inputValue(), 'Unsent comment');
  await comment.fill('');
  await clickOutside();
  await dialog.waitFor({ state: 'detached' }); // nothing unsaved: closes as before

  // ── Detail drawer: title/description edit ──────────────────────────────────
  await item('alpha').focus();
  await page.keyboard.press('e');
  const titleEdit = page.getByPlaceholder('Title', { exact: true });
  await titleEdit.fill('Renamed but not saved');
  await clickOutside();
  await page.waitForTimeout(300);
  assert.equal(await dialog.count(), 1, 'an unsaved edit survives an outside click');
  assert.equal(await titleEdit.inputValue(), 'Renamed but not saved');
  await dialog.getByTitle('Close', { exact: true }).click();
  await dialog.waitFor({ state: 'detached' }); // the Close button is deliberate

  assert.deepEqual(writes, [], 'nothing was written');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
console.log('PASS unsaved dismiss: dirty create dialog and drawer ignore stray outside clicks; Esc/Close and clean forms still close');
