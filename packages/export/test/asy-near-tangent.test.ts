/**
 * The Asymptote helpers count as the kernel does (pre-beta review, ADR-0027): a gap within
 * the kernel's band is a tangency, whose candidate is the double point. gm_lc and gm_cc took
 * the square root of the gap anyway, so a gap of 10⁻⁷·scale became an offset of about
 * 10⁻³·scale: the exported T was 1.1·10⁻⁴ of the scale away from the kernel's.
 * Below, the helpers' formulas are evaluated as Asymptote would (doubles), from the text
 * of the file, and compared with the kernel; tex.yml compiles the same fixture.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { bandThreshold } from '@geomira/num/tolerance';
import { toAsymptote } from '../src/asy';
import { frameOf, REGISTRY } from './helpers/figure';

const text = readFileSync('tests/fixtures/export/near-tangent.geo', 'utf8');

type P = { x: number; y: number };
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y });
const abs = (a: P) => Math.hypot(a.x, a.y);

/** gm_lc(l, k) and gm_cc(a, b) of asy-helpers.ts, line for line. */
function lc(p: P, d: P, c: P, r: number, band: number): P[] {
  const t = ((c.x - p.x) * d.x + (c.y - p.y) * d.y) / (d.x * d.x + d.y * d.y);
  const f = { x: p.x + t * d.x, y: p.y + t * d.y };
  const e = abs(sub(f, c));
  const h = Math.abs(r - e) <= band ? 0 : Math.sqrt(Math.max(0, r * r - e * e));
  const u = { x: d.x / abs(d), y: d.y / abs(d) };
  return [-1, 1].map((s) => ({ x: f.x + s * h * u.x, y: f.y + s * h * u.y }));
}
function cc(c1: P, r1: number, c2: P, r2: number, band: number): P[] {
  const d = sub(c2, c1);
  const s = d.x * d.x + d.y * d.y;
  const dr = Math.abs(r1 - r2);
  const x = (s + r1 * r1 - r2 * r2) / (2 * s);
  const inner = Math.abs(Math.sqrt(s) - dr) <= band;
  const outer = Math.abs(r1 + r2 - Math.sqrt(s)) <= band;
  const touch = !(inner && dr <= band) && (inner || outer);
  const h = touch ? 0 : Math.sqrt(Math.max(0, r1 * r1 - x * x * s));
  const n = { x: -d.y / Math.sqrt(s), y: d.x / Math.sqrt(s) };
  return [-1, 1].map((k) => ({
    x: c1.x + x * d.x + k * h * n.x,
    y: c1.y + x * d.y + k * h * n.y,
  }));
}

describe('Asymptote near tangencies match the kernel', () => {
  const f = frameOf(text);
  const asy = toAsymptote(f, REGISTRY, 'standalone').text;
  const ctx = evalContextFor(f.doc);
  if (!ctx.ok) throw new Error(ctx.reason);
  const band = bandThreshold('length', ctx.ctx);
  const at = (name: string): P => {
    const o = f.doc.objects.find((x) => x.name === name);
    const v = o === undefined ? undefined : f.values.get(o.id);
    if (v?.kind !== 'point') throw new Error(`${name} is not a point`);
    return v;
  };

  it('the file writes the kernel band and the banded helpers, constructively', () => {
    expect(asy).toContain(`real gm_band = ${String(band)};`);
    expect(asy).toContain('  real h = abs(k.r - e) <= gm_band ? 0 : sqrt(max(0, k.r^2 - e^2));');
    expect(asy).toContain('  bool touch = !(inner && dr <= gm_band) && (inner || outer);');
    expect(asy).toContain('pair T = gm_low(gm_lc(l, c), +1);');
    expect(asy).toContain('pair U = gm_low(gm_cc(c, c2), +1);');
  });

  it('the helpers give the kernel double points', () => {
    const tol = 1e-6 * ctx.ctx.scale;
    const T = lc({ x: -10, y: 4.9999995 }, { x: 20, y: 0 }, { x: 0, y: 0 }, 5, band)[1];
    const U = cc({ x: 0, y: 0 }, 5, { x: 10.0000001, y: 0 }, 5, band)[1];
    const V = cc({ x: 0, y: 0 }, 5, { x: 0, y: 1 }, 4.0000001, band)[0];
    for (const [name, p] of [
      ['T', T],
      ['U', U],
      ['V', V],
    ] as const) {
      if (p === undefined) throw new Error(name);
      expect(abs(sub(p, at(name)))).toBeLessThan(tol);
    }
  });
});
