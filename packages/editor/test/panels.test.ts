import { print } from '@geomira/lang/print';
import { describe, expect, it } from 'vitest';
import { claimRows, hypothesisRows, objectsByLayer, statementLines } from '../src/panels';
import { editorOf, env } from './helpers/editor';

/** The data behind the Objects and Claims panels (SPEC §15). */

const TEXT = `A = (1, 3)
B = (0, 0)
C = (4, 0)
l = line(B, C)
m = line(B, C)
X = intersect(l, m)
t = reflect(l)
@layer mirror = image(t, main)
assume acute(A, B, C)
claim collinear(A, B, C)
claim on(B, l)
claim X = A`;

describe('objectsByLayer', () => {
  it('groups objects by layer, with Undefined reasons and images marked', () => {
    const s = editorOf(TEXT);
    const groups = objectsByLayer(s);
    expect(groups.map((g) => g.name)).toEqual(['main', 'mirror']);
    const main = groups[0]?.rows ?? [];
    expect(main.map((r) => r.name)).toEqual(['A', 'B', 'C', 'l', 'm', 'X', 't']);
    const x = main.find((r) => r.name === 'X');
    expect(x).toMatchObject({ status: 'undefined', definition: 'intersect(l, m)' });
    expect(x?.reason).toMatch(/coincident lines|parallel/u);
    expect(main.find((r) => r.name === 'A')).toMatchObject({
      status: 'ok',
      kind: 'point',
      definition: 'point(1, 3)',
      managed: false,
    });
    const images = groups[1]?.rows ?? [];
    expect(images.map((r) => r.name)).toEqual(['A*', 'B*', 'C*', 'l*', 'm*', 'X*']);
    expect(images.every((r) => r.managed)).toBe(true);
    expect(groups[1]?.derived).toBe(true);
  });

  it('Inexact values are listed with their reason, apart from Undefined ones', () => {
    const big = `1${'0'.repeat(61)}`;
    const s = editorOf(`k = ${big}\nA = point(k, 0)\nr = sqrt(0 - 2)`);
    const rows = objectsByLayer(s)[0]?.rows ?? [];
    expect(rows.find((r) => r.name === 'A')?.status).toBe('inexact');
    expect(rows.find((r) => r.name === 'A')?.reason).not.toBe('');
    expect(rows.find((r) => r.name === 'r')).toMatchObject({
      status: 'undefined',
      reason: 'sqrt of a negative number',
    });
  });
});

describe('statement lines of claims and assumptions in the printed text', () => {
  it('maps each claim and assumption to its line', () => {
    const s = editorOf(TEXT);
    const lines = print(s.doc).split('\n');
    const at = statementLines(s.doc);
    for (const c of s.doc.claims) {
      const l = at.claims.get(c.id);
      expect(lines[(l?.line ?? 0) - 1]).toBe(l?.text);
      expect(l?.text.startsWith('claim ')).toBe(true);
    }
    const a = at.assumptions.get(s.doc.assumptions[0]?.id ?? -1);
    expect(a?.text).toBe('assume acute(A, B, C)');
    expect(lines[(a?.line ?? 0) - 1]).toBe(a?.text);
  });
});

describe('claimRows: live three-valued badges for the current figure', () => {
  it('true, false and undefined (degenerate or undefined objects, never true or false)', () => {
    const s = editorOf(TEXT);
    const rows = claimRows(s, env);
    expect(rows.map((r) => r.badge.value)).toEqual(['false', 'true', 'undefined']);
    expect(rows[2]?.badge).toMatchObject({ value: 'undefined' });
    expect(rows[0]?.text).toBe('claim collinear(A, B, C)');
  });

  it('hypothesisRows: the current figure against each assume line (note B)', () => {
    const s = editorOf(TEXT.replace('A = (1, 3)', 'A = (-1, 3)'));
    const [h] = hypothesisRows(s, env);
    expect(h).toMatchObject({ text: 'assume acute(A, B, C)', status: 'fails' });
    expect(h?.message).toMatch(/^This figure is not acute: ∠B ≈ 108\.4°$/u);
    expect(hypothesisRows(editorOf(TEXT), env)[0]?.status).toBe('holds');
  });
});
