/**
 * Property tests of the display tools of Run 8a (ADR-0011), spread into
 * tools.property.test.ts's PROPERTIES (whose meta-test checks that every registry tool has
 * one). Every map used is exact over Q (reflections, 90° rotations), so each property is
 * checked exactly and in floats.
 */
import type { Field } from '@geomira/num/field';
import { call, type Expr } from '../../src/expr';
import { vCross, vSub } from '../../src/geom';
import type { Value, Vec } from '../../src/value';
import { num } from './doc';
import type { Figure } from './figure';
import { BOTH, type CircleProperty } from './circle-properties';

const T = (tool: string, ...args: Expr[]): Expr => call(tool, args);
const str = (value: string): Expr => ({ kind: 'str', value });

function same<T>(F: Field<T>, f: Figure<T>, p: Vec<T>, q: Vec<T>): boolean {
  return F.isZero(F.sub(p.x, q.x), 'length', f.ctx) && F.isZero(F.sub(p.y, q.y), 'length', f.ctx);
}

/** Two display values are equal (kind, counts, string, every position). */
export function sameDisplay<T>(f: Figure<T>, u: Value<T>, v: Value<T>): boolean {
  const { F } = f;
  if (u.kind === 'angle_mark' && v.kind === 'angle_mark')
    return (
      u.arcs === v.arcs &&
      u.right === v.right &&
      same(F, f, u.b, v.b) &&
      same(F, f, u.from, v.from) &&
      same(F, f, u.to, v.to)
    );
  if (u.kind === 'segment_mark' && v.kind === 'segment_mark')
    return u.ticks === v.ticks && same(F, f, u.p, v.p) && same(F, f, u.q, v.q);
  if (u.kind === 'text' && v.kind === 'text') return u.text === v.text && same(F, f, u.at, v.at);
  return false;
}

/** The mark's arms run counter-clockwise: cross(from − b, to − b) > 0. */
function counterClockwise<T>(f: Figure<T>, v: Value<T>): boolean {
  if (v.kind !== 'angle_mark') return false;
  return f.F.sign(vCross(f.F, vSub(f.F, v.from, v.b), vSub(f.F, v.to, v.b)), 'area', f.ctx) === 1;
}

const sameNamed = <T>(f: Figure<T>, a: string, b: string) => sameDisplay(f, f.get(a), f.get(b));

export const DISPLAY_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['mark_angle', 'apply'],
    name: 'mark_angle(A, B, C) = mark_angle(C, B, A), counter-clockwise; its image under a reflection or a quarter turn is the mark of the images',
    build: (b, [A, B, C, D]) => {
      b.call('m', 'mark_angle', A, B, C, num(2));
      b.call('m_2', 'mark_angle', C, B, A, num(2));
      const s = T('reflect', T('line', B, D));
      b.call('r', 'apply', s, b.ref('m'));
      b.call('r_2', 'mark_angle', T('apply', s, A), T('apply', s, B), T('apply', s, C), num(2));
      const t = T('rotate', D, num(90));
      b.call('q', 'apply', t, b.ref('m'));
      b.call('q_2', 'mark_angle', T('apply', t, A), T('apply', t, B), T('apply', t, C), num(2));
    },
    required: ['m', 'r', 'q'],
    check: (f) =>
      counterClockwise(f, f.get('m')) &&
      counterClockwise(f, f.get('r')) &&
      sameNamed(f, 'm', 'm_2') &&
      sameNamed(f, 'r', 'r_2') &&
      sameNamed(f, 'q', 'q_2'),
    fields: BOTH,
  },
  {
    tools: ['mark_right', 'apply'],
    name: 'mark_right(A, B, rotate(A, B, ±90)) is a right-angle mark equal to its reverse, mapped like a mark',
    build: (b, [A, B, , D]) => {
      b.add('X', T('rotate', A, B, num(90)));
      b.add('Y', T('rotate', A, B, num(-90)));
      b.call('m', 'mark_right', A, B, b.ref('X'));
      b.call('m_2', 'mark_right', b.ref('X'), B, A);
      b.call('n', 'mark_right', A, B, b.ref('Y'));
      const s = T('reflect', T('line', B, D));
      b.call('r', 'apply', s, b.ref('m'));
      b.call('r_2', 'mark_right', T('apply', s, A), T('apply', s, B), T('apply', s, b.ref('X')));
    },
    required: ['m', 'n', 'r'],
    check: (f) => {
      const m = f.get('m');
      return (
        m.kind === 'angle_mark' &&
        m.right &&
        counterClockwise(f, m) &&
        counterClockwise(f, f.get('n')) &&
        sameNamed(f, 'm', 'm_2') &&
        sameNamed(f, 'r', 'r_2')
      );
    },
    fields: BOTH,
  },
  {
    tools: ['mark_segment', 'apply'],
    name: 'mark_segment(A, B, n) keeps its ends and ticks; its image is the mark of the images',
    build: (b, [A, B, , D]) => {
      b.call('m', 'mark_segment', A, B, num(3));
      const s = T('reflect', D);
      b.call('r', 'apply', s, b.ref('m'));
      b.call('r_2', 'mark_segment', T('apply', s, A), T('apply', s, B), num(3));
    },
    required: ['m', 'r'],
    check: (f) => {
      const m = f.get('m');
      return (
        m.kind === 'segment_mark' &&
        m.ticks === 3 &&
        same(f.F, f, m.p, asVec(f.get('A'))) &&
        same(f.F, f, m.q, asVec(f.get('B'))) &&
        sameNamed(f, 'r', 'r_2')
      );
    },
    fields: BOTH,
  },
  {
    tools: ['text', 'apply'],
    name: 'text(A, s) sits at A with s; its image under a map is the text at the image of A',
    build: (b, [A, B, C]) => {
      b.call('t', 'text', A, str('Let \\omega be the circle'));
      const s = T('reflect', T('line', B, C));
      b.call('r', 'apply', s, b.ref('t'));
      b.call('r_2', 'text', T('apply', s, A), str('Let \\omega be the circle'));
    },
    required: ['t', 'r'],
    check: (f) => {
      const t = f.get('t');
      return (
        t.kind === 'text' &&
        t.text === 'Let \\omega be the circle' &&
        same(f.F, f, t.at, asVec(f.get('A'))) &&
        sameNamed(f, 'r', 'r_2')
      );
    },
    fields: BOTH,
  },
];

function asVec<T>(v: Value<T>): Vec<T> {
  if (v.kind !== 'point') throw new Error(`expected a point, got ${v.kind}`);
  return v;
}
