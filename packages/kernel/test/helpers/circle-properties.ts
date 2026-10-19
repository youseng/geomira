/**
 * Property tests of the Run 3a tools, spread into tools.property.test.ts's PROPERTIES
 * (whose meta-test checks that every registry tool has one). Exact over Q where the tool
 * needs no square root; the side-length tools are checked over floats here and exactly on
 * Heronian triangles in theorems-circles.test.ts.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { call } from '../../src/expr';
import { vCross, vDot, vSub } from '../../src/geom';
import type { Circle, Line, Value, Vec } from '../../src/value';
import { num, q, type Builder } from './doc';
import { asNum, asPoint, numIs, samePoints, type Figure, type Pts } from './figure';

export interface CircleProperty {
  readonly tools: readonly string[];
  readonly name: string;
  readonly build: (b: Builder, p: Pts) => void;
  readonly required: readonly string[];
  readonly check: <T>(f: Figure<T>) => boolean;
  readonly fields?: readonly Field<unknown>[];
}

export const FLOAT = [FloatField] as Field<unknown>[];
export const BOTH = [RationalField, FloatField] as Field<unknown>[];

export function asCircle<T>(v: Value<T>): Circle<T> {
  if (v.kind !== 'circle') throw new Error(`expected a circle, got ${v.kind}`);
  return v;
}

export function asLine<T>(v: Value<T>): Line<T> {
  if (v.kind !== 'line') throw new Error(`expected a line, got ${v.kind}`);
  return v;
}

/** The power |P − O|² − r² of P. */
export function power<T>(F: Field<T>, P: Vec<T>, c: Circle<T>): T {
  const w = vSub(F, P, c.c);
  return F.sub(vDot(F, w, w), c.r2);
}

/** P lies on circle `c` (names): its power is zero as an area. */
export function onCircle<T>(f: Figure<T>, p: string, c: string): boolean {
  return f.F.isZero(power(f.F, asPoint(f.get(p)), asCircle(f.get(c))), 'area', f.ctx);
}

/** P lies on the carrier line of `l` (names). */
export function onLine<T>(f: Figure<T>, p: string, l: string): boolean {
  const L = asLine(f.get(l));
  return f.F.isZero(vCross(f.F, vSub(f.F, asPoint(f.get(p)), L.p), L.d), 'area', f.ctx);
}

/** Two directions are perpendicular (dot product zero as an area). */
export function perpendicular<T>(f: Figure<T>, a: Vec<T>, b: Vec<T>): boolean {
  return f.F.isZero(vDot(f.F, a, b), 'area', f.ctx);
}

/** Two directions are parallel (cross product zero as an area). */
export function parallel<T>(f: Figure<T>, a: Vec<T>, b: Vec<T>): boolean {
  return f.F.isZero(vCross(f.F, a, b), 'area', f.ctx);
}

/** x equals the exact value `text` as a quantity of dimension `dim`. */
export function equalsExact<T>(f: Figure<T>, x: T, text: string, dim: 'length' | 'area'): boolean {
  const t = f.F.fromRational(q(text));
  if (isInexact(t)) throw new Error(t.reason);
  return f.F.isZero(f.F.sub(x, t), dim, f.ctx);
}

function sameVec<T>(f: Figure<T>, p: Vec<T>, r: Vec<T>): boolean {
  return (
    f.F.isZero(f.F.sub(p.x, r.x), 'length', f.ctx) && f.F.isZero(f.F.sub(p.y, r.y), 'length', f.ctx)
  );
}

/** The centre, r² and anchor of two circles (names) agree. */
export function sameCircle<T>(f: Figure<T>, a: string, b: string): boolean {
  const [c, d] = [asCircle(f.get(a)), asCircle(f.get(b))];
  const anchors =
    c.anchor === undefined || d.anchor === undefined
      ? c.anchor === d.anchor
      : sameVec(f, c.anchor, d.anchor);
  return sameVec(f, c.c, d.c) && f.F.isZero(f.F.sub(c.r2, d.r2), 'area', f.ctx) && anchors;
}

/** The anchor of circle `c` is the point `p` (names). */
export function anchorIs<T>(f: Figure<T>, c: string, p: string): boolean {
  const a = asCircle(f.get(c)).anchor;
  return a !== undefined && sameVec(f, a, asPoint(f.get(p)));
}

/** Two named numbers are equal (dimensionless). */
export function sameNumbers<T>(f: Figure<T>, a: string, b: string): boolean {
  return f.F.isZero(f.F.sub(asNum(f.get(a)), asNum(f.get(b))), 'dimensionless', f.ctx);
}

export const CIRCLE_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['circle', 'circumcircle', 'center', 'circumcenter'],
    name: 'circle(A, B, C) = circumcircle(A, B, C): centred at the circumcenter, through A, B, C, anchored at A',
    build: (b, [A, B, C]) => {
      b.call('c', 'circle', A, B, C);
      b.call('k', 'circumcircle', A, B, C);
      b.call('O', 'center', b.ref('c'));
      b.call('O_2', 'circumcenter', A, B, C);
    },
    required: ['c'],
    check: (f) =>
      sameCircle(f, 'c', 'k') &&
      samePoints(f, 'O', 'O_2') &&
      ['A', 'B', 'C'].every((p) => onCircle(f, p, 'c')) &&
      anchorIs(f, 'c', 'A'),
  },
  {
    tools: ['circle', 'on'],
    name: 'circle(O, A) is anchored at A; on(c, u, v) lies on c; on(c, u, 0) is the anchor; circle(O, r) has r² and no anchor',
    build: (b, [A, B]) => {
      const c = b.call('c', 'circle', A, B);
      b.call('X', 'on', c, num('7/3'), num(-2));
      b.call('Y', 'on', c, num(-3), num(0));
      b.call('r', 'circle', A, num('7/2'));
    },
    required: ['c'],
    check: (f) => {
      const r = asCircle(f.get('r'));
      return (
        onCircle(f, 'X', 'c') &&
        onCircle(f, 'B', 'c') &&
        anchorIs(f, 'c', 'B') &&
        samePoints(f, 'Y', 'B') &&
        r.anchor === undefined &&
        equalsExact(f, r.r2, '49/4', 'area')
      );
    },
  },
  {
    tools: ['on', 'segment', 'ray', 'divide'],
    name: 'on(segment(A, B), t) = divide(A, B, t) inside the range, clamped outside it',
    build: (b, [A, B]) => {
      const s = b.call('s', 'segment', A, B);
      b.call('X', 'on', s, num('1/3'));
      b.call('X_2', 'divide', A, B, num('1/3'));
      b.call('Y', 'on', s, num(2));
      b.call('Z', 'on', call('ray', [A, B]), num(-1));
    },
    required: ['s'],
    check: (f) => samePoints(f, 'X', 'X_2') && samePoints(f, 'Y', 'B') && samePoints(f, 'Z', 'A'),
  },
  {
    tools: ['on', 'angle'],
    name: 'on(circle(O, r), θ): on(c, 30) and on(c, 120) lie on c and subtend 90° at O',
    build: (b, [A]) => {
      const c = b.call('c', 'circle', A, num(3));
      b.call('X', 'on', c, num(30));
      b.call('Y', 'on', c, num(120));
      b.call('a', 'angle', b.ref('X'), A, b.ref('Y'));
    },
    required: [],
    check: (f) => onCircle(f, 'X', 'c') && onCircle(f, 'Y', 'c') && numIs(f, 'a', '90'),
    fields: FLOAT,
  },
  {
    tools: ['cline', 'circumcircle', 'line'],
    name: 'cline(A, B, C) is the circumcircle; cline(A, B, X) with X on AB is the line AB',
    build: (b, [A, B, C]) => {
      b.call('c', 'cline', A, B, C);
      b.call('k', 'circumcircle', A, B, C);
      b.call('m', 'cline', A, B, call('divide', [A, B, num('3/2')]));
      b.call('l', 'line', A, B);
    },
    required: ['c', 'm'],
    check: (f) => {
      const [m, l] = [asLine(f.get('m')), asLine(f.get('l'))];
      return sameCircle(f, 'c', 'k') && sameVec(f, m.p, l.p) && sameVec(f, m.d, l.d) && !m.chiral;
    },
  },
];
