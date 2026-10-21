import { expect, test } from '@playwright/test';

/**
 * Run 9b: a smoke test of the static site. In every e2e run it checks the built site under its
 * base path; after a deploy, deploy.yml runs it against the GitHub Pages URL itself
 * (GEOMIRA_PAGES_URL, the `pages` project's base URL): the page opens without errors, draws an
 * example, opens a panel and the landing page leads to the app.
 */
test('the site opens, draws an example, and its landing page leads to the app', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Geomira' })).toBeVisible();
  const canvas = page.getByLabel('Geometry canvas');
  await expect(canvas).toBeVisible();
  await page.getByLabel('Example').selectOption('euler-line');
  // Something is drawn: dark pixels of the figure on the canvas.
  await expect
    .poll(() =>
      canvas.evaluate((c) => {
        const ctx = (c as HTMLCanvasElement).getContext('2d');
        if (ctx === null) return 0;
        const d = ctx.getImageData(0, 0, (c as HTMLCanvasElement).width, 200).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 4) if ((d[i] ?? 255) < 100) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(50);
  await page.getByRole('tab', { name: 'Claims', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Claims' })).toContainText('collinear');
  expect(errors).toEqual([]);
  await page.goto('./about.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geomira');
  await page.getByRole('link', { name: 'Open Geomira' }).first().click();
  await expect(page.getByLabel('Geometry canvas')).toBeVisible();
});
