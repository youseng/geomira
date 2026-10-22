/**
 * figureDiameter (ADR-0017): the scale of SPEC §3.1 before its clamp to ≥ 1, used by the
 * samplers and the GUI choice so that a figure is treated alike at every size. Each
 * degenerate case of its doc comment is a test; evalContextFor is its clamp.
 */
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../src/context';
import { call } from '../src/expr';
import { figureDiameter } from '../src/figure-size';
import { Builder, num, pt } from './helpers/doc';

describe('figureDiameter', () => {
  it('is the diameter of the free points, unclamped, and evalContextFor clamps it to 1', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', '0.03', '0.04');
    expect(figureDiameter(b.doc)).toBeCloseTo(0.05, 15);
    const c = evalContextFor(b.doc);
    expect(c.ok ? c.ctx.scale : c.reason).toBe(1);
  });

  it('counts explicit radii as 2·|r| and points nested in other calls', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.add('c', call('circle', [b.ref('A'), num('-1/100')]));
    expect(figureDiameter(b.doc)).toBeCloseTo(0.02, 15);
    b.add('M', call('midpoint', [pt(0, 0), pt('0.3', '0.4')]));
    expect(figureDiameter(b.doc)).toBeCloseTo(0.5, 15);
  });

  it('degenerate: no free point and no radius → 0; a single point → 0', () => {
    expect(figureDiameter(new Builder().doc)).toBe(0);
    const b = new Builder();
    b.point('A', 5, -7);
    expect(figureDiameter(b.doc)).toBe(0);
  });

  it('degenerate: a radius beyond the float argument limit is ignored', () => {
    const b = new Builder();
    b.point('A', 0, 0);
    b.point('B', 1, 0);
    b.add('c', call('circle', [b.ref('A'), num('9'.repeat(70))]));
    expect(figureDiameter(b.doc)).toBe(1);
  });

  it('degenerate: a coordinate beyond the double range → undefined (evalContextFor refuses)', () => {
    const b = new Builder();
    b.add('A', pt(`1${'0'.repeat(400)}`, 0));
    expect(figureDiameter(b.doc)).toBeUndefined();
    expect(evalContextFor(b.doc).ok).toBe(false);
  });
});
