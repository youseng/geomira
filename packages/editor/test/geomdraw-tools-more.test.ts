/**
 * ADR-0024: the new GUI tools over existing kernel tools build the call the language would
 * write; rotate, homothety and the circle with a radius read the number typed in the tool's
 * field; the keys follow Geomdraw's.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { keyAction } from '../src/keymap';
import { toolInput, type ToolInput } from '../src/machine';
import { toolGroup } from '../src/tool-groups';
import type { ToolId } from '../src/tool-state';
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
  valueOf,
  xyOf,
} from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)', 'l = line(A, B)', 'c = circle(A, C)'].join(
  '\n',
);

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((t, i) => input(t, i), s);
}

function refusedWith(s: EditorState, i: ToolInput, reason: RegExp): void {
  const r = toolInput(s, i, env);
  expect(r.ok).toBe(false);
  expect(r.state).toBe(s);
  if (!r.ok) expect(r.reason).toMatch(reason);
}

describe('the new tools over kernel tools build what the language writes', () => {
  const cases: [ToolId, ToolInput[] | [number, number][], string, string?][] = [
    [
      'ext_bisector',
      [
        [4, 0],
        [0, 0],
        [1, 3],
      ],
      'ext_bisector(B, A, C)',
    ],
    [
      'diameter_circle',
      [
        [0, 0],
        [4, 0],
      ],
      'diameter_circle(A, B)',
    ],
    [
      'translate',
      [
        [1, 3],
        [0, 0],
        [4, 0],
      ],
      'translate(C, A, B)',
    ],
    [
      'measure_ratio',
      [
        [0, 0],
        [4, 0],
        [0, 0],
        [1, 3],
      ],
      'ratio(A, B, A, C)',
    ],
    [
      'measure_area',
      [
        [0, 0],
        [4, 0],
        [1, 3],
      ],
      'area(A, B, C)',
    ],
  ];
  for (const [tool, clicks, def] of cases)
    it(`${tool}: ${def}`, () => {
      let s = useTool(editorOf(FIG), tool);
      for (const c of clicks) s = input(s, Array.isArray(c) ? click(s, c[0], c[1]) : c);
      const added = addedNames(editorOf(FIG), s);
      expect(added).toHaveLength(1);
      expect(defText(s, added[0] ?? '?')).toBe(def);
    });

  it('ratio reuses a picked point (A twice) without refusing it', () => {
    let s = useTool(editorOf(FIG), 'measure_ratio');
    for (const [x, y] of [
      [0, 0],
      [4, 0],
      [0, 0],
      [1, 3],
    ] as const)
      s = input(s, click(s, x, y));
    const v = valueOf(s, 'k');
    expect(v.kind === 'number' && v.v).toBeCloseTo(4 / Math.sqrt(10), 12);
  });

  it('second intersection: two curves and the known point, in any order: other(c, m, C)', () => {
    const fig = `${FIG}\nm = line(C, B)`;
    for (const first of ['point', 'curves'] as const) {
      let s = useTool(editorOf(fig), 'second_intersection');
      const [c, m] = [idOf(s, 'c'), idOf(s, 'm')];
      s =
        first === 'point'
          ? run(s, click(s, 1, 3), { kind: 'object', id: c }, { kind: 'object', id: m })
          : run(s, { kind: 'object', id: c }, { kind: 'object', id: m }, click(s, 1, 3));
      expect(defText(s, 'D')).toBe('other(c, m, C)');
      const [x, y] = xyOf(s, 'D');
      expect(x * x + y * y).toBeCloseTo(10, 9);
    }
  });

  it('radical axis of two circles; circle with a typed radius', () => {
    const fig = `${FIG}\nd = circle(B, C)`;
    let s = useTool(editorOf(fig), 'radical_axis');
    s = run(s, { kind: 'object', id: idOf(s, 'c') }, { kind: 'object', id: idOf(s, 'd') });
    expect(defText(s, 'l_1')).toBe('radical_axis(c, d)');
    let t = useTool(editorOf(FIG), 'circle_radius');
    expect(t.toolState.value).toBe('1');
    t = run(t, click(t, 4, 0));
    expect(defText(t, 'c_1')).toBe('circle(B, 1)');
  });
});

describe('tools with a typed number: rotate, homothety, circle (center, radius)', () => {
  function withValue(tool: ToolId, value: string): EditorState {
    const s = useTool(editorOf(FIG), tool);
    const r = applyEdit(s, { kind: 'toolValue', value }, env);
    if (!r.ok) throw new Error(r.reason);
    return r.state;
  }

  it('rotate C about A by 90: rotate(C, A, 90) at (-3, 1), exact', () => {
    let s = useTool(editorOf(FIG), 'rotate');
    expect(s.toolState.value).toBe('60');
    s = withValue('rotate', '90');
    s = run(s, click(s, 1, 3), click(s, 0, 0));
    expect(defText(s, 'D')).toBe('rotate(C, A, 90)');
    expect(xyOf(s, 'D')).toEqual([-3, 1]);
    expect(print(s.doc)).toContain('D = rotate(C, A, 90)');
  });

  it('homothety of a line by -1/2 keeps the typed fraction; the image is a line', () => {
    let s = withValue('homothety', '-1/2');
    s = run(s, { kind: 'object', id: idOf(s, 'c') }, click(s, 4, 0));
    expect(defText(s, 'c_1')).toBe('homothety(c, B, -1/2)');
    let t = withValue('rotate', '45°');
    t = run(t, click(t, 1, 3), click(t, 0, 0));
    expect(defText(t, 'D')).toBe('rotate(C, A, 45)');
  });

  it('a value that is not an exact number is refused at the last pick, with the picks kept', () => {
    let s = withValue('homothety', 'two');
    s = input(s, click(s, 1, 3));
    refusedWith(s, click(s, 0, 0), /Ratio k: "two" is not an exact number/u);
    expect(s.toolState.picks).toEqual([idOf(s, 'C')]);
  });

  it('the value survives a build and a cancel; a tool without a number refuses one', () => {
    let s = withValue('rotate', '30');
    s = run(s, click(s, 1, 3), click(s, 0, 0), { kind: 'cancel' });
    expect(s.toolState.value).toBe('30');
    const t = useTool(editorOf(FIG), 'line');
    const r = applyEdit(t, { kind: 'toolValue', value: '2' }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('the active tool takes no number');
  });

  it('typing the value keeps the picks made so far', () => {
    let s = useTool(editorOf(FIG), 'rotate');
    s = input(s, click(s, 1, 3));
    const r = applyEdit(s, { kind: 'toolValue', value: '120' }, env);
    expect(r.ok && r.state.toolState.picks).toEqual([idOf(s, 'C')]);
  });
});

describe('keys and groups after Geomdraw (ADR-0024)', () => {
  const key = (k: string) =>
    keyAction({ key: k, ctrl: false, shift: k !== k.toLowerCase(), alt: false });
  it('Geomdraw letters select the same tools', () => {
    const expected: [string, ToolId][] = [
      ['v', 'move'],
      ['p', 'point'],
      ['i', 'intersection'],
      ['e', 'second_intersection'],
      ['m', 'midpoint'],
      ['f', 'foot'],
      ['l', 'line'],
      ['s', 'segment'],
      ['h', 'parallel'],
      ['j', 'perpendicular'],
      ['b', 'perp_bisector'],
      ['n', 'bisector'],
      ['t', 'tangent'],
      ['c', 'circle'],
      ['k', 'circle3'],
      ['d', 'diameter_circle'],
      ['x', 'reflect'],
      ['r', 'rotate'],
      ['z', 'homothety'],
      ['a', 'measure_angle'],
      ['q', 'measure_distance'],
    ];
    for (const [k, tool] of expected) expect(key(k), k).toEqual({ kind: 'tool', tool });
  });

  it('the new tools sit in the existing groups', () => {
    const groups: [ToolId, string][] = [
      ['second_intersection', 'points'],
      ['ext_bisector', 'lines'],
      ['polar', 'lines'],
      ['radical_axis', 'lines'],
      ['circle_radius', 'circles'],
      ['diameter_circle', 'circles'],
      ['rotate', 'transform'],
      ['translate', 'transform'],
      ['homothety', 'transform'],
      ['spiral', 'transform'],
      ['measure_ratio', 'measure'],
      ['measure_area', 'measure'],
      ['measure_power', 'measure'],
    ];
    for (const [tool, g] of groups) expect(toolGroup(tool), tool).toBe(g);
  });
});
