/**
 * Explicit radii in the figure scale (SPEC §3.1, ADR-0004): the literal r of circle(O, r)
 * counts as a diameter 2·|r|; computed radii and circle(O, A) do not; a radius beyond the
 * float argument limit is ignored (its circle is Inexact in the float run anyway).
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../src/context';
import { call } from '../src/expr';
import { Builder, evalDoc, num, pt, valueOf } from './helpers/doc';

function scaleOf(b: Builder): number | string {
  const c = evalContextFor(b.doc);
  return c.ok ? c.ctx.scale : c.reason;
}

describe('evalContextFor counts explicit radii', () => {
  it('a literal radius counts as a diameter 2·|r|, combined with the free points by max', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', 3, 4);
    expect(scaleOf(b)).toBe(5);
    b.add('c', call('circle', [b.ref('A'), num(10)]));
    expect(scaleOf(b)).toBe(20);
    b.add('k', call('center', [call('circle', [pt(1, 1), num(-15)])]));
    expect(scaleOf(b)).toBe(30);
  });

  it('computed radii and circle(O, A) do not count', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.add('c', call('circle', [b.ref('A'), call('add', [num(50), num(1)])]));
    b.add('k', call('circle', [b.ref('A'), pt(1, 0)]));
    expect(scaleOf(b)).toBe(1);
  });

  it('a radius alone sets the scale; small radii keep the minimum scale 1', () => {
    const b = new Builder();
    b.add('c', call('circle', [call('point', [call('neg', [num(0)]), num(0)]), num(7)]));
    expect(scaleOf(b)).toBe(14);
    const small = new Builder();
    small.add('c', call('circle', [pt(0, 0), num('1/10')]));
    expect(scaleOf(small)).toBe(1);
  });

  it('a radius beyond the float argument limit is ignored; its float circle is Inexact', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', 6, 8);
    b.add('c', call('circle', [b.ref('A'), num(1e200)]));
    expect(scaleOf(b)).toBe(10);
    expect(valueOf(b.doc, evalDoc(b.doc, FloatField), 'c').kind).toBe('inexact');
    expect(valueOf(b.doc, evalDoc(b.doc, RationalField), 'c').kind).toBe('circle');
    const huge = new Builder();
    huge.point('A', 0, 0);
    huge.point('B', 6, 8);
    huge.add('c', call('circle', [huge.ref('A'), num(`1${'0'.repeat(400)}`)]));
    expect(scaleOf(huge)).toBe(10);
    const big = new Builder();
    big.add('c', call('circle', [pt(0, 0), num(1e50)]));
    expect(scaleOf(big)).toBe(2e50);
  });
});
