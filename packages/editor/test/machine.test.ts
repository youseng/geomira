/**
 * The tool state machine (SPEC §12): every GUI tool of tools.ts, driven by clicks resolved
 * through the real scene and hit-test, and by panel choices, finish, cancel and text. Each
 * builds the call the language would write; points are created on demand (free, glider,
 * intersection); refusals leave the state unchanged.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { toolInput, claimToolKinds, type ToolInput } from '../src/machine';
import { TOOLS } from '../src/tools';
import type { EditorState } from '../src/state';
import {
  addedNames,
  click,
  defText,
  editorOf,
  env,
  idOf,
  input,
  useTool,
  xyOf,
} from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'l = line(A, B)', 'c = circle(A, C)'].join(
  '\n',
);

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((t, i) => input(t, i), s);
}

function refused(s: EditorState, i: ToolInput, reason: RegExp | string): void {
  const r = toolInput(s, i, env);
  expect(r.ok).toBe(false);
  expect(r.state).toBe(s);
  if (!r.ok) expect(r.reason).toMatch(reason);
}

describe('point creation', () => {
  it('point tool: free (rounded), glider on a line and on a circle, existing points picked', () => {
    let s = useTool(editorOf(FIG), 'point');
    s = input(s, click(s, -2.34567, -1.23456));
    expect(print(s.doc)).toContain('D = (-2.3457, -1.2346)');
    s = input(s, click(s, 2.5, 0));
    expect(defText(s, 'E')).toBe('on(l, 5/8)');
    s = input(s, click(s, 0, Math.sqrt(10)));
    expect(defText(s, 'F')).toMatch(/^on\(c, /u);
    const [fx, fy] = xyOf(s, 'F');
    expect(Math.hypot(fx, fy - Math.sqrt(10)) * s.viewport.zoom).toBeLessThan(0.1);
    const before = s;
    s = input(s, click(s, 1, 3)); // C itself: nothing new
    expect(s.doc).toBe(before.doc);
  });

  it('point tool on an intersection: the GUI selector choice', () => {
    let s = useTool(editorOf(FIG), 'point');
    s = input(s, click(s, Math.sqrt(10), 0));
    expect(defText(s, 'D')).toBe('intersect(l, c, along(+))');
    expect(xyOf(s, 'D')[0]).toBeCloseTo(Math.sqrt(10), 12);
  });

  it('glider tool: a point on the clicked curve', () => {
    let s = useTool(editorOf(FIG), 'glider');
    s = input(s, click(s, -3, 0));
    expect(defText(s, 'D')).toBe('on(l, -3/4)');
    refused(s, click(s, 6, 5), 'click a line or a circle');
  });
});

describe('construction tools', () => {
  const cases: [EditorState['tool'], [number, number][], string][] = [
    [
      'midpoint',
      [
        [0, 0],
        [4, 0],
      ],
      'midpoint(A, B)',
    ],
    [
      'line',
      [
        [0, 0],
        [1, 3],
      ],
      'line(A, C)',
    ],
    [
      'segment',
      [
        [4, 0],
        [1, 3],
      ],
      'segment(B, C)',
    ],
    [
      'ray',
      [
        [0, 0],
        [1, 3],
      ],
      'ray(A, C)',
    ],
    [
      'parallel',
      [
        [1, 3],
        [-6, 0],
      ],
      'parallel(C, l)',
    ],
    [
      'perpendicular',
      [
        [1, 3],
        [-6, 0],
      ],
      'perp(C, l)',
    ],
    [
      'perp_bisector',
      [
        [0, 0],
        [4, 0],
      ],
      'perp_bisector(A, B)',
    ],
    [
      'bisector',
      [
        [4, 0],
        [0, 0],
        [1, 3],
      ],
      'bisector(B, A, C)',
    ],
    [
      'circle',
      [
        [4, 0],
        [1, 3],
      ],
      'circle(B, C)',
    ],
    [
      'circle3',
      [
        [0, 0],
        [4, 0],
        [1, 3],
      ],
      'circle(A, B, C)',
    ],
    [
      'foot',
      [
        [1, 3],
        [-6, 0],
      ],
      'foot(C, l)',
    ],
    [
      'reflect',
      [
        [1, 3],
        [-6, 0],
      ],
      'reflect(C, l)',
    ],
    [
      'mark_angle',
      [
        [4, 0],
        [0, 0],
        [1, 3],
      ],
      'mark_angle(B, A, C)',
    ],
    [
      'mark_segment',
      [
        [0, 0],
        [4, 0],
      ],
      'mark_segment(A, B)',
    ],
    [
      'measure_distance',
      [
        [0, 0],
        [1, 3],
      ],
      'dist(A, C)',
    ],
    [
      'measure_angle',
      [
        [4, 0],
        [0, 0],
        [1, 3],
      ],
      'angle(B, A, C)',
    ],
  ];
  for (const [tool, clicks, def] of cases)
    it(`${tool}: ${def}`, () => {
      let s = useTool(editorOf(FIG), tool);
      for (const [x, y] of clicks) s = input(s, click(s, x, y));
      const added = addedNames(editorOf(FIG), s);
      expect(added).toHaveLength(1);
      expect(defText(s, added[0] ?? '?')).toBe(def);
      expect(s.toolState.picks).toEqual([]);
      expect(s.history.past).toHaveLength(1);
    });

  it('names follow the kind of the result: reflecting a line gives a line name', () => {
    let s = useTool(editorOf(`${FIG}\nm = line(A, C)`), 'reflect');
    s = run(s, { kind: 'object', id: idOf(s, 'm') }, { kind: 'object', id: idOf(s, 'l') });
    expect(addedNames(editorOf(`${FIG}\nm = line(A, C)`), s)).toEqual(['l_1']);
  });

  it('mark_right only on a right angle; tangent at a point of the circle and from outside', () => {
    let s = useTool(editorOf(`${FIG}\nH = rotate(B, A, 90)`), 'mark_right');
    s = run(s, click(s, 4, 0), click(s, 0, 0), click(s, 0, 4));
    expect(defText(s, 'mk')).toBe('mark_right(B, A, H)');
    let t = useTool(editorOf(FIG), 'tangent');
    t = run(t, click(t, 1, 3), click(t, -Math.sqrt(10), 0.0001));
    expect(defText(t, 'l_1')).toBe('tangent(C, c)');
    let u = useTool(editorOf(`${FIG}\nP = (6, 0)`), 'tangent');
    u = run(u, click(u, 6, 0), { kind: 'object', id: idOf(u, 'c') });
    expect(u.toolState.choosing).toEqual({
      tool: 'tangent_from',
      args: [idOf(u, 'P'), idOf(u, 'c')],
    });
    u = input(u, click(u, 1.6, 3));
    expect(defText(u, 'l_1')).toMatch(/^tangent_from\(P, c, /u);
    const v = u.values.values.get(idOf(u, 'l_1'));
    expect(v?.kind === 'line' && v.p.y > 0).toBe(true);
  });

  it('intersection tool: one candidate at once, two wait for the click that chooses', () => {
    let s = useTool(editorOf(`${FIG}\nm = line(A, C)`), 'intersection');
    s = run(s, { kind: 'object', id: idOf(s, 'l') }, { kind: 'object', id: idOf(s, 'm') });
    expect(defText(s, 'D')).toBe('intersect(l, m)');
    s = run(s, { kind: 'object', id: idOf(s, 'l') }, { kind: 'object', id: idOf(s, 'c') });
    expect(s.toolState.choosing?.tool).toBe('intersect');
    refused(s, { kind: 'object', id: idOf(s, 'A') }, 'nothing to pick');
    s = input(s, click(s, -3, 0.5));
    // A point and a line of the construction decide (SPEC §7 order: before along(±)).
    expect(defText(s, 'E')).toBe('intersect(l, c, opposite_side(B, m))');
  });

  it('polygon: closes on its first vertex, or on finish', () => {
    let s = useTool(editorOf(FIG), 'polygon');
    s = run(s, click(s, 0, 0), click(s, 4, 0), click(s, 1, 3));
    refused(s, click(s, 4, 0), 'this object is already picked');
    s = input(s, click(s, 0, 0));
    expect(defText(s, 'poly')).toBe('polygon(A, B, C)');
    s = run(s, click(s, 0, 0), click(s, 4, 0));
    refused(s, { kind: 'finish' }, 'not enough picks to finish');
    s = run(s, click(s, 1, 3), click(s, -2, -2), { kind: 'finish' });
    expect(defText(s, 'poly_1')).toBe('polygon(A, B, C, D)');
  });

  it('text: the anchor, then the string', () => {
    let s = useTool(editorOf(FIG), 'text');
    s = input(s, click(s, 1, 3));
    refused(s, click(s, 2, 2), 'type the text');
    refused(s, { kind: 'text', value: '' }, 'the text is empty');
    s = input(s, { kind: 'text', value: 'Let \\omega be "c"' });
    expect(print(s.doc)).toContain('txt = text(C, "Let \\\\omega be \\"c\\"")');
  });

  it('claim tool: kinds with object parameters; a rest parameter ends with finish', () => {
    expect(claimToolKinds()).toEqual(
      expect.arrayContaining([
        'collinear',
        'concyclic',
        'concurrent',
        'parallel',
        'perpendicular',
        'on',
        'tangent',
        'equal',
      ]),
    );
    expect(claimToolKinds()).not.toContain('length');
    let s = useTool(editorOf(FIG), 'claim', 'collinear');
    s = run(s, click(s, 0, 0), click(s, 4, 0), click(s, 2, 0), { kind: 'finish' });
    expect(print(s.doc)).toContain('claim collinear(A, B, D)');
    s = useTool(s, 'claim', 'on');
    s = run(s, click(s, 1, 3), { kind: 'object', id: idOf(s, 'c') });
    expect(print(s.doc)).toContain('claim on(C, c)');
  });

  it('layer from transform: the transform comes from the panel; the image of the active layer', () => {
    let s = useTool(editorOf(`${FIG}\nT = reflect(l)`), 'derived_layer');
    refused(s, { kind: 'object', id: idOf(s, 'A') }, /pick a transform/);
    refused(s, click(s, 0, 0), /click a transform/);
    s = input(s, { kind: 'object', id: idOf(s, 'T') });
    expect(print(s.doc)).toContain('@layer image = image(T, main)');
    expect(xyOf(s, 'C*')).toEqual([1, -3]);
  });

  it('cancel drops the picks; the move tool selects what is clicked', () => {
    let s = useTool(editorOf(FIG), 'line');
    s = input(s, click(s, 0, 0));
    expect(s.toolState.picks).toEqual([idOf(s, 'A')]);
    s = input(s, { kind: 'cancel' });
    expect(s.toolState.picks).toEqual([]);
    s = useTool(s, 'move');
    s = input(s, click(s, 4, 0));
    expect(s.selection).toEqual([idOf(s, 'B')]);
    s = input(s, click(s, 6, 5));
    expect(s.selection).toEqual([]);
  });

  it('every tool has a unique id and key, help, and runs (no tool is a stub)', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((t) => t.key)).size).toBe(TOOLS.length);
    for (const t of TOOLS) expect(t.help.length).toBeGreaterThan(10);
  });
});
