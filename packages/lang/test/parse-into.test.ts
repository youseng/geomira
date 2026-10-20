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

describe('parseInto keeps the ids of persisting names; styles are what the text says (law P3)', () => {
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

  it('styles are exactly what the text says: a style the text drops is the default style', () => {
    const bare = [
      '@version 1',
      '@layer aux',
      '@layer r = image(s, main)',
      'A = (0, 0)',
      'B = (4, 0)',
      'C = (1, 3) [layers=aux,main]',
      's = reflect(line(A, B))',
    ].join('\n');
    const r = parseInto(base, bare, registry);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc.objects.find((o) => o.name === 'A')?.style).toEqual({});
    expect(r.doc.objects.find((o) => o.name === 'C*')?.style).toEqual({});
    expect(idOf(r.doc, 'A')).toBe(idOf(base, 'A'));
    const stated = parseInto(
      base,
      bare.replace('A = (0, 0)', 'A = (0, 0) [width=2]'),
      registry,
    ).doc;
    expect(stated.objects.find((o) => o.name === 'A')?.style).toEqual({ width: 2 });
  });

  it('deleting a style line resets the object to the default style, and printing never brings the line back', () => {
    const text = print(base);
    expect(text).toContain('style C* [hidden]');
    const r = parseInto(base, text.replace('style C* [hidden]\n', ''), registry);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc.objects.find((o) => o.name === 'C*')?.style).toEqual({});
    expect(idOf(r.doc, 'C*')).toBe(idOf(base, 'C*'));
    const printed = print(r.doc);
    expect(printed.split('\n').some((l) => l.startsWith('style C*'))).toBe(false);
    expect(printed).toBe(text.replace('style C* [hidden]\n', ''));
  });

  it('a style statement for a user object: deleting it resets the style; keeping it keeps the style', () => {
    const old = parseOk(file('A = (0, 0)', 'style A [color=red, hidden]'));
    expect(old.objects[0]?.style).toEqual({ color: 'red', hidden: true });
    const kept = parseInto(old, file('A = (0, 0)', 'style A [color=red, hidden]'), registry).doc;
    expect(kept.objects[0]?.style).toEqual({ color: 'red', hidden: true });
    const dropped = parseInto(old, file('A = (0, 0)'), registry).doc;
    expect(dropped.objects[0]).toMatchObject({ id: old.objects[0]?.id, style: {} });
    expect(print(dropped)).toBe(`${file('A = (0, 0)')}\n`);
  });

  it('a renamed object is a new object (new id); a removed one is gone; ids are never reused', () => {
    const r = parseInto(base, print(base).replace(/\bB\b/gu, 'P'), registry);
    expect(r.diagnostics).toEqual([]);
    expect(idOf(r.doc, 'P')).toBeGreaterThanOrEqual(base.nextId);
    expect(r.doc.objects.some((o) => o.name === 'B')).toBe(false);
    expect(r.doc.nextId).toBeGreaterThan(Math.max(...r.doc.objects.map((o) => o.id)));
  });

  it('an old [noimage] the text no longer states is gone: the images come back', () => {
    const old = parseOk(
      file('@layer r = image(s, main)', 'A = (0, 0) [noimage]', 's = reflect((1, 1))'),
    );
    expect(old.objects.map((o) => o.name)).toEqual(['A', 's']);
    const r = parseInto(
      old,
      file('@layer r = image(s, main)', 'A = (0, 0)', 's = reflect((1, 1))', 'X = midpoint(A*, A)'),
      registry,
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.doc.objects.map((o) => o.name)).toEqual(['A', 's', 'A*', 'X', 'X*']);
    expect(r.doc.objects[0]?.style).toEqual({});
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('a text with errors still gives a valid document, with the persisting ids', () => {
    const r = parseInto(base, `${print(base)}\nQ = midpoint(A, nowhere)`, registry);
    expect(r.diagnostics).toHaveLength(1);
    expect(idOf(r.doc, 'A')).toBe(idOf(base, 'A'));
    expect(checkInvariants(r.doc)).toEqual([]);
  });
});
