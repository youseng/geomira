/**
 * Note B of Run 10 (SPEC §10.4: the LOCAL regime "cannot cross configuration boundaries"):
 * for a figure at least 10σ inside its configuration, 20,000 LOCAL samples never leave it.
 *
 * σ is measured, not assumed: the deciding quantity q of each configuration (its sign is the
 * configuration) is differentiated numerically with respect to every free input, each moved
 * by one deviation of the LOCAL noise as SPEC §10.4 states it relative to the figure (points by
 * 0.02 of the figure's size on x and y, a line glider by that length along its line, a circle
 * glider by that arc, a param by 2% of its range); the first-order deviation of q is the root
 * sum of squares. The test first checks that the figure IS at least 10 such deviations inside
 * (|q₀| ≥ 10·dev), then that no sample changes the sign of q. A Gaussian crosses 10σ with
 * probability about 10⁻²³, so one crossing in 20,000 means the noise is larger than SPEC says
 * (the bugs of ADR-0015 and ADR-0017 each fail this test).
 *
 * Configurations cover every kind of free input, figures of size 10⁻³ to 10⁴, and a figure far
 * from the origin.
 */
import { describe, expect, it } from 'vitest';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber, type Rational } from '@geomira/num/rational';
import { evalContextFor } from '@geomira/kernel/context';
import type { Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Value } from '@geomira/kernel/value';
import { LOCAL_SIGMA } from '../src/constants';
import { exprAt } from '../src/expr-path';
import { readFree, writeFree, type FreeInput } from '../src/free';
import { prepare, type Prepared } from '../src/prepare';
import { drawSample, figureSize } from '../src/sampler';
import { c, Figure, n, REGISTRY } from './helpers/build';

const SAMPLES = 20_000;
const SIGMAS = 10;

type Pt = { x: number; y: number };
type Q = (at: (name: string) => Value<number> | undefined) => number;

function pointOf(v: Value<number> | undefined): Pt {
  return v?.kind === 'point' ? v : { x: NaN, y: NaN };
}

function quantity(q: Q, doc: Document): number {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) return NaN;
  const values = evaluate(doc, REGISTRY, FloatField, ctx.ctx).values;
  return q((name) => {
    const o = doc.objects.find((x) => x.name === name);
    return o === undefined ? undefined : values.get(o.id);
  });
}

/** The value of a glider's object in the current figure, evaluated here (not the sampler's table). */
function gliderObject(p: Prepared, input: FreeInput): Value<number> | undefined {
  const o = p.doc.objects.find((x) => x.id === input.id);
  const target = o === undefined ? undefined : exprAt(o.def, [...input.path, 0]);
  const ctx = evalContextFor(p.doc);
  if (target?.kind !== 'ref' || !ctx.ok) return undefined;
  return evaluate(p.doc, REGISTRY, FloatField, ctx.ctx).values.get(target.id);
}

/** One LOCAL deviation of each slot of `input` as a function step → new slot values. */
function moves(p: Prepared, input: FreeInput, v: Rational[], sigma: number) {
  const x = v.map(toNumber);
  const set = (i: number, t: number) => v.map((r, j) => (j === i ? fromNumber(t) : r));
  const obj = gliderObject(p, input);
  const r = obj?.kind === 'circle' ? Math.sqrt(obj.r2) : NaN;
  switch (input.kind) {
    case 'point':
      return [
        (h: number) => set(0, (x[0] ?? 0) + h * sigma),
        (h: number) => set(1, (x[1] ?? 0) + h * sigma),
      ];
    case 'line-glider': {
      const len = obj?.kind === 'line' ? Math.hypot(obj.d.x, obj.d.y) : NaN;
      return [(h: number) => set(0, (x[0] ?? 0) + (h * sigma) / len)];
    }
    case 'angle-glider':
      return [(h: number) => set(0, (x[0] ?? 0) + (((h * sigma) / r) * 180) / Math.PI)];
    case 'stereo': {
      // (u : v) = (cos φ/2, sin φ/2): turning (u, v) by β moves the point by the arc 2rβ.
      const [u = 0, w = 0] = x;
      return [
        (h: number) => {
          const b = (h * sigma) / (2 * r);
          return [
            fromNumber(u * Math.cos(b) - w * Math.sin(b)),
            fromNumber(u * Math.sin(b) + w * Math.cos(b)),
          ];
        },
      ];
    }
    case 'param':
      return [(h: number) => set(2, (x[2] ?? 0) + h * LOCAL_SIGMA * ((x[1] ?? 0) - (x[0] ?? 0)))];
    case 'radius':
      return []; // scaled by the similarity only: no noise
  }
}

/** q in the current figure and its first-order deviation under the LOCAL noise. */
function deviation(p: Prepared, q: Q): { q0: number; dev: number } {
  const q0 = quantity(q, p.doc);
  const sigma = LOCAL_SIGMA * figureSize(p);
  const h = 1e-3;
  let sum = 0;
  for (const input of p.free) {
    const v = readFree(p.doc, input) ?? [];
    for (const move of moves(p, input, v, sigma)) {
      const d = writeFree(p.doc, [{ input, values: move(h) }]);
      sum += ((quantity(q, d) - q0) / h) ** 2;
    }
  }
  return { q0, dev: Math.sqrt(sum) };
}

function crossings(p: Prepared, q: Q, q0: number): number {
  let out = 0;
  for (let seed = 0; seed < SAMPLES; seed++)
    if (!(Math.sign(quantity(q, drawSample(p, 'local', seed, false))) === Math.sign(q0))) out++;
  return out;
}

function prep(f: Figure): Prepared {
  // Any valid claim: the sampler does not read it.
  const first = f.doc.objects[0]?.name ?? 'A';
  const claim = f.claim('equal', first, first);
  const p = prepare(f.doc, claim, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  return p.prepared;
}

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const cosAt = (v: Pt, a: Pt, b: Pt) => {
  const [ux, uy, wx, wy] = [a.x - v.x, a.y - v.y, b.x - v.x, b.y - v.y];
  return (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
};

/** Acute: every angle's cosine is positive; q = the smallest. */
const acute: Q = (at) => {
  const [a, b, cc] = ['A', 'B', 'C'].map((x) => pointOf(at(x)));
  if (a === undefined || b === undefined || cc === undefined) return NaN;
  return Math.min(cosAt(a, b, cc), cosAt(b, a, cc), cosAt(cc, a, b));
};

function triangle(s: number, dx = 0, dy = 0): Figure {
  const v = (x: number) => String(x);
  return new Figure()
    .point('A', v(dx), v(dy))
    .point('B', v(dx + 4 * s), v(dy))
    .point('C', v(dx + 2 * s), v(dy + 3.4 * s));
}

interface Case {
  readonly name: string;
  readonly figure: () => Figure;
  readonly q: Q;
}

const CASES: readonly Case[] = [
  { name: 'an acute triangle (size 5)', figure: () => triangle(1), q: acute },
  { name: 'an acute triangle of size 0.005', figure: () => triangle(0.001), q: acute },
  { name: 'an acute triangle of size 5·10⁴', figure: () => triangle(1e4), q: acute },
  { name: 'an acute triangle far from the origin', figure: () => triangle(1, 1e5, -3e5), q: acute },
  {
    name: 'the orientation of a triangle (no mirroring in LOCAL)',
    figure: () => triangle(0.02),
    q: (at) => cross(pointOf(at('A')), pointOf(at('B')), pointOf(at('C'))),
  },
  {
    name: 'four points on a circle (by their (u : v)) in cyclic order',
    figure: () => {
      const f = new Figure().point('O', 0, 0).point('X', 5, 0).def('w', 'circle', 'O', 'X');
      for (const [name, u, v] of [
        ['P', 1, 0],
        ['Q', 2, 3],
        ['R', 0, 1],
        ['S', -1, 2],
      ] as const)
        f.add(name, c('on', 'w', n(u), n(v)));
      return f;
    },
    q: (at) => {
      const o = pointOf(at('O'));
      const ang = ['P', 'Q', 'R', 'S'].map((x) => {
        const p = pointOf(at(x));
        return Math.atan2(p.y - o.y, p.x - o.x);
      });
      const gaps = ang.map((a, i) => {
        const g = (ang[(i + 1) % ang.length] ?? 0) - a;
        return g - 2 * Math.PI * Math.floor(g / (2 * Math.PI));
      });
      // In cyclic order iff the counter-clockwise gaps add up to one turn.
      return Math.abs(gaps.reduce((s, g) => s + g, 0) - 2 * Math.PI) < 1e-6
        ? Math.min(...gaps)
        : -1;
    },
  },
  {
    // Found by this test: a glider by (u : v) had no circle in the sampler's glider table, so its
    // arc noise was σ·r/size instead of σ (here 50σ: r = 50, size 1).
    name: 'a point by (u : v) on a circle 50 times larger than the figure, on one side of AB',
    figure: () =>
      new Figure()
        .point('A', 0, 0)
        .point('B', 1, 0)
        .def('O', 'divide', 'A', 'B', n(-50))
        .def('w', 'circle', 'O', 'A')
        .add('P', c('on', 'w', n(200), n(1))),
    q: (at) => cross(pointOf(at('A')), pointOf(at('B')), pointOf(at('P'))),
  },
  {
    name: 'two points on circle(O, r) by angle, the second counter-clockwise from the first',
    figure: () => {
      const f = new Figure().point('O', 0, 0).point('Z', 1, 1).def('w', 'circle', 'O', n(3));
      return f.add('X', c('on', 'w', n(20))).add('Y', c('on', 'w', n(110)));
    },
    q: (at) => cross(pointOf(at('O')), pointOf(at('X')), pointOf(at('Y'))),
  },
  {
    name: 'a point on a line, on one side of the foot of another point',
    figure: () =>
      new Figure()
        .point('A', 0, 0)
        .point('B', 6, 2)
        .point('Q', 0, 3)
        .def('l', 'line', 'A', 'B')
        .add('P', c('on', 'l', n('3/4')))
        .def('F', 'foot', 'Q', 'l'),
    q: (at) => {
      const [p, f, a, b] = ['P', 'F', 'A', 'B'].map((x) => pointOf(at(x)));
      if (p === undefined || f === undefined || a === undefined || b === undefined) return NaN;
      return (p.x - f.x) * (b.x - a.x) + (p.y - f.y) * (b.y - a.y);
    },
  },
  {
    name: 'a param above a threshold (the point divides AB beyond its fifth)',
    figure: () =>
      new Figure()
        .point('A', 0, 0)
        .point('B', 5, 0)
        .add('k', c('param', n(0), n(1), n('1/2')))
        .def('M', 'divide', 'A', 'B', 'k'),
    q: (at) => {
      const k = at('k');
      return k?.kind === 'number' ? k.v - 1 / 5 : NaN;
    },
  },
];

describe(`LOCAL never crosses a configuration it is ${String(SIGMAS)}σ inside (note B, SPEC §10.4)`, () => {
  for (const k of CASES)
    it(`${k.name}: 0 of ${String(SAMPLES)} samples cross`, () => {
      const p = prep(k.figure());
      const { q0, dev } = deviation(p, k.q);
      expect(Number.isFinite(q0) && dev > 0, `q0 ${String(q0)}, dev ${String(dev)}`).toBe(true);
      expect(Math.abs(q0) / dev, 'the figure is at least 10σ inside').toBeGreaterThanOrEqual(
        SIGMAS,
      );
      expect(crossings(p, k.q, q0)).toBe(0);
    });
});
