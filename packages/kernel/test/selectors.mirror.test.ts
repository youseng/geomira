/**
 * MIRROR TESTS (Run 3b, SPEC §7, §10.4): a random figure and its mirror image (x ↦ −x of
 * every free point, NO selector flipped). Gliders are mirrored BY POSITION: the glider's
 * point is mirrored and re-projected onto its (mirrored) object with gliderParameter,
 * never by copying the parameter; on a chiral line (perp_bisector) the mirrored glider sits
 * at −t, on an achiral one (line(A, B)) at t, and both are asserted.
 * Then, for every branchable call of the figure:
 *   - a reflection-equivariant selector picks the mirror image of the original choice;
 *   - an orientation-dependent one (isOrientationDependent: orient(±), along(±) on a chiral
 *     line) picks the mirror image of the OTHER candidate (the original call with the
 *     selector flipped); along(±) on an achiral line is equivariant.
 * Undefined results must mirror too (same reason).
 */
import { FloatField } from '@geomira/num/float-field';
import { fromNumber, toNumber } from '@geomira/num/rational';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, lit, type Expr, type RefExpr, type Selector } from '../src/expr';
import { gliderParameter, type GliderForm } from '../src/glider';
import { isOrientationDependent } from '../src/selector';
import type { Value } from '../src/value';
import { Builder, contextOf, evalDoc, valueOf } from './helpers/doc';
import { add, mul, unit, type V } from './helpers/branch-figures';
import { LAW_TIMEOUT, lawCount } from './helpers/laws';

const FIGURES = lawCount(300);

interface Plan {
  readonly pts: Readonly<Record<string, V>>;
  readonly t1: number;
  readonly t2: number;
  readonly uv: readonly [number, number];
}

/** C the centre of c₁ (radius ρ, through D); A, B, F, H inside; E, P outside. */
function plan(rng: Rng): Plan {
  const C: V = [rng.uniform(-15, 15), rng.uniform(-15, 15)];
  const rho = rng.uniform(5, 15);
  const at = (lo: number, hi: number): V =>
    add(C, mul(unit(rng.uniform(0, 360)), rho * rng.uniform(lo, hi)));
  return {
    pts: {
      C,
      D: at(1, 1),
      A: at(0, 0.8),
      B: at(0, 0.8),
      F: at(0, 0.8),
      H: at(0, 0.8),
      E: at(1.2, 3),
      P: at(1.2, 4),
    },
    t1: rng.uniform(0.1, 0.9),
    t2: rng.uniform(-0.3, 0.3),
    uv: [rng.uniform(-2, 2), rng.uniform(-2, 2)],
  };
}

type Glide = (name: string, obj: RefExpr, form: GliderForm, params: readonly number[]) => RefExpr;

interface Call {
  readonly name: string;
  readonly line: string | null;
  readonly selectors: readonly Selector[];
}

const along = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });

/** The figure (same objects and names in both builds; gliders through `glide`). */
function recipe(b: Builder, p: Plan, mirrored: boolean, glide: Glide, flip: boolean): Call[] {
  const free = (n: string): RefExpr => {
    const [x, y] = p.pts[n] ?? [0, 0];
    return b.add(n, call('point', [lit(fromNumber(mirrored ? -x : x)), lit(fromNumber(y))]));
  };
  const [A, B, C, D, E] = [free('A'), free('B'), free('C'), free('D'), free('E')];
  const [F, H, P] = [free('F'), free('H'), free('P')];
  const c1 = b.add('c_1', call('circle', [C, D]));
  const la = b.add('l_a', call('line', [A, B]));
  const lb = b.add('l_b', call('perp_bisector', [A, B]));
  const G1 = glide('G_1', la, 'line', [p.t1]);
  const G2 = glide('G_2', lb, 'line', [p.t2]);
  const G3 = glide('G_3', c1, 'stereo', p.uv);
  b.add('l_c', call('line', [G2, E]));
  b.add('l_d', call('tangent', [G3, c1]));
  b.add('l_e', call('perp', [F, la]));
  b.add('l_f', call('line', [G3, F]));
  const c2 = b.add('c_2', call('circle', [E, G1]));
  const s = (k: 1 | -1): 1 | -1 => (flip ? (k === 1 ? -1 : 1) : k);
  const calls: [string, string, Expr[], string | null, Selector[]][] = [];
  for (const l of ['l_a', 'l_b', 'l_c', 'l_d', 'l_e'])
    for (const k of [1, -1] as const)
      calls.push([
        `X_{${l.replace('_', '')}${k === 1 ? 'p' : 'm'}}`,
        'intersect',
        [b.ref(l), c1],
        l,
        [along(s(k))],
      ]);
  for (const k of [1, -1] as const) {
    const tag = k === 1 ? 'p' : 'm';
    calls.push([`Y_${tag}`, 'intersect', [c1, c2], null, [orient(s(k))]]);
    calls.push([`T_${tag}`, 'tangent_point', [P, c1], null, [orient(s(k))]]);
    calls.push([`t_${tag}`, 'tangent_from', [P, c1], null, [orient(s(k))]]);
  }
  const lfc: Expr[] = [b.ref('l_f'), c1];
  calls.push(
    ['Z_1', 'intersect', [la, c1], 'l_a', [{ kind: 'same_side', q: G2, l: b.ref('l_e') }]],
    ['Z_2', 'intersect', [lb, c1], 'l_b', [{ kind: 'opposite_side', q: H, l: la }]],
    ['Z_3', 'intersect', [c1, c2], null, [{ kind: 'on_arc', b: G3, c: D, a: G1, not: true }]],
    ['Z_4', 'intersect', [b.ref('l_c'), c1], 'l_c', [{ kind: 'between', a: G2, b: E }]],
    ['Z_5', 'intersect', [la, c1], 'l_a', [{ kind: 'inside', c: c2 }]],
    ['Z_6', 'intersect', [lb, c1], 'l_b', [{ kind: 'outside', c: c2 }]],
    ['Z_7', 'intersect', [c1, c2], null, [{ kind: 'near', p: G3 }]],
    ['Z_8', 'tangent_point', [P, c1], null, [{ kind: 'far_from', p: G1 }]],
    ['Z_9', 'intersect', lfc, 'l_f', [{ kind: 'other', p: G3 }]],
    [
      'Z_10',
      'tangent_from',
      [P, c1],
      null,
      [
        { kind: 'near', p: H },
        { kind: 'on_arc', b: A, c: B, a: G3, not: false },
      ],
    ],
  );
  return calls.map(([name, tool, args, line, selectors]) => {
    b.add(name, call(tool, args, selectors));
    return { name, line, selectors };
  });
}

/** Builds the original (`flip`: orientation-dependent selectors flipped) or the mirror. */
function build(
  p: Plan,
  mirrored: boolean,
  flip: boolean,
  original?: Builder,
): { b: Builder; calls: Call[] } {
  const b = new Builder();
  const literal = (xs: readonly number[]) => xs.map((x) => lit(fromNumber(x)));
  const glide: Glide = (name, obj, form, params) => {
    if (!mirrored || original === undefined)
      return b.add(name, call('on', [obj, ...literal(params)]));
    // By position: mirror the original glider's point, re-project it on the mirrored object.
    const X = valueOf(original.doc, evalDoc(original.doc, FloatField), name);
    const objName = b.doc.objects.find((o) => o.id === obj.id)?.name ?? '';
    const objValue = valueOf(b.doc, evalDoc(b.doc, FloatField), objName);
    if (X.kind !== 'point') throw new Error(`${name} is ${X.kind}`);
    const q = gliderParameter(FloatField, objValue, { x: -X.x, y: X.y }, form, contextOf(b.doc));
    if ('kind' in q) throw new Error(q.reason);
    const nums = q.form === 'line' ? [q.t] : q.form === 'stereo' ? [q.u, q.v] : [q.degrees];
    return b.add(name, call('on', [obj, ...literal(nums)]));
  };
  return { b, calls: recipe(b, p, mirrored, glide, flip) };
}

function mirrorOf(v: Value<number>): Value<number> {
  if (v.kind === 'point') return { kind: 'point', x: -v.x, y: v.y };
  if (v.kind === 'line') return { ...v, p: { x: -v.p.x, y: v.p.y }, d: { x: -v.d.x, y: v.d.y } };
  return v;
}

/** The mirrored value equals the expected one (points within tolerance; lines as sets). */
function same(m: Value<number>, e: Value<number>, scale: number): boolean {
  if (m.kind === 'undefined' || e.kind === 'undefined')
    return m.kind === e.kind && 'reason' in m && 'reason' in e && m.reason === e.reason;
  const tol = 1e-9 * scale;
  if (m.kind === 'point' && e.kind === 'point') return Math.hypot(m.x - e.x, m.y - e.y) <= tol;
  if (m.kind === 'line' && e.kind === 'line') {
    const cr = m.d.x * e.d.y - m.d.y * e.d.x;
    return (
      m.chiral === e.chiral &&
      Math.hypot(m.p.x - e.p.x, m.p.y - e.p.y) <= tol &&
      Math.abs(cr) <= tol * Math.hypot(m.d.x, m.d.y) * Math.hypot(e.d.x, e.d.y)
    );
  }
  return false;
}

describe(
  `mirror tests: ${String(FIGURES)} figures and their mirror images`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('equivariant selectors pick the mirror image, orientation-dependent ones the other candidate', () => {
      const tally = { equivariant: 0, dependent: 0, undefinedAgree: 0, gliders: 0 };
      for (let i = 0; i < FIGURES; i += 1) {
        const p = plan(createRng(deriveSeed(7700, i)));
        const orig = build(p, false, false);
        const flipped = build(p, false, true);
        const mirr = build(p, true, false, orig.b);
        const [eo, ef, em] = [
          evalDoc(orig.b.doc, FloatField),
          evalDoc(flipped.b.doc, FloatField),
          evalDoc(mirr.b.doc, FloatField),
        ];
        const scale = contextOf(orig.b.doc).scale;
        // Gliders: re-projected by position; t ↦ t on line(A, B), t ↦ −t on perp_bisector(A, B).
        const lit0 = (name: string) => {
          const o = mirr.b.doc.objects.find((x) => x.name === name);
          const a = o?.def.kind === 'call' ? o.def.args[1] : undefined;
          return a?.kind === 'lit' ? toNumber(a.value) : NaN;
        };
        expect(Math.abs(lit0('G_1') - p.t1)).toBeLessThan(1e-9);
        expect(Math.abs(lit0('G_2') + p.t2)).toBeLessThan(1e-9);
        tally.gliders += 2;
        for (const c of orig.calls) {
          const lineValue = c.line === null ? null : valueOf(orig.b.doc, eo, c.line);
          const line = lineValue?.kind === 'line' ? lineValue : null;
          const dependent = c.selectors.some((s) => isOrientationDependent(s, line));
          const expected = dependent
            ? valueOf(flipped.b.doc, ef, c.name)
            : valueOf(orig.b.doc, eo, c.name);
          const got = valueOf(mirr.b.doc, em, c.name);
          expect(
            same(got, mirrorOf(expected), scale),
            `figure ${String(i)} ${c.name}: ${JSON.stringify([got, expected])}`,
          ).toBe(true);
          if (got.kind === 'undefined') tally.undefinedAgree += 1;
          else if (dependent) tally.dependent += 1;
          else tally.equivariant += 1;
        }
      }
      process.stdout.write(
        `mirror: ${String(tally.equivariant)} equivariant and ${String(tally.dependent)} orientation-dependent choices mirrored, ` +
          `${String(tally.undefinedAgree)} Undefined agree, ${String(tally.gliders)} gliders re-projected\n`,
      );
      expect(tally.dependent).toBeGreaterThan(FIGURES * 8);
      expect(tally.equivariant).toBeGreaterThan(FIGURES * 8);
    });
  },
);
