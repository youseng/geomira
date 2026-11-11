/**
 * ADR-0063 in the web app: the style card applies its changes at once. It has no Write button,
 * Reset is its only footer action, a Rename button appears while a new name is typed, and
 * `changedFields` names the control a change belongs to (one undo per control).
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEditor } from '@geomira/editor/state';
import { parse } from '@geomira/lang/parse';
import { StyleCard, type OpenCard } from '../src/StyleCard';
import { changedFields } from '../src/style-draft';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const doc = parse('@version 1\nA = (0, 0) [color=red]\nB = (4, 0)\n', registry).doc;
const store = new EditorStore({ registry }, () => undefined);
const state = createEditor(doc, store.env);

function html(name: string, card: Partial<OpenCard> = {}): string {
  const o = doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(name);
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
}

describe('the card applies at once', () => {
  it('no Write to script; Reset only when the style is not the default', () => {
    expect(html('A')).not.toContain('Write to script');
    expect(html('A')).toMatch(/<button type="button">Reset<\/button>/u);
    expect(html('B')).toMatch(/<button type="button" disabled="">Reset<\/button>/u);
  });

  it('Rename appears only while a different name is typed', () => {
    expect(html('A')).not.toContain('>Rename<');
    expect(html('A', { name: 'A' })).not.toContain('>Rename<');
    expect(html('A', { name: ' A ' })).not.toContain('>Rename<');
    expect(html('A', { name: 'P' })).toContain('>Rename<');
  });
});

describe('changedFields: the control a change belongs to', () => {
  it('names the fields that differ, sorted', () => {
    expect(changedFields({ width: 2 }, { width: 3 })).toBe('width');
    expect(changedFields({}, { color: 'red', width: 2 })).toBe('color,width');
    expect(changedFields({ label: 'x' }, {})).toBe('label');
    expect(changedFields({ color: 'red' }, { color: 'red' })).toBe('');
  });
});
