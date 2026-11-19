import { expect, type Page } from '@playwright/test';

/** Compare actual painted header rectangles only inside the visible viewport. */
export async function expectHeaderClear(page: Page) {
  const covered = await page.getByRole('banner').evaluate((header) => {
    const workspace = header.closest('.app')?.querySelector('[aria-label="Workspace"]');
    if (workspace === null || workspace === undefined) throw new Error('no workspace');
    const w = workspace.getBoundingClientRect();
    return Array.from(header.children)
      .filter((child) => child !== workspace)
      .some((child) => {
        const r = child.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          Math.min(innerHeight, r.bottom, w.bottom) > Math.max(0, r.top, w.top) &&
          Math.min(innerWidth, r.right, w.right) > Math.max(0, r.left, w.left)
        );
      });
  });
  expect(covered).toBe(false);
}

/** The visible panel hint teaches native page scrolling between source and figure controls. */
export async function fitAfterPageScroll(page: Page) {
  const fit = page.getByRole('button', { name: 'Fit', exact: true });
  const fitExposed = () =>
    fit.evaluate((button) => {
      const r = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
  if (!(await fitExposed())) {
    // Native keyboard navigation scrolls between source and figure controls on a short page.
    const canvas = page.getByLabel('Geometry canvas');
    const zoom = await canvas.getAttribute('data-zoom');
    await page.keyboard.press('Escape');
    for (let i = 0; i < 20 && !(await fit.evaluate((e) => e === document.activeElement)); i++)
      await page.keyboard.press('Shift+Tab');
    await expect(fit).toBeFocused();
    expect(await fitExposed()).toBe(true);
    expect(await canvas.getAttribute('data-zoom')).toBe(zoom);
  }
  await fit.click();
}
