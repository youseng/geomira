import { describe, expect, it } from 'vitest';
import { call, lit, ref, type Expr, type Selector } from '@geomira/kernel/expr';
import { rational } from '@geomira/num/rational';
import { mapExpr, type AsyExpr, type AsyType, type MapEnv } from '../src/asy-map';
import { checkCoordinates } from '../src/check';
import type { AsyPlan } from '../src/asy-plan';
import { AsyNames } from '../src/asy-names';
import { REGISTRY } from './helpers/figure';

/** Variables 1…: P (pair), Q (pair), R (pair), S (pair), l (line), m (segment), w (circle), k (real), t (map), poly (path). */
const VARS: Readonly<Record<number, [string, AsyType, boolean]>> = {
  1: ['P', 'pair', false],
  2: ['Q', 'pair', false],
  3: ['R', 'pair', false],
  4: ['S', 'pair', false],
  5: ['l', 'gmline', false],
  6: ['m', 'gmline', true],
  7: ['w', 'gmcircle', false],
  8: ['k', 'real', false],
  9: ['t', 'transform', false],
  10: ['poly', 'path', false],
};

function env(dialect: 'standalone' | 'aops' = 'standalone'): MapEnv {
  return {
    registry: REGISTRY,
    dialect,
    ref: (id): AsyExpr | undefined => {
      const v = VARS[id];
      return v === undefined
        ? undefined
        : { code: v[0], type: v[1], compound: false, bounded: v[2], helpers: [], variants: [] };
    },
  };
}

const [P, Q, R, S, l, m, w, k, t, poly] = [
  ref(1),
  ref(2),
  ref(3),
  ref(4),
  ref(5),
  ref(6),
  ref(7),
  ref(8),
  ref(9),
  ref(10),
] as const;
const num = (x: number) => lit(rational(BigInt(x)));
const c = (tool: string, args: readonly Expr[], sels: readonly Selector[] = []) =>
  call(tool, args, sels);
const code = (e: Expr, d?: 'aops') => mapExpr(e, env(d))?.code;

describe('mapExpr', () => {
  it('maps the constructions (spot checks of every family)', () => {
    expect(code(c('foot', [P, l]))).toBe('gm_foot(P, l)');
    expect(code(c('foot', [P, Q, R]), 'aops')).toBe('foot(P, Q, R)');
    expect(code(c('circumcenter', [P, Q, R]), 'aops')).toBe('circumcenter(P, Q, R)');
    expect(code(c('circle', [P, k]))).toBe('gm_circler(P, k)');
    expect(code(c('translate', [P, Q]))).toBe('shift(Q - P)');
    expect(code(c('translate', [w, P, Q]))).toBe('gm_apply(shift(Q - P), w)');
    expect(code(c('homothety', [P, num(-2)]))).toBe('gm_homothety(P, -2)');
    expect(code(c('compose', [t, c('inverse', [t])]))).toBe('t * inverse(t)');
    expect(code(c('apply', [c('compose', [t, t]), poly]))).toBe('(t * t) * poly');
    expect(code(c('div', [c('add', [k, num(1)]), c('neg', [k])]))).toBe('(k + 1) / (-k)');
    expect(code(c('mul', [lit(rational(-3n, 4n)), k]))).toBe('(-3/4) * k');
    expect(code(c('intersect', [w, l], [{ kind: 'other', p: P }]))).toBe('gm_lc_other(l, w, P)');
    expect(code(c('intersect', [l, w], [{ kind: 'along', sign: -1 }]))).toBe(
      'gm_low(gm_lc(l, w), -1)',
    );
  });

  it.each([
    ['an unknown tool', c('nope', [P])],
    ['a numeric tool', c('excenter', [P, Q, R])],
    ['a string argument', c('midpoint', [P, { kind: 'str', value: 'x' }])],
    ['an unknown reference', c('midpoint', [P, ref(99)])],
    ['arguments no overload takes', c('midpoint', [P, l])],
    ['selectors on a tool without candidates', c('midpoint', [P, Q], [{ kind: 'near', p: P }])],
    ['a line meeting a line with a selector', c('intersect', [l, m], [{ kind: 'near', p: P }])],
    ['a pair of curves without a selector', c('intersect', [l, w])],
    ['along on two circles', c('intersect', [w, w], [{ kind: 'along', sign: 1 }])],
    ['orient on a line and a circle', c('intersect', [l, w], [{ kind: 'orient', sign: 1 }])],
    ['other(P) of a non-point', c('intersect', [l, w], [{ kind: 'other', p: k }])],
    ['near of a non-point', c('intersect', [l, w], [{ kind: 'near', p: k }])],
    ['a side of a non-line', c('intersect', [l, w], [{ kind: 'same_side', q: P, l: w }])],
    ['near on a segment', c('intersect', [m, w], [{ kind: 'far_from', p: P }])],
    ['an intersection of a number', c('intersect', [k, w])],
    ['reflect of a number', c('reflect', [k])],
    ['rotate without an angle', c('rotate', [P, Q])],
    ['apply of a number', c('apply', [t, k])],
    ['apply by a non-map', c('apply', [P, Q])],
    ['compose of points', c('compose', [P, Q])],
    ['arithmetic on points', c('add', [P, Q])],
    ['neg of a point', c('neg', [P])],
    ['a polygon of numbers', c('polygon', [k, k, k])],
    ['a circle of a line', c('circle', [P, l])],
    ['a segment of a circle', c('segment', [P, w])],
    ['incircle of two points', c('incircle', [P, Q])],
    ['centroid of two points', c('centroid', [P, Q])],
    ['midpoint of one point', c('midpoint', [P])],
    ['spiral of three points', c('spiral', [P, Q, R])],
    ['homothety of two points', c('homothety', [P, Q])],
  ])('does not map %s', (_name, e) => {
    expect(mapExpr(e, env())).toBeUndefined();
  });

  it('literals: integers bare, fractions and negatives parenthesised as operands', () => {
    expect(mapExpr(num(3), env())).toMatchObject({ code: '3', type: 'real', compound: false });
    expect(mapExpr(lit(rational(1n, 3n)), env())).toMatchObject({ code: '1/3', compound: true });
  });

  it('records the variants it used', () => {
    const e = c('midpoint', [c('foot', [P, l]), S]);
    expect(mapExpr(e, env())?.variants).toEqual(['foot(pair,gmline)', 'midpoint(pair,pair)']);
  });
});

describe('checkCoordinates: malformed lines', () => {
  const plan = (type: AsyType): AsyPlan => {
    const d = {
      id: 1,
      name: 'o',
      ident: 'o',
      type,
      code: '',
      constructive: true,
      dependent: true,
      variants: [],
      helpers: [],
    };
    return { decls: [d], byId: new Map([[1, d]]), names: new AsyNames() };
  };
  it.each([
    [
      'gmline',
      { kind: 'line', p: { x: 0, y: 0 }, d: { x: 1, y: 0 }, lo: null, hi: null, chiral: false },
      '1 0 0 0 0 0 0 0 0',
      'a line without direction',
    ],
    [
      'gmline',
      { kind: 'line', p: { x: 0, y: 0 }, d: { x: 1, y: 0 }, lo: null, hi: null, chiral: false },
      '1 0 0 1 0',
      'not a line',
    ],
    ['gmcircle', { kind: 'circle', c: { x: 0, y: 0 }, r2: 1, arc: null }, '1 0 0', 'not a circle'],
    ['real', { kind: 'number', v: 1 }, '1 1 2', 'not a number'],
    [
      'transform',
      {
        kind: 'transform',
        t: { type: 'similarity', anti: false, a: { re: 1, im: 0 }, b: { re: 0, im: 0 } },
      },
      '1 0 0 1',
      'not a transform',
    ],
  ] as const)('%s: %s', (type, value, out, reason) => {
    const r = checkCoordinates(plan(type), new Map([[1, value]]), 1, out);
    expect(r.problems[0]?.reason).toBe(reason);
  });
});
