/**
 * ADR-0046: the style card's Name field. Write to script applies name and style as one edit
 * (cardWrite); an invalid or taken name shows the reason under the field and disables Write;
 * a managed image's field is read-only with the reason; the canvas previews a writable name.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyEdit } from '@geomira/editor/edit';
import { createEditor } from '@geomira/editor/state';
import { findObjectByName, type Document } from '@geomira/kernel/document';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { EditorStore } from '../src/store';
import { StyleCard, type OpenCard } from '../src/StyleCard';
import { cardWrite, previewDocument } from '../src/style-name';
import { registry } from './helpers';

const TEXT = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'T = reflect(line(B, (4, 1)))',
  '@layer inv = image(T, main)',
  '',
].join('\n');

function docOf(text: string): Document {
  const r = parse(text, registry);
  expect(r.diagnostics).toEqual([]);
  return r.doc;
}

function objectOf(doc: Document, name: string) {
  const o = findObjectByName(doc, name);
  if (o === undefined) throw new Error(`no ${name}`);
  return o;
}

describe('cardWrite: what Write to script applies', () => {
  const doc = docOf(TEXT);
  const a = objectOf(doc, 'A');

  it('untouched name, unchanged style: nothing to write, nothing to say', () => {
    expect(cardWrite(doc, registry, a, undefined, a.style)).toEqual({
      edit: null,
      message: undefined,
      fixed: false,
    });
    expect(cardWrite(doc, registry, a, 'A', {}).edit).toBeNull();
  });

  it('a new name and a style: one batch edit; applied, the text shows both, A* is P*', () => {
    const w = cardWrite(doc, registry, a, 'P', { color: 'red' });
    expect(w.message).toBeUndefined();
    expect(w.edit?.kind).toBe('batch');
    const s = createEditor(doc, { registry });
    const r = w.edit === null ? undefined : applyEdit(s, w.edit, { registry });
    if (r?.ok !== true) throw new Error('refused');
    expect(r.state.history.past).toHaveLength(1);
    expect(print(r.state.doc)).toContain('P = (0, 0) [color=red]');
    expect(findObjectByName(r.state.doc, 'P*')?.id).toBe(objectOf(doc, 'A*').id);
  });

  it('a taken or invalid name: the reason, and Write disabled even with a style draft', () => {
    expect(cardWrite(doc, registry, a, 'B', { color: 'red' })).toEqual({
      edit: null,
      message: 'the name B is already used',
      fixed: false,
    });
    expect(cardWrite(doc, registry, a, 'Ma', {}).message).toBe(
      '"Ma" is not a valid name: did you mean M_a?',
    );
    expect(cardWrite(doc, registry, a, '', {}).message).toBe('a name cannot be empty');
  });

  it('a managed image: fixed, with the reason; its style can still be written', () => {
    const img = objectOf(doc, 'A*');
    const w = cardWrite(doc, registry, img, undefined, { color: 'red' });
    expect(w.fixed).toBe(true);
    expect(w.message).toBe('A* is the image of A in layer inv: rename A');
    expect(w.edit).toEqual({ kind: 'style', id: img.id, style: { color: 'red' } });
  });

  it('the preview renames only a writable name (images follow); the document is untouched', () => {
    const p = previewDocument(doc, registry, a.id, {}, 'P');
    expect(p.objects.map((o) => o.name)).toContain('P*');
    expect(findObjectByName(doc, 'A')?.id).toBe(a.id);
    expect(previewDocument(doc, registry, a.id, {}, 'B')).toBe(doc);
    expect(previewDocument(doc, registry, a.id, {}, undefined)).toBe(doc);
    expect(previewDocument(doc, registry, a.id, {}, ' A ')).toBe(doc);
  });
});

describe('the card shows the Name field', () => {
  const store = new EditorStore({ registry }, () => undefined);
  const state = createEditor(docOf(TEXT), store.env);
  const html = (name: string, card: Partial<OpenCard> = {}) => {
    const o = objectOf(state.doc, name);
    const open: OpenCard = {
      id: o.id,
      anchor: { left: 0, top: 0, right: 0, bottom: 0 },
      draft: o.style,
      ...card,
    };
    return renderToString(
      <StyleCard
        store={store}
        state={state}
        card={open}
        onDraft={() => undefined}
        onName={() => undefined}
        onClose={() => undefined}
      />,
    );
  };
  const writeButton = (h: string) =>
    /<button type="button"( disabled="")?>Write to script/u.exec(h);

  it('at the top of the card, with the current name; Write disabled until something changes', () => {
    const h = html('C');
    expect(h).toMatch(/aria-label="Name"[^>]*value="C"/u);
    expect(h.indexOf('aria-label="Name"')).toBeLessThan(h.indexOf('Point size'));
    expect(writeButton(h)?.[1]).toBe(' disabled=""');
    expect(h).not.toContain('sc-problem');
  });

  it('a new valid name enables Write', () => {
    const h = html('C', { name: 'P' });
    expect(h).toMatch(/aria-label="Name"[^>]*value="P"/u);
    expect(writeButton(h)?.[1]).toBeUndefined();
  });

  it('a taken name: the message under the field, Write disabled', () => {
    const h = html('C', { name: 'A', draft: { color: 'red' } });
    expect(h).toContain('the name A is already used');
    expect(h).toContain('aria-invalid="true"');
    expect(h).toMatch(/aria-describedby="[^"]+"/u);
    expect(writeButton(h)?.[1]).toBe(' disabled=""');
  });

  it('a managed image: read-only, with the reason', () => {
    const h = html('A*');
    expect(h).toMatch(/aria-label="Name"[^>]*readOnly=""/u);
    expect(h).toContain('A* is the image of A in layer inv: rename A');
  });
});
