import { expect, test, type Page } from '@playwright/test';
import { claimItem, command, expectLines, openApp, RESERVED, tab, text, textArea } from './helpers';

/** Run 8b flows (SPEC §10.5, §15): claims, badges, tests in the worker, hypotheses. Desktop. */

const ORTHO = ['A = (1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'];
const CLAIM = 'claim ∠BHC + ∠BAC = 180';

async function verdict(page: Page, regime: 'local' | 'global') {
  const v = page.locator(`.verdict[data-regime="${regime}"]`);
  await expect(v).toBeVisible({ timeout: 60_000 });
  return v;
}

test('local test, then global test, then open the counterexample', async ({ page }) => {
  const errors = await openApp(page);
  for (const line of [...ORTHO, CLAIM]) await command(page, line);
  await tab(page, 'Claims');
  const item = claimItem(page, 'claim');
  await expect(item.locator('.badge')).toHaveText('true in this figure');
  await item.getByRole('button', { name: 'Test', exact: true }).click();
  const local = await verdict(page, 'local');
  await expect(local.locator('.verdict-line')).toHaveText(
    'Holds in this configuration (local test, n = 200, exact over Q)',
  );
  await expect(local).toHaveClass(/tone-holds/u);
  await expect(local.locator('.verdict-detail')).toContainText('seed ');
  // No assume line: the global test runs only when asked for.
  await expect(page.locator('.verdict[data-regime="global"]')).toHaveCount(0);
  await item.getByRole('button', { name: 'Test globally', exact: true }).click();
  const global = await verdict(page, 'global');
  await expect(global.locator('.verdict-line')).toHaveText(
    /^Configuration-dependent \(global test, n = 200, exact over Q: \d+ of \d+ fail; no orientation-dependent selector\)$/u,
  );
  // Global findings are information, never red.
  await expect(global).toHaveClass(/tone-info/u);
  const colour = await global.locator('.verdict-line').evaluate((e) => getComputedStyle(e).color);
  expect(colour).not.toBe('rgb(130, 7, 30)');
  expect(await page.locator('.claims').innerText()).not.toMatch(RESERVED);
  const before = await text(page);
  await tab(page, 'Claims');
  await global.getByRole('button', { name: 'Open counterexample' }).click();
  await expect(await textArea(page)).not.toHaveValue(before);
  await expectLines(page, CLAIM, 'H = orthocenter(A, B, C)');
  await tab(page, 'Claims');
  await expect(claimItem(page, 'claim').locator('.badge')).toHaveText('false in this figure');
  await expect(
    page.getByText('These results are for an earlier version of the figure.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('with assume lines the global test follows the local test by itself', async ({ page }) => {
  await openApp(page);
  for (const line of [...ORTHO, 'assume acute(A, B, C)', CLAIM]) await command(page, line);
  await tab(page, 'Claims');
  await claimItem(page, 'claim').getByRole('button', { name: 'Test', exact: true }).click();
  await expect((await verdict(page, 'local')).locator('.verdict-line')).toHaveText(
    'Holds in this configuration (local test, n = 200, exact over Q)',
  );
  const global = await verdict(page, 'global');
  await expect(global.locator('.verdict-line')).toHaveText(
    /^Holds across the declared configuration \(global test, n = 200, exact over Q; \d+ samples rejected by hypotheses; 100 mirrored\)$/u,
  );
  await expect(global).toHaveClass(/tone-info/u);
});

test('a figure that violates an assume line says so at that line, and the tests still run', async ({
  page,
}) => {
  await openApp(page);
  const obtuse = ['A = (-1, 3)', 'B = (0, 0)', 'C = (4, 0)', 'H = orthocenter(A, B, C)'];
  for (const line of [...obtuse, 'assume acute(A, B, C)', CLAIM]) await command(page, line);
  await tab(page, 'Claims');
  const hyp = page.getByRole('list', { name: 'Hypotheses' }).getByRole('listitem');
  await expect(hyp).toContainText('assume acute(A, B, C)');
  await expect(hyp.locator('.hyp-message')).toHaveText('This figure is not acute: ∠B ≈ 108.4°');
  await expect(hyp.locator('.line-no')).toHaveText(/^line \d+$/u);
  await claimItem(page, 'claim').getByRole('button', { name: 'Test', exact: true }).click();
  const local = await verdict(page, 'local');
  await expect(local.locator('.verdict-line')).toHaveText(/^Inconclusive \(local test, n = 200: /u);
  await expect(local.locator('.verdict-line')).not.toContainText('hard to satisfy');
  const global = await verdict(page, 'global');
  await expect(global.locator('.verdict-line')).toHaveText(
    /^Holds across the declared configuration/u,
  );
});

test('cancel stops a running test; badges are three-valued', async ({ page }) => {
  await openApp(page);
  for (const line of [
    ...ORTHO,
    'X = intersect(line(A, B), line(A, B))',
    CLAIM,
    'claim collinear(A, B, C)',
    'claim X = A',
  ])
    await command(page, line);
  await tab(page, 'Claims');
  await expect(claimItem(page, 'collinear').locator('.badge')).toHaveText('false in this figure');
  await expect(claimItem(page, 'X = A').locator('.badge')).toHaveText(/^undefined: /u);
  const item = claimItem(page, '∠BHC');
  // Start a global test and cancel it right after React has rendered the Cancel button (one
  // macrotask later, inside the page), long before the test could finish; the worker reads
  // messages between slices of ≤ 12 ms.
  const clicked = await page.evaluate(async () => {
    const li = [...document.querySelectorAll('.claim')].find((x) => x.textContent.includes('∠BHC'));
    const button = (label: string) =>
      [...(li?.querySelectorAll('button') ?? [])].find((b) => b.textContent === label);
    button('Test globally')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const cancel = button('Cancel');
    cancel?.click();
    return cancel !== undefined;
  });
  expect(clicked).toBe(true);
  await expect(item.locator('.run')).toHaveText(
    /^Global test: cancelled after \d+ of 200 figures$/u,
  );
});
