/**
 * TikZ arcs of a large screen radius (ADR-0028): `arc[… radius=R]` makes TeX compute R × the
 * unit and offsets up to 2R as dimensions, which stop at 16383.99pt (\maxdimen). The canvas
 * draws arcs of up to MAX_ARC_RADIUS = 32768 px (24576bp) as curves, so from a safe bound on
 * an arc is written as explicit Bézier pieces instead, each within ARC_BEZIER_PX (1/16 px) of
 * the circle; smaller arcs are written as before.
 */
import { describe, expect, it } from 'vitest';
import { ARC_BEZIER_PX } from '../src/arc-bezier';
import { toTikz } from '../src/tikz';
import { frameOf } from './helpers/figure';

const PT_PER_BP = 72.27 / 72;
const MAX_DIMEN_PT = 16383.99;

function figure(R: number): string {
  return `@version 1\n@viewport 0 0 50\nO = (0, ${String(-R)})\nP = (0, 0)\nc = circle(O, P)\n`;
}

type Pair = readonly [number, number];
const pair = (s: string): Pair => {
  const [x, y] = s.split(',').map(Number);
  return [x ?? NaN, y ?? NaN];
};

/** The Bézier pieces `(p0) .. controls (c0) and (c1) .. (p1) …` of a \draw line. */
function pieces(line: string): [Pair, Pair, Pair, Pair][] {
  const start = /\] \(([^)]*)\)/u.exec(line)?.[1];
  if (start === undefined) return [];
  const out: [Pair, Pair, Pair, Pair][] = [];
  let p0 = pair(start);
  for (const m of line.matchAll(/\.\. controls \(([^)]*)\) and \(([^)]*)\) \.\. \(([^)]*)\)/gu)) {
    const p1 = pair(m[3] ?? '');
    out.push([p0, pair(m[1] ?? ''), pair(m[2] ?? ''), p1]);
    p0 = p1;
  }
  return out;
}

function bezier([p0, c0, c1, p1]: [Pair, Pair, Pair, Pair], t: number): Pair {
  const u = 1 - t;
  const f = (i: 0 | 1) =>
    u * u * u * p0[i] + 3 * u * u * t * c0[i] + 3 * u * t * t * c1[i] + t * t * t * p1[i];
  return [f(0), f(1)];
}

describe('TikZ arcs stay within TeX’s dimensions', () => {
  for (const R of [10, 100, 150, 300, 436, 600, 655])
    it(`a circle of radius ${String(R)} at zoom 50 (${String(R * 50)} px)`, () => {
      const t = toTikz(frameOf(figure(R))).text;
      const unit = Number(/\[x=([^,]*)bp/u.exec(t)?.[1] ?? NaN);
      expect(unit).toBe(37.5);
      for (const m of t.matchAll(/radius=([\d.]+)\]/gu))
        expect(2 * Number(m[1]) * unit * PT_PER_BP).toBeLessThan(MAX_DIMEN_PT);
      const line = t.split('\n').find((l) => l.startsWith('\\draw[') && l.includes('gmc0'));
      if (line === undefined) throw new Error(t);
      const ps = pieces(line);
      if (line.includes('arc[')) expect(ps).toEqual([]);
      else {
        expect(ps.length).toBeGreaterThan(0);
        // Every piece is on the circle within ARC_BEZIER_PX and the written digits.
        for (const p of ps)
          for (let i = 0; i <= 32; i++) {
            const [x, y] = bezier(p, i / 32);
            const off = Math.abs(Math.hypot(x, y + R) - R) * unit;
            expect(off).toBeLessThan(0.75 * ARC_BEZIER_PX + 0.02);
          }
      }
    });

  it('the arc pieces reach both edges of the view', () => {
    const t = toTikz(frameOf(figure(600))).text;
    const line = t.split('\n').find((l) => l.includes('.. controls')) ?? '';
    const ps = pieces(line);
    const xs = ps.flatMap((p) => [p[0][0], p[3][0]]);
    expect(Math.min(...xs)).toBeLessThan(-6.4);
    expect(Math.max(...xs)).toBeGreaterThan(6.4);
  });
});
