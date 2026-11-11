// Real native UI workflows in the integration runner's disposable project.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.SCOTTY_TEST_URL;
const projectId = process.env.SCOTTY_TEST_PROJECT;
const output = process.env.SCOTTY_TEST_OUTPUT;
assert.ok(base && projectId && output, 'Set SCOTTY_TEST_URL, SCOTTY_TEST_PROJECT and SCOTTY_TEST_OUTPUT for an isolated native fixture');
fs.mkdirSync(output, { recursive: true });
const prefix = `${base}/api/p/${encodeURIComponent(projectId)}`;
const evidence = [];
async function snapshot() {
  const response = await fetch(`${prefix}/beads`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meta.kind, 'bead-rs');
  assert.ok(Array.isArray(body.meta.readyIds));
  return body;
}
const initial = await snapshot();
const blocker = initial.beads.find(bead => bead.status === 'open' && !bead.assignee);
assert.ok(blocker, 'The fixture needs an existing open unassigned dependency target');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const suffix = Date.now().toString(36);
const title = `UI native "quoted" 日本語 ${suffix}`;
let issueId;
try {
  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
  await page.goto(`${base}/p/${encodeURIComponent(projectId)}?view=board`);
  await page.getByRole('heading', { name: 'Board', exact: true }).waitFor();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByLabel('Type', { exact: true }).fill('review_check');
  await create.getByPlaceholder('What needs doing?').fill(title);
  await create.getByPlaceholder('Optional details, acceptance criteria…', { exact: true }).fill('- [ ] Native checklist\n\nDescription 日本語');
  assert.equal(await create.getByRole('button', { name: 'Attach image' }).count(), 0);
  assert.equal(await create.getByText('Parent', { exact: true }).count(), 0);
  assert.match(await create.innerText(), /Creation author is not recorded/);
  await create.getByRole('button', { name: 'Create bead', exact: true }).click();
  await create.waitFor({ state: 'hidden' });
  const created = (await snapshot()).beads.find(bead => bead.title === title);
  assert.ok(created, 'UI create must persist the new record');
  issueId = created.id;
  assert.equal(created.issue_type, 'review_check');
  evidence.push({ step: 'create', bead: created });

  await page.locator(`[data-keyboard-bead-id="${issueId}"]`).click();
  let drawer = page.getByRole('dialog');
  await drawer.getByText(title, { exact: true }).waitFor();
  assert.match(await drawer.innerText(), /Unknown author/);
  assert.equal(await drawer.getByTitle('Edit title & description', { exact: true }).isEnabled(), true);
  assert.equal(await drawer.getByTitle('Delete', { exact: true }).count(), 0);
  assert.equal(await drawer.getByTitle('Archive (close + label)', { exact: true }).count(), 0);
  assert.equal(await drawer.getByRole('button', { name: 'Refine with AI' }).count(), 0);
  assert.equal(await drawer.getByLabel('Priority', { exact: true }).isEnabled(), true);

  await drawer.getByTitle('Edit title & description', { exact: true }).click();
  await drawer.getByLabel('Title', { exact: true }).fill('Discarded title');
  await drawer.getByLabel('Type', { exact: true }).fill('discarded_type');
  await drawer.getByLabel('Notes', { exact: true }).fill('Discarded notes');
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  let current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.equal(current.title, title);
  assert.equal(current.issue_type, 'review_check');
  assert.equal(current.notes, '');

  const editedTitle = `Edited UI native 日本語 ${suffix}`;
  const editedDescription = '- [ ] Saved native checklist\n\nChanged description 日本語';
  const editedNotes = `Saved notes ${suffix}\nSecond line`;
  await drawer.getByTitle('Edit title & description', { exact: true }).click();
  await drawer.getByLabel('Title', { exact: true }).fill(editedTitle);
  await drawer.getByPlaceholder('Describe this bead…', { exact: true }).fill(editedDescription);
  await drawer.getByLabel('Type', { exact: true }).fill('custom_review');
  await drawer.getByLabel('Notes', { exact: true }).fill(editedNotes);
  assert.equal(await drawer.getByRole('button', { name: 'Attach image' }).count(), 0);
  assert.equal(await drawer.getByRole('button', { name: 'Refine with AI' }).count(), 0);
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await drawer.getByRole('heading', { name: editedTitle, exact: true }).waitFor();
  await Promise.all([
    page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/beads/${issueId}`) && response.status() === 200),
    drawer.getByLabel('Priority', { exact: true }).selectOption('0'),
  ]);
  await drawer.getByLabel('Priority', { exact: true }).locator('option:checked').filter({ hasText: 'Critical' }).waitFor({ state: 'attached' });
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.equal(current.title, editedTitle);
  assert.equal(current.description, editedDescription);
  assert.equal(current.issue_type, 'custom_review');
  assert.equal(current.notes, editedNotes);
  assert.equal(current.priority, 0);
  evidence.push({ step: 'edit scalars', bead: current });

  const checkbox = drawer.getByRole('checkbox');
  assert.equal(await checkbox.isEnabled(), true);
  await Promise.all([
    page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/beads/${issueId}`) && response.status() === 200),
    checkbox.check(),
  ]);
  assert.equal((await snapshot()).beads.find(bead => bead.id === issueId).description,
    editedDescription.replace('- [ ]', '- [x]'));

  await drawer.getByTitle('Edit title & description', { exact: true }).click();
  await drawer.getByLabel('Notes', { exact: true }).fill('');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await drawer.getByRole('heading', { name: editedTitle, exact: true }).waitFor();
  assert.equal((await snapshot()).beads.find(bead => bead.id === issueId).notes, '');

  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: true } });
  const refused = await context.request.patch(`${prefix}/beads/${issueId}`, { data: { title: 'Read-only overwrite' } });
  assert.equal(refused.status(), 403);
  assert.equal((await refused.json()).code, 'read_only');
  await page.reload();
  drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: editedTitle, exact: true }).waitFor();
  assert.equal(await drawer.getByTitle('Edit title & description', { exact: true }).count(), 0);
  assert.equal(await drawer.getByLabel('Priority', { exact: true }).isEnabled(), false);
  await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
  await page.reload();
  drawer = page.getByRole('dialog');
  await drawer.getByRole('heading', { name: editedTitle, exact: true }).waitFor();
  const comment = `Persisted UI comment ${suffix}`;
  await drawer.getByPlaceholder(/^Comment as /).fill(comment);
  await drawer.getByRole('button', { name: 'Comment', exact: true }).click();
  await drawer.getByText(comment, { exact: true }).waitFor();

  // Assignment and clearing remain distinct from starting and releasing work.
  await drawer.getByRole('button', { name: 'Change assignee' }).click();
  await drawer.getByLabel('Assignee', { exact: true }).fill(initial.meta.humanActor);
  await drawer.getByRole('button', { name: 'Save assignee' }).click();
  await drawer.getByRole('button', { name: 'Change assignee' }).waitFor();
  assert.equal((await snapshot()).beads.find(bead => bead.id === issueId).assignee, initial.meta.humanActor);
  await drawer.getByRole('button', { name: 'Change assignee' }).click();
  await drawer.getByLabel('Assignee', { exact: true }).fill('');
  await drawer.getByRole('button', { name: 'Save assignee' }).click();
  await drawer.getByRole('button', { name: 'Change assignee' }).waitFor();
  assert.equal((await snapshot()).beads.find(bead => bead.id === issueId).assignee, '');

  const labelWrites = [];
  page.on('request', request => {
    if (request.url().endsWith(`/beads/${issueId}/labels`)) labelWrites.push({ method: request.method(), body: request.postDataJSON() });
  });
  const externalLabel = `external-${suffix}`;
  const externalAdd = await context.request.post(`${prefix}/beads/${issueId}/labels`, { data: { label: externalLabel } });
  assert.equal(externalAdd.status(), 200);
  const labels = drawer.getByLabel('Add label', { exact: true });
  await labels.fill(`ui-${suffix}`);
  await labels.press('Enter');
  await drawer.getByRole('button', { name: `Remove label ui-${suffix}` }).waitFor();
  assert.ok((await snapshot()).beads.find(bead => bead.id === issueId).labels.includes(externalLabel));
  await drawer.getByRole('button', { name: `Remove label ui-${suffix}` }).click();
  await drawer.getByRole('button', { name: `Remove label ui-${suffix}` }).waitFor({ state: 'hidden' });
  assert.ok((await snapshot()).beads.find(bead => bead.id === issueId).labels.includes(externalLabel));
  assert.deepEqual(labelWrites, [{ method: 'POST', body: { label: `ui-${suffix}` } }, { method: 'DELETE', body: { label: `ui-${suffix}` } }]);

  for (const kind of ['blocks', 'relates_to', 'verifies']) {
    await drawer.getByRole('button', { name: 'Add dependency', exact: true }).click();
    await drawer.getByLabel('Dependency type').selectOption(kind);
    await drawer.getByLabel('Search dependency beads').fill(blocker.id);
    await drawer.locator('[cmdk-item]').filter({ hasText: blocker.id }).click();
    await drawer.getByRole('button', { name: 'Add', exact: true }).click();
    await drawer.getByLabel('Dependency type').waitFor({ state: 'hidden' });
  }
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.deepEqual(current.dependencies.filter(dep => dep.depends_on_id === blocker.id).map(dep => dep.type).sort(), ['blocks', 'relates_to', 'verifies']);
  await drawer.getByTitle('Close', { exact: true }).click();
  await drawer.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  const labelBoxes = [];
  for (const kind of ['blocks', 'relates_to', 'verifies']) {
    const edge = page.locator(`.react-flow__edge[data-id="${issueId}->${blocker.id}:${kind}"]`);
    const label = edge.locator('.react-flow__edge-text');
    await label.waitFor();
    assert.equal(await label.textContent(), kind);
    labelBoxes.push(await label.boundingBox());
  }
  assert.equal(await page.getByText('parent-child', { exact: true }).count(), 0);
  for (let i = 0; i < labelBoxes.length; i++) for (let j = i + 1; j < labelBoxes.length; j++) {
    const a = labelBoxes[i], b = labelBoxes[j];
    assert.ok(a && b && (a.y + a.height <= b.y || b.y + b.height <= a.y), 'Same-pair kind labels must not overlap');
  }
  await page.screenshot({ path: path.join(output, 'native-ui-graph.png'), fullPage: true });
  await page.locator(`[data-keyboard-bead-id="${issueId}"]`).click();
  drawer = page.getByRole('dialog');
  for (const kind of ['relates_to', 'verifies']) {
    const relationship = drawer.locator('div').filter({ has: drawer.getByText(kind, { exact: true }) }).filter({ has: drawer.getByTitle('remove', { exact: true }) });
    await relationship.last().getByTitle('remove', { exact: true }).click();
    await drawer.getByText(kind, { exact: true }).waitFor({ state: 'hidden' });
  }
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.deepEqual(current.dependencies.filter(dep => dep.depends_on_id === blocker.id).map(dep => dep.type), ['blocks']);
  await drawer.getByTitle('remove', { exact: true }).click();
  await drawer.getByTitle('remove', { exact: true }).waitFor({ state: 'hidden' });

  const status = drawer.getByLabel('Status', { exact: true });
  await status.selectOption('in_progress');
  await status.locator('option:checked').filter({ hasText: 'In progress' }).waitFor({ state: 'attached' });
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.equal(current.status, 'in_progress');
  assert.equal(current.assignee, initial.meta.humanActor);
  await status.selectOption('open');
  await status.locator('option:checked').filter({ hasText: 'Open' }).waitFor({ state: 'attached' });
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.equal(current.status, 'open');
  assert.equal(current.assignee, '');

  await status.selectOption('closed');
  assert.equal(await drawer.getByRole('button', { name: 'Close with reason', exact: true }).isEnabled(), false);
  await drawer.getByPlaceholder(/^Why is this done/).fill(`UI verified ${suffix}`);
  await drawer.getByRole('button', { name: 'Close with reason', exact: true }).click();
  await drawer.getByText(`UI verified ${suffix}`, { exact: true }).waitFor();
  current = (await snapshot()).beads.find(bead => bead.id === issueId);
  assert.equal(current.status, 'closed');
  assert.equal(current.close_reason, `UI verified ${suffix}`);
  await status.selectOption('open');
  await status.locator('option:checked').filter({ hasText: 'Open' }).waitFor({ state: 'attached' });

  await page.reload();
  drawer = page.getByRole('dialog');
  await drawer.getByText(comment, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'native-ui-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await drawer.getByPlaceholder(/^Comment as /).fill(`Mobile comment ${suffix}`);
  await drawer.getByRole('button', { name: 'Comment', exact: true }).click();
  await drawer.getByText(`Mobile comment ${suffix}`, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'native-ui-mobile.png'), fullPage: true });
  evidence.push({ step: 'reload and mobile comment', bead: (await snapshot()).beads.find(bead => bead.id === issueId) });
  assert.deepEqual(errors, []);
  console.log(`PASS native UI scalar edits, cancellation, checklist, read-only mode, comments, assignment, labels, exact-kind dependencies, lifecycle, reload and mobile comment: ${issueId}`);
} finally {
  fs.writeFileSync(path.join(output, 'native-ui-evidence.json'), JSON.stringify({ issueId, evidence, errors }, null, 2));
  await context.tracing.stop({ path: path.join(output, 'native-ui-trace.zip') });
  await browser.close();
}
