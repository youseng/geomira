/** Normal pending initialization is not a failure alert that may resize a live canvas. */
import { expect, test } from '@playwright/test';
import { openApp, tool, text } from './helpers';
import { nativeWorldPoint, pointText } from './native-pointer';
import { holdConnections } from './recovery-helpers';

for (const gesture of ['point', 'outline'] as const) {
  test(`first successful local save preserves canvas bounds during ${gesture} input`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await holdConnections(page, true);
    await openApp(page, './index.html');
    await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
      'Not saved',
    );
    await tool(page, gesture === 'point' ? 'Point' : 'Move');
    const canvas = page.getByLabel('Geometry canvas');
    await canvas.scrollIntoViewIfNeeded();
    const before = await canvas.boundingBox();
    if (before === null) throw new Error('missing canvas');
    const at =
      gesture === 'point'
        ? {
            x: Math.round(before.x + before.width / 2),
            y: Math.round(before.y + before.height / 2),
          }
        : { x: Math.ceil(before.x + 12), y: Math.ceil(before.y + 12) };
    const actual = await nativeWorldPoint(page, async () => {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      if (gesture === 'outline') await page.mouse.move(at.x + 50, at.y + 40, { steps: 4 });
      await page.evaluate(() => window.dispatchEvent(new Event('release-storage')));
      await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
        'Saved locally',
      );
      expect(await canvas.boundingBox()).toEqual(before);
      if (gesture === 'outline') {
        const outline = await page.locator('.selbox').boundingBox();
        if (outline === null) throw new Error('missing selection outline');
        expect(Math.round(outline.x)).toBe(at.x);
        expect(Math.round(outline.y)).toBe(at.y);
        expect(Math.round(outline.width)).toBe(50);
        expect(Math.round(outline.height)).toBe(40);
      }
      await page.mouse.up();
    });
    if (gesture === 'point')
      expect(await text(page)).toBe(`@version 1\nA = ${pointText(actual)}\n`);
    else {
      await expect(page.locator('.selbox')).toHaveCount(0);
      expect(await text(page)).toBe('@version 1\n');
    }
  });
}

test('real blocked storage still exposes persistent recovery actions and truthful status', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('test denied storage', 'SecurityError');
    };
  });
  await openApp(page, './index.html');
  const status = page.getByRole('status', { name: 'Local save status' });
  await expect(status).toContainText('Not saved');
  const recovery = page.getByRole('region', { name: 'Recovery versions' });
  await expect(recovery).toContainText('SecurityError');
  await expect(
    recovery.getByRole('button', { name: 'Download .geo backup', exact: true }),
  ).toBeVisible();
  await expect(
    recovery.getByRole('button', { name: 'Retry local save', exact: true }),
  ).toBeVisible();
  await tool(page, 'Point');
  await expect(recovery).toBeVisible();
  await expect(status).not.toContainText('Saved locally');
});

test('initial Not saved state still offers explicit Recovery backup before storage finishes', async ({
  page,
}) => {
  await holdConnections(page, true);
  await openApp(page, './index.html');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText('Not saved');
  await page.getByRole('button', { name: 'Recovery versions', exact: true }).click();
  const recovery = page.getByRole('region', { name: 'Recovery versions' });
  await expect(recovery).toBeVisible();
  const download = page.waitForEvent('download');
  await recovery.getByRole('button', { name: 'Download .geo backup', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.geo$/u);
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText('Not saved');
});
