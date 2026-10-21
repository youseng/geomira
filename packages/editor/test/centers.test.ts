/**
 * The Centers group and the triangle circles as GUI tools (ADR-0016 decisions 21, 23): one
 * scenario per tool, driven by clicks through the real scene as Run 8a's tool tests are.
 * Each picks A, B, C and builds the kernel call the language would write, named by olympiad
 * convention when that name is free; the value is the center or circle of the triangle,
 * checked against its coordinates.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { keyAction } from '../src/keymap';
import { toolGroup } from '../src/tool-groups';
import type { ToolId } from '../src/tool-state';
import { toolUI } from '../src/tools';
import {
  addedNames,
  click,
  defText,
  editorOf,
  input,
  useTool,
  valueOf,
  xyOf,
} from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n');

/** Side lengths a = BC, b = CA, c = AB and twice the area of A(0,0) B(4,0) C(1,3). */
const [a, b, c] = [Math.hypot(3, 3), Math.hypot(1, 3), 4];
const AREA2 = 12;
/** The incenter and the excenter opposite A, by their barycentric weights. */
const I = [(4 * b + c) / (a + b + c), (3 * c) / (a + b + c)] as const;
const J = [(4 * b + c) / (-a + b + c), (3 * c) / (-a + b + c)] as const;

/** Tool, conventional name, definition, coordinates. */
const CENTERS: readonly [ToolId, string, string, readonly [number, number]][] = [
  ['centroid', 'G', 'centroid(A, B, C)', [5 / 3, 1]],
  ['circumcenter', 'O', 'circumcenter(A, B, C)', [2, 1]],
  ['incenter', 'I', 'incenter(A, B, C)', I],
  ['orthocenter', 'H', 'orthocenter(A, B, C)', [1, 1]],
  ['ninepoint_center', 'N', 'ninepoint_center(A, B, C)', [1.5, 1]],
  ['excenter', 'I_a', 'excenter(A, B, C)', J],
];

/** Tool, name, definition, center and radius of each circle of the triangle. */
const CIRCLES: readonly [ToolId, string, string, readonly [number, number], number][] = [
  ['circumcircle', 'ω', 'circumcircle(A, B, C)', [2, 1], Math.sqrt(5)],
  ['incircle', 'ω', 'incircle(A, B, C)', I, AREA2 / (a + b + c)],
  ['excircle', 'c', 'excircle(A, B, C)', J, AREA2 / (-a + b + c)],
  ['ninepoint_circle', 'c', 'ninepoint_circle(A, B, C)', [1.5, 1], Math.sqrt(5) / 2],
];

function pickABC(tool: ToolId, fig = FIG) {
  let s = useTool(editorOf(fig), tool);
  for (const [x, y] of [
    [0, 0],
    [4, 0],
    [1, 3],
  ] as const)
    s = input(s, click(s, x, y));
  const added = addedNames(editorOf(fig), s);
  expect(added).toHaveLength(1);
  expect(s.toolState.picks).toEqual([]);
  expect(s.history.past).toHaveLength(1);
  return { s, name: added[0] ?? '?' };
}

describe('the Centers group: click A, B, C', () => {
  for (const [tool, conventional, def, [x, y]] of CENTERS)
    it(`${tool}: ${conventional} = ${def}`, () => {
      const { s, name } = pickABC(tool);
      expect(name).toBe(conventional);
      expect(defText(s, name)).toBe(def);
      const [px, py] = xyOf(s, name);
      expect(px).toBeCloseTo(x, 12);
      expect(py).toBeCloseTo(y, 12);
      expect(toolGroup(tool)).toBe('centers');
    });
});

describe('the triangle circles: click A, B, C', () => {
  for (const [tool, conventional, def, [x, y], r] of CIRCLES)
    it(`${tool}: ${conventional} = ${def}`, () => {
      const { s, name } = pickABC(tool);
      expect(name).toBe(conventional);
      expect(defText(s, name)).toBe(def);
      const v = valueOf(s, name);
      if (v.kind !== 'circle') throw new Error(`${name} is a ${v.kind}`);
      expect(v.c.x).toBeCloseTo(x, 12);
      expect(v.c.y).toBeCloseTo(y, 12);
      expect(Math.sqrt(v.r2)).toBeCloseTo(r, 12);
      expect(toolGroup(tool)).toBe('circles');
    });
});

describe('conventional names fall back to the usual rule when taken', () => {
  it('a taken name (by an object, a claim or a layer) gives the next free name', () => {
    expect(pickABC('circumcenter', `${FIG}\nO = (9, 9)`).name).toBe('D');
    expect(pickABC('centroid', `${FIG}\nclaim collinear(A, B, C) [name=G]`).name).toBe('D');
    expect(pickABC('incircle', `${FIG}\nω = circle(A, 1)`).name).toBe('c');
    expect(pickABC('circumcircle', `${FIG}\n@layer ω`).name).toBe('c');
  });

  it('the excenter is named by the vertex picked first: I_b opposite B, I_c opposite C', () => {
    const opposite = (first: readonly [number, number]) => {
      let s = useTool(editorOf(FIG), 'excenter');
      const all = [
        [0, 0],
        [4, 0],
        [1, 3],
      ] as const;
      const rest = all.filter(([x, y]) => x !== first[0] || y !== first[1]);
      for (const [x, y] of [first, ...rest]) s = input(s, click(s, x, y));
      return addedNames(editorOf(FIG), s);
    };
    expect(opposite([4, 0])).toEqual(['I_b']);
    expect(opposite([1, 3])).toEqual(['I_c']);
    const s = pickABC('excenter', `${FIG}\nI_a = (9, 9)`);
    expect(s.name).toBe('D');
  });

  it('a first vertex without a one-letter name asks for no conventional name', () => {
    const fig = ['A_1 = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n');
    let s = useTool(editorOf(fig), 'excenter');
    for (const [x, y] of [
      [0, 0],
      [4, 0],
      [1, 3],
    ] as const)
      s = input(s, click(s, x, y));
    expect(addedNames(editorOf(fig), s)).toEqual(['A']);
    expect(defText(s, 'A')).toBe('excenter(A_1, B, C)');
  });
});

describe('center tools from an empty figure, by key', () => {
  it('the key selects the tool; clicks in empty space create A, B, C, then the center', () => {
    const key = toolUI('circumcenter')?.key ?? '';
    expect(keyAction({ key, ctrl: false, shift: false, alt: false })).toEqual({
      kind: 'tool',
      tool: 'circumcenter',
    });
    expect(keyAction({ key: 'N', ctrl: false, shift: true, alt: false })).toEqual({
      kind: 'tool',
      tool: 'ninepoint_circle',
    });
    let s = useTool(editorOf(''), 'circumcenter');
    for (const [x, y] of [
      [-2, 0],
      [2, 0],
      [0, 3],
    ] as const)
      s = input(s, click(s, x, y));
    expect(print(s.doc)).toContain('O = circumcenter(A, B, C)');
    const [, oy] = xyOf(s, 'O');
    expect(oy).toBeCloseTo(5 / 6, 3);
  });

  it('a degenerate pick (three collinear points) gives an undefined circle, not garbage', () => {
    let s = useTool(editorOf(`${FIG}\nE = (8, 0)`), 'incircle');
    for (const [x, y] of [
      [0, 0],
      [4, 0],
      [8, 0],
    ] as const)
      s = input(s, click(s, x, y));
    const v = valueOf(s, 'ω');
    expect(v.kind).toBe('undefined');
  });
});
