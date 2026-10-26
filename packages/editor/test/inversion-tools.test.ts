/**
 * Run 14 in the editor (ADR-0032 decisions 10, 11, 16): the GUI tools over the inversion tools
 * build the map alone, as data; a figure in an inverted layer drags through the inversion (the
 * source goes to the preimage of the cursor; not draggable when the map depends on the dragged
 * point: the center, or a point of the circle of inversion); the drag-end rounding of an image
 * uses the map's local scale at the source; every shortcut is still bound once.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { chainScale } from '../src/drag';
import { applyEdit } from '../src/edit';
import { KEYMAP } from '../src/keymap';
import type { ToolInput } from '../src/machine';
import { toolGroup } from '../src/tool-groups';
import type { EditorState } from '../src/state';
import {
  addedNames,
  defText,
  edit,
  editorOf,
  env,
  idOf,
  input,
  useTool,
  valueOf,
} from './helpers/editor';

const FIG = ['O = (0, 0)', 'A = (2, 0)', 'B = (1, 3)', 'C = (5, 1)', 'w = circle(O, A)'].join('\n');

const pick = (s: EditorState, name: string): ToolInput => ({ kind: 'object', id: idOf(s, name) });

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((t, i) => input(t, i), s);
}

describe('the inversion GUI tools build the map alone', () => {
  it('Inversion, √(bc) inversion and Inversion fixing a circle (either order)', () => {
    const cases: [Parameters<typeof useTool>[1], string[], string][] = [
      ['inversion', ['w'], 'inversion(w)'],
      ['sqrt_bc', ['A', 'B', 'C'], 'sqrt_bc(A, B, C)'],
      ['inversion_fixing', ['C', 'w'], 'inversion_fixing(C, w)'],
      ['inversion_fixing', ['w', 'C'], 'inversion_fixing(C, w)'],
    ];
    for (const [tool, picks, def] of cases) {
      let s = useTool(editorOf(FIG), tool);
      const before = s;
      s = run(s, ...picks.map((p) => pick(s, p)));
      expect(addedNames(before, s), tool).toEqual(['f']);
      expect(defText(s, 'f'), tool).toBe(def);
      expect(valueOf(s, 'f').kind).toBe('transform');
      expect(toolGroup(tool)).toBe('transform');
    }
  });

  it('their keys are ⇧W, ⇧U, ⇧F, and no key is bound twice', () => {
    const keys = KEYMAP.map(
      (k) => `${k.ctrl === true ? 'C-' : ''}${k.shift === true ? 'S-' : ''}${k.key}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['W', 'U', 'F']) expect(KEYMAP.filter((b) => b.key === k)).toHaveLength(1);
  });
});

const LAYER = [FIG, 'f = inversion(O, 4)', '@layer inv = image(f, main)'].join('\n');

function drag(s: EditorState, id: number, to: [number, number]): EditorState {
  let t = edit(s, { kind: 'dragStart', id });
  t = edit(t, { kind: 'dragMove', to: { x: to[0], y: to[1] } });
  return edit(t, { kind: 'dragEnd' });
}

describe('drag-through an inversion', () => {
  it('dragging B* moves B to the preimage of the cursor', () => {
    const s0 = editorOf(LAYER);
    const s = drag(s0, idOf(s0, 'B*'), [0.8, 1.6]);
    expect(defText(s, 'B')).toBe('point(1, 2)');
    expect(print(s.doc)).toMatch(/^B = \(1, 2\)$/mu);
  });

  it('not draggable when the map depends on the dragged point (the center; a point of the circle)', () => {
    // The center's image is Undefined (nothing to drag); a point that defines the map is not
    // draggable through it (SPEC §8.4), with the stated reason.
    const s0 = editorOf(LAYER);
    const center = applyEdit(s0, { kind: 'dragStart', id: idOf(s0, 'O*') }, env);
    expect(center.ok ? 'started' : center.reason).toBe('O* is undefined');
    const s1 = editorOf([FIG, 'g = inversion(w)', '@layer inv = image(g, main)'].join('\n'));
    const onCircle = applyEdit(s1, { kind: 'dragStart', id: idOf(s1, 'A*') }, env);
    expect(onCircle.ok ? 'started' : onCircle.reason).toBe('A* cannot be dragged: g depends on A');
    const s2 = editorOf(LAYER.replace('f = inversion(O, 4)', 'f = inversion(B, 4)'));
    const atCenter = applyEdit(s2, { kind: 'dragStart', id: idOf(s2, 'C*') }, env);
    expect(atCenter.ok).toBe(true);
    const byCenter = applyEdit(s2, { kind: 'dragStart', id: idOf(s2, 'A*') }, env);
    expect(byCenter.ok).toBe(true);
  });

  it('the chain scale of an image is the local scale |f′| at its source', () => {
    const s0 = editorOf(LAYER);
    // |f′(z)| = k/|z − O|² = 4/10 at B = (1, 3); 4/26 at C = (5, 1).
    expect(chainScale(s0.doc, idOf(s0, 'B*'), s0.values)).toBeCloseTo(0.4, 12);
    expect(chainScale(s0.doc, idOf(s0, 'C*'), s0.values)).toBeCloseTo(4 / 26, 12);
  });
});
