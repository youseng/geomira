/**
 * Laws L9 and L8 for the display values (ADR-0011) on extreme figures and views: angle
 * marks (arcs and right-angle squares), segment marks and texts built from points of every
 * magnitude, with their images in a mirror layer, under random and fitted views. Scenes,
 * display lists, labels and hits are finite, and what is drawn is what is hit.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Expr } from '@geomira/kernel/expr';
import { buildScene } from '../../src/build';
import { layout } from '../../src/display';
import { hitTest } from '../../src/hit';
import { sceneBounds } from '../../src/bounds';
import { fitViewport, type View } from '../../src/viewport';
import { Doc, valuesOf } from '../helpers/docs';
import { assertAllFinite, checkL8, samplePath, type L8Counts } from '../helpers/laws';

const RUNS = process.env.NIGHTLY === '1' ? 2000 : 200;

const coord = fc.oneof(
  fc.integer({ min: -10, max: 10 }),
  fc.double({ min: -10, max: 10, noNaN: true }),
  fc.double({ min: -1e150, max: 1e150, noNaN: true }),
  fc.double({ min: -1e-150, max: 1e-150, noNaN: true }),
);

const STRINGS = ['A', 'M_a', '\\omega', 'Let ABC be a triangle', "H'", 'x^2'];

const specArb = fc.record({
  points: fc.array(fc.tuple(coord, coord), { minLength: 3, maxLength: 6 }),
  marks: fc.array(
    fc.tuple(fc.nat({ max: 5 }), fc.array(fc.nat(), { minLength: 3, maxLength: 3 })),
    {
      minLength: 1,
      maxLength: 8,
    },
  ),
  mirror: fc.boolean(),
  zoom: fc.oneof(
    fc.double({ min: 1, max: 200, noNaN: true }),
    fc.double({ min: 1e-200, max: 1e200, noNaN: true }),
  ),
  random: fc.boolean(),
  center: fc.tuple(coord, coord),
});

function build(spec: typeof specArb extends fc.Arbitrary<infer S> ? S : never): Doc {
  const t = new Doc();
  spec.points.forEach(([x, y], i) => t.point(`P${String(i)}`, x, y));
  const n = spec.points.length;
  const p = (k: number) => `P${String(k % n)}`;
  for (const [i, [kind, [a, b, c]]] of spec.marks.entries()) {
    const [A, B, C] = [p(a ?? 0), p(b ?? 1), p(c ?? 2)];
    const name = `m${String(i)}`;
    const str: Expr = { kind: 'str', value: STRINGS[(a ?? 0) % STRINGS.length] ?? 'A' };
    const defs: Expr[] = [
      t.call('mark_angle', A, B, C),
      t.call('mark_angle', A, B, C, 1 + ((c ?? 0) % 3)),
      t.call('mark_right', A, B, t.call('rotate', A, B, 90)),
      t.call('mark_segment', A, B),
      t.call('mark_segment', A, B, 1 + ((c ?? 0) % 3)),
      t.call('text', A, str),
    ];
    t.add(name, defs[kind] ?? defs[0] ?? t.call('point', 0, 0));
  }
  if (spec.mirror) {
    t.add('s', t.call('reflect', t.call('line', 'P0', t.call('point', 1, 1))));
    t.derived('refl', 's');
  }
  return t;
}

function nearDrawn(d: ReturnType<typeof layout>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [i, item] of d.items.entries())
    for (const p of item.paths) {
      const q = samplePath(p, 2)[i % 3];
      if (q !== undefined) out.push({ x: q.x + (i % 7) - 3, y: q.y + ((i * 5) % 7) - 3 });
    }
  return out.slice(0, 16);
}

describe('L9 and L8 for marks and texts (ADR-0011)', () => {
  it('scenes, layouts, labels and hits are finite; what is drawn is what is hit', () => {
    const counts: L8Counts = { samples: 0, cursors: 0, hits: 0 };
    const kinds = new Map<string, number>();
    fc.assert(
      fc.property(specArb, (spec) => {
        const t = build(spec);
        const scene = buildScene(t.doc, valuesOf(t.doc));
        const size = { width: 640, height: 480 };
        const view: View = spec.random
          ? { viewport: { cx: spec.center[0], cy: spec.center[1], zoom: spec.zoom }, size }
          : { viewport: fitViewport(sceneBounds(scene), size, 40), size };
        const d = layout(scene, view);
        assertAllFinite(scene, 'scene');
        assertAllFinite(d.items, 'items');
        assertAllFinite(d.labels, 'labels');
        for (const item of d.items) kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1);
        const cursors = nearDrawn(d);
        for (const q of cursors) assertAllFinite(hitTest(d, q), 'hit');
        checkL8(d, cursors, counts);
      }),
      { numRuns: RUNS, seed: 11 },
    );
    console.warn(
      `display fuzz: ${String(RUNS)} figures; items ${JSON.stringify(Object.fromEntries(kinds))}; L8 ${JSON.stringify(counts)}`,
    );
    for (const k of ['angle_mark', 'segment_mark', 'text'])
      expect(kinds.get(k) ?? 0).toBeGreaterThan(RUNS / 10);
    expect(counts.samples).toBeGreaterThan(RUNS);
  }, 120_000);
});
