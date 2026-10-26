/**
 * Property tests of the v1.1 tools (Run 13, ADR-0031), spread into tools.property.test.ts's
 * PROPERTIES (whose meta-test checks that every registry tool has one). Every one of these
 * tools is rational, so the exact run checks each identity exactly over Q; FloatField runs
 * the identities that are well conditioned on random figures (the theorem tests,
 * theorems-v11.test.ts, skip ill-conditioned float figures).
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { vCross, vSub } from '../../src/geom';
import type { Vec } from '../../src/value';
import { asCircle, asLine, onCircle, onLine, power, sameCircle } from './circle-properties';
import { num, type Builder } from './doc';
import { asPoint, samePoints, type Figure, type Pts } from './figure';

export interface V11Property {
  readonly tools: readonly string[];
  readonly name: string;
  readonly build: (b: Builder, p: Pts) => void;
  readonly required: readonly string[];
  readonly check: <T>(f: Figure<T>) => boolean;
  readonly fields?: readonly Field<unknown>[];
}

const EXACT = [RationalField] as Field<unknown>[];
const BOTH = [RationalField, FloatField] as Field<unknown>[];

/** X lies on c's arc (the side of the chord from → to, as arc-range.ts decides it). */
function onArc<T>(f: Figure<T>, x: string, c: string): boolean {
  const k = asCircle(f.get(c));
  if (k.arc === null) return false;
  const X: Vec<T> = asPoint(f.get(x));
  const side = f.F.neg(vCross(f.F, vSub(f.F, k.arc.to, k.arc.from), vSub(f.F, X, k.arc.from)));
  const s = f.F.sign(side, 'area', f.ctx);
  return s === 1 || s === 0;
}

/** Three named points have equal powers to three named circles. */
function equalPowers<T>(f: Figure<T>, p: string, cs: readonly string[]): boolean {
  const P = asPoint(f.get(p));
  const [a, ...rest] = cs.map((c) => power(f.F, P, asCircle(f.get(c))));
  return a !== undefined && rest.every((x) => f.F.isZero(f.F.sub(x, a), 'area', f.ctx));
}

export const V11_PROPERTIES: readonly V11Property[] = [
  {
    tools: ['spiral_center', 'spiral', 'apply'],
    name: 'spiral_center(A, B, C, D) is fixed by spiral(A, B, C, D) and equals spiral_center(A, C, B, D) and spiral_center(D, B, C, A)',
    build: (b, [A, B, C, D]) => {
      const O = b.call('O', 'spiral_center', A, B, C, D);
      b.call('O_1', 'apply', call('spiral', [A, B, C, D]), O);
      b.call('O_2', 'spiral_center', A, C, B, D);
      b.call('O_3', 'spiral_center', D, B, C, A);
    },
    required: ['O'],
    check: (f) =>
      samePoints(f, 'O', 'O_1') && samePoints(f, 'O', 'O_2') && samePoints(f, 'O', 'O_3'),
    fields: EXACT,
  },
  {
    tools: ['isogonal', 'orthocenter', 'circumcenter'],
    name: 'isogonal is an involution, and isogonal(orthocenter) = circumcenter',
    build: (b, [A, B, C, D]) => {
      const X = b.call('X', 'isogonal', D, A, B, C);
      b.call('D_2', 'isogonal', X, A, B, C);
      b.call('O', 'isogonal', call('orthocenter', [A, B, C]), A, B, C);
      b.call('O_2', 'circumcenter', A, B, C);
    },
    required: ['X', 'D_2', 'O'],
    check: (f) => samePoints(f, 'D', 'D_2') && samePoints(f, 'O', 'O_2'),
    fields: EXACT,
  },
  {
    tools: ['symmedian', 'isogonal', 'centroid'],
    name: 'the three symmedians pass through isogonal(centroid) (the symmedian point); symmedian(A, B, C) = symmedian(A, C, B)',
    build: (b, [A, B, C]) => {
      b.call('K', 'isogonal', call('centroid', [A, B, C]), A, B, C);
      b.call('s_a', 'symmedian', A, B, C);
      b.call('s_b', 'symmedian', B, C, A);
      b.call('s_c', 'symmedian', C, A, B);
      b.call('s_2', 'symmedian', A, C, B);
    },
    required: ['K', 's_a'],
    check: (f) => {
      const [s, t] = [asLine(f.get('s_a')), asLine(f.get('s_2'))];
      const same = f.F.isZero(vCross(f.F, s.d, t.d), 'area', f.ctx) && onLine(f, 'A', 's_2');
      return same && ['s_a', 's_b', 's_c'].every((l) => onLine(f, 'K', l)) && !s.chiral;
    },
    fields: BOTH,
  },
  {
    tools: ['pole', 'polar'],
    name: 'pole and polar are inverse: pole(polar(D, c), c) = D, and the polar of pole(l, c) is l',
    build: (b, [A, B, C, D]) => {
      const c = b.call('c', 'circle', A, B);
      b.call('D_2', 'pole', call('polar', [D, c]), c);
      const l = b.call('l', 'line', C, D);
      const P = b.call('P', 'pole', l, c);
      b.call('m', 'polar', P, c);
    },
    required: ['D_2', 'P'],
    check: (f) => {
      const [l, m] = [asLine(f.get('l')), asLine(f.get('m'))];
      return (
        samePoints(f, 'D', 'D_2') &&
        f.F.isZero(vCross(f.F, l.d, m.d), 'area', f.ctx) &&
        onLine(f, 'C', 'm') &&
        onLine(f, 'D', 'm')
      );
    },
    fields: EXACT,
  },
  {
    tools: ['radical_center', 'radical_axis'],
    name: 'radical_center has equal powers to the three circles and lies on their radical axes; any order',
    build: (b, [A, B, C, D]) => {
      const c1 = b.call('c_1', 'circle', A, B);
      const c2 = b.call('c_2', 'circle', C, num('7/2'));
      const c3 = b.call('c_3', 'circle', D, A);
      b.call('X', 'radical_center', c1, c2, c3);
      b.call('X_2', 'radical_center', c3, c1, c2);
      b.call('r', 'radical_axis', c1, c2);
    },
    required: ['X'],
    check: (f) =>
      equalPowers(f, 'X', ['c_1', 'c_2', 'c_3']) &&
      samePoints(f, 'X', 'X_2') &&
      onLine(f, 'X', 'r'),
    fields: EXACT,
  },
  {
    tools: ['arc', 'on'],
    name: 'arc(A, B, C): the circle through A, B, C, from A or C to the other, B on the arc, gliders stay on it',
    build: (b, [A, B, C]) => {
      const a = b.call('a', 'arc', A, B, C);
      b.call('a_2', 'arc', C, B, A);
      b.call('k', 'circle', A, B, C);
      for (const [i, [u, v]] of [
        ['1', '0'],
        ['3', '-1'],
        ['-2', '5'],
        ['1', '-4'],
      ].entries())
        b.call(`X_${String(i)}`, 'on', a, num(u ?? '1'), num(v ?? '0'));
    },
    required: ['a'],
    check: (f) => {
      const [a, a2] = [asCircle(f.get('a')), asCircle(f.get('a_2'))];
      const sameEnds =
        a.arc !== null &&
        a2.arc !== null &&
        [
          [a.arc.from, a2.arc.from],
          [a.arc.to, a2.arc.to],
        ].every(
          ([p, r]) => p !== undefined && r !== undefined && f.F.eq(p.x, r.x) && f.F.eq(p.y, r.y),
        );
      const gliders = [0, 1, 2, 3].map((i) => `X_${String(i)}`);
      return (
        sameCircle(f, 'a', 'k') &&
        sameEnds &&
        onArc(f, 'B', 'a') &&
        gliders.every((x) => onCircle(f, x, 'a') && onArc(f, x, 'a'))
      );
    },
    fields: EXACT,
  },
];
