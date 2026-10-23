/**
 * Asymptote circles at the screen's accuracy (ADR-0028). `circle(c, r)` and `arc(…)` are
 * unitcircle scaled, four cubic Béziers that are off the circle by up to 2.7·10⁻⁴·r: at zoom
 * 2000 a circle of radius 5 (10000 px) was drawn up to 2.7 px off, so a point on it was
 * visibly off the curve. A circle or arc whose quarter pieces would be off by more than
 * ARC_BEZIER_PX is now written as enough explicit Bézier pieces; smaller ones are drawn as
 * before. Below, the pieces are read back from the file and measured against the circle.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARC_BEZIER_PX, bezierArcError } from '../src/arc-bezier';
import { toAsymptote } from '../src/asy';
import { examples, frameOf, REGISTRY } from './helpers/figure';

type P = readonly [number, number];
const pair = (s: string): P => {
  const [x, y] = s.split(',').map(Number);
  return [x ?? NaN, y ?? NaN];
};

/** The pieces `(p0)..controls (c0) and (c1)..(p1)…` of a draw statement. */
function pieces(line: string): [P, P, P, P][] {
  const start = /^draw\(\(([^)]*)\)\.\.controls/u.exec(line)?.[1];
  if (start === undefined) return [];
  const out: [P, P, P, P][] = [];
  let p0 = pair(start);
  for (const m of line.matchAll(/\.\.controls \(([^)]*)\) and \(([^)]*)\)\.\.\(([^)]*)\)/gu)) {
    const p1 = pair(m[3] ?? '');
    out.push([p0, pair(m[1] ?? ''), pair(m[2] ?? ''), p1]);
    p0 = p1;
  }
  return out;
}

/** The largest distance between the pieces and the circle (c, r), world units. */
function offCircle(ps: [P, P, P, P][], c: P, r: number): number {
  let worst = 0;
  for (const [p0, c0, c1, p1] of ps)
    for (let j = 0; j <= 64; j++) {
      const t = j / 64;
      const u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
      const x = w[0] * p0[0] + w[1] * c0[0] + w[2] * c1[0] + w[3] * p1[0];
      const y = w[0] * p0[1] + w[1] * c0[1] + w[2] * c1[1] + w[3] * p1[1];
      worst = Math.max(worst, Math.abs(Math.hypot(x - c[0], y - c[1]) - r));
    }
  return worst;
}

function drawOf(text: string, name: string): string {
  const lines = text.split('\n');
  return lines[lines.indexOf(`// ${name}`) + 1] ?? '';
}

describe('Asymptote circles within ARC_BEZIER_PX of the canvas’s', () => {
  it('a circle of radius 5 at zoom 2000 (the review’s case)', () => {
    const a = (19.44 * Math.PI) / 180;
    const f = frameOf(`@version 1
@viewport ${(5 * Math.cos(a)).toFixed(4)} ${(5 * Math.sin(a)).toFixed(4)} 2000
O = (0, 0)
c = circle(O, 5)
P = intersect(c, line(O, (${Math.cos(a).toFixed(6)}, ${Math.sin(a).toFixed(6)})), along(+))
`);
    const text = toAsymptote(f, REGISTRY, 'standalone').text;
    expect(text).not.toMatch(/^draw\(circle\(/mu);
    const ps = pieces(drawOf(text, 'c'));
    expect(ps.length).toBeGreaterThan(0);
    expect(offCircle(ps, [0, 0], 5) * 2000).toBeLessThanOrEqual(ARC_BEZIER_PX);
  });

  it('a circle of radius 600 at zoom 50 (30000 px)', () => {
    const f = frameOf(
      '@version 1\n@viewport 0 0 50\nO = (0, -600)\nP = (0, 0)\nc = circle(O, P)\n',
    );
    const ps = pieces(drawOf(toAsymptote(f, REGISTRY, 'standalone').text, 'c'));
    expect(ps.length).toBeGreaterThan(0);
    expect(offCircle(ps, [0, -600], 600) * 50).toBeLessThanOrEqual(ARC_BEZIER_PX);
    // The drawn span crosses the whole view.
    const xs = ps.flatMap((p) => [p[0][0], p[3][0]]);
    expect(Math.min(...xs)).toBeLessThan(-6.4);
    expect(Math.max(...xs)).toBeGreaterThan(6.4);
  });

  it('a circle the canvas samples as a polyline is that polyline', () => {
    const f = frameOf(
      '@version 1\n@viewport 0 0 50\nO = (0, -1000)\nP = (0, 0)\nc = circle(O, P)\n',
    );
    expect(drawOf(toAsymptote(f, REGISTRY, 'standalone').text, 'c')).toMatch(
      /^draw\(\([^)]*\)--\(/u,
    );
  });

  const inputs = [
    ...examples(),
    ...['constructions', 'display', 'numeric', 'big-arcs'].map((n) => ({
      name: `fixture-${n}`,
      text: readFileSync(`tests/fixtures/export/${n}.geo`, 'utf8'),
    })),
  ];
  for (const input of inputs)
    it(`${input.name}: every circle drawn as one is within ARC_BEZIER_PX`, () => {
      const f = frameOf(input.text);
      const text = toAsymptote(f, REGISTRY, 'standalone').text;
      for (const item of f.display.items) {
        const arc = item.paths.find((p) => p.kind === 'arc');
        if (item.kind !== 'circle' || arc?.kind !== 'arc') continue;
        const draw = drawOf(text, item.name);
        if (draw.startsWith('draw(circle(') || draw.startsWith('draw(arc('))
          expect(arc.r * bezierArcError(Math.PI / 2)).toBeLessThanOrEqual(ARC_BEZIER_PX);
        else expect(pieces(draw).length).toBeGreaterThan(0);
      }
    });
});
