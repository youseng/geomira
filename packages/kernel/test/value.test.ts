import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  VALUE_KINDS,
  capabilityKinds,
  hasCapability,
  isKnownKind,
  isLine,
  isNum,
  isPoint,
  isPolygon,
  isUnavailable,
  numOf,
  numbersOf,
  pointOf,
  undef,
  type Value,
} from '../src/value';

const VALUES: Value<number>[] = [
  pointOf(1, 2),
  { kind: 'line', p: { x: 0, y: 0 }, d: { x: 1, y: 0 }, lo: 0, hi: null, chiral: false },
  {
    kind: 'circle',
    c: { x: 0, y: 0 },
    r2: 4,
    arc: { from: { x: 2, y: 0 }, to: { x: 0, y: 2 } },
    anchor: { x: 2, y: 0 },
  },
  { kind: 'circle', c: { x: 1, y: 1 }, r2: 1, arc: null },
  numOf(3),
  {
    kind: 'polygon',
    pts: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  },
  {
    kind: 'transform',
    t: { type: 'similarity', anti: false, a: { re: 1, im: 0 }, b: { re: 2, im: 3 } },
  },
  undef('why'),
  { kind: 'inexact', reason: 'not here' },
];

describe('values and capabilities (SPEC §4)', () => {
  it('maps every capability to its kinds', () => {
    expect(Object.fromEntries(CAPABILITIES.map((c) => [c, capabilityKinds(c)]))).toEqual({
      point: ['point'],
      curve: ['line', 'circle'],
      linear: ['line'],
      round: ['circle'],
      number: ['number'],
      transform: ['transform'],
      polygon: ['polygon'],
      annotation: ['angle_mark', 'segment_mark', 'text'],
      string: ['string'],
    });
    expect(() => capabilityKinds('nope' as never)).toThrow(/unexpected capability/);
  });

  it('hasCapability: Undefined, Inexact and unknown kinds have none', () => {
    for (const v of VALUES) {
      const caps = CAPABILITIES.filter((c) => hasCapability(v, c));
      if (v.kind === 'undefined' || v.kind === 'inexact') expect(caps).toEqual([]);
      else expect(caps.length).toBeGreaterThan(0);
    }
    expect(CAPABILITIES.filter((c) => hasCapability({ kind: 'locus' }, c))).toEqual([]);
    expect(isKnownKind({ kind: 'locus' })).toBe(false);
    expect(VALUES.every(isKnownKind)).toBe(true);
    expect(new Set(VALUES.map((v) => v.kind))).toEqual(new Set(VALUE_KINDS));
  });

  it('predicates and constructors', () => {
    expect(
      VALUES.map((v) =>
        [isPoint(v), isLine(v), isNum(v), isPolygon(v), isUnavailable(v)].map(Number).join(''),
      ),
    ).toEqual(['10000', '01000', '00000', '00000', '00100', '00010', '00000', '00001', '00001']);
    expect(numOf(1)).toEqual({ kind: 'number', v: 1 });
    expect(Object.keys(numOf(1))).toEqual(['kind', 'v']);
  });

  it('numbersOf lists every field element, never the null bounds', () => {
    expect(VALUES.map((v) => numbersOf(v))).toEqual([
      [1, 2],
      [0, 0, 1, 0, 0],
      [0, 0, 4, 2, 0, 0, 2, 2, 0],
      [1, 1, 1],
      [3],
      [0, 0, 1, 0],
      [1, 0, 2, 3],
      [],
      [],
    ]);
    const full: Value<number> = {
      kind: 'line',
      p: { x: 0, y: 0 },
      d: { x: 1, y: 0 },
      lo: -1,
      hi: 1,
      chiral: true,
    };
    expect(numbersOf(full)).toEqual([0, 0, 1, 0, -1, 1]);
    expect(() => numbersOf({ kind: 'locus' } as never)).toThrow(/unexpected value/);
  });
});
