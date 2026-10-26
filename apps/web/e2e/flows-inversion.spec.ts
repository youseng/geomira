import { expect, test } from '@playwright/test';
import { clickWorld, command, dragWorld, expectLines, openApp, tab, text, tool } from './helpers';

/**
 * Run 14 (ADR-0032): derive an inverted layer, build in it, drag an image. The inversion tool
 * builds f = inversion(w); Layer from transform makes the layer; new objects are built in it;
 * dragging an image moves its source to the preimage of the cursor; the center's image is
 * listed as undefined with its reason. Desktop project.
 */
test('derive an inverted layer, build in it, drag an image', async ({ page }) => {
  const errors = await openApp(page);
  // w has radius 2 about O (power 4): C = (2, 2) ↦ C* = (1, 1), D = (0, 4) ↦ D* = (0, 1).
  for (const line of ['O = (0, 0)', 'A = (2, 0)', 'C = (2, 2)', 'D = (0, 4)', 'w = circle(O, A)'])
    await command(page, line);
  await tool(page, 'Inversion');
  await clickWorld(page, 0, -2);
  await expectLines(page, 'f = inversion(w)');

  await tool(page, 'Layer from transform');
  await tab(page, 'Objects');
  await page.getByRole('button', { name: 'f', exact: true }).click();
  await expectLines(page, '@layer image = image(f, main)');
  await expect(page.getByText('center of inversion').first()).toBeVisible();

  // Build in the derived layer: the midpoint of the images C* and D*.
  await tab(page, 'Layers');
  await page.getByLabel('Build new objects in layer 2').check();
  await tool(page, 'Midpoint');
  await clickWorld(page, 1, 1);
  await clickWorld(page, 0, 1);
  await expect
    .poll(async () => text(page))
    .toMatch(/^E = midpoint\(C\*, D\*\) \[layers=image\]$/mu);

  // Dragging C* to (0.8, 1.6) moves C to its preimage (1, 2) (drag-through, SPEC §8.4).
  await tool(page, 'Move');
  await dragWorld(page, [1, 1], [0.8, 1.6]);
  await expectLines(page, 'C = (1, 2)');
  expect(errors).toEqual([]);
});
