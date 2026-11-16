/** ADR-0074: recovery stays below the wrapped header and leaves its toggle reachable. */
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, tab } from './helpers';
import { expectHeaderClear } from './layout-visibility';

async function placedBelowControls(page: Page) {
  const recovery = page.getByRole('region', { name: 'Recovery versions', exact: true });
  await expect(recovery).toBeVisible();
  const popup = await recovery.boundingBox();
  const header = await page.getByRole('banner').boundingBox();
  const workspace = await page
    .getByRole('region', { name: 'Workspace', exact: true })
    .boundingBox();
  const view = page.viewportSize();
  if (popup === null || header === null || workspace === null || view === null)
    throw new Error('missing recovery bounds');
  await expectHeaderClear(page);
  expect(popup.y).toBeGreaterThanOrEqual(
    Math.max(0, header.y + header.height, workspace.y + workspace.height),
  );
  expect(popup.x).toBeGreaterThanOrEqual(0);
  expect(popup.x + popup.width).toBeLessThanOrEqual(view.width);
  expect(popup.y + popup.height).toBeLessThanOrEqual(view.height);
  const toggle = page.getByRole('button', { name: 'Recovery versions', exact: true });
  expect(
    await toggle.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      );
    }),
  ).toBe(true);
}

for (const viewport of [
  { width: 390, height: 664 },
  { width: 768, height: 768 },
  { width: 390, height: 380 },
]) {
  test(`recovery opens, closes and reopens below controls at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openApp(page, './index.html');
    await command(page, 'A=(0,0)');
    await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
      'Saved locally',
    );
    const toggle = page.getByRole('button', { name: 'Recovery versions', exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await placedBelowControls(page);
    await toggle.click();
    await expect(page.getByRole('region', { name: 'Recovery versions', exact: true })).toHaveCount(
      0,
    );
    await toggle.press('Enter');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await placedBelowControls(page);
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await tab(page, 'Text');
    await page.getByLabel('Text', { exact: true }).focus();
    await toggle.focus();
    await toggle.press('Enter');
    await placedBelowControls(page);
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test(`blocked-storage warning leaves recovery reachable at ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      for (const property of ['localStorage', 'indexedDB'])
        Object.defineProperty(window, property, {
          configurable: true,
          get() {
            throw new DOMException('blocked by recovery layout test', 'SecurityError');
          },
        });
    });
    await openApp(page, './index.html');
    await command(page, 'A=(0,0)');
    await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
      'Not saved',
    );
    const toggle = page.getByRole('button', { name: 'Recovery versions', exact: true });
    await toggle.focus();
    await placedBelowControls(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await placedBelowControls(page);
    await expect(
      page.getByRole('button', { name: 'Download .geo backup', exact: true }),
    ).toBeVisible();
    await toggle.press('Enter');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
}
