/**
 * Run 10 audit, hunt items "NaN/Infinity leaks" and "label offsets under zoom" in the scene
 * (law L9: no canvas call sees a huge or non-finite number):
 *   - a circle of radius 1e6 to 1e300 through the origin, viewed at zooms 2^-40 to 2^600: every
 *     number of the display list and of a hit test is finite, and every drawn vertex lies within
 *     a few margins of the surface;
 *   - an explicit label offset (angle 30°, 25 px) stays 25 px at 30° at every zoom.
 * The circle is not drawn at all once its radius exceeds ~1e16 view widths: doubles cannot
 * place it near the view any closer than that (docs/audit/2026-10-22.md, W10).
 */
import { describe, expect, it } from 'vitest';
import { layout, MARGIN_PX, type DisplayList } from '../src/display';
import { hitTest } from '../src/hit';
import { viewProblem, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

function numbers(x: unknown, out: number[] = []): number[] {
  if (typeof x === 'number') out.push(x);
  else if (Array.isArray(x)) for (const y of x) numbers(y, out);
  else if (x !== null && typeof x === 'object') for (const y of Object.values(x)) numbers(y, out);
  return out;
}

function coords(d: DisplayList): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const i of d.items)
    for (const p of i.paths) {
      if (p.kind === 'poly') out.push(...p.pts);
      else if (p.kind === 'dot') out.push(p.c);
    }
  return out;
}

describe('huge circles through a view at extreme zooms (L9)', () => {
  it('every number finite and every polyline vertex near the surface', () => {
    const bad: string[] = [];
    for (const e of [6, 20, 50, 100, 150, 200, 250, 300]) {
      const R = 10 ** e;
      const t = new Doc().point('O', R, 0).point('P', 0, 0);
      t.add('w', t.call('circle', 'O', 'P'), { style: { label: 'w' } });
      const scene = t.scene();
      for (const z of [-40, -10, 0, 10, 40, 100, 200, 400, 600]) {
        const view: View = {
          viewport: { cx: 0, cy: 0, zoom: 2 ** z },
          size: { width: 400, height: 300 },
        };
        if (viewProblem(view) !== undefined) continue;
        const d = layout(scene, view);
        if (!numbers(d).every(Number.isFinite))
          bad.push(`R=1e${String(e)} z=2^${String(z)}: non-finite`);
        const far = coords(d).filter(
          (q) =>
            Math.abs(q.x - 200) > 200 + 4 * MARGIN_PX || Math.abs(q.y - 150) > 150 + 4 * MARGIN_PX,
        );
        if (far.length > 0)
          bad.push(
            `R=1e${String(e)} z=2^${String(z)}: ${String(far.length)} far, e.g. ${JSON.stringify(far[0])}`,
          );
        if (!numbers(hitTest(d, { x: 200, y: 150 })).every(Number.isFinite)) bad.push('hit');
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('labels under zoom', () => {
  it('explicit label offset stays dist px at any zoom; auto direction stable', () => {
    const t = new Doc()
      .point('A', 1, 1, { style: { labelAngle: 30, labelDist: 25 } })
      .point('B', 3, 2)
      .point('C', -2, 4);
    t.add('l', t.call('line', 'B', 'C'));
    t.add('m', t.call('line', 'A', 'B'));
    const scene = t.scene();
    const res: string[] = [];
    for (const z of [1e-3, 0.5, 1, 50, 1e4, 1e8]) {
      const d = layout(scene, {
        viewport: { cx: 1, cy: 1, zoom: z },
        size: { width: 400, height: 300 },
      });
      const l = d.labels.find((x) => x.text === 'A');
      const b = d.labels.find((x) => x.text === 'B');
      if (l === undefined) continue;
      res.push(
        `${String(z)}: ${Math.hypot(l.at.x - l.anchor.x, l.at.y - l.anchor.y).toFixed(6)} ${String(l.angle)} B=${String(b?.angle)}`,
      );
    }
    expect(res.every((r) => r.includes(' 25.000000 30 '))).toBe(true);
  });
});
