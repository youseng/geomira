import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { command, openApp, text, tab } from './helpers';

const download = fileURLToPath(new URL('../dist/geomira.html', import.meta.url));

test('the advertised offline file is the tested public build and preserves old claim data', async ({
  page,
}) => {
  const original = readFileSync(new URL('../dist-single/index.html', import.meta.url));
  expect(readFileSync(download)).toEqual(original);
  await page.addInitScript(() => {
    const worker = window.Worker;
    let count = 0;
    Object.defineProperty(window, '__offlineWorkers', { get: () => count });
    window.Worker = class extends worker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        count++;
      }
    };
  });
  const errors = await openApp(page, `${pathToFileURL(download).href}?dev=1`);
  for (const line of [
    'A = (0,0)',
    'B = (4,0)',
    'C = (0,3)',
    'c = circle(A,1)',
    'd = circle(B,1)',
    't = tangent(c,d,along(-),orient(+))',
    'claim collinear(A,B,C)',
    'assume greater(dist(A,B),0)',
  ])
    await command(page, line);
  expect(await text(page)).toContain('claim collinear(A, B, C)');
  await expect(page.getByRole('tab', { name: 'Claims', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0);
  await tab(page, 'Help');
  await expect(page.getByRole('tabpanel')).not.toContainText('Tests:');
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(() => {
      const count: unknown = Reflect.get(window, '__offlineWorkers');
      return count;
    }),
  ).toBe(0);
  expect(errors).toEqual([]);
});
