/**
 * `triangle ABC <type>` on points that exist (ADR-0025 decision 3, ADR-0028): the new
 * vertices are drawn, deterministically from the statement, so that the triangle WITH the
 * existing points has the type with a margin. When no place can give the type (the existing
 * points coincide, are undefined, or all three exist and violate it), the line is an error
 * and nothing of it is applied.
 */
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Document } from '@geomira/kernel/document';
import { FloatField } from '@geomira/num/float-field';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { canonicalDocument, stable } from '../src/canonical';
import { file, firstError, parseOk, registry } from './helpers/lang';

type P = readonly [number, number];

function coords(doc: Document, names: readonly string[]): P[] {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) throw new Error(ctx.reason);
  const vs = evaluate(doc, registry, FloatField, ctx.ctx).values;
  return names.map((n) => {
    const v = vs.get(doc.objects.find((o) => o.name === n)?.id ?? -1);
    if (v?.kind !== 'point') throw new Error(`${n} is not a point`);
    return [v.x, v.y] as const;
  });
}

function angleAt(a: P, b: P, c: P): number {
  const [ux, uy, vx, vy] = [a[0] - b[0], a[1] - b[1], c[0] - b[0], c[1] - b[1]];
  return (Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * 180) / Math.PI;
}

/** Angles at A, B, C of a parsed triangle ABC. */
function angles(doc: Document): number[] {
  const [a, b, c] = coords(doc, ['A', 'B', 'C']) as [P, P, P];
  return [angleAt(c, a, b), angleAt(a, b, c), angleAt(b, c, a)];
}

/** Parses with no diagnostic, and checks the printed text reads back the same (P1, P2). */
function ok(...lines: string[]): Document {
  const doc = parseOk(file(...lines));
  const text = print(doc);
  const back = parse(text, registry);
  expect(back.diagnostics).toEqual([]);
  expect(stable(canonicalDocument(back.doc))).toBe(stable(canonicalDocument(doc)));
  expect(print(back.doc)).toBe(text);
  return doc;
}

const PAIRS: readonly (readonly [string, string])[] = [
  ['(0, 0)', '(4, 0)'],
  ['(0, 0)', '(3, 0)'],
  ['(-2, 0)', '(2, 0)'],
  ['(0, 0)', '(0, 4)'],
  ['(1, 1)', '(4, 2)'],
  ['(0, 0)', '(5, 0)'],
  ['(0, 0)', '(2, 0)'],
  ['(-1, -1)', '(3, -1)'],
  ['(100, 40)', '(130, 40)'],
  ['(0, 0)', '(0.3, 0.1)'],
  ['(-7, 3)', '(9, -12)'],
];

describe('triangle ABC <type> with two existing vertices', () => {
  it('A = (0, 0), B = (4, 0), triangle ABC acute: C makes ABC acute (the review case)', () => {
    const doc = ok('A = (0, 0)', 'B = (4, 0)', 'triangle ABC acute');
    const as = angles(doc);
    expect(Math.max(...as)).toBeLessThanOrEqual(80);
    expect(Math.min(...as)).toBeGreaterThanOrEqual(15);
    expect(doc.assumptions.map((a) => a.kind)).toEqual(['acute']);
    expect(ok('A = (0, 0)', 'B = (4, 0)', 'triangle ABC acute')).toEqual(doc);
  });

  it('every type holds with its margin, whatever the size and place of AB', () => {
    for (const [a, b] of PAIRS) {
      const base = [`A = ${a}`, `B = ${b}`];
      const acute = angles(ok(...base, 'triangle ABC acute'));
      expect(Math.max(...acute)).toBeLessThanOrEqual(80);
      expect(Math.min(...acute)).toBeGreaterThanOrEqual(15);
      for (const [type, v] of [
        ['obtuse', 0],
        ['obtuse_at_B', 1],
        ['obtuse_at_C', 2],
      ] as const) {
        const as = angles(ok(...base, `triangle ABC ${type}`));
        expect(as[v]).toBeGreaterThanOrEqual(100);
        expect(as[v]).toBeLessThanOrEqual(150);
        expect(Math.min(...as)).toBeGreaterThanOrEqual(15);
      }
      const [p, q, r] = coords(ok(...base, 'triangle ABC scalene'), ['A', 'B', 'C']) as [P, P, P];
      const s = [
        Math.hypot(q[0] - r[0], q[1] - r[1]),
        Math.hypot(r[0] - p[0], r[1] - p[1]),
        Math.hypot(p[0] - q[0], p[1] - q[1]),
      ].sort((x, y) => x - y) as [number, number, number];
      expect(s[1]).toBeGreaterThan(1.1 * s[0]);
      expect(s[2]).toBeGreaterThan(1.1 * s[1]);
    }
  });

  it('the existing vertex may be any of the three, and may be constructed', () => {
    const doc = ok('X = (0, 0)', 'Y = (6, 2)', 'B = midpoint(X, Y)', 'triangle ABC obtuse_at_B');
    const as = angles(doc);
    expect(as[1]).toBeGreaterThanOrEqual(100);
    expect(as[1]).toBeLessThanOrEqual(150);
  });
});

describe('triangle ABC <type> with one existing vertex', () => {
  it('the others are drawn around it', () => {
    for (const a of ['(0, 0)', '(40, -30)', '(4.5, 4.5)']) {
      const acute = angles(ok(`A = ${a}`, 'triangle ABC acute'));
      expect(Math.max(...acute)).toBeLessThanOrEqual(80);
      const obtuse = angles(ok(`A = ${a}`, 'triangle ABC obtuse_at_C'));
      expect(obtuse[2]).toBeGreaterThanOrEqual(100);
    }
  });
});

describe('triangle ABC <type> with three existing vertices', () => {
  it('a triangle that has the type keeps its points and gets the assumption', () => {
    const doc = ok('A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'triangle ABC acute');
    expect(doc.assumptions.map((a) => a.kind)).toEqual(['acute']);
    expect(ok('A = (0, 0)', 'B = (4, 0)', 'C = (-1, 3)', 'triangle ABC obtuse')).toBeDefined();
  });

  it('a triangle that violates the type is an error, and nothing of the line is applied', () => {
    const text = file('A = (0, 0)', 'B = (4, 0)', 'C = (-4.9, 5)', 'triangle ABC acute');
    const r = parse(text, registry);
    const e = r.diagnostics.filter((d) => d.severity === 'error');
    expect(e).toHaveLength(1);
    expect(e[0]?.line).toBe(5);
    expect(e[0]?.message).toBe('the triangle ABC is not acute here: its angle at A is 134°');
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 'B', 'C']);
    expect(r.doc.assumptions).toEqual([]);
    expect(
      firstError(file('A = (0, 0)', 'B = (4, 0)', 'C = (2, 1)', 'triangle ABC obtuse_at_A'))
        .message,
    ).toBe('the triangle ABC is not obtuse at A here: its angle at A is 27°');
    expect(
      firstError(file('A = (0, 0)', 'B = (4, 0)', 'C = (2, 3)', 'triangle ABC scalene')).message,
    ).toBe('the triangle ABC is not scalene here: two of its sides are equal');
    expect(
      firstError(file('A = (0, 0)', 'B = (4, 0)', 'C = (2, 0)', 'triangle ABC acute')).message,
    ).toBe('the triangle ABC is not acute here: A, B and C are collinear');
  });

  it('without a type, three existing points are only joined (as before)', () => {
    const doc = ok('A = (0, 0)', 'B = (4, 0)', 'C = (2, 0)', 'triangle ABC');
    expect(doc.objects.map((o) => o.name)).toEqual(['A', 'B', 'C', 'tri_ABC']);
  });
});

describe('no place for the new vertices: an error, nothing applied', () => {
  it('existing vertices that coincide', () => {
    const r = parse(file('A = (1, 1)', 'B = (1, 1)', 'triangle ABC acute'), registry);
    const e = r.diagnostics.filter((d) => d.severity === 'error');
    expect(e.map((d) => d.message)).toEqual([
      'triangle ABC: A and B coincide here, so no place for C makes the triangle acute',
    ]);
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 'B']);
    expect(r.doc.assumptions).toEqual([]);
  });

  it('an existing vertex that is undefined, or not a point', () => {
    const undef = parse(
      file('A = (0, 0)', 'B = intersect(line(A, (1, 0)), line((0, 1), (1, 1)))', 'triangle ABC'),
      registry,
    );
    expect(undef.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message)).toEqual([
      'triangle ABC: B is undefined here, so no place can be drawn for C',
    ]);
    expect(undef.doc.objects.map((o) => o.name)).toEqual(['A', 'B']);
    const curve = parse(file('A = (0, 0)', 'B = line(A, (1, 0))', 'triangle ABC'), registry);
    expect(curve.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message)).toEqual([
      'triangle ABC: B is a line, not a point',
    ]);
    expect(curve.doc.objects.map((o) => o.name)).toEqual(['A', 'B']);
  });
});
