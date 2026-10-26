/**
 * Run 13 (ADR-0031): the map tools build the transformation alone with "Transformation only"
 * (the maintainer's note: Reflect, Rotate, Homothety, Translate and Spiral only built one
 * object's image, so a standalone map needed typing); "Apply transformation" maps an object
 * with it; and the GUI tools over the v1.1 kernel tools build what the language writes.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { keyAction, KEYMAP } from '../src/keymap';
import type { ToolInput } from '../src/machine';
import { toolPrompt } from '../src/prompt';
import { toolGroup } from '../src/tool-groups';
import type { ToolId } from '../src/tool-state';
import type { EditorState } from '../src/state';
import {
  addedNames,
  click,
  defText,
  edit,
  editorOf,
  env,
  idOf,
  input,
  useTool,
  valueOf,
} from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'D = (3, 3)',
  'l = line(A, B)',
  'c = circle(A, C)',
  'k = circle(B, 2)',
  'm = circle(D, 1)',
  'P = (2, 1)',
  'n = line(C, D)',
].join('\n');

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((t, i) => input(t, i), s);
}

const pick = (s: EditorState, name: string): ToolInput => ({ kind: 'object', id: idOf(s, name) });

describe('map tools: “Transformation only” builds the map itself', () => {
  it('reflect in a line: f = reflect(l), one history entry, named as a transformation', () => {
    let s = useTool(editorOf(FIG), 'reflect');
    s = edit(s, { kind: 'toolMapOnly', on: true });
    expect(toolPrompt(s)).toMatch(/mirror line or center/u);
    const before = s;
    s = run(s, click(s, 2, 0));
    expect(addedNames(before, s)).toEqual(['f']);
    expect(defText(s, 'f')).toBe('reflect(l)');
    expect(valueOf(s, 'f').kind).toBe('transform');
    expect(print(s.doc)).toMatch(/^f = reflect\(l\)$/mu);
    const undone = edit(s, { kind: 'undo' });
    expect(undone.doc).toBe(before.doc);
  });

  it('rotate, homothety, translate and spiral build rotate(O, θ), homothety(O, k), translate(A, B), spiral(A, B, C, D)', () => {
    const cases: [ToolId, string[], string][] = [
      ['rotate', ['A'], 'rotate(A, 60)'],
      ['homothety', ['B'], 'homothety(B, 2)'],
      ['translate', ['A', 'B'], 'translate(A, B)'],
      ['spiral', ['A', 'B', 'C', 'D'], 'spiral(A, B, C, D)'],
    ];
    for (const [tool, picks, def] of cases) {
      let s = edit(useTool(editorOf(FIG), tool), { kind: 'toolMapOnly', on: true });
      s = run(s, ...picks.map((p) => pick(s, p)));
      expect(defText(s, 'f'), tool).toBe(def);
      expect(valueOf(s, 'f').kind).toBe('transform');
    }
  });

  it('stays on across builds and switches between map tools, off after another tool; toggling clears the picks', () => {
    let s = edit(useTool(editorOf(FIG), 'translate'), { kind: 'toolMapOnly', on: true });
    s = run(s, pick(s, 'A'));
    expect(s.toolState.picks).toHaveLength(1);
    const off = edit(s, { kind: 'toolMapOnly', on: false });
    expect(off.toolState.picks).toEqual([]);
    expect(off.toolState.mapOnly).toBeUndefined();
    s = run(s, pick(s, 'B'));
    expect(s.toolState.mapOnly).toBe(true);
    expect(useTool(s, 'rotate').toolState.mapOnly).toBe(true);
    expect(useTool(useTool(s, 'line'), 'rotate').toolState.mapOnly).toBeUndefined();
  });

  it('is refused for a tool that builds no transformation, and without it the image is built as before', () => {
    const s = useTool(editorOf(FIG), 'line');
    const r = applyEdit(s, { kind: 'toolMapOnly', on: true }, env);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
    const t = useTool(editorOf(FIG), 'reflect');
    const u = run(t, pick(t, 'C'), pick(t, 'l'));
    const [image] = addedNames(t, u);
    expect(defText(u, image ?? '')).toBe('reflect(C, l)');
  });

  it('Apply transformation maps an object with a built map, in either order; Layer from transform takes it too', () => {
    let s = edit(useTool(editorOf(FIG), 'reflect'), { kind: 'toolMapOnly', on: true });
    s = run(s, pick(s, 'l'));
    s = useTool(s, 'apply_map');
    const s1 = run(s, pick(s, 'f'), pick(s, 'C'));
    const [X] = addedNames(s, s1);
    expect(defText(s1, X ?? '')).toBe('apply(f, C)');
    const s2 = run(s1, pick(s1, 'c'), pick(s1, 'f'));
    const [Y] = addedNames(s1, s2);
    expect(defText(s2, Y ?? '')).toBe('apply(f, c)');
    const [x, y] = [valueOf(s2, X ?? ''), valueOf(s2, Y ?? '')];
    expect(x.kind === 'point' && [x.x, x.y]).toEqual([1, -3]);
    expect(y.kind).toBe('circle');
    s = s2;
    s = useTool(s, 'derived_layer');
    s = run(s, pick(s, 'f'));
    expect(s.doc.layers.some((L) => L.rule?.transform.id === idOf(s, 'f'))).toBe(true);
  });
});

describe('GUI tools over the v1.1 kernel tools', () => {
  const cases: [ToolId, string[], string, string][] = [
    ['arc', ['B', 'C', 'A'], 'arc(B, C, A)', 'circle'],
    ['symmedian', ['A', 'B', 'C'], 'symmedian(A, B, C)', 'line'],
    ['isogonal', ['P', 'A', 'B', 'C'], 'isogonal(P, A, B, C)', 'point'],
    ['spiral_center', ['A', 'B', 'C', 'D'], 'spiral_center(A, B, C, D)', 'point'],
    ['pole', ['n', 'c'], 'pole(n, c)', 'point'],
    ['pole', ['c', 'n'], 'pole(n, c)', 'point'],
    ['radical_center', ['c', 'k', 'm'], 'radical_center(c, k, m)', 'point'],
  ];
  for (const [tool, picks, def, kind] of cases) {
    it(`${tool}: ${picks.join(', ')} → ${def}`, () => {
      let s = useTool(editorOf(FIG), tool);
      const before = s;
      s = run(s, ...picks.map((p) => pick(s, p)));
      const [name] = addedNames(before, s);
      expect(name).toBeDefined();
      expect(defText(s, name ?? '')).toBe(def);
      expect(valueOf(s, name ?? '').kind).toBe(kind);
    });
  }

  it('each new tool has its group and its Shift key, and no key is taken twice', () => {
    const keys: [ToolId, string, string][] = [
      ['arc', 'K', 'circles'],
      ['symmedian', 'Y', 'lines'],
      ['isogonal', 'I', 'centers'],
      ['spiral_center', 'Z', 'centers'],
      ['pole', 'E', 'points'],
      ['radical_center', 'X', 'centers'],
      ['apply_map', 'G', 'transform'],
    ];
    for (const [tool, key, group] of keys) {
      expect(keyAction({ key, ctrl: false, shift: true, alt: false })).toEqual({
        kind: 'tool',
        tool,
      });
      expect(toolGroup(tool)).toBe(group);
    }
    const plain = KEYMAP.filter((k) => k.ctrl !== true).map((k) => k.key);
    expect(new Set(plain).size).toBe(plain.length);
  });

  it('a repeat of the same construction is reused, not added (ADR-0029: arc(C, B, A) is arc(A, B, C))', () => {
    let s = useTool(editorOf(FIG), 'arc');
    s = run(s, pick(s, 'A'), pick(s, 'C'), pick(s, 'B'));
    const after = run(s, pick(s, 'B'), pick(s, 'C'), pick(s, 'A'));
    expect(after.doc.objects.length).toBe(s.doc.objects.length);
  });

  it('three collinear points give an Undefined arc, listed with its reason (never a guess)', () => {
    let s = useTool(editorOf(`${FIG}\nE = (2, 0)`), 'arc');
    s = run(s, pick(s, 'A'), pick(s, 'E'), pick(s, 'B'));
    const v = valueOf(s, 'c_1');
    expect(v.kind === 'undefined' && v.reason).toMatch(/^collinear points: arc/u);
  });
});
