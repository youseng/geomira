/**
 * The Centers group and the triangle circles as GUI tools (ADR-0016 decision 21): one
 * scenario per tool, driven by clicks through the real scene as Run 8a's tool tests are.
 * Each picks A, B, C and builds the kernel call the language would write; the value is the
 * centre or circle of the triangle, checked against its coordinates.
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
/** The incentre and the excentre opposite A, by their barycentric weights. */
const I = [(4 * b + c) / (a + b + c), (3 * c) / (a + b + c)] as const;
const J = [(4 * b + c) / (-a + b + c), (3 * c) / (-a + b + c)] as const;

const CENTRES: readonly [ToolId, string, readonly [number, number]][] = [
  ['centroid', 'centroid(A, B, C)', [5 / 3, 1]],
  ['circumcenter', 'circumcenter(A, B, C)', [2, 1]],
  ['incenter', 'incenter(A, B, C)', I],
  ['orthocenter', 'orthocenter(A, B, C)', [1, 1]],
  ['ninepoint_center', 'ninepoint_center(A, B, C)', [1.5, 1]],
  ['excenter', 'excenter(A, B, C)', J],
];

/** Centre and radius of each circle of the triangle. */
const CIRCLES: readonly [ToolId, string, readonly [number, number], number][] = [
  ['circumcircle', 'circumcircle(A, B, C)', [2, 1], Math.sqrt(5)],
  ['incircle', 'incircle(A, B, C)', I, AREA2 / (a + b + c)],
  ['excircle', 'excircle(A, B, C)', J, AREA2 / (-a + b + c)],
  ['ninepoint_circle', 'ninepoint_circle(A, B, C)', [1.5, 1], Math.sqrt(5) / 2],
];

function pickABC(tool: ToolId) {
  let s = useTool(editorOf(FIG), tool);
  for (const [x, y] of [
    [0, 0],
    [4, 0],
    [1, 3],
  ] as const)
    s = input(s, click(s, x, y));
  const added = addedNames(editorOf(FIG), s);
  expect(added).toHaveLength(1);
  expect(s.toolState.picks).toEqual([]);
  expect(s.history.past).toHaveLength(1);
  return { s, name: added[0] ?? '?' };
}

describe('the Centers group: click A, B, C', () => {
  for (const [tool, def, [x, y]] of CENTRES)
    it(`${tool}: ${def}`, () => {
      const { s, name } = pickABC(tool);
      expect(name).toBe('D');
      expect(defText(s, name)).toBe(def);
      const [px, py] = xyOf(s, name);
      expect(px).toBeCloseTo(x, 12);
      expect(py).toBeCloseTo(y, 12);
      expect(toolGroup(tool)).toBe('centers');
    });
});

describe('the triangle circles: click A, B, C', () => {
  for (const [tool, def, [x, y], r] of CIRCLES)
    it(`${tool}: ${def}`, () => {
      const { s, name } = pickABC(tool);
      expect(name).toBe('c');
      expect(defText(s, name)).toBe(def);
      const v = valueOf(s, name);
      if (v.kind !== 'circle') throw new Error(`${name} is a ${v.kind}`);
      expect(v.c.x).toBeCloseTo(x, 12);
      expect(v.c.y).toBeCloseTo(y, 12);
      expect(Math.sqrt(v.r2)).toBeCloseTo(r, 12);
      expect(toolGroup(tool)).toBe('circles');
    });
});

describe('centre tools from an empty figure, by key', () => {
  it('the key selects the tool; clicks in empty space create A, B, C, then the centre', () => {
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
    expect(print(s.doc)).toContain('D = circumcenter(A, B, C)');
    const [, oy] = xyOf(s, 'D');
    expect(oy).toBeCloseTo(5 / 6, 3);
  });

  it('a degenerate pick (three collinear points) gives an undefined centre, not garbage', () => {
    let s = useTool(editorOf(`${FIG}\nE = (8, 0)`), 'incircle');
    for (const [x, y] of [
      [0, 0],
      [4, 0],
      [8, 0],
    ] as const)
      s = input(s, click(s, x, y));
    const v = valueOf(s, 'c');
    expect(v.kind).toBe('undefined');
  });
});
