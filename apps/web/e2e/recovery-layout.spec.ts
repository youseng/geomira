/** ADR-0074: recovery stays below the wrapped header and leaves its toggle reachable. */
import { expect, test, type Page } from '@playwright/test';
import { command, openApp, tab } from './helpers';
import { expectHeaderClear } from './layout-visibility';
import { readFile } from 'node:fs/promises';

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

async function seededTextHandoff(page: Page) {
  await page.setViewportSize({ width: 390, height: 380 });
  await openApp(page, './index.html');
  await command(page, 'A=(0,0)');
  await command(page, 'B=(4,0)');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  const input = page.getByLabel('Command', { exact: true });
  await input.fill('C=midpoint(');
  await tab(page, 'Text');
  const field = page.getByLabel('Text', { exact: true });
  const draft = '@version 1\nA=(9,9)\nM=midpoint(\n# keep this invalid draft';
  await field.fill(draft);
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(17, 17);
  });
  const toggle = page.getByRole('button', { name: 'Recovery versions', exact: true });
  await toggle.focus();
  // The Firefox failure retained app.scrollTop162 after native Text→Recovery focus.
  // Seed that observed browser position; activation is still an ordinary native key.
  await toggle.evaluate((element) => {
    const app = element.closest('.app');
    if (!(app instanceof HTMLElement)) throw new Error('no workspace scroll host');
    app.scrollTop = 162;
  });
  await expect(toggle).toBeFocused();
  return { field, draft, toggle, input };
}

async function canonicalBackup(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .geo backup', exact: true }).click();
  const path = await (await pending).path();
  return readFile(path, 'utf8');
}

test('Recovery activation reveals its focused control after a retained native Text scroll', async ({
  page,
}) => {
  const { field, draft, toggle, input } = await seededTextHandoff(page);
  await toggle.press('Enter');
  await placedBelowControls(page);
  await expect(toggle).toBeFocused();
  await expect(field).toHaveValue(draft);
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(17);
  const ab = '@version 1\nA = (0, 0)\nB = (4, 0)\n';
  expect(await canonicalBackup(page)).toBe(ab);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await canonicalBackup(page)).toBe('@version 1\nA = (0, 0)\n');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await canonicalBackup(page)).toBe(ab);
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.press('Enter');
  await placedBelowControls(page);
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(field).toHaveValue(draft);
  await expect(input).toHaveValue('C=midpoint(');
});

test('Recovery queued visibility yields to later native Command focus and scrolling', async ({
  page,
}) => {
  const { field, draft, toggle, input } = await seededTextHandoff(page);
  await toggle.evaluate((element) => {
    const outlet = element.closest('.app')?.querySelector('.recovery-outlet');
    if (!outlet) throw new Error('no recovery outlet');
    // Handoff after insertion so the baseline includes native insertion anchoring,
    // but before deferred Recovery visibility work can act on the new focus owner.
    const observer = new MutationObserver(() => {
      if (!outlet.querySelector('#recovery-versions')) return;
      observer.disconnect();
      const command = document.querySelector('input[aria-label="Command"]');
      if (!(command instanceof HTMLInputElement)) throw new Error('no command');
      command.focus();
      // Native focus scrolls asynchronously in WebKit. Establish the visible scroll
      // precondition explicitly before measuring whether Recovery later steals it.
      command.scrollIntoView({ block: 'end', inline: 'nearest' });
      command.dataset['nativeCommandScroll'] = String(command.closest('.app')?.scrollTop);
    });
    observer.observe(outlet, { childList: true, subtree: true });
  });
  await toggle.press('Enter');
  await input.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve();
          }),
        ),
      ),
  );
  await expect(input).toBeFocused();
  const scroll = await input.evaluate((element) => ({
    before: Number(element.dataset['nativeCommandScroll']),
    after: element.closest('.app')?.scrollTop,
  }));
  expect(scroll.before).toBeGreaterThan(0);
  expect(scroll.after).toBe(scroll.before);
  expect(
    await input.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      );
    }),
  ).toBe(true);
  await expect(input).toHaveValue('C=midpoint(');
  await expect(field).toHaveValue(draft);
  expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(17);
});

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
