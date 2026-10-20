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

/** Coordinates across magnitudes: tiny, ordinary, huge (up to 1e150), and exact zeros. */
const coord = fc.oneof(
  fc.integer({ min: -10, max: 10 }),
  fc.double({ min: -10, max: 10, noNaN: true }),
  fc.double({ min: -1e150, max: 1e150, noNaN: true }),
  fc.double({ min: -1e-150, max: 1e-150, noNaN: true }),
);

const TOOLS: readonly [string, number][] = [
  ['line', 2],
  ['segment', 2],
  ['ray', 2],
  ['circle', 2],
  ['circumcircle', 3],
  ['polygon', 3],
  ['polygon', 4],
  ['midpoint', 2],
  ['perp_bisector', 2],
  ['diameter_circle', 2],
  ['incircle', 3],
  ['orthocenter', 3],
];

const docArb = fc.record({
  points: fc.array(fc.tuple(coord, coord), { minLength: 1, maxLength: 6 }),
  calls: fc.array(
    fc.tuple(fc.nat({ max: TOOLS.length - 1 }), fc.array(fc.nat(), { minLength: 4, maxLength: 4 })),
    {
      maxLength: 8,
    },
  ),
  mirror: fc.boolean(),
  style: fc.record({
    z: fc.integer({ min: -2, max: 2 }),
    width: fc.double({ min: 0, max: 100, noNaN: true }),
  }),
});

const viewArb: fc.Arbitrary<View> = fc.record({
  viewport: fc.record({
    cx: fc.oneof(fc.constant(0), coord),
    cy: fc.oneof(fc.constant(0), coord),
    zoom: fc.oneof(
      fc.double({ min: 1, max: 200, noNaN: true }),
      fc.double({ min: 1e-200, max: 1e200, noNaN: true }),
      fc.constantFrom(0, -1, Number.MIN_VALUE, Number.MAX_VALUE),
    ),
  }),
  size: fc.record({
    width: fc.integer({ min: 1, max: 1200 }),
    height: fc.integer({ min: 1, max: 900 }),
  }),
});

/** Cursors a few pixels from drawn paths (deterministic from the seed). */
function nearDrawn(d: ReturnType<typeof layout>, seed: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [i, item] of d.items.entries())
    for (const p of item.paths) {
      const pts = samplePath(p, 2);
      const q = pts[(seed + i) % pts.length];
      if (q === undefined) continue;
      const j = ((seed >> 3) + i) % 13;
      out.push({ x: q.x + j - 6, y: q.y + ((j * 7) % 13) - 6 });
    }
  return out.slice(0, 12);
}

type Spec = typeof docArb extends fc.Arbitrary<infer S> ? S : never;

function build(spec: Spec): Doc {
  const t = new Doc();
  spec.points.forEach(([x, y], i) => t.point(`P${String(i)}`, x, y));
  for (const [k, [toolIndex, picks]] of spec.calls.entries()) {
    const [tool, arity] = TOOLS[toolIndex] ?? ['line', 2];
    const pts = t.doc.objects.filter((o) => /^P\d+$|^Q\d+$/u.test(o.name));
    const args: Expr[] = picks
      .slice(0, arity)
      .map((p) => t.expr(pts[p % pts.length]?.name ?? 'P0'));
    const point = ['midpoint', 'orthocenter'].includes(tool);
    t.add(point ? `Q${String(k)}` : `c${String(k)}`, t.call(tool, ...args), { style: spec.style });
  }
  if (spec.mirror && t.doc.objects.length >= 2) {
    t.add('s', t.call('reflect', t.call('line', 'P0', t.call('point', 1, 1))));
    t.derived('refl', 's');
  }
  return t;
}

describe('L9 and L8 on extreme figures and views (scene level)', () => {
  it('scenes, layouts, labels and hits are finite; what is drawn is what is hit', () => {
    const counts: L8Counts = { samples: 0, cursors: 0, hits: 0 };
    let numbers = 0;
    let problems = 0;
    fc.assert(
      fc.property(
        docArb,
        fc.option(viewArb, { freq: 2 }),
        fc.array(
          fc.tuple(
            fc.double({ min: -50, max: 1300, noNaN: true }),
            fc.double({ min: -50, max: 1000, noNaN: true }),
          ),
          { maxLength: 6 },
        ),
        fc.nat(),
        (spec, given, cursors, seed) => {
          const t = build(spec);
          const scene = buildScene(t.doc, valuesOf(t.doc));
          const size = { width: 640, height: 480 };
          // Half the views are random, half fit the figure (null: fitted).
          const view = given ?? { viewport: fitViewport(sceneBounds(scene), size, 40), size };
          const d = layout(scene, view);
          const near = nearDrawn(d, seed);
          if (d.problem !== null) problems++;
          numbers += assertAllFinite(scene, 'scene') + assertAllFinite(d.items, 'items');
          numbers += assertAllFinite(d.labels, 'labels');
          for (const [x, y] of cursors) assertAllFinite(hitTest(d, { x, y }), 'hit');
          checkL8(d, [...cursors.map(([x, y]) => ({ x, y })), ...near], counts);
        },
      ),
      { numRuns: RUNS, seed: 7 },
    );
    console.warn(
      `scene fuzz: ${String(RUNS)} figures, ${String(numbers)} numbers finite, ${String(problems)} views refused; L8 ${JSON.stringify(counts)}`,
    );
    expect(counts.samples).toBeGreaterThan(RUNS);
  }, 120_000);
});
