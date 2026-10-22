/**
 * Found in the Run 10 audit: TikZ wrote numbers TeX cannot read. TeX's dimensions and pgf's
 * numbers are fixed-point (|x| ≤ 16383.99, resolution 2^−16): a fitted figure 0.001 wide got
 * `x=300000bp`, one 10^9 wide `x=0bp` (and coordinates of 10^8), and a figure with a coordinate
 * of 20000 at a small unit wrote `(20000,0)` raw. Now the unit stays a few bp, every coordinate
 * number stays below 15000 with at least three significant digits across the view, and
 * ordinary figures are written exactly as before (the goldens are unchanged).
 */
import { describe, expect, it } from 'vitest';
import { toTikzStandalone } from '../src/tikz';
import { toAsymptote } from '../src/asy';
import { frameOf, REGISTRY } from './helpers/figure';

function numbers(tikz: string): { unit: number; coords: number[] } {
  const unit = Number(/\[x=([^,]*)bp/u.exec(tikz)?.[1] ?? NaN);
  const coords = [...tikz.matchAll(/\((-?[\d.]+),(-?[\d.]+)\)/gu)].flatMap((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  return { unit, coords };
}

function triangle(x0: number, s: number): string {
  const f = (v: number) =>
    v.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
  return `@version 1\nA = (${f(x0)}, 0)\nB = (${f(x0 + s)}, 0)\nC = (${f(x0)}, ${f(s)})\nt = polygon(A, B, C)\n`;
}

describe('TikZ numbers stay within TeX’s range', () => {
  for (const [what, text] of [
    ['a figure 0.001 wide', triangle(0, 0.001)],
    ['a figure 10^-7 wide', triangle(0, 1e-7)],
    ['a figure 10^9 wide', triangle(0, 1e9)],
    ['a figure 20000 from the origin', triangle(20000, 3)],
    ['a figure 10^6 wide and 10^9 from the origin', triangle(1e9, 1e6)],
  ] as const)
    it(`${what}: the unit is a few bp, coordinates below 15000 and distinguishable`, () => {
      const t = toTikzStandalone(frameOf(text)).text;
      const { unit, coords } = numbers(t);
      expect(unit, t).toBeGreaterThan(0.05);
      expect(unit).toBeLessThan(1000);
      expect(coords.length).toBeGreaterThan(3);
      for (const c of coords) expect(Math.abs(c)).toBeLessThan(15000);
      // The triangle's legs span many units of the last written digit.
      const xs = coords.filter((_, i) => i % 2 === 0);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    });

  it('an ordinary figure is written in world coordinates at the screen’s unit (as before)', () => {
    const t = toTikzStandalone(frameOf(triangle(0, 4))).text;
    expect(t).not.toContain('Coordinates are world coordinates ×');
    expect(t).not.toContain('relative to');
    expect(t).toContain('(0,0)');
  });
});

describe('the Asymptote unit of an extreme figure is not rounded away', () => {
  it('a figure 10^9 wide has a positive unitsize; an ordinary one keeps six decimals', () => {
    const huge = toAsymptote(frameOf(triangle(1e9, 1e9)), REGISTRY, 'standalone').text;
    const unit = Number(/^unitsize\(([^)]*)\);$/mu.exec(huge)?.[1] ?? NaN);
    expect(unit).toBeGreaterThan(0);
    expect(huge).not.toContain('(0 px on screen)');
    const ordinary = toAsymptote(frameOf(triangle(0, 4)), REGISTRY, 'standalone').text;
    expect(ordinary).toMatch(/^unitsize\(\d+(\.\d{1,6})?\);$/mu);
  });
});
