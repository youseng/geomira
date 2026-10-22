/**
 * The claim kinds' float residuals as ADR-0008's table defines them (each checked against an
 * independent computation), the degenerate-data wording users read, wrong arguments, and the
 * literal ranges at their ends. Run 10, note A: the mutation survivors of kinds-*.ts.
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import type { Value } from '@geomira/kernel/value';
import { evalClaim } from '../src/eval-claim';
import type { ClaimKindSpec } from '../src/kind';
import { claimKind } from '../src/kinds';
import { Figure, REGISTRY } from './helpers/build';
import { circle, line, lit, pt, type Xy } from './helpers/values';

function kind(name: string): ClaimKindSpec {
  const k = claimKind(name);
  if (k === undefined) throw new Error(name);
  return k;
}
const S = { scale: 10 };
const Fl = FloatField;
const pts = (...xs: Xy[]) => xs.map((x) => pt(Fl, x));
/** The angle ∡ABC in radians (counter-clockwise from BA to BC), independently. */
const dir = ([ax, ay]: Xy, [bx, by]: Xy, [cx, cy]: Xy) =>
  Math.atan2(Number(cy) - Number(by), Number(cx) - Number(bx)) -
  Math.atan2(Number(ay) - Number(by), Number(ax) - Number(bx));

describe('residuals (ADR-0008 decision 2)', () => {
  it('collinear: the largest distance to P₁P₂ over the diameter of the three points', () => {
    expect(kind('collinear').residual(pts([0, 0], [4, 0], [2, 1]), S)).toBeCloseTo(1 / 4, 12);
    // The fourth point is the farthest: 3 / max(4, √10, √18).
    expect(kind('collinear').residual(pts([0, 0], [4, 0], [2, 1], [1, 3]), S)).toBeCloseTo(
      3 / Math.sqrt(18),
      12,
    );
  });

  it('concyclic: the largest |sin(∡ACB − ∡APB)| over the further points', () => {
    const [A, B, C, P1, P2]: [Xy, Xy, Xy, Xy, Xy] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ];
    const s = (P: Xy) => Math.abs(Math.sin(dir(A, C, B) - dir(A, P, B)));
    expect(kind('concyclic').residual(pts(A, B, C, P1), S)).toBeCloseTo(s(P1), 12);
    expect(kind('concyclic').residual(pts(A, B, C, P1, P2), S)).toBeCloseTo(
      Math.max(s(P1), s(P2)),
      12,
    );
  });

  it('concurrent: |det| / (|d₁||d₂||dₖ|·scale), the largest over the further lines', () => {
    const ls: Value<number>[] = [
      line(Fl, [0, 0], [0, 2]),
      line(Fl, [0, 0], [3, 0]),
      line(Fl, [1, 1], [2, 1]),
      line(Fl, [0, 0.5], [1, 0.5]),
    ];
    // det(rows) = 6 and 3 for the third and fourth lines; norms 2·3·1.
    expect(kind('concurrent').residual(ls.slice(0, 3), S)).toBeCloseTo(6 / (6 * 10), 12);
    expect(kind('concurrent').residual(ls, S)).toBeCloseTo(6 / (6 * 10), 12);
    expect(
      kind('concurrent').residual(
        [ls[0], ls[1], ls[3]].flatMap((x) => (x === undefined ? [] : [x])),
        S,
      ),
    ).toBeCloseTo(3 / 60, 12);
  });

  it('parallel |sin|, perpendicular |cos| of the angle between the lines', () => {
    const l = line(Fl, [0, 0], [2, 0]);
    const m = line(Fl, [5, 5], [6, 7]);
    expect(kind('parallel').residual([l, m], S)).toBeCloseTo(2 / Math.sqrt(5), 12);
    expect(kind('perpendicular').residual([l, m], S)).toBeCloseTo(1 / Math.sqrt(5), 12);
  });

  it('directed and undirected angles: |sin| of the difference; a zero arm makes it infinite', () => {
    const [A, B, C]: [Xy, Xy, Xy] = [
      [3, 0],
      [0, 0],
      [1, 2],
    ];
    const [D, E, G]: [Xy, Xy, Xy] = [
      [1, 0],
      [0, 0],
      [1, 1],
    ];
    const want = Math.abs(Math.sin(dir(A, B, C) - dir(D, E, G)));
    const args = [lit(Fl, 1), ...pts(A, B, C, D, E, G)];
    expect(kind('dangle').residual(args, S)).toBeCloseTo(want, 12);
    expect(kind('dangle').residual([lit(Fl, 1), ...pts(B, B, C, D, E, G)], S)).toBe(Infinity);
    expect(kind('dangle').residual([lit(Fl, 1), ...pts(A, B, C, D, E, E)], S)).toBe(Infinity);
    const l = line(Fl, [0, 0], [2, 0]);
    const m = line(Fl, [5, 5], [6, 7]);
    expect(kind('dangle_lines').residual([l, m, lit(Fl, 45)], S)).toBeCloseTo(
      Math.abs(Math.sin(Math.atan2(2, 1) - Math.PI / 4)),
      12,
    );
  });
});

describe('literal ranges at their ends; wrong arguments', () => {
  const Q = RationalField;
  const angles = [
    pt(Q, [1, 0]),
    pt(Q, [0, 0]),
    pt(Q, [0, 1]),
    pt(Q, [1, 0]),
    pt(Q, [0, 0]),
    pt(Q, [0, 1]),
  ];
  const reason = (name: string, args: Value<{ num: bigint; den: bigint }>[]) => {
    const a = kind(name).algebra(Q, args, S);
    return 'kind' in a ? (a.kind === 'undefined' ? a.reason : a.kind) : 'ok';
  };

  it('dangle takes n from 1 to 12', () => {
    for (const k of [1, 12]) expect(reason('dangle', [lit(Q, k), ...angles])).toBe('ok');
    for (const k of ['0', '13', '1/2'])
      expect(reason('dangle', [lit(Q, k), ...angles])).toBe(
        'dangle: the multiple n must be an integer from 1 to 12',
      );
  });

  it('angle_sum takes θ in [0°, 360°], angle_diff in [−180°, 180°]', () => {
    for (const t of [0, 360]) expect(reason('angle_sum', [...angles, lit(Q, t)])).toBe('ok');
    for (const t of [-1, 361])
      expect(reason('angle_sum', [...angles, lit(Q, t)])).toBe(
        'angle_sum: θ must lie in [0°, 360°]',
      );
    for (const t of [-180, 180]) expect(reason('angle_diff', [...angles, lit(Q, t)])).toBe('ok');
    for (const t of [-181, 181])
      expect(reason('angle_diff', [...angles, lit(Q, t)])).toBe(
        'angle_diff: θ must lie in [-180°, 180°]',
      );
  });

  it('arguments of the wrong kind: "<kind>: the arguments do not fit the claim"', () => {
    const p = pt(Q, [0, 0]);
    const l = line(Q, [0, 0], [1, 0]);
    const w = circle(Q, [0, 0], 1);
    const cases: [string, Value<{ num: bigint; den: bigint }>[]][] = [
      ['collinear', [p, l, p]],
      ['concyclic', [p, p, l, p]],
      ['concurrent', [l, p, l]],
      ['parallel', [l, w]],
      ['perpendicular', [w, l]],
      ['equal', [p, l]],
      ['dangle', [lit(Q, 1), p, p, l, p, p, p]],
      ['dangle_lines', [l, p, lit(Q, 30)]],
    ];
    for (const [name, args] of cases)
      expect(reason(name, args), name).toBe(`${name}: the arguments do not fit the claim`);
    // The undirected forms share one check, named "angle".
    for (const name of ['angle_eq', 'angle_sum', 'angle_diff'])
      expect(
        reason(name, [p, p, p, p, w, p, lit(Q, 0)].slice(0, name === 'angle_eq' ? 6 : 7)),
      ).toBe('angle: the arguments do not fit the claim');
  });
});

describe('degenerate data, in the words users read', () => {
  const reasonOf = (f: Figure, kindName: string, ...args: string[]) => {
    const id = f.claim(kindName, ...args);
    const v = evalClaim(f.doc, id, REGISTRY);
    return v.value === 'undefined' ? v.reason : v.value;
  };

  it('concyclic of collinear points; concurrent and parallel of the same line, or all parallel', () => {
    const f = new Figure().point('A', 0, 0).point('B', 1, 0).point('C', 2, 0).point('D', 3, 0);
    expect(reasonOf(f, 'concyclic', 'A', 'B', 'C', 'D')).toBe(
      'degenerate: all the points are collinear',
    );
    const g = new Figure().point('A', 0, 0).point('B', 1, 0).point('C', 0, 1).point('E', 3, 3);
    g.def('l', 'line', 'A', 'B').def('m', 'line', 'B', 'A').def('h', 'line', 'A', 'C');
    expect(reasonOf(g, 'parallel', 'l', 'm')).toBe('degenerate: l and m are the same line');
    expect(reasonOf(g, 'concurrent', 'l', 'h', 'm')).toBe('degenerate: l and m are the same line');
    g.def('p1', 'parallel', 'E', 'l').def('p2', 'parallel', 'C', 'l');
    expect(reasonOf(g, 'concurrent', 'l', 'p1', 'p2')).toBe(
      'degenerate: all the lines are parallel',
    );
  });
});
