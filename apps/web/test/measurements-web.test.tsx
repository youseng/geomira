/**
 * ADR-0048 in the web app: the style card of a measurement (its "shown" is `show`; the fields
 * of a drawn object while shown; "Not drawn" otherwise, with how to show it or why it cannot
 * be drawn; the decimals field), the Measurements list at the top of the Objects panel, a Move
 * click on a value label selecting its measurement, and the selection halo of a distance
 * (which draws no stroke) behind its label.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createEditor } from '@geomira/editor/state';
import { measurementRows } from '@geomira/editor/measurements';
import { findObjectByName, type Document } from '@geomira/kernel/document';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout, type DisplayList } from '@geomira/scene/display';
import { estimatedWidth, labelGlyphs } from '@geomira/scene/label-hit';
import { LABEL_FONT_PX } from '@geomira/scene/label-box';
import { Gestures } from '../src/gestures';
import { ObjectsPanel } from '../src/panels/ObjectsPanel';
import { measurementText } from '../src/panels/MeasurementsList';
import { drawDisplay, LIGHT_THEME, NO_UI } from '../src/render';
import { EditorStore } from '../src/store';
import { StyleCard, type OpenCard } from '../src/StyleCard';
import { fieldsOf, writeEdit } from '../src/style-draft';
import {
  cardFields,
  cardKindFor,
  notDrawnNote,
  typedDigits,
  withShown,
} from '../src/style-measure';
import { Recorder, registry } from './helpers';

const TEXT = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'd = dist(A, B) [show]',
  'e = angle(B, A, C)',
  'u = angle(A, A, C) [show]',
  'r = ratio(A, B, A, C) [show]',
  'k = 2 * d',
  '',
].join('\n');

function docOf(text: string): Document {
  const r = parse(text, registry);
  expect(r.diagnostics).toEqual([]);
  return r.doc;
}

const doc = docOf(TEXT);
const store = new EditorStore({ registry }, () => undefined);
const state = createEditor(doc, store.env);
const obj = (name: string) => {
  const o = findObjectByName(doc, name);
  if (o === undefined) throw new Error(`no ${name}`);
  return o;
};
const kindOf = (name: string) =>
  cardKindFor(obj(name), state.values.values.get(obj(name).id), 'number');

describe('the style card of a measurement', () => {
  it('kinds: dist is a distance, angle an angle (also when Undefined); ratio and arithmetic none', () => {
    expect(kindOf('d')).toBe('distance');
    expect(kindOf('e')).toBe('angle');
    expect(kindOf('u')).toBe('angle');
    expect(kindOf('r')).toBe('none');
    expect(kindOf('k')).toBe('none');
    const a = obj('A');
    expect(cardKindFor(a, state.values.values.get(a.id), 'point')).toBe('point');
  });

  it('fields: a drawn object’s while shown; only "shown" and the decimals while not', () => {
    expect(cardFields('distance', { show: true })).toEqual(fieldsOf('distance'));
    expect(fieldsOf('distance').main).toEqual(['color', 'opacity', 'label', 'visible']);
    expect(fieldsOf('angle').main).toEqual(['color', 'width', 'opacity', 'label', 'visible']);
    expect(fieldsOf('angle').more).toEqual(['digits', 'dash', 'z', 'labelOffset']);
    for (const s of [{}, { show: false }, { show: true, hidden: true }])
      expect(cardFields('angle', s)).toEqual({ main: ['visible'], more: ['digits'] });
    expect(cardFields('curve', {})).toEqual(fieldsOf('curve'));
  });

  it('"shown" writes show (and clears hidden); off removes it', () => {
    expect(withShown({}, true)).toEqual({ show: true });
    expect(withShown({ hidden: true, color: 'red' }, true)).toEqual({ color: 'red', show: true });
    expect(withShown({ show: true, digits: 3 }, false)).toEqual({ digits: 3 });
    expect(writeEdit(obj('e').id, withShown({}, true))).toEqual({
      kind: 'style',
      id: obj('e').id,
      style: { show: true },
    });
  });

  it('notes: how to show a measurement; why a shown ratio is not drawn; others as before', () => {
    expect(notDrawnNote(obj('e'), 'angle', {})).toBe('Not drawn: tick "shown" to draw its value.');
    expect(notDrawnNote(obj('d'), 'distance', { show: true })).toBeUndefined();
    expect(notDrawnNote(obj('r'), 'none', { show: true })).toBe(
      'Not drawn: only dist, angle and dangle measurements are drawn.',
    );
    expect(notDrawnNote(obj('k'), 'none', {})).toBe('Not drawn: nothing to style.');
    expect(notDrawnNote(obj('A'), 'point', {})).toBeUndefined();
  });

  it('decimals: a whole number from 0 to 10; empty removes the field', () => {
    expect(typedDigits('3')).toBe(3);
    expect(typedDigits(' ')).toBeUndefined();
    for (const bad of ['-1', '11', '2.5', 'x']) expect(typedDigits(bad)).toBeNull();
  });

  const html = (name: string, draft?: OpenCard['draft']) => {
    const o = obj(name);
    const open: OpenCard = {
      id: o.id,
      anchor: { left: 0, top: 0, right: 0, bottom: 0 },
      draft: draft ?? o.style,
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

  it('renders: a shown distance has colour, label, shown (checked) and the decimals', () => {
    const h = html('d');
    expect(h).toContain('aria-label="Colour"');
    expect(h).toContain('aria-label="Show the label"');
    expect(h).toMatch(/aria-label="Shown"[^>]*checked=""/u);
    expect(h).toContain('Decimals (0–10, empty = 2)');
    expect(h).not.toContain('Not drawn');
    expect(h).not.toContain('Line width');
  });

  it('renders: an angle not shown offers "shown" (unchecked) and the note; ratio says why', () => {
    const h = html('e');
    expect(h).toMatch(/aria-label="Shown"/u);
    expect(h).not.toMatch(/aria-label="Shown"[^>]*checked=""/u);
    expect(h).not.toContain('aria-label="Colour"');
    expect(h).toContain('Not drawn: tick &quot;shown&quot; to draw its value.');
    expect(html('e', { show: true })).toContain('Line width');
    expect(html('r')).toContain('Not drawn: only dist, angle and dangle measurements are drawn.');
    expect(html('k')).toContain('Not drawn: nothing to style.');
  });
});

describe('the Measurements list (Objects panel)', () => {
  it('rows: name, definition, value as shown; Undefined with its reason', () => {
    const rows = measurementRows(state, store.env);
    expect(rows.map((r) => [r.name, measurementText(r)])).toEqual([
      ['d', '4.00 · shown'],
      ['e', `${((Math.atan2(3, 1) * 180) / Math.PI).toFixed(2)}°`],
      ['u', `undefined: ${rows[2]?.reason ?? ''} · shown`],
      ['r', `${(4 / Math.hypot(1, 3)).toFixed(2)} · not drawable`],
      ['k', '8.00'],
    ]);
    expect(rows[2]?.reason).toMatch(/./u);
  });

  it('the panel lists them first, under "Measurements"; a figure without numbers has no list', () => {
    const h = renderToString(
      <ObjectsPanel store={store} state={state} undrawable={[]} onStyle={() => undefined} />,
    );
    expect(h.indexOf('Measurements')).toBeGreaterThanOrEqual(0);
    expect(h.indexOf('Measurements')).toBeLessThan(h.indexOf('<h3>main'));
    expect(h).toContain('aria-label="Measurement d"');
    expect(h).toContain('4.00 · shown');
    const plain = createEditor(docOf('@version 1\nA = (0, 0)\n'), store.env);
    const p = renderToString(
      <ObjectsPanel store={store} state={plain} undrawable={[]} onStyle={() => undefined} />,
    );
    expect(p).not.toContain('Measurements');
  });
});

describe('on the canvas', () => {
  const SIZE = { width: 800, height: 600 };
  function setup() {
    const s = new EditorStore({ registry }, () => undefined);
    s.openText(TEXT, 'new');
    const display = (): DisplayList => {
      const c = s.current();
      return layout(buildScene(c.doc, c.values.values), { viewport: c.viewport, size: SIZE });
    };
    return { s, display };
  }

  it('a Move click on the value label selects the measurement (no edit)', () => {
    const { s, display } = setup();
    const id = findObjectByName(s.current().doc, 'd')?.id ?? -1;
    const l = display().labels.find((x) => x.id === id);
    if (l === undefined) throw new Error('no label');
    const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
    const q = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const before = print(s.current().doc);
    const g = new Gestures(s);
    g.down(1, q, display());
    g.up(1, q, display());
    expect(s.current().selection).toEqual([id]);
    expect(print(s.current().doc)).toBe(before);
  });

  it('a selected distance has a halo box behind its label; nothing when not selected', () => {
    const { s, display } = setup();
    const id = findObjectByName(s.current().doc, 'd')?.id ?? -1;
    const rects = (sel: number[]) => {
      const rec = new Recorder();
      drawDisplay(rec, display(), { ...NO_UI, selection: new Set(sel) }, LIGHT_THEME, 1);
      return rec.calls.filter((c) => c[0] === 'fillRect').length;
    };
    expect(rects([id]) - rects([])).toBe(1);
  });
});
