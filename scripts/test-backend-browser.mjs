// Real browser against the isolated server/workspace owned by the integration runner.
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Verify real list/detail rendering and capability controls without intercepting
 * project responses. The integration runner owns fixture creation and cleanup.
 */
export async function checkBackendBrowser({ base, projectId, backend, issueId, runDirectory, seeded }) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    await context.request.put(`${base}/api/viewer-mode`, { data: { readOnly: false } });
    await page.goto(`${base}/p/${projectId}`);
    await page.getByRole('heading', { name: 'Board', exact: true }).waitFor();
    if (backend === 'bead-rs') {
      const readyColumn = page.locator('section').filter({ has: page.getByText('Ready', { exact: true }) });
      assert.equal(await readyColumn.count(), 1, 'the readiness assertions require the visible Ready column');
      await readyColumn.locator(`[data-keyboard-bead-id="${seeded.ready}"]`).waitFor();
      assert.equal(await readyColumn.locator(`[data-keyboard-bead-id="${seeded.assigned}"]`).count(), 0);
      assert.equal(await readyColumn.locator(`[data-keyboard-bead-id="${seeded.manual}"]`).count(), 0);
      assert.equal(await readyColumn.locator(`[data-keyboard-bead-id="${seeded.dependent}"]`).count(), 0);
    }
    await page.locator(`[data-keyboard-bead-id="${issueId}"]`).click();
    await page.getByText('Persisted comment 日本語', { exact: true }).waitFor();
    for (const title of ['Edit title & description', 'Delete', 'Archive (close + label)', 'Block this bead on a human approval gate']) {
      const control = page.getByTitle(title, { exact: true });
      if (backend === 'bead-rs') {
        assert.ok(await control.count() === 0 || !await control.isVisible() || !await control.isEnabled(),
          `native control must be hidden or disabled: ${title}`);
      } else {
        await control.waitFor();
        assert.equal(await control.isEnabled(), true, `bd retains ${title}`);
      }
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(runDirectory, `${backend}-detail.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(runDirectory, `${backend}-mobile-detail.png`), fullPage: true });
  } finally {
    await browser.close();
  }
}
