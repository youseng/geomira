/**
 * The style card's model (ADR-0029): the kind → fields mapping, the draft operations
 * (Write / Reset availability, the preview document), the values shown (effective, default
 * when unset, inherited by images), the label's "show" and the attribute round trips: every
 * draft the card can make is written as one style edit and reads back from the text.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyEdit } from '@geomira/editor/edit';
import { createEditor } from '@geomira/editor/state';
import { findObjectByName, type Style } from '@geomira/kernel/document';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { POINT_RADIUS, STROKE_WIDTH } from '@geomira/scene/style';
import {
  canReset,
  canWrite,
  cardKindOf,
  fieldsOf,
  inheritedStyle,
  kindName,
  patchStyle,
  sameStyle,
  setField,
  STYLE_FIELDS,
  withDraft,
  writeEdit,
} from '../src/style-draft';
import {
  defaultLabel,
  labelShown,
  LINE_WIDTH,
  opacityShown,
  POINT_SIZE,
  rangeFor,
  sliderText,
  typedNumber,
  widthShown,
  withLabel,
  withVisible,
} from '../src/style-values';
import { registry } from './helpers';

function docOf(text: string) {
  const r = parse(`@version 1\n${text}\n`, registry);
  expect(r.diagnostics).toEqual([]);
  return r.doc;
}

function objectOf(doc: ReturnType<typeof docOf>, name: string) {
  const o = findObjectByName(doc, name);
  if (o === undefined) throw new Error(`no ${name}`);
  return o;
}

describe('the fields of each kind (ADR-0029 decision 3)', () => {
  it('points: colour, point size, opacity, label, visible; more: z, label offset, noimage', () => {
    expect(fieldsOf('point')).toEqual({
      main: ['color', 'width', 'opacity', 'label', 'visible'],
      more: ['z', 'labelOffset', 'noimage'],
    });
  });

  it('curves: the same with a line width, and the dash under More', () => {
    expect(fieldsOf('curve').main).toEqual(['color', 'width', 'opacity', 'label', 'visible']);
    expect(fieldsOf('curve').more).toEqual(['dash', 'z', 'labelOffset', 'noimage']);
  });

  it('texts: no width, no label of their own (the text is the label); undrawn kinds: none', () => {
    expect(fieldsOf('text')).toEqual({
      main: ['color', 'opacity', 'visible'],
      more: ['z', 'labelOffset', 'noimage'],
    });
    expect(fieldsOf('none')).toEqual({ main: [], more: [] });
  });

  it('value kinds map to card kinds; Undefined values use the static kind', () => {
    expect(cardKindOf('point', null)).toBe('point');
    for (const k of ['line', 'circle', 'polygon', 'angle_mark', 'segment_mark'] as const)
      expect(cardKindOf(k, null), k).toBe('curve');
    expect(cardKindOf('text', null)).toBe('text');
    for (const k of ['number', 'string', 'transform'] as const)
      expect(cardKindOf(k, null), k).toBe('none');
    expect(cardKindOf('undefined', 'point')).toBe('point');
    expect(cardKindOf('inexact', 'line')).toBe('curve');
    expect(cardKindOf('undefined', null)).toBe('curve');
  });

  it('the header names the kind as the value is', () => {
    const doc = docOf('A = (0, 0)\nB = (1, 0)\ns = segment(A, B)\nr = ray(A, B)\nl = line(A, B)');
    const values = createEditor(doc, { registry }).values.values;
    const name = (n: string) => kindName(values.get(objectOf(doc, n).id), null);
    expect([name('A'), name('s'), name('r'), name('l')]).toEqual([
      'point',
      'segment',
      'ray',
      'line',
    ]);
    expect(kindName({ kind: 'undefined', reason: 'x' }, 'point')).toBe('point, undefined');
    expect(kindName(undefined, null)).toBe('object');
  });
});

describe('the draft (ADR-0029 decision 4)', () => {
  it('Write is enabled only when the draft differs from the style; Reset only when not default', () => {
    expect(canWrite({ color: 'red' }, { color: 'red' })).toBe(false);
    expect(canWrite({ color: 'red' }, {})).toBe(true);
    expect(canWrite({}, { width: 2 })).toBe(true);
    expect(canReset({})).toBe(false);
    expect(canReset({ hidden: false })).toBe(true);
  });

  it('patchStyle sets and removes fields; sameStyle compares every field', () => {
    const s = patchStyle({ color: 'red', width: 2 }, { width: undefined, opacity: 0.5 });
    expect(s).toEqual({ color: 'red', opacity: 0.5 });
    expect(Object.keys(s)).toEqual(['color', 'opacity']);
    for (const k of STYLE_FIELDS) {
      const one = patchStyle({}, { [k]: k === 'dash' ? 'dashed' : 1 });
      expect(sameStyle(one, {}), k).toBe(false);
    }
  });

  it('setField removes a value equal to what the object shows without it', () => {
    expect(setField({ width: 2 }, 'width', POINT_RADIUS, POINT_RADIUS)).toEqual({});
    expect(setField({}, 'width', 2.4, POINT_RADIUS)).toEqual({ width: 2.4 });
    expect(setField({ color: 'red' }, 'color', undefined, undefined)).toEqual({});
  });

  it('withDraft styles one object for the preview, and is the same document when unchanged', () => {
    const doc = docOf('A = (0, 0) [color=red]\nB = (1, 0)');
    const a = objectOf(doc, 'A');
    expect(withDraft(doc, a.id, { color: 'red' })).toBe(doc);
    const preview = withDraft(doc, a.id, { color: 'blue', opacity: 0.5 });
    expect(objectOf(preview, 'A').style).toEqual({ color: 'blue', opacity: 0.5 });
    expect(objectOf(preview, 'B')).toBe(objectOf(doc, 'B'));
    expect(objectOf(doc, 'A').style).toEqual({ color: 'red' });
  });

  it('Write to script is one style edit: one history entry, and the text shows it', () => {
    const s = createEditor(docOf('A = (0, 0)\nB = (2, 0)'), { registry });
    const r = applyEdit(s, writeEdit(objectOf(s.doc, 'B').id, { color: 'red', noimage: true }), {
      registry,
    });
    expect(r.ok).toBe(true);
    expect(r.state.history.past).toHaveLength(1);
    expect(print(r.state.doc)).toContain('B = (2, 0) [color=red, noimage]');
  });
});

describe('the values shown (ADR-0029 decision 3)', () => {
  it('sliders show the effective value, the default when the style has none', () => {
    expect(widthShown({}, 'point')).toBe(POINT_RADIUS);
    expect(widthShown({}, 'curve')).toBe(STROKE_WIDTH);
    expect(widthShown({ width: 2.4 }, 'point')).toBe(2.4);
    expect(widthShown({ width: 1000 }, 'curve')).toBe(64);
    expect(widthShown({ width: Number.NaN }, 'curve')).toBe(STROKE_WIDTH);
    expect(opacityShown({})).toBe(1);
    expect(opacityShown({ opacity: 0.3 })).toBe(0.3);
    expect(opacityShown({ opacity: 9 })).toBe(1);
    expect(sliderText(2.4000000000000004)).toBe('2.4');
    expect(sliderText(1)).toBe('1');
  });

  it('a range widens to hold a value set in the text', () => {
    expect(rangeFor(POINT_SIZE, 3.5)).toEqual(POINT_SIZE);
    expect(rangeFor(LINE_WIDTH, 12)).toEqual({ ...LINE_WIDTH, max: 12 });
    expect(rangeFor(LINE_WIDTH, 0)).toEqual({ ...LINE_WIDTH, min: 0 });
  });

  it('an image inherits its source style as the scene draws it (label with the suffix)', () => {
    const doc = docOf(
      [
        '@layer r = image(s, main)',
        'A = (1, 2) [width=5, opacity=0.5, label="P", color=red]',
        'B = (0, 0)',
        'C = (1, 0) [label=""]',
        's = reflect(line(B, C))',
        'style A* [color=blue]',
      ].join('\n'),
    );
    const image = objectOf(doc, 'A*');
    const inherited = inheritedStyle(doc, image);
    expect(inherited).toEqual({ width: 5, opacity: 0.5, label: 'P*', color: 'red' });
    expect(inheritedStyle(doc, objectOf(doc, 'A'))).toEqual({});
    expect(inheritedStyle(doc, objectOf(doc, 'C*')).label).toBe('');
    const values = createEditor(doc, { registry }).values.values;
    const drawn = buildScene(doc, values).primitives.find((p) => p.name === 'A*');
    const shown = { ...inherited, ...image.style };
    expect(drawn?.style.width).toBe(widthShown(shown, 'point'));
    expect(drawn?.style.opacity).toBe(opacityShown(shown));
    expect(drawn?.style.color).toBe(shown.color);
    expect(drawn?.label?.text).toBe(shown.label);
  });
});

describe('the label "show" (ADR-0029 decision 6: label="" hides, absent is the default)', () => {
  it('points show their name by default; other kinds show none', () => {
    expect(labelShown({}, 'point')).toBe(true);
    expect(labelShown({ label: '' }, 'point')).toBe(false);
    expect(labelShown({}, 'curve')).toBe(false);
    expect(labelShown({ label: 'l' }, 'curve')).toBe(true);
  });

  it('a point: off writes label="", on removes it, on with a text writes the text', () => {
    const off = withLabel({ color: 'red' }, {}, 'point', 'A', { on: false, text: '' });
    expect(off).toEqual({ color: 'red', label: '' });
    expect(withLabel(off, {}, 'point', 'A', { on: true, text: '' })).toEqual({ color: 'red' });
    expect(withLabel(off, {}, 'point', 'A', { on: true, text: 'A_1' })).toEqual({
      color: 'red',
      label: 'A_1',
    });
    expect(withLabel({ label: 'A_1' }, {}, 'point', 'A', { on: false, text: 'A_1' })).toEqual({
      label: '',
    });
  });

  it('a line: on writes its name (or the text), off removes the label', () => {
    expect(withLabel({}, {}, 'curve', 'l', { on: true, text: '' })).toEqual({ label: 'l' });
    expect(withLabel({}, {}, 'curve', 'l', { on: true, text: 'g' })).toEqual({ label: 'g' });
    expect(withLabel({ label: 'g' }, {}, 'curve', 'l', { on: false, text: 'g' })).toEqual({});
  });

  it('an image follows its source: hiding writes label="", showing again removes it', () => {
    const inherited: Style = { label: 'P*' };
    const off = withLabel({}, inherited, 'point', 'A*', { on: false, text: '' });
    expect(off).toEqual({ label: '' });
    expect(withLabel(off, inherited, 'point', 'A*', { on: true, text: '' })).toEqual({});
    expect(defaultLabel(inherited, 'A*')).toBe('P*');
    expect(defaultLabel({ label: '' }, 'A*')).toBe('A*');
    // A source without a label: an image curve shows its own name when asked.
    expect(withLabel({}, { label: '' }, 'curve', 'l*', { on: true, text: '' })).toEqual({
      label: 'l*',
    });
  });

  it('"shown" off is hidden; on removes it, or writes hidden=false over a hidden source', () => {
    expect(withVisible({}, {}, false)).toEqual({ hidden: true });
    expect(withVisible({ hidden: true }, {}, true)).toEqual({});
    expect(withVisible({}, { hidden: true }, true)).toEqual({ hidden: false });
    expect(withVisible({ hidden: false }, { hidden: true }, false)).toEqual({});
  });

  it('typed numbers: empty removes, a number at least the minimum is taken, others ignored', () => {
    expect(typedNumber('', 0)).toBeUndefined();
    expect(typedNumber(' 12.5 ', 0)).toBe(12.5);
    expect(typedNumber('-3', Number.NEGATIVE_INFINITY)).toBe(-3);
    expect(typedNumber('-3', 0)).toBeNull();
    expect(typedNumber('x', 0)).toBeNull();
  });
});

describe('attribute round trips: every draft the card makes reads back from the text', () => {
  const COLOURS = ['black', 'gray', 'red', 'blue', 'green', 'orange', 'purple', 'brown', 'teal'];
  const draftArb = fc.record(
    {
      color: fc.oneof(
        fc.constantFrom(...COLOURS),
        fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`),
      ),
      width: fc.integer({ min: 4, max: 70 }).map((n) => n / 10),
      dash: fc.constantFrom('solid' as const, 'dashed' as const, 'dotted' as const),
      opacity: fc.integer({ min: 0, max: 20 }).map((n) => n / 20),
      hidden: fc.boolean(),
      noimage: fc.boolean(),
      label: fc.constantFrom('', 'A_1', '\\omega', 'a "quoted" label'),
      z: fc.integer({ min: -3, max: 3 }),
      labelAngle: fc.double({ min: -720, max: 720, noNaN: true }),
      labelDist: fc.double({ min: 0, max: 30, noNaN: true }),
    },
    { requiredKeys: [] },
  );

  it('one style edit; print and parse give the same style (P1 for the card)', () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const s = createEditor(docOf('A = (0, 0)\nB = (2, 0)\nl = line(A, B)'), { registry });
        for (const name of ['B', 'l']) {
          const r = applyEdit(s, writeEdit(objectOf(s.doc, name).id, draft), { registry });
          expect(r.ok).toBe(true);
          const back = parse(print(r.state.doc), registry);
          expect(back.diagnostics).toEqual([]);
          expect(sameStyle(objectOf(back.doc, name).style, draft)).toBe(true);
        }
      }),
      { seed: 29, numRuns: 200 },
    );
  });
});
