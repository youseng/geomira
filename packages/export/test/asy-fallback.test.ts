/**
 * What the Asymptote export writes numerically (ADR-0014 decision 10): calls whose tool or
 * arguments do not map, selectors the helpers cannot follow exactly, and every kind of numeric
 * variable (tests/fixtures/export/numeric.geo is compiled and checked in tex.yml).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { toAsymptoteCheck } from '../src/asy';
import { planAsy, typeOfValue } from '../src/asy-plan';
import { frameOf, REGISTRY } from './helpers/figure';

const BASE = `@version 1
A = (0, 0)
B = (6, 0)
C = (1, 5)
P = (3, -2)
w = circumcircle(A, B, C)
c2 = circle(P, 3)
l = line(A, B)
`;

function decl(extra: string, name: string) {
  const plan = planAsy(frameOf(BASE + extra), REGISTRY, 'standalone');
  const d = plan.decls.find((x) => x.name === name);
  if (d === undefined) throw new Error(`no declaration of ${name}`);
  return d;
}

describe('numeric where the helpers cannot follow the kernel exactly', () => {
  it.each([
    ['near on a segment', 'X = intersect(segment(C, P), w, near(P))'],
    ['far_from on a segment', 'X = intersect(segment(C, P), w, far_from(P))'],
    ['a side on a ray', 'X = intersect(ray(P, C), w, same_side(P, l))'],
    ['two selectors', 'X = intersect(line(P, C), w, near(P), same_side(B, line(A, C)))'],
    ['on_arc', 'X = intersect(line(P, C), w, on_arc(A, B, C))'],
    ['outside', 'X = intersect(w, c2, outside(circle(A, 1)))'],
    ['inside', 'X = intersect(w, c2, inside(circle(A, 1)))'],
    ['a tool without a mapping', 'X = excenter(A, B, C)'],
    ['an argument without a mapping', 'X = midpoint(A, excenter(A, B, C))'],
    ['a glider', 'X = on(w, 2, 1)'],
  ])('%s', (_name, line) => {
    const d = decl(`${line}\n`, 'X');
    expect(d.constructive).toBe(false);
    expect(d.dependent).toBe(true);
    expect(d.code).toMatch(/^\(-?[\d.e-]+, -?[\d.e-]+\)$/u);
  });

  it('a numeric dependent object is marked in the file; a free point is not', () => {
    const t = toAsymptoteCheck(frameOf(`${BASE}X = excenter(A, B, C)\n`), REGISTRY).text;
    expect(t).toMatch(/^pair X = \(.*\); \/\/ numeric$/mu);
    expect(t).toMatch(/^pair A = \(0, 0\);$/mu);
  });
});

describe('numeric variables of every kind', () => {
  const text = readFileSync('tests/fixtures/export/numeric.geo', 'utf8');
  const plan = planAsy(frameOf(text), REGISTRY, 'standalone');
  const by = (n: string) => plan.decls.find((d) => d.name === n);

  it('numbers, maps, lines, segments, circles and polygons have numeric forms', () => {
    expect(by('k')?.code).toBe(String(Math.SQRT2));
    expect(by('T')?.code).toMatch(/^\((-?[\d.e-]+, ){5}-?[\d.e-]+\)$/u);
    expect(by('l')?.code).toMatch(/^gm_mkline\(\(.*\), \(.*\), false, 0, false, 0\)$/u);
    expect(by('s')?.code).toMatch(/^gm_mkline\(\(.*\), \(.*\), true, 0, true, 1\)$/u);
    expect(by('ν')?.code).toMatch(/^gm_mkcircle\(\(.*\), [\d.e-]+\)$/u);
    expect(by('p')?.code).toMatch(/^\(.*\)--\(.*\)--\(.*\)--cycle$/u);
  });

  it('constructive objects use the numeric variables', () => {
    expect(by('X')?.code).toBe('T * A');
    expect(by('R')?.code).toBe('rotate(k, C) * A');
    expect(by('r')?.code).toBe('gm_apply(T, gm_ray(A, B))');
    expect(by('Y')?.code).toBe('gm_midpoint(X, gm_foot(B, l))');
    expect(by('q')?.code).toBe('T * p');
  });

  it('the check writes every kind of variable', () => {
    const t = toAsymptoteCheck(frameOf(text), REGISTRY).text;
    for (const d of plan.decls) expect(t).toContain(`gm_w("${String(d.id)}", `);
    expect(t).toContain('new real[] {k}');
    expect(t).toContain('new real[] {T.x, T.y, T.xx, T.xy, T.yx, T.yy}');
    expect(t).toContain('new real[] {nu.c.x, nu.c.y, nu.r}');
  });

  it('values that have no variable: marks, texts, strings, undefined', () => {
    expect(typeOfValue({ kind: 'undefined', reason: 'x' })).toBeUndefined();
    expect(typeOfValue({ kind: 'string', s: 'x' })).toBeUndefined();
    expect(typeOfValue({ kind: 'text', at: { x: 0, y: 0 }, text: 'x' })).toBeUndefined();
    expect(typeOfValue({ kind: 'future' } as never)).toBeUndefined();
  });
});
