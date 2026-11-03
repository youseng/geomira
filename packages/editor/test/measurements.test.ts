/**
 * ADR-0048 in the editor: the Distance and Angle tools create SHOWN measurements (`show`,
 * in the text); using them on a measurement made before (not shown) shows it, as one edit;
 * a measurement's value label is dragged like any label (one edit of label_angle /
 * label_dist); in the Move tool a click on a label that hits no object selects the label's
 * object; the Measurements list gives each number's value as shown, Undefined with its reason;
 * `digits` outside the text's range is refused by the style edit.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { estimatedWidth, hitLabel, labelGlyphs } from '@geomira/scene/label-hit';
import { LABEL_FONT_PX } from '@geomira/scene/label-box';
import { hitTest } from '@geomira/scene/hit';
import { applyEdit } from '../src/edit';
import { measurementRows } from '../src/measurements';
import type { EditorState } from '../src/state';
import {
  addedNames,
  click,
  edit,
  editorOf,
  env,
  idOf,
  input,
  registry,
  SIZE,
  useTool,
  viewOf,
} from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n');

function lineOf(s: EditorState, name: string): string {
  return (
    print(s.doc)
      .split('\n')
      .find((x) => x.startsWith(`${name} = `)) ?? ''
  );
}

function clickAll(s: EditorState, pts: readonly [number, number][]): EditorState {
  let t = s;
  for (const [x, y] of pts) t = input(t, click(t, x, y));
  return t;
}

describe('the Distance and Angle tools create shown measurements', () => {
  it('Distance: dist(A, C) [show], one history entry; Angle: angle(B, A, C) [show]', () => {
    const s0 = editorOf(FIG);
    const d = clickAll(useTool(s0, 'measure_distance'), [
      [0, 0],
      [1, 3],
    ]);
    const [dn = '?'] = addedNames(s0, d);
    expect(lineOf(d, dn)).toBe(`${dn} = dist(A, C) [show]`);
    expect(d.history.past).toHaveLength(1);
    const a = clickAll(useTool(s0, 'measure_angle'), [
      [4, 0],
      [0, 0],
      [1, 3],
    ]);
    const [an = '?'] = addedNames(s0, a);
    expect(lineOf(a, an)).toBe(`${an} = angle(B, A, C) [show]`);
    // L5: the text holds it.
    expect(print(parse(print(a.doc), registry).doc)).toBe(print(a.doc));
  });

  it('the new measurement is drawn: its value label is in the display list', () => {
    const s0 = editorOf(FIG);
    const d = clickAll(useTool(s0, 'measure_distance'), [
      [0, 0],
      [4, 0],
    ]);
    const display = layout(buildScene(d.doc, d.values.values), viewOf(d));
    const id = idOf(d, addedNames(s0, d)[0] ?? '?');
    expect(display.labels.find((l) => l.id === id)?.text).toBe('4.00');
  });

  it('on a measurement made before and not shown: shows it (one style edit), selected', () => {
    const s0 = editorOf(`${FIG}\nm = dist(A, C) [color=red]`);
    const t = clickAll(useTool(s0, 'measure_distance'), [
      [0, 0],
      [1, 3],
    ]);
    expect(addedNames(s0, t)).toEqual([]);
    expect(lineOf(t, 'm')).toBe('m = dist(A, C) [color=red, show]');
    expect(t.history.past).toHaveLength(1);
    expect(t.selection).toEqual([idOf(t, 'm')]);
    // Shown already: reused, nothing written.
    const again = clickAll(useTool(t, 'measure_distance'), [
      [1, 3],
      [0, 0],
    ]);
    expect(again.doc).toBe(t.doc);
    expect(again.history.past).toHaveLength(1);
  });

  it('other tools still build without a style', () => {
    const s0 = editorOf(FIG);
    const r = clickAll(useTool(s0, 'measure_ratio'), [
      [0, 0],
      [4, 0],
      [0, 0],
      [1, 3],
    ]);
    const [n = '?'] = addedNames(s0, r);
    expect(lineOf(r, n)).toBe(`${n} = ratio(A, B, A, C)`);
  });
});

describe('the value label of a measurement', () => {
  const TEXT = `${FIG}\nd = dist(A, B) [show]\ne = angle(B, A, C) [show]`;

  it('is dragged like any label: one edit of label_angle and label_dist; undo restores', () => {
    const s = editorOf(TEXT);
    const d = idOf(s, 'd');
    let t = edit(s, { kind: 'dragStart', id: d, part: 'label' });
    t = edit(t, { kind: 'dragLabel', angle: 250.4, dist: 18.6 });
    t = edit(t, { kind: 'dragLabel', angle: 270.2, dist: 20.4 });
    t = edit(t, { kind: 'dragEnd' });
    expect(lineOf(t, 'd')).toBe('d = dist(A, B) [label_angle=270, label_dist=20, show]');
    expect(t.history.past).toHaveLength(1);
    expect(edit(t, { kind: 'undo' }).doc).toBe(s.doc);
    const display = layout(buildScene(t.doc, t.values.values), viewOf(t));
    const l = display.labels.find((x) => x.id === d);
    expect(l?.angle).toBe(270);
    expect(l === undefined ? NaN : l.at.y - l.anchor.y).toBeCloseTo(20, 9);
  });

  it('a Move click on it selects the measurement; on empty paper nothing', () => {
    const s = editorOf(TEXT);
    const display = layout(buildScene(s.doc, s.values.values), viewOf(s));
    for (const name of ['d', 'e']) {
      const id = idOf(s, name);
      const l = display.labels.find((x) => x.id === id);
      if (l === undefined) throw new Error(`no label of ${name}`);
      const { box } = labelGlyphs(l, l.runs.map(estimatedWidth), LABEL_FONT_PX);
      const q = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
      const hit = hitTest(display, q);
      const label = hitLabel(display, q)?.id;
      expect(label).toBe(id);
      const world = { x: 0, y: 0 };
      const t = input(s, { kind: 'click', hit, world, ...(label === undefined ? {} : { label }) });
      expect(t.selection).toEqual(hit.hits.length > 0 ? [hit.hits[0]?.id] : [id]);
    }
    const empty = { x: SIZE.width - 2, y: SIZE.height - 2 };
    const t = input(s, { kind: 'click', hit: hitTest(display, empty), world: { x: 0, y: 0 } });
    expect(t.selection).toEqual([]);
  });

  it('digits outside the text’s range is refused; a whole number in [0, 10] is written', () => {
    const s = editorOf(TEXT);
    const d = idOf(s, 'd');
    for (const digits of [-1, 11, 2.5, Number.NaN]) {
      const r = applyEdit(s, { kind: 'style', id: d, style: { show: true, digits } }, env);
      expect(r.ok ? 'accepted' : r.reason).toBe('digits is a whole number from 0 to 10');
    }
    const t = edit(s, { kind: 'style', id: d, style: { show: true, digits: 0 } });
    expect(lineOf(t, 'd')).toBe('d = dist(A, B) [show, digits=0]');
  });
});

describe('the Measurements list', () => {
  it('every number with its definition and value as shown; Undefined with its reason', () => {
    const s = editorOf(
      [
        FIG,
        'd = dist(A, B) [show, digits=3]',
        'e = angle(B, A, C)',
        'u = angle(A, A, C) [show]',
        'r = ratio(A, B, A, C) [show]',
        'k = 2 * d',
        'l = line(A, B)',
      ].join('\n'),
    );
    const rows = measurementRows(s, env);
    expect(rows.map((r) => [r.name, r.definition, r.status, r.value, r.shown])).toEqual([
      ['d', 'dist(A, B)', 'ok', '4.000', true],
      ['e', 'angle(B, A, C)', 'ok', `${((Math.atan2(3, 1) * 180) / Math.PI).toFixed(2)}°`, false],
      ['u', 'angle(A, A, C)', 'undefined', null, true],
      ['r', 'ratio(A, B, A, C)', 'ok', (4 / Math.hypot(1, 3)).toFixed(2), true],
      ['k', 'mul(2, d)', 'ok', '8.00', false],
    ]);
    expect(rows[2]?.reason).toMatch(/./u);
    expect(rows[3]?.notDrawable).toBe('only dist, angle and dangle measurements are drawn');
    expect(rows[0]?.notDrawable).toBeUndefined();
  });

  it('values are live: a drag of B changes the row', () => {
    const s = editorOf(`${FIG}\nd = dist(A, B) [show]`);
    let t = edit(s, { kind: 'dragStart', id: idOf(s, 'B') });
    t = edit(t, { kind: 'dragMove', to: { x: 6, y: 0 } });
    expect(measurementRows(t, env)[0]?.value).toBe('6.00');
    t = edit(t, { kind: 'dragEnd' });
    expect(measurementRows(t, env)[0]?.value).toBe('6.00');
  });
});
