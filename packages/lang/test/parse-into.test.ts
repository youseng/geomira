import { describe, expect, it } from 'vitest';
import { checkInvariants } from '@geomira/kernel/invariants';
import { syncProblems } from '@geomira/kernel/derived';
import { parseInto } from '../src/parse-into';
import { print } from '../src/print';
import { file, idOf, parseOk, registry } from './helpers/lang';

const base = parseOk(
  file(
    '@layer aux',
    '@layer r = image(s, main)',
    'A = (0, 0) [color=red]',
    'B = (4, 0)',
    'C = (1, 3) [layers=aux,main]',
    's = reflect(line(A, B))',
    'style C* [hidden]',
    'assume acute(A, B, C)',
    'claim A = A [name=self]',
    'claim collinear(A, B, C)',
  ),
);

describe('parseInto keeps ids and styles of persisting names (law P3)', () => {
  it('the same text gives back the same document, ids included', () => {
    const r = parseInto(base, print(base), registry);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc).toEqual(base);
  });

  it('an edited definition keeps every id; new objects get fresh ids above nextId', () => {
    const text = print(base)
      .replace('B = (4, 0)', 'B = (5, 0)')
      .replace('s = reflect', 'D = midpoint(A, B)\ns = reflect');
    const r = parseInto(base, text, registry);
    expect(r.diagnostics).toEqual([]);
    for (const o of base.objects) expect(idOf(r.doc, o.name), o.name).toBe(o.id);
    expect(idOf(r.doc, 'D')).toBeGreaterThanOrEqual(base.nextId);
    expect(idOf(r.doc, 'D*')).toBeGreaterThanOrEqual(base.nextId);
    expect(r.doc.layers.map((l) => l.id)).toEqual(base.layers.map((l) => l.id));
    expect(r.doc.claims.map((c) => c.id)).toEqual(base.claims.map((c) => c.id));
    expect(r.doc.assumptions.map((a) => a.id)).toEqual(base.assumptions.map((a) => a.id));
    expect(checkInvariants(r.doc)).toEqual([]);
    expect(syncProblems(r.doc, registry)).toEqual([]);
  });

  it('a style the text does not state is kept; a stated style wins', () => {
    const bare = [
      '@version 1',
      '@layer aux',
      '@layer r = image(s, main)',
      'A = (0, 0)',
      'B = (4, 0)',
      'C = (1, 3) [layers=aux,main]',
      's = reflect(line(A, B))',
    ].join('\n');
    const kept = parseInto(base, bare, registry).doc;
    expect(kept.objects.find((o) => o.name === 'A')?.style).toEqual({ color: 'red' });
    expect(kept.objects.find((o) => o.name === 'C*')?.style).toEqual({ hidden: true });
    const stated = parseInto(
      base,
      bare.replace('A = (0, 0)', 'A = (0, 0) [width=2]'),
      registry,
    ).doc;
    expect(stated.objects.find((o) => o.name === 'A')?.style).toEqual({ width: 2 });
  });

  it('a renamed object is a new object (new id); a removed one is gone; ids are never reused', () => {
    const r = parseInto(base, print(base).replace(/\bB\b/gu, 'P'), registry);
    expect(r.diagnostics).toEqual([]);
    expect(idOf(r.doc, 'P')).toBeGreaterThanOrEqual(base.nextId);
    expect(r.doc.objects.some((o) => o.name === 'B')).toBe(false);
    expect(r.doc.nextId).toBeGreaterThan(Math.max(...r.doc.objects.map((o) => o.id)));
  });

  it('an old [noimage] that would change the images is not kept', () => {
    const old = parseOk(
      file('@layer r = image(s, main)', 'A = (0, 0) [noimage]', 's = reflect((1, 1))'),
    );
    const r = parseInto(
      old,
      file('@layer r = image(s, main)', 'A = (0, 0)', 's = reflect((1, 1))', 'X = midpoint(A*, A)'),
      registry,
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 's', 'A*', 'X', 'X*']);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('a text with errors still gives a valid document, with the persisting ids', () => {
    const r = parseInto(base, `${print(base)}\nQ = midpoint(A, nowhere)`, registry);
    expect(r.diagnostics).toHaveLength(1);
    expect(idOf(r.doc, 'A')).toBe(idOf(base, 'A'));
    expect(checkInvariants(r.doc)).toEqual([]);
  });
});
