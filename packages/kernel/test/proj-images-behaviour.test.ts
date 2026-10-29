/**
 * Run 16c audit (mutation shard kernel-b, ADR-0040 decision 9): behaviour of projective images
 * that the earlier tests left open. A range's image contains exactly the images of its points
 * (segments, rays both ways, two rays; maps with det of both signs; points on both sides of the
 * sent line ℓ); a polygon's image is the polygon of its vertices' images, or Undefined when a
 * side crosses ℓ; an angle mark's image sweeps counter-clockwise over the images of the points
 * inside the angle, whichever side of ℓ its vertex is on and whatever the sign of det; a point
 * on ℓ goes to an achiral point at infinity.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr } from '../src/expr';
import type { Line, Value } from '../src/value';
import { evalCall, pt } from './helpers/doc';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
type XY = { x: number; y: number };

const SENT = T('line', pt(0, 1), pt(1, 1));
const MAPS: Record<string, Expr> = {
  'send y = 1 to infinity': T('send_to_infinity', SENT),
  'then reflect (det < 0)': T(
    'compose',
    T('send_to_infinity', SENT),
    T('reflect', T('line', pt(0, 0), pt(1, 0))),
  ),
  'send x + y = 3 to infinity': T('send_to_infinity', T('line', pt(3, 0), pt(0, 3))),
};

const FIELDS: readonly Field<unknown>[] = [FloatField, RationalField];

function xyOf<T>(F: Field<T>, v: Value<T>): XY | undefined {
  return v.kind === 'point' ? { x: F.toNumber(v.x), y: F.toNumber(v.y) } : undefined;
}

function lineOf<T>(F: Field<T>, v: Value<T>): Line<number> | undefined {
  if (v.kind !== 'line') return undefined;
  const n = (x: T | null) => (x === null ? null : F.toNumber(x));
  return {
    kind: 'line',
    p: { x: F.toNumber(v.p.x), y: F.toNumber(v.p.y) },
    d: { x: F.toNumber(v.d.x), y: F.toNumber(v.d.y) },
    lo: n(v.lo),
    hi: n(v.hi),
    chiral: v.chiral,
    ...(v.outside === true ? { outside: true } : {}),
  };
}

/** X's parameter on l's carrier and whether it is in l's range, or 'edge' within margin of an end. */
function membership(l: Line<number>, X: XY): boolean | 'edge' {
  const dd = l.d.x * l.d.x + l.d.y * l.d.y;
  const t = ((X.x - l.p.x) * l.d.x + (X.y - l.p.y) * l.d.y) / dd;
  const ends = [l.lo, l.hi].filter((e): e is number => e !== null);
  const span = Math.max(1, ...ends.map(Math.abs), Math.abs(t));
  if (ends.some((e) => Math.abs(t - e) < 1e-6 * span)) return 'edge';
  const inside = (l.lo === null || t >= l.lo) && (l.hi === null || t <= l.hi);
  return l.outside === true ? !((l.lo ?? -Infinity) < t && t < (l.hi ?? Infinity)) : inside;
}

const SOURCES: Record<string, Expr> = {
  'segment off ℓ': T('segment', pt(-2, -1), pt(3, 0)),
  'segment crossing ℓ': T('segment', pt(0, -1), pt(2, 4)),
  'ray toward ℓ': T('ray', pt(1, -2), pt(2, 0)),
  'ray away from ℓ': T('ray', pt(1, -2), pt(0, -4)),
  'ray from beyond ℓ': T('ray', pt(-1, 5), pt(1, 2)),
  'a segment from a point of y = 1': T('segment', pt(0, 1), pt(2, -1)),
  'a ray from infinity (the image of a segment from a point of ℓ)': T(
    'apply',
    T('send_to_infinity', SENT),
    T('segment', pt(0, 1), pt(2, -1)),
  ),
  'a ray from infinity, the other way': T(
    'apply',
    T('send_to_infinity', SENT),
    T('segment', pt(3, 1), pt(1, 4)),
  ),
  'a ray mapped by a reflection first': T(
    'apply',
    T('reflect', T('line', pt(0, 0), pt(1, 1))),
    T('ray', pt(2, -1), pt(-3, -2)),
  ),
  'two rays (a segment crossing ℓ, mapped)': T(
    'apply',
    T('send_to_infinity', SENT),
    T('segment', pt(-1, -1), pt(1, 3)),
  ),
};

/** A standalone expression's value. */
function ev<T>(F: Field<T>, e: Expr): Value<T> {
  if (e.kind !== 'call') throw new Error('a call');
  return evalCall(F, e.tool, e.args);
}

const P = (X: XY) => pt(String(X.x), String(X.y));

describe('the image of a range is the range of the images', () => {
  for (const [mn, map] of Object.entries(MAPS))
    for (const [sn, src] of Object.entries(SOURCES))
      it(`${sn} under "${mn}"`, () => {
        for (const F of FIELDS) {
          const source = lineOf(F, ev(F, src));
          const image = lineOf(F, ev(F, T('apply', map, src)));
          if (source === undefined || image === undefined) throw new Error(`${sn}: not a line`);
          const n = Math.hypot(source.d.x, source.d.y);
          let checked = 0;
          for (let L = -9; L <= 9; L += 0.37) {
            const X = {
              x: source.p.x + (L * source.d.x) / n,
              y: source.p.y + (L * source.d.y) / n,
            };
            const inS = membership(source, X);
            const Y = xyOf(F, ev(F, T('apply', map, P(X))));
            if (inS === 'edge' || Y === undefined) continue;
            const inI = membership(image, Y);
            if (inI === 'edge') continue;
            expect(inI, `${F.name}: the point at ${String(L)}`).toBe(inS);
            checked++;
          }
          expect(checked).toBeGreaterThan(30);
        }
      });
});

const F0 = FloatField;
const SEND = MAPS['send y = 1 to infinity'] ?? T('identity');
const why = (v: Value<number>) => (v.kind === 'undefined' ? v.reason : v.kind);

describe('lines at and near the sent line', () => {
  it('ℓ itself, a line within the band of ℓ, an end within the band of ℓ', () => {
    expect(why(ev(F0, T('apply', SEND, SENT)))).toBe(
      'apply: the line is sent to infinity (the line at infinity is not an object)',
    );
    const near = 'ambiguous: within the band of the line sent to infinity';
    expect(why(ev(F0, T('apply', SEND, T('line', pt(0, '1.00000001'), pt(2, '1.00000001')))))).toBe(
      near,
    );
    expect(why(ev(F0, T('apply', SEND, T('line', pt(0, 1), pt(2, '1.00000001')))))).toBe(near);
    expect(why(ev(F0, T('apply', SEND, T('segment', pt(0, '1.00000001'), pt(2, -1)))))).toBe(near);
    expect(ev(F0, T('apply', SEND, T('segment', pt(0, '1.000001'), pt(2, -1)))).kind).toBe('line');
  });

  it('a point of ℓ goes to the achiral point at infinity of its direction from the image', () => {
    for (const F of FIELDS) {
      const v = ev(F, T('apply', SEND, pt(3, 1)));
      expect(v.kind === 'ideal_point' && v.chiral).toBe(false);
    }
  });
});

describe('polygons and angle marks', () => {
  const tri = [pt(0, 0), pt(2, 0), pt(1, '1/2')];
  it("a polygon off ℓ: the polygon of its vertices' images", () => {
    for (const F of FIELDS)
      for (const map of Object.values(MAPS)) {
        const v = ev(F, T('apply', map, T('polygon', ...tri)));
        const want = tri.map((p) => xyOf(F, ev(F, T('apply', map, p))));
        expect(v.kind === 'polygon' && v.pts.map((p) => xyOf(F, { kind: 'point', ...p }))).toEqual(
          want,
        );
      }
  });

  it('a polygon with a side across ℓ or a vertex on it has no image', () => {
    const reason = 'apply: a side of the polygon passes through infinity, so it has no image';
    for (const pts of [
      [pt(0, 0), pt(2, 2), pt(1, -1)],
      [pt(0, 1), pt(2, 0), pt(1, -1)],
    ])
      expect(why(ev(F0, T('apply', SEND, T('polygon', ...pts))))).toBe(reason);
  });

  /** The counter-clockwise sweep from u to w contains v (all from the vertex; sweep < 180°). */
  const sweeps = (u: XY, v: XY, w: XY) => {
    const cr = (a: XY, b: XY) => a.x * b.y - a.y * b.x;
    return cr(u, w) > 0 && cr(u, v) > 0 && cr(v, w) > 0;
  };

  it('a mark sweeps counter-clockwise over the images of points inside it (both sides of ℓ, det of both signs)', () => {
    for (const [b, a, c] of [
      [
        [0, 0],
        [1, 0],
        [0, -1],
      ],
      [
        [0.5, 3],
        [1.5, 3],
        [0.5, 4],
      ],
    ] as const)
      for (const map of Object.values(MAPS)) {
        const mk = T('mark_angle', pt(a[0], a[1]), pt(b[0], b[1]), pt(c[0], c[1]));
        const src = ev(F0, mk);
        const img = ev(F0, T('apply', map, mk));
        if (src.kind !== 'angle_mark' || img.kind !== 'angle_mark') throw new Error(why(img));
        const e = 1e-3;
        const inner = {
          x: src.b.x + e * (src.from.x + src.to.x - 2 * src.b.x),
          y: src.b.y + e * (src.from.y + src.to.y - 2 * src.b.y),
        };
        const at = xyOf(F0, ev(F0, T('apply', map, P(inner))));
        if (at === undefined) throw new Error('inner image');
        const rel = (q: XY) => ({ x: q.x - img.b.x, y: q.y - img.b.y });
        expect(sweeps(rel(img.from), rel(at), rel(img.to)), JSON.stringify(b)).toBe(true);
      }
  });

  it('a mark whose vertex is on ℓ has no image', () => {
    expect(why(ev(F0, T('apply', SEND, T('mark_angle', pt(1, 0), pt(0, 1), pt(0, -1)))))).toBe(
      'apply: the vertex of the mark is sent to infinity',
    );
  });
});
