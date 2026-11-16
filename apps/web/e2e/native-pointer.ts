/** Native drivers may quantize requested mouse positions (Firefox delivers integer clients).
 * Independently map the delivered event through the displayed bitmap's CSS/logical ratio.
 * These fixtures use scale<10 at zoom50, whose documented construction grid is 10^-4.
 */
import type { Page } from '@playwright/test';

export interface NativeWorldPoint {
  readonly x: number;
  readonly y: number;
}
export const pointText = (p: NativeWorldPoint) => `(${String(p.x)}, ${String(p.y)})`;

/** Raw projection for a drag whose dependent-kind guard must refuse grid rounding. */
export async function nativeRawWorldPoint(
  page: Page,
  action: () => Promise<void>,
): Promise<NativeWorldPoint> {
  const canvas = page.getByLabel('Geometry canvas');
  await canvas.evaluate((c) => {
    c.removeAttribute('data-native-point');
    c.addEventListener(
      'pointerup',
      (event) => {
        if (!(event instanceof PointerEvent)) throw new Error('expected native pointer');
        const box = c.getBoundingClientRect();
        c.setAttribute(
          'data-native-point',
          JSON.stringify({
            clientX: event.clientX,
            clientY: event.clientY,
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            logicalWidth: c.clientWidth,
            logicalHeight: c.clientHeight,
            cx: Number(c.dataset.cx),
            cy: Number(c.dataset.cy),
            zoom: Number(c.dataset.zoom),
          }),
        );
      },
      { once: true },
    );
  });
  await action();
  const p = await canvas.evaluate((c) => {
    const raw = c.getAttribute('data-native-point');
    if (raw === null) throw new Error('native pointer did not reach the canvas');
    return JSON.parse(raw) as {
      clientX: number;
      clientY: number;
      left: number;
      top: number;
      width: number;
      height: number;
      logicalWidth: number;
      logicalHeight: number;
      cx: number;
      cy: number;
      zoom: number;
    };
  });
  return {
    x: p.cx + (((p.clientX - p.left) * p.logicalWidth) / p.width - p.logicalWidth / 2) / p.zoom,
    y: p.cy - (((p.clientY - p.top) * p.logicalHeight) / p.height - p.logicalHeight / 2) / p.zoom,
  };
}

export async function nativeWorldPoint(
  page: Page,
  action: () => Promise<void>,
): Promise<NativeWorldPoint> {
  const p = await nativeRawWorldPoint(page, action);
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return { x: round(p.x), y: round(p.y) };
}
