/** ADR-0076: reviewed public header, geometry, source and document controls together. */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { command, openApp, tab } from './helpers';
import { pinSceneFont } from './scene-font';

const layout = '.topbar, .workspace-bar, .board, .side, .palette, .cmdbar';
function bounds(page: Page) {
  return page.locator(layout).evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
}

/** An extra review attachment, not the native viewport reference. No layout box may move. */
async function attachScrollSurface(page: Page, info: TestInfo) {
  const before = await bounds(page);
  const style = await page.addStyleTag({
    content: '.app, html, body { overflow: visible !important; }',
  });
  await expect.poll(() => bounds(page)).toEqual(before);
  await info.attach('unclipped scroll surface - unchanged geometry, not native viewport', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  await style.evaluate((element) => {
    element.textContent = '';
  });
  await expect.poll(() => bounds(page)).toEqual(before);
}

async function reachFooterByWheel(page: Page) {
  const footer = page.locator('.palette, .cmdbar input');
  const inside = () =>
    footer.evaluateAll((elements) =>
      elements.every((element) => {
        const r = element.getBoundingClientRect();
        return r.y >= 0 && r.bottom <= innerHeight && r.x >= 0 && r.right <= innerWidth;
      }),
    );
  await expect(page.locator('.palette')).toBeVisible();
  await expect(page.locator('.cmdbar')).toBeVisible();
  if (!(await inside())) {
    const hint = page.getByText('Scroll up for the figure; down for tools and the command bar.', {
      exact: true,
    });
    await expect(hint).toBeInViewport({ ratio: 1 });
    await hint.hover();
    await page.mouse.wheel(0, 10000);
    await expect.poll(inside).toBe(true);
  }
}

test('screenshot baseline: public workspace with editable source and file controls', async ({
  page,
}, info) => {
  const fontReady = await pinSceneFont(page);
  const errors = await openApp(page, './index.html');
  await page.getByLabel('Example', { exact: true }).selectOption('nine-point-circle');
  await command(page, '@author "Visual fixture"');
  await expect(page.getByRole('status', { name: 'Local save status' })).toContainText(
    'Saved locally',
  );
  await tab(page, 'Text');
  await fontReady();
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.locator('.app').evaluate((element) => {
    element.scrollTop = 0;
  });
  const camera = () =>
    page
      .getByLabel('Geometry canvas')
      .evaluate((element) =>
        ['cx', 'cy', 'zoom'].map((key) => element.getAttribute(`data-${key}`)),
      );
  const beforeWheel = await camera();
  await reachFooterByWheel(page);
  expect(await camera(), 'page scrolling preserves the geometry camera').toEqual(beforeWheel);
  await page.locator('.app').evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  await expect(page.locator('.claim-chips')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await info.attach('actual native public viewport', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await attachScrollSurface(page, info);
  await expect(page).toHaveScreenshot('public-workspace.png', {
    maxDiffPixelRatio: 0.01,
  });
  expect(errors).toEqual([]);
});
