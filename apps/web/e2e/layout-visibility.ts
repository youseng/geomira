import { expect, type Page } from '@playwright/test';

/** Compare actual painted header rectangles only inside the visible viewport. */
export async function expectHeaderClear(page: Page) {
  const covered = await page.getByRole('banner').evaluate((header) => {
    const workspace = header.closest('.app')?.querySelector('[aria-label="Workspace"]');
    if (workspace === null || workspace === undefined) throw new Error('no workspace');
    const w = workspace.getBoundingClientRect();
    return [header, ...Array.from(header.children)].some((child) => {
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
