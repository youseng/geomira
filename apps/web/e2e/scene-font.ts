import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// ADR-0066: scene snapshots must not depend on the host's local serif-font inventory.
// This unmodified, licensed fixture is test-only; the release keeps its platform font stack.
const font = readFileSync(new URL('./fonts/LiberationSerif-Italic.ttf', import.meta.url));
const face = `@font-face{font-family:"Geomira Math";src:url("data:font/ttf;base64,${font.toString('base64')}") format("truetype")}`;

/** Install before navigation; the returned waiter verifies installation and a painted frame. */
export async function pinSceneFont(page: Page): Promise<() => Promise<void>> {
  let installed = false;
  await page.route('**/*.css', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/@font-face\s*\{[^}]*\}/gu, (rule) => {
      if (!rule.includes('Geomira Math')) return rule;
      installed = true;
      return face;
    });
    await route.fulfill({ response, body });
  });
  return async () => {
    expect(installed, 'the scene font fixture replaced the platform-dependent face').toBe(true);
    await page.evaluate(async () => {
      await document.fonts.load('15px "Geomira Math"');
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  };
}
