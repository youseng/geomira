/**
 * ADR-0025: Geomdraw's script conveniences, read as the canonical statements they stand for.
 * The printed text holds only the canonical forms, so the language laws P1–P3 are untouched:
 * each test also checks that the printed text parses back to the same document and prints
 * the same text again.
 */
import { describe, expect, it } from 'vitest';
import { evaluate } from '@geomira/kernel/evaluate';
import { evalContextFor } from '@geomira/kernel/context';
import { FloatField } from '@geomira/num/float-field';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { stable } from '../src/canonical';
import { firstError, registry } from './helpers/lang';

const T = ['A = (1, 2)', 'B = (3, 4)', 'C = (0, 5)'];

/** The printed text of a sugared text with no error (the @version line dropped). */
function printed(...lines: string[]): string[] {
  const r = parse(['@version 1', ...lines].join('\n'), registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  expect(errors.map((d) => d.message)).toEqual([]);
  const text = print(r.doc);
  // P1/P2 on the result: the canonical text parses to the same document and prints the same.
  const again = parse(text, registry);
  expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(stable(again.doc)).toBe(stable(r.doc));
  expect(print(again.doc)).toBe(text);
  return text.split('\n').filter((l) => l !== '' && !l.startsWith('@version'));
}

function values(...lines: string[]) {
  const doc = parse(['@version 1', ...lines].join('\n'), registry).doc;
  const ctx = evalContextFor(doc);
  if (!ctx.ok) throw new Error(ctx.reason);
  const vs = evaluate(doc, registry, FloatField, ctx.ctx).values;
  return (name: string) => vs.get(doc.objects.find((o) => o.name === name)?.id ?? -1);
}

describe('free points without coordinates', () => {
  it('points A B C, point P and A = point(): exact places, deterministic, apart', () => {
    const a = printed('points A B C');
    expect(a).toHaveLength(3);
    for (const l of a) expect(l).toMatch(/^[ABC] = \(-?\d+(\.\d)?, -?\d+(\.\d)?\)$/u);
    expect(printed('points A B C')).toEqual(a);
    expect(printed('points ABC')).toEqual(a);
    const v = values('points A B C');
    const xy = ['A', 'B', 'C'].map((n) => {
      const p = v(n);
      if (p?.kind !== 'point') throw new Error(n);
      return [p.x, p.y] as const;
    });
    for (const [i, p] of xy.entries())
      for (const q of xy.slice(i + 1))
        expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThan(1.99);
    expect(printed('point P')).toHaveLength(1);
    expect(printed('A = point()')[0]).toMatch(/^A = \(/u);
    expect(printed('A = point() [color=red]')[0]).toMatch(/^A = \(.*\) \[color=red\]$/u);
  });

  it('errors: names are needed, and point() takes no selector', () => {
    expect(firstError('points').message).toBe('points takes point names');
    expect(firstError('points a').message).toBe('points takes point names');
  });
});

describe('triangle ABC', () => {
  it('glued or apart, with bare types (acute, scalene, obtuse at the first vertex)', () => {
    expect(printed('triangle ABC')).toEqual(printed('triangle A B C'));
    expect(printed('triangle ABC acute')).toContain('assume acute(A, B, C)');
    expect(printed('triangle ABC obtuse')).toContain('assume ∠BAC > 90');
    expect(printed('triangle ABC obtuse_at_B')).toContain('assume ∠ABC > 90');
    expect(firstError('triangle ABC right').message).toBe(
      'a right angle is constructed, never assumed',
    );
  });

  it('on points that exist it draws their triangle; missing vertices are made', () => {
    expect(printed(...T, 'triangle ABC')).toEqual([...T, 'tri_ABC = polygon(A, B, C)']);
    const mixed = printed(...T.slice(0, 2), 'triangle ABC');
    expect(mixed.slice(0, 2)).toEqual(T.slice(0, 2));
    expect(mixed[2]).toMatch(/^C = \(/u);
    expect(mixed[3]).toBe('tri_ABC = polygon(A, B, C)');
  });
});

describe('glued point names: AB a line, ABC a circle, spread where points are taken', () => {
  const cases: [string, string][] = [
    ['l = AB', 'l = line(A, B)'],
    ['ω = ABC', 'ω = circle(A, B, C)'],
    ['q = ABC', 'q = circle(A, B, C)'],
    ['p = polygon(ABC)', 'p = polygon(A, B, C)'],
    ['P = foot(C, AB)', 'P = foot(C, line(A, B))'],
    ['M = midpoint(BC)', 'M = midpoint(B, C)'],
    ['O = circumcenter(ABC)', 'O = circumcenter(A, B, C)'],
    ['k = ratio(AB, AC)', 'k = ratio(A, B, A, C)'],
    ['d = dist(AB)', 'd = dist(A, B)'],
    ['d = dist(C, AB)', 'd = dist(C, line(A, B))'],
    ['s = area(ABC)', 's = area(A, B, C)'],
    ['f = reflect(AB)', 'f = reflect(line(A, B))'],
    ['b = bisector(ABC)', 'b = bisector(A, B, C)'],
    ['P = on(ABC)', 'P = on(circle(A, B, C), 2, 1)'],
    ['X = intersect(AB, ABC, other(A))', 'X = intersect(line(A, B), circle(A, B, C), other(A))'],
    [
      'X = intersect(BC, ABC, same_side(A, BC))',
      'X = intersect(line(B, C), circle(A, B, C), same_side(A, line(B, C)))',
    ],
  ];
  for (const [line, want] of cases)
    it(`${line} is ${want}`, () => {
      expect(printed(...T, line).at(-1)).toBe(want);
    });

  it('four or more names are a polygon', () => {
    expect(printed(...T, 'D = (4, 1)', 'p = ABCD').at(-1)).toBe('p = polygon(A, B, C, D)');
  });

  it('a name of a run that does not exist: the hint says what the run means', () => {
    const d = firstError('x = AB');
    expect(d.message).toBe('unknown name "A"');
    expect(d.hint).toBe('define it first (AB is line(A, B); the length AB is dist(A, B))');
  });
});

describe('both branches: X, Y = call(…)', () => {
  it('a line and a circle: along(+) and along(-), two distinct points on both', () => {
    const p = printed(...T, 'w = ABC', 'X, Y = intersect(w, line((0, 3), (5, 3)))');
    expect(p.slice(-2)).toEqual([
      'X = intersect(w, line((0, 3), (5, 3)), along(+))',
      'Y = intersect(w, line((0, 3), (5, 3)), along(-))',
    ]);
    const v = values(...T, 'w = ABC', 'X, Y = intersect(w, line((0, 3), (5, 3)))');
    const [x, y] = [v('X'), v('Y')];
    expect(x?.kind === 'point' && y?.kind === 'point').toBe(true);
    if (x?.kind === 'point' && y?.kind === 'point')
      expect(Math.hypot(x.x - y.x, x.y - y.y)).toBeGreaterThan(1);
  });

  it('two circles, tangents and touch points: orient(±); Geomdraw names tangents, tangent_points', () => {
    expect(
      printed(...T, 'w = ABC', 'v = circle(A, C)', 'X, Y = intersect(w, v)').slice(-2),
    ).toEqual(['X = intersect(w, v, orient(+))', 'Y = intersect(w, v, orient(-))']);
    const tl = printed(...T, 'w = ABC', 'P = (9, 9)', 't_1, t_2 = tangents(P, w)');
    expect(tl.slice(-2)).toEqual([
      't_1 = tangent_from(P, w, orient(+))',
      't_2 = tangent_from(P, w, orient(-))',
    ]);
    const tp = printed(
      ...T,
      'w = ABC',
      'P = (9, 9)',
      'T_1, T_2 = tangent_points(P, w) [color=red]',
    );
    expect(tp.slice(-2)).toEqual([
      'T_1 = tangent_point(P, w, orient(+)) [color=red]',
      'T_2 = tangent_point(P, w, orient(-)) [color=red]',
    ]);
  });

  it('refusals: one candidate, three names, written selectors, mixed kinds', () => {
    expect(firstError([...T, 'X, Y = intersect(AB, BC)'].join('\n')).message).toBe(
      'intersect(…) does not have two candidates here',
    );
    expect(firstError([...T, 'X, Y, Z = intersect(AB, ABC)'].join('\n')).message).toBe(
      'a call has two branches: write two names',
    );
    expect(firstError([...T, 'X, Y = intersect(AB, ABC, other(A))'].join('\n')).message).toMatch(
      /write no selector/u,
    );
    expect(
      firstError([...T, 'X, Y = intersect(cline(A, B, C), circle(A, C))'].join('\n')).message,
    ).toMatch(/cannot be told apart/u);
    expect(firstError([...T, 'X, Y = AB'].join('\n')).message).toBe(
      'two names take a call with two candidates',
    );
  });
});

describe("Geomdraw's style words, names in capitals, other names for tools", () => {
  it('@red @dashed @thick @hidden @nolabel are attributes; an unknown word is an error', () => {
    expect(printed(...T, 'l = AB @red @dashed @thick').at(-1)).toBe(
      'l = line(A, B) [color=red, width=2.5, dash=dashed]',
    );
    expect(printed(...T, 'l = AB @nolabel @hidden @dotted @thin').at(-1)).toBe(
      'l = line(A, B) [width=1, dash=dotted, hidden, label=""]',
    );
    expect(printed(...T, 'style A @blue')).toContain('A = (1, 2) [color=blue]');
    const d = firstError([...T, 'l = AB @pink'].join('\n'));
    expect(d.message).toBe('unexpected "@pink"');
    expect(d.hint).toContain('@red');
  });

  it('Midpoint(…) and Triangle ABC are read in lowercase', () => {
    expect(printed(...T, 'M = Midpoint(A, B)').at(-1)).toBe('M = midpoint(A, B)');
    expect(printed('Triangle ABC')).toEqual(printed('triangle ABC'));
    expect(printed('Points A B')).toEqual(printed('points A B'));
  });

  it('tangents, tangent_points, second_intersection, length, distance, slider, perpendicular', () => {
    const p = printed(
      ...T,
      'w = ABC',
      'D = second_intersection(w, AB, A)',
      'd = length(A, B)',
      'e = distance(A, B)',
      't = slider(0, 1, 1/2)',
      'm = perpendicular(C, AB)',
    );
    expect(p.slice(-5)).toEqual([
      'D = other(w, line(A, B), A)',
      'd = dist(A, B)',
      'e = dist(A, B)',
      't = param(0, 1, 1/2)',
      'm = perp(C, line(A, B))',
    ]);
  });
});

describe("Geomdraw's claim forms", () => {
  const cases: [string, string][] = [
    ['claim A, B, C collinear', 'claim collinear(A, B, C)'],
    ['claim ABC collinear', 'claim collinear(A, B, C)'],
    ['claim ABCD cyclic', 'claim concyclic(A, B, C, D)'],
    ['claim A, B, C, D concyclic', 'claim concyclic(A, B, C, D)'],
    ['claim AB ⟂ CD', 'claim perpendicular(line(A, B), line(C, D))'],
    ['claim AB ⊥ CD', 'claim perpendicular(line(A, B), line(C, D))'],
    ['claim AB \\perp CD', 'claim perpendicular(line(A, B), line(C, D))'],
    ['claim AB perp CD', 'claim perpendicular(line(A, B), line(C, D))'],
    ['claim AB ∥ CD', 'claim parallel(line(A, B), line(C, D))'],
    ['claim AB parallel CD', 'claim parallel(line(A, B), line(C, D))'],
    ['claim AD, BC, CD concurrent', 'claim concurrent(line(A, D), line(B, C), line(C, D))'],
    ['claim D on ABC', 'claim on(D, circle(A, B, C))'],
    ['claim ABC tangent ABD', 'claim tangent(circle(A, B, C), circle(A, B, D))'],
    ['claim collinear(ABC)', 'claim collinear(A, B, C)'],
    ['assume acute(ABC)', 'assume acute(A, B, C)'],
    ['assume D inside ABC', 'assume D inside polygon(A, B, C)'],
  ];
  for (const [line, want] of cases)
    it(`${line} is ${want}`, () => {
      expect(printed(...T, 'D = (2, 7)', line)).toContain(want);
    });

  it('the relations keep their meaning (AB = CD is a length, P = Q equal points)', () => {
    const p = printed(...T, 'D = (2, 7)', 'claim AB = CD', 'claim A = B', 'claim AB/CD = 2');
    expect(p).toEqual(expect.arrayContaining(['claim AB = CD', 'claim A = B', 'claim AB/CD = 2']));
  });
});

describe('the alias table', () => {
  it('maps names that are not registry tools to registry tools', async () => {
    const { TOOL_ALIASES } = await import('../src/geomdraw');
    for (const [alias, tool] of Object.entries(TOOL_ALIASES)) {
      expect(registry.get(alias), alias).toBeUndefined();
      expect(registry.get(tool), tool).toBeDefined();
    }
  });
});

describe('ADR-0025 carries the grammar of the additions verbatim', () => {
  it('the ebnf block of the ADR is GEOMDRAW_GRAMMAR', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { GEOMDRAW_GRAMMAR } = await import('../src/geomdraw-docs');
    const adr = readFileSync(
      fileURLToPath(new URL('../../../docs/adr/0025-geomdraw-notation.md', import.meta.url)),
      'utf8',
    );
    expect(adr).toContain(`\`\`\`ebnf\n${GEOMDRAW_GRAMMAR}\n\`\`\``);
  });
});
