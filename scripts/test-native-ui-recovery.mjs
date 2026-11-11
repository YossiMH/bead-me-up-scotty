// UI-boundary failure injection only: real native writes, substituted error responses.
// This does not test server/native propagation of an actual readback failure.
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
const title = `UI committed-response ${Date.now()}`;
const text = `UI committed comment ${Date.now()}`;
const label = `recovered-${Date.now()}`;
let labelListFails = false;
const evidence = { boundary: 'HTTP response replaced after a real successful native write', creates: 0, comments: 0, updates: 0, labels: 0, labelReads: 0 };
try {
  const initial = await (await context.request.get(`${prefix}/beads`)).json();
  assert.equal(initial.meta.kind, 'bead-rs');
  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
  await page.route(`${prefix}/beads`, async route => {
    if (route.request().method() === 'GET' && labelListFails) {
      return route.fulfill({ status: 503, json: { error: 'Injected coherent list read failure' } });
    }
    if (route.request().method() !== 'POST') return route.continue();
    evidence.creates++;
    assert.equal(evidence.creates, 1, 'Create must not be replayed');
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 201);
    const bead = await response.json();
    evidence.issueId = bead.id;
    evidence.createReadback = bead;
    await route.fulfill({ status: 409, json: { error: 'Injected readback-unavailable UI boundary', code: 'mutation_committed', outcome: { state: 'committed', operation: 'create', issueId: bead.id, phase: 'readback' } } });
  });
  await page.goto(`${base}/p/${encodeURIComponent(projectId)}?view=board`);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByPlaceholder('What needs doing?').fill(title);
  await create.getByRole('button', { name: 'Create bead', exact: true }).click();
  await create.getByRole('alert').waitFor();
  assert.match(await create.getByRole('alert').innerText(), /committed/);
  assert.ok((await create.getByRole('alert').innerText()).includes(evidence.issueId));
  assert.equal(await create.getByRole('button', { name: 'Create bead', exact: true }).isEnabled(), false);
  await create.press('Control+Enter');
  assert.equal(evidence.creates, 1);
  await page.screenshot({ path: path.join(output, 'native-create-recovery.png'), fullPage: true });
  await create.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await page.getByRole('dialog').getByText(title, { exact: true }).waitFor();
  const drawer = page.getByRole('dialog');
  await page.route(`${prefix}/beads/${evidence.issueId}/comments`, async route => {
    evidence.comments++;
    assert.equal(evidence.comments, 1, 'Comment must not be replayed');
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 200);
    const bead = await response.json();
    const comment = bead.comments.find(comment => comment.text === text);
    assert.ok(comment?.id, 'Keep the real comment receipt');
    evidence.commentId = comment.id;
    await route.fulfill({ status: 409, json: { error: 'Injected readback-unavailable UI boundary', code: 'mutation_committed', outcome: { state: 'committed', operation: 'comment', issueId: bead.id, receiptId: comment.id, phase: 'readback' } } });
  });
  await drawer.getByPlaceholder(/^Comment as /).fill(text);
  await drawer.getByRole('button', { name: 'Comment', exact: true }).click();
  await drawer.getByRole('alert').waitFor();
  assert.ok((await drawer.getByRole('alert').innerText()).includes(evidence.commentId));
  assert.equal(await drawer.getByRole('button', { name: 'Comment', exact: true }).isEnabled(), false);
  await page.screenshot({ path: path.join(output, 'native-comment-recovery.png'), fullPage: true });
  await drawer.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await drawer.getByRole('alert').waitFor({ state: 'hidden' });
  assert.equal(await drawer.getByPlaceholder(/^Comment as /).inputValue(), '');
  const editedTitle = `${title} edited`;
  await page.route(`${prefix}/beads/${evidence.issueId}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await route.fulfill({ status: 400, json: { error: 'Injected validation refusal', code: 'invalid_input' } });
  });
  await drawer.getByTitle('Edit title & description', { exact: true }).click();
  await drawer.getByLabel('Title', { exact: true }).fill(editedTitle);
  await drawer.getByLabel('Notes', { exact: true }).fill('Keep the submitted draft');
  await Promise.all([
    page.waitForResponse(response => response.request().method() === 'PATCH' && response.status() === 400),
    drawer.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  assert.equal(await drawer.getByLabel('Title', { exact: true }).inputValue(), editedTitle);
  assert.equal(await drawer.getByLabel('Notes', { exact: true }).inputValue(), 'Keep the submitted draft');
  assert.equal((await (await context.request.get(`${prefix}/beads/${evidence.issueId}`)).json()).title, title);
  await page.unroute(`${prefix}/beads/${evidence.issueId}`);
  await page.route(`${prefix}/beads/${evidence.issueId}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    evidence.updates++;
    assert.equal(evidence.updates, 1, 'Scalar edit must not be replayed');
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 200);
    evidence.updateReadback = await response.json();
    await route.fulfill({ status: 409, json: { error: 'Injected edit readback-unavailable UI boundary', code: 'mutation_committed',
      outcome: { state: 'committed', operation: 'update', issueId: evidence.issueId, phase: 'readback' } } });
  });
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await drawer.getByRole('alert').waitFor();
  assert.equal(await drawer.getByRole('button', { name: 'Save', exact: true }).isEnabled(), false);
  assert.equal(await drawer.getByLabel('Title', { exact: true }).inputValue(), editedTitle);
  await drawer.getByPlaceholder('Describe this bead…', { exact: true }).press('Control+Enter');
  assert.equal(evidence.updates, 1);
  await drawer.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await drawer.getByRole('alert').waitFor({ state: 'hidden' });
  await drawer.getByRole('heading', { name: editedTitle, exact: true }).waitFor();
  assert.equal(evidence.updates, 1);
  await page.screenshot({ path: path.join(output, 'native-edit-recovery.png'), fullPage: true });
  await page.unroute(`${prefix}/beads/${evidence.issueId}`);
  await page.route(`${prefix}/beads/${evidence.issueId}`, async route => {
    assert.equal(route.request().method(), 'GET');
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 200);
    evidence.labelReads++;
    return route.fulfill({ response });
  });
  await page.route(`${prefix}/beads/${evidence.issueId}/labels`, async route => {
    evidence.labels++;
    assert.equal(evidence.labels, 1, 'Label intent must not be replayed');
    const response = await route.fetch({ maxRetries: 0 });
    assert.equal(response.status(), 200);
    evidence.labelReadback = await response.json();
    labelListFails = true;
    await route.fulfill({ status: 409, json: { error: 'Injected label readback-unavailable UI boundary', code: 'mutation_committed', outcome: { state: 'committed', operation: 'label_add', issueId: evidence.issueId, phase: 'readback' } } });
  });
  const labels = drawer.getByLabel('Add label', { exact: true });
  await labels.fill(label);
  await labels.press('Enter');
  await drawer.getByRole('alert').waitFor();
  assert.equal(await labels.isEnabled(), false);
  await drawer.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await drawer.getByText(/Read-only refresh failed:/).waitFor();
  assert.ok(evidence.labelReads > 0, 'Targeted GET succeeded before the list failed');
  assert.equal(await labels.isEnabled(), false, 'Failed list refresh cannot unlock stale chips');
  assert.equal(evidence.labels, 1);
  await page.screenshot({ path: path.join(output, 'native-label-recovery-locked.png'), fullPage: true });
  labelListFails = false;
  await drawer.getByRole('button', { name: 'Refresh without resubmitting', exact: true }).click();
  await drawer.getByRole('alert').waitFor({ state: 'hidden' });
  await drawer.getByRole('button', { name: `Remove label ${label}`, exact: true }).waitFor();
  assert.equal(await labels.isEnabled(), true);
  assert.equal(evidence.labels, 1);
  await page.screenshot({ path: path.join(output, 'native-label-recovery-refreshed.png'), fullPage: true });
  const snapshot = await (await context.request.get(`${prefix}/beads`)).json();
  const matches = snapshot.beads.filter(bead => bead.id === evidence.issueId);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, editedTitle);
  assert.equal(matches[0].notes, 'Keep the submitted draft');
  assert.equal(matches[0].comments.filter(comment => comment.text === text).length, 1);
  assert.ok(matches[0].labels.includes(label));
  assert.equal(evidence.creates, 1);
  assert.equal(evidence.comments, 1);
  assert.equal(evidence.updates, 1);
  evidence.persisted = matches[0];
  console.log('PASS UI-boundary create/comment/edit/label recovery; failed list keeps labels locked, refreshed labels unlock, one real write each');
} finally {
  fs.writeFileSync(path.join(output, 'native-ui-recovery-evidence.json'), JSON.stringify(evidence, null, 2));
  await context.tracing.stop({ path: path.join(output, 'native-ui-recovery-trace.zip') });
  await browser.close();
}
