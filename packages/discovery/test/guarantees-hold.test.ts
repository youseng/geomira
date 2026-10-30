/**
 * ADR-0035 decision 6: every construction fact a tool declares (`Signature.guarantees`) HOLDS.
 * For each declared overload (a test fails when a new entry has no figure here), the call is
 * built in the corpus's base figure, each guarantee is instantiated as a claim and must be true
 * in the current figure and HOLD IN THIS CONFIGURATION in the local test. A guarantee that did
 * not hold would hide a fact that is not a construction fact.
 */
import { describe, expect, it } from 'vitest';
import { GUARANTEE_TABLE } from '@geomira/kernel/guarantees';
import type { GuaranteeTerm } from '@geomira/kernel/tool';
import { evalClaim } from '@geomira/claims/eval-claim';
import { testClaim } from '@geomira/claims/job';
import { along, c, n, orient, type Arg } from '../../claims/test/helpers/build';
import type { Sel } from '../../claims/test/helpers/build';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { REGISTRY } from './helpers';

const AB = () => c('line', 'A', 'B');
const AD = () => c('line', 'A', 'D');
/** The conic through A, B, C, D, E (ADR-0042) and the pole of its chord AB (tangents touch A, B). */
const K = () => c('conic', 'A', 'B', 'C', 'D', 'E');
const T = () => c('pole', AB(), K());
/** A second conic through A, B, C, D (Run 16c, ADR-0043): it meets K again nowhere else. */
const K2 = () => c('conic', 'A', 'B', 'C', 'D', 'F');
/** other(P, Q, R): the fourth common point of two conics (or a conic and a circle). */
const other3 = (p: Arg, q: Arg, r: Arg): Sel => ({
  sel: (f) => ({ kind: 'other', p: f.expr(p), rest: [f.expr(q), f.expr(r)] }),
});

/** Arguments of each declared overload, in the base figure (A, B, C, D, E, F, G; ω = w). */
const FIGURES: Readonly<Record<string, () => Arg[]>> = {
  'midpoint(point,point)': () => ['A', 'B'],
  'divide(point,point,number)': () => ['A', 'B', n('1/3')],
  'foot(point,linear)': () => ['D', AB()],
  'foot(point,point,point)': () => ['D', 'A', 'B'],
  'intersect(linear,linear)': () => [AB(), c('line', 'C', 'D')],
  'intersect(linear,round)': () => [AD(), 'w', along(1)],
  'intersect(round,linear)': () => ['w', AD(), along(-1)],
  'intersect(round,round)': () => ['w', c('circle', 'D', 'A'), orient(1)],
  'circumcenter(point,point,point)': () => ['A', 'B', 'C'],
  'centroid(point,point,point)': () => ['A', 'B', 'C'],
  'orthocenter(point,point,point)': () => ['A', 'B', 'C'],
  'line(point,point)': () => ['A', 'B'],
  'line(ppoint,ppoint)': () => ['A', 'B'],
  'segment(point,point)': () => ['A', 'B'],
  'ray(point,point)': () => ['A', 'B'],
  'parallel(point,linear)': () => ['D', AB()],
  'perp(point,linear)': () => ['D', AB()],
  'perp_bisector(point,point)': () => ['A', 'B'],
  'circle(point,point)': () => ['D', 'A'],
  'circle(point,number)': () => ['D', n(3)],
  'circle(point,point,point)': () => ['A', 'B', 'D'],
  'circumcircle(point,point,point)': () => ['A', 'B', 'D'],
  'cline(point,point,point)': () => ['A', 'B', 'D'],
  'diameter_circle(point,point)': () => ['A', 'B'],
  'ninepoint_circle(point,point,point)': () => ['A', 'B', 'C'],
  'on(linear,number)': () => [AB(), n('1/3')],
  'on(round,number,number)': () => ['w', n(2), n(1)],
  'on(round,number)': () => [c('circle', 'D', n(3)), n(30)],
  'other(linear,round,point)': () => [AD(), 'w', 'A'],
  'other(round,linear,point)': () => ['w', AD(), 'A'],
  'other(round,round,point)': () => ['w', c('circle', 'D', 'A'), 'A'],
  'tangent(point,round)': () => ['A', 'w'],
  'polar(point,round)': () => ['D', 'w'],
  'radical_axis(round,round)': () => ['w', c('circle', 'D', n(3))],
  'incenter(point,point,point)': () => ['A', 'B', 'C'],
  'excenter(point,point,point)': () => ['A', 'B', 'C'],
  'incircle(point,point,point)': () => ['A', 'B', 'C'],
  'excircle(point,point,point)': () => ['A', 'B', 'C'],
  'bisector(point,point,point)': () => ['A', 'B', 'C'],
  'ext_bisector(point,point,point)': () => ['A', 'B', 'C'],
  'ninepoint_center(point,point,point)': () => ['A', 'B', 'C'],
  'tangent_point(point,round)': () => ['D', 'w', orient(1)],
  'tangent_from(point,round)': () => ['D', 'w', orient(-1)],
  'reflect(point,linear)': () => ['D', AB()],
  'reflect(point,point)': () => ['D', 'A'],
  'rotate(point,point,number)': () => ['D', 'A', n(60)],
  'homothety(point,point,number)': () => ['D', 'A', n(-2)],
  'translate(point,point,point)': () => ['D', 'A', 'B'],
  'symmedian(point,point,point)': () => ['A', 'B', 'C'],
  'symmedian_point(point,point,point)': () => ['A', 'B', 'C'],
  'pole(linear,round)': () => [c('line', 'D', 'E'), 'w'],
  'radical_center(round,round,round)': () => ['w', c('circle', 'D', n(3)), c('circle', 'E', n(2))],
  'arc(point,point,point)': () => ['A', 'B', 'C'],
  'harmonic_conjugate(point,point,ppoint)': () => ['A', 'B', c('divide', 'A', 'B', n('1/3'))],
  'harmonic_conjugate(linear,linear,linear)': () => [AB(), c('line', 'A', 'C'), AD()],
  'intersect(linear,conic)': () => [AD(), K(), along(1)],
  'intersect(conic,linear)': () => [K(), AD(), along(-1)],
  'on(conic,number,number)': () => [K(), n(2), n(1)],
  'other(linear,conic,point)': () => [AD(), K(), 'A'],
  'other(conic,linear,point)': () => [K(), AD(), 'A'],
  'tangent(point,conic)': () => ['A', K()],
  'tangent_point(point,conic)': () => [T(), K(), orient(1)],
  'tangent_from(point,conic)': () => [T(), K(), orient(-1)],
  'conic(point,point,point,point,point)': () => ['A', 'B', 'C', 'D', 'E'],
  'intersect(conic,conic)': () => [K(), K2(), other3('A', 'B', 'C')],
  'intersect(conic,round)': () => [K(), 'w', other3('A', 'B', 'C')],
  'intersect(round,conic)': () => ['w', K(), other3('B', 'C', 'A')],
  'exsimilicenter(round,round)': () => ['w', c('circle', 'D', n(3))],
  'insimilicenter(round,round)': () => ['w', c('circle', 'D', n(3))],
};

function term(t: GuaranteeTerm, args: readonly Arg[]): Arg {
  if (t === 'result') return 'R';
  if (typeof t === 'number') {
    const a = args.filter((x) => typeof x === 'string' || !('sel' in x))[t];
    if (a === undefined) throw new Error(`argument ${String(t)}`);
    return a;
  }
  if ('lit' in t) return n(t.lit);
  return c(t.tool, ...t.args.map((x) => term(x, args)));
}

const entries = Object.entries(GUARANTEE_TABLE).flatMap(([tool, e]) =>
  Object.entries(e).map(([key, facts]) => ({ name: `${tool}(${key})`, tool, facts })),
);

describe('every declared guarantee holds (ADR-0035)', () => {
  it('every declared overload has a figure here', () => {
    expect(entries.map((e) => e.name).filter((x) => FIGURES[x] === undefined)).toEqual([]);
  });

  for (const e of entries) {
    it(e.name, () => {
      const args = FIGURES[e.name]?.();
      if (args === undefined) throw new Error(e.name);
      const f = baseFigure().add('R', c(e.tool, ...args));
      for (const [i, g] of e.facts.entries()) {
        const id = f.claim(g.claim, ...g.args.map((t) => term(t, args)));
        const what = `${e.name}: guarantee ${String(i + 1)} (${g.claim})`;
        expect(evalClaim(f.doc, id, REGISTRY).value, what).toBe('true');
        const r = testClaim(
          { kind: 'testClaim', regime: 'local', doc: f.doc, claim: id, seed: 17 + i, n: 16 },
          { registry: REGISTRY },
        );
        expect(r.kind === 'verdict' ? r.verdict.kind : r.kind, what).toBe('holds');
      }
    });
  }
});
