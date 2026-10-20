import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { BAND, EPS } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { ndgFailure, ndgStatus, type Ndg } from '../src/ndg';
import { lift, pt } from './helpers/values';

const CTX = { scale: 10 };
const v = (x: number, y: number) => ({ x, y });

describe('NDG items in FloatField: banded length and sine decisions', () => {
  it('distinct: within EPS·scale degenerate, inside the band ambiguous, beyond ok', () => {
    const at = (d: number) =>
      ndgStatus(FloatField, { kind: 'distinct', a: v(1, 1), b: v(1 + d, 1), what: '' }, CTX);
    expect(at(0)).toBe('degenerate');
    expect(at(0.5 * EPS * 10)).toBe('degenerate');
    expect(at(3 * EPS * 10)).toBe('ambiguous');
    expect(at(2 * BAND * 10)).toBe('ok');
    expect(at(-2 * BAND * 10)).toBe('ok');
  });

  it('noncollinear uses the smallest height, so a short valid triangle is fine', () => {
    const tri = (h: number) =>
      ndgStatus(
        FloatField,
        { kind: 'noncollinear', a: v(0, 0), b: v(1e-4, 0), c: v(0, h), what: '' },
        CTX,
      );
    expect(tri(1e-4)).toBe('ok');
    const flat = (h: number) =>
      ndgStatus(
        FloatField,
        { kind: 'noncollinear', a: v(0, 0), b: v(10, 0), c: v(5, h), what: '' },
        CTX,
      );
    expect(flat(0)).toBe('degenerate');
    expect(flat(2 * EPS * 10)).toBe('ambiguous');
    expect(flat(2 * BAND * 10)).toBe('ok');
    expect(
      ndgStatus(
        FloatField,
        { kind: 'noncollinear', a: v(1, 1), b: v(1, 1), c: v(1, 1), what: '' },
        CTX,
      ),
    ).toBe('degenerate');
  });

  it('nonparallel is a sine (dimensionless): short directions are judged like long ones', () => {
    const at = (u: number, s: number) =>
      ndgStatus(FloatField, { kind: 'nonparallel', u: v(u, 0), v: v(u, u * s), what: '' }, CTX);
    expect(at(1e-6, 1e-3)).toBe('ok');
    expect(at(1e3, 0)).toBe('degenerate');
    expect(at(1, 3 * EPS)).toBe('ambiguous');
  });

  it('off_line, distinct_radii, any', () => {
    expect(
      ndgStatus(
        FloatField,
        { kind: 'off_line', p: v(3, 1e-12), q: v(0, 0), d: v(1e-3, 0), what: '' },
        CTX,
      ),
    ).toBe('degenerate');
    expect(
      ndgStatus(
        FloatField,
        { kind: 'off_line', p: v(3, 1), q: v(0, 0), d: v(1e-3, 0), what: '' },
        CTX,
      ),
    ).toBe('ok');
    expect(ndgStatus(FloatField, { kind: 'distinct_radii', r2a: 4, r2b: 4, what: '' }, CTX)).toBe(
      'degenerate',
    );
    expect(
      ndgStatus(FloatField, { kind: 'distinct_radii', r2a: 4, r2b: 4.001, what: '' }, CTX),
    ).toBe('ok');
    const items: Ndg<number>[] = [
      { kind: 'distinct', a: v(0, 0), b: v(0, 0), what: 'a' },
      { kind: 'distinct', a: v(0, 0), b: v(3 * EPS * 10, 0), what: 'b' },
    ];
    expect(ndgStatus(FloatField, { kind: 'any', items, what: '' }, CTX)).toBe('ambiguous');
    expect(ndgFailure(FloatField, items, CTX)).toEqual({ status: 'degenerate', what: 'a' });
    expect(ndgFailure(FloatField, items.slice(1), CTX)).toEqual({ status: 'ambiguous', what: 'b' });
    expect(ndgFailure(FloatField, [], CTX)).toBeUndefined();
  });
});

describe('NDG items in exact fields: exact zero tests', () => {
  it('a point 10⁻³⁰ away is distinct over Q; the same point is not, over Q and mod p', () => {
    const aq = pt(RationalField, [1, 2]);
    expect(ndgStatus(RationalField, { kind: 'distinct', a: aq, b: aq, what: '' }, CTX)).toBe(
      'degenerate',
    );
    const ap = pt(ModPField, [1, 2]);
    expect(ndgStatus(ModPField, { kind: 'distinct', a: ap, b: ap, what: '' }, CTX)).toBe(
      'degenerate',
    );
    const tiny = pt(RationalField, [1, '2.000000000000000000000000000001']);
    expect(
      ndgStatus(
        RationalField,
        { kind: 'distinct', a: pt(RationalField, [1, 2]), b: tiny, what: '' },
        CTX,
      ),
    ).toBe('ok');
    const [r1, r2] = [lift(ModPField, 4), lift(ModPField, 4)];
    expect(ndgStatus(ModPField, { kind: 'distinct_radii', r2a: r1, r2b: r2, what: '' }, CTX)).toBe(
      'degenerate',
    );
    const col = {
      kind: 'noncollinear' as const,
      a: pt(ModPField, [0, 0]),
      b: pt(ModPField, [1, 1]),
      c: pt(ModPField, [5, 5]),
      what: '',
    };
    expect(ndgStatus(ModPField, col, CTX)).toBe('degenerate');
  });
});
