import { readFileSync } from 'node:fs';
import { pngFigureText } from '@geomira/export/png';
import { expect, test, type Page } from '@playwright/test';
import { command, dragWorld, expectLines, openApp, tab, text, textArea, tool } from './helpers';

const REPRO = `O=(0,0)
F=(1000,0)
c=circle(O,0.01)
d=circle(O,0.02)
A=on(c,0)
B=on(d,0)
claim length(O,A,O,B,1)
assume greater(dist(O,F),0)
`;

async function noClaims(page: Page) {
  for (const name of ['Claims'])
    await expect(page.getByRole('tab', { name, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Claim', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Claim to test', { exact: true })).toHaveCount(0);
  await expect(page.locator('.claim-chips, .verdict, .discovery, .view-banner')).toHaveCount(0);
  await expect(page.getByTestId('runner')).toHaveCount(0);
}

async function prepare(page: Page, url = './index.html?dev=1') {
  await page.addInitScript(() => {
    // Simulate old/foreign preferences: none may become a feature switch.
    try {
      localStorage.setItem('claimTesting', 'true');
      localStorage.setItem(
        'geomira-settings',
        JSON.stringify({ claims: true, discovery: true, dev: true }),
      );
    } catch {
      /* file origins may deny storage */
    }
    // Instrument both worker creation and job messages before application startup.
    const original = typeof Worker === 'undefined' ? undefined : Worker;
    const counts = { workers: 0, jobs: 0 };
    Object.defineProperty(window, '__retiredJobs', { value: counts });
    if (original !== undefined) {
      window.Worker = class extends original {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          counts.workers++;
        }
        override postMessage(
          message: unknown,
          options?: StructuredSerializeOptions | Transferable[],
        ) {
          counts.jobs++;
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      };
    }
  });
  const errors = await openApp(page, url);
  return errors;
}

async function idle(page: Page) {
  // Longer than the old 300 ms warm timer and the text/autosave delays.
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(() => {
      const counts: unknown = Reflect.get(window, '__retiredJobs');
      return counts;
    }),
  ).toEqual({
    workers: 0,
    jobs: 0,
  });
  await noClaims(page);
}

test('release: load, edit, drag, examples and legacy preferences never run retired jobs', async ({
  page,
}) => {
  const errors = await prepare(page);
  await noClaims(page);
  const area = await textArea(page);
  await area.fill(REPRO);
  await expect(area).toHaveValue(/claim /u);
  await area.press('Control+Enter');
  await expectLines(page, 'O = (0, 0)', 'F = (1000, 0)');
  await command(page, 'claim equal(O,F)');
  await command(page, 'assume greater(dist(O,F),1)');
  await idle(page);
  await page.getByLabel('Geometry canvas').focus();
  await page.keyboard.press('H');
  await expect(page.getByLabel('Claim kind')).toHaveCount(0);
  // An explicit retired action gets a neutral refusal; statement entry above succeeded.
  const input = page.getByLabel('Command', { exact: true });
  await input.fill('tool claim');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await input.fill('');
  for (const example of ['nine-point-circle', 'euler-line']) {
    await page.getByLabel('Example').selectOption(example);
    await expect(await textArea(page)).toHaveValue(/claim /u);
    await idle(page);
  }
  const close = page.getByRole('button', { name: 'Hide panels', exact: true });
  if (await close.isVisible()) await close.click();
  await tool(page, 'Move');
  await dragWorld(page, [1, 4], [2, 4]);
  await idle(page);
  // Every displayed tab has content; help has no retired shortcut hints.
  for (const name of ['Objects', 'Layers', 'Help', 'Text']) {
    await tab(page, name);
    await expect(page.getByRole('tabpanel')).not.toBeEmpty();
  }
  await tab(page, 'Help');
  await expect(page.getByRole('tabpanel')).not.toContainText(
    /Claim:|Finish a polygon or a claim|Tests:/u,
  );
  await page.getByRole('tab', { name: 'Text', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab', { name: 'Objects', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('release: claim-bearing shares and exports preserve data; Randomize, measurements and undo work', async ({
  page,
  context,
}) => {
  const errors = await prepare(page);
  for (const line of [
    'triangle A B C acute',
    'M = midpoint(A,B)',
    'a = dist(A,B) [show]',
    'claim collinear(A,M,B)',
    '@title "Compatibility"',
    '@author "Geomira"',
  ])
    await command(page, line);
  const before = await text(page);
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await expect(await textArea(page)).not.toHaveValue(before);
  await expect(await textArea(page)).toHaveValue(/claim collinear/u);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(await textArea(page)).toHaveValue(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(await textArea(page)).not.toHaveValue(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(await textArea(page)).toHaveValue(before);
  await tab(page, 'Objects');
  await expect(page.getByRole('tabpanel')).toContainText('a');
  for (const format of ['SVG', 'PNG', 'TikZ', 'Asymptote']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('button', { name: format, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export' });
    await expect(dialog).toBeVisible();
    if (format === 'PNG') {
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: /^Download .*\.png$/u }).click();
      const bytes = readFileSync(await (await download).path());
      const saved = pngFigureText(bytes);
      expect(saved).toContain('claim collinear(A, M, B)');
      expect(saved).toContain('@title "Compatibility"');
      expect(saved).toContain('@author "Geomira"');
      expect(saved).toContain('assume acute');
    } else await expect(dialog.getByLabel('Export content')).not.toHaveValue('');
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page
    .getByRole('dialog', { name: 'Share link' })
    .getByRole('textbox')
    .inputValue();
  const other = await context.newPage();
  const otherErrors = await prepare(other, link);
  await expect(await textArea(other)).toHaveValue(before);
  await idle(other);
  await idle(page);
  expect(errors).toEqual([]);
  expect(otherErrors).toEqual([]);
});
