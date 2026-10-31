/**
 * ADR-0046: the style card's Name field. "Write to script" applies the new name and the
 * style as ONE edit (one history entry; undo restores both); managed images follow their
 * source (A* becomes P* when A becomes P, A** too); claims, assumptions and layer exclusions
 * refer by id, so the text shows the new name everywhere. An invalid or taken name is
 * refused with the kernel's own reason, and a managed image's name cannot be changed (the
 * field says why).
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { cardEdit, cardNameProblem, fixedName } from '../src/style-card';
import { docOf, edit, editorOf, env, idOf, registry } from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'm = line(B, C)',
  'T = reflect(line(B, (4, 1)))',
  'U = reflect(line((0, 5), (1, 5)))',
  '@layer inv = image(T, main) [exclude=C]',
  '@layer twice = image(U, inv)',
  'claim collinear(A, B, C)',
  'assume acute(A, B, C)',
].join('\n');

function lines(text: string): string[] {
  return text.split('\n');
}

describe('Write to script with a new name: one edit', () => {
  it('rename and style are one history entry; undo restores both; images follow', () => {
    const s = editorOf(FIG);
    const before = print(s.doc);
    const a = idOf(s, 'A');
    const e = cardEdit(s.doc, a, { name: 'P', style: { color: 'red' } });
    expect(e?.kind).toBe('batch');
    if (e === null) throw new Error('no edit');
    const t = edit(s, e);
    expect(t.history.past.length).toBe(s.history.past.length + 1);
    const text = lines(print(t.doc));
    expect(text).toContain('P = (0, 0) [color=red]');
    expect(text).toContain('claim collinear(P, B, C)');
    expect(text).toContain('assume acute(P, B, C)');
    // The images follow: A* is P*, A** is P**, with the same ids.
    expect(idOf(t, 'P*')).toBe(idOf(s, 'A*'));
    expect(idOf(t, 'P**')).toBe(idOf(s, 'A**'));
    expect(t.doc.objects.some((o) => o.name.startsWith('A'))).toBe(false);
    const u = edit(t, { kind: 'undo' });
    expect(print(u.doc)).toBe(before);
    expect(u.doc).toBe(s.doc);
    const r = edit(u, { kind: 'redo' });
    expect(print(r.doc)).toBe(print(t.doc));
  });

  it('a name in a layer exclusion follows too', () => {
    const s = editorOf(FIG);
    const t = edit(s, cardEdit(s.doc, idOf(s, 'C'), { name: 'X' }) ?? { kind: 'undo' });
    expect(print(t.doc)).toContain('@layer inv = image(T, main) [exclude=X]');
    expect(t.history.past.length).toBe(1);
  });

  it('only a name: a rename edit; only a style: the style edit as before; neither: none', () => {
    const doc = docOf(FIG);
    const a = doc.objects.find((o) => o.name === 'A')?.id ?? -1;
    expect(cardEdit(doc, a, { name: 'P' })).toEqual({ kind: 'rename', id: a, name: 'P' });
    expect(cardEdit(doc, a, { name: 'A', style: { color: 'red' } })).toEqual({
      kind: 'style',
      id: a,
      style: { color: 'red' },
    });
    expect(cardEdit(doc, a, { name: 'A' })).toBeNull();
    expect(cardEdit(doc, a, {})).toBeNull();
    // Surrounding blanks are not part of a name.
    expect(cardEdit(doc, a, { name: ' P ' })).toEqual({ kind: 'rename', id: a, name: 'P' });
    expect(cardEdit(doc, a, { name: ' A ' })).toBeNull();
  });

  it('a name the kernel refuses makes the whole edit refused: nothing changes', () => {
    const s = editorOf(FIG);
    const a = idOf(s, 'A');
    const e = cardEdit(s.doc, a, { name: 'B', style: { color: 'red' } });
    if (e === null) throw new Error('no edit');
    const r = applyEdit(s, e, env);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
});

describe('names the field refuses, with the reason', () => {
  const doc = docOf(`${FIG}\nclaim parallel(m, m) [name=cl]`);
  const id = (n: string) => doc.objects.find((o) => o.name === n)?.id ?? -1;
  const a = id('A');

  it('taken by another object or a claim', () => {
    expect(cardNameProblem(doc, registry, a, 'B')).toBe('the name B is already used');
    expect(cardNameProblem(doc, registry, a, 'cl')).toBe('the name cl is already used');
  });

  it('not grammatical (the kernel nameProblem), a keyword, empty', () => {
    expect(cardNameProblem(doc, registry, a, 'Ma')).toBe(
      '"Ma" is not a valid name: did you mean M_a?',
    );
    expect(cardNameProblem(doc, registry, a, 'claim')).toBe('"claim" is a keyword');
    expect(cardNameProblem(doc, registry, a, '')).toBe('a name cannot be empty');
    expect(cardNameProblem(doc, registry, a, '  ')).toBe('a name cannot be empty');
    expect(cardNameProblem(doc, registry, a, 'P*')).toBe(
      '"P*": names ending in * are reserved for images',
    );
    expect(cardNameProblem(doc, registry, a, 'l AC')).toBe('"l AC" is not a valid name');
  });

  it('accepted: its own name, a free point name, a descriptive name, a Greek name', () => {
    for (const n of ['A', 'P', 'M_a', "H'", 'l_AC', 'ω', ' P ']) {
      expect(cardNameProblem(doc, registry, a, n), n).toBeUndefined();
    }
    expect(cardNameProblem(doc, registry, id('m'), 'l_BC')).toBeUndefined();
  });

  it('a missing object', () => {
    expect(cardNameProblem(doc, registry, 999, 'P')).toBe('there is no object #999');
  });
});

describe('managed images keep the name of their source', () => {
  const doc = docOf(FIG);
  const id = (n: string) => doc.objects.find((o) => o.name === n)?.id ?? -1;

  it('the field is fixed, with the reason and what to rename instead', () => {
    expect(fixedName(doc, id('A*'))).toBe('A* is the image of A in layer inv: rename A');
    expect(fixedName(doc, id('A**'))).toBe('A** is the image of A* in layer twice: rename A');
    expect(fixedName(doc, id('A'))).toBeUndefined();
    expect(fixedName(doc, 999)).toBeUndefined();
  });

  it('any other name is refused with that reason; no edit renames an image', () => {
    expect(cardNameProblem(doc, registry, id('A*'), 'Q')).toBe(
      'A* is the image of A in layer inv: rename A',
    );
    expect(cardNameProblem(doc, registry, id('A*'), 'A*')).toBeUndefined();
    expect(cardEdit(doc, id('A*'), { name: 'A*', style: { color: 'red' } })).toEqual({
      kind: 'style',
      id: id('A*'),
      style: { color: 'red' },
    });
  });
});
