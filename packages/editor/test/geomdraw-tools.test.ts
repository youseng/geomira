/**
 * ADR-0024: the GUI tools in the manner of the maintainer's Geomdraw. Tools whose picks
 * differ in kind take them in either order; the tangent tool from a point outside a circle
 * builds BOTH tangents, and the intersection tool every intersection that is not a point
 * yet, each in one history entry, each with the selectors of the GUI choice (SPEC §7).
 */
import { describe, expect, it } from 'vitest';
import { applyEdit } from '../src/edit';
import { toolInput, type ToolInput } from '../src/machine';
import type { ToolId } from '../src/tool-state';
import { toolUI } from '../src/tools';
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

/** The objects a tool built from `clicks` (world points) on FIG; picks are done. */
function built(tool: ToolId, clicks: readonly (readonly [number, number])[], fig = FIG) {
  let s = useTool(editorOf(fig), tool);
  for (const [x, y] of clicks) s = input(s, click(s, x, y));
  expect(s.toolState.picks).toEqual([]);
  return { s, added: addedNames(editorOf(fig), s) };
}

describe('order-free tools: the line or circle may be picked first', () => {
  const cases: [ToolId, [number, number], [number, number], string][] = [
    ['parallel', [1, 3], [-6, 0], 'parallel(C, l)'],
    ['perpendicular', [1, 3], [-6, 0], 'perp(C, l)'],
    ['foot', [1, 3], [-6, 0], 'foot(C, l)'],
    ['polar', [4, 0], [-Math.sqrt(10), 0.0001], 'polar(B, c)'],
    ['measure_power', [4, 0], [-Math.sqrt(10), 0.0001], 'power(B, c)'],
  ];
  for (const [tool, point, curve, def] of cases)
    it(`${tool}: point then curve, and curve then point, give ${def}`, () => {
      for (const order of [
        [point, curve],
        [curve, point],
      ]) {
        const { s, added } = built(tool, order);
        expect(added).toHaveLength(1);
        expect(s.history.past).toHaveLength(1);
        expect(defText(s, added[0] ?? '?')).toBe(def);
      }
    });

  it('the line first, then a click in empty space creates the point', () => {
    const { s, added } = built('perpendicular', [
      [-6, 0],
      [2, 2],
    ]);
    expect(added).toEqual(['D', 'l_1']);
    // The new point is its own edit, as every point a pick creates (ADR-0012 item 15).
    expect(s.history.past).toHaveLength(2);
    expect(defText(s, 'D')).toBe('point(2, 2)');
    expect(defText(s, 'l_1')).toBe('perp(D, l)');
  });

  it('the line first, then a click on that line puts the point on it (a glider)', () => {
    let s = useTool(editorOf(FIG), 'perpendicular');
    s = run(s, click(s, -6, 0), click(s, 2.5, 0));
    expect(defText(s, 'D')).toBe('on(l, 5/8)');
    expect(defText(s, 'l_1')).toBe('perp(D, l)');
  });

  it('panel picks are order-free too; a second line is refused while the point is open', () => {
    let s = useTool(editorOf(`${FIG}\nm = line(A, C)`), 'parallel');
    s = input(s, { kind: 'object', id: idOf(s, 'l') });
    refusedWith(s, { kind: 'object', id: idOf(s, 'm') }, /pick a point/u);
    s = input(s, { kind: 'object', id: idOf(s, 'C') });
    expect(defText(s, 'l_1')).toBe('parallel(C, l)');
  });

  it('the status of an order-free pick: its slots record the step each pick filled', () => {
    let s = useTool(editorOf(FIG), 'foot');
    s = input(s, click(s, -6, 0));
    expect(s.toolState.picks).toEqual([idOf(s, 'l')]);
    expect(s.toolState.slots).toEqual([1]);
    s = input(s, { kind: 'cancel' });
    expect(s.toolState.slots).toEqual([]);
  });

  it('a tool whose steps have one kind keeps its order (ray A→C differs from ray C→A)', () => {
    expect(toolUI('ray')?.anyOrder).toBeUndefined();
    const { s, added } = built('ray', [
      [1, 3],
      [0, 0],
    ]);
    expect(defText(s, added[0] ?? '?')).toBe('ray(C, A)');
  });
});

describe('the tangent tool from a point outside builds both tangents (ADR-0024)', () => {
  const fig = `${FIG}\nP = (6, 0)`;
  for (const order of ['point first', 'circle first'] as const)
    it(`${order}: two tangents in one history entry, each through P and touching c`, () => {
      let s = useTool(editorOf(fig), 'tangent');
      const p = click(s, 6, 0);
      const circle: ToolInput = { kind: 'object', id: idOf(s, 'c') };
      s = order === 'point first' ? run(s, p, circle) : run(s, circle, click(s, 6, 0));
      const added = addedNames(editorOf(fig), s);
      expect(added).toEqual(['l_1', 'l_2']);
      expect(s.history.past).toHaveLength(1);
      const r2 = 10;
      const ys: number[] = [];
      for (const name of added) {
        expect(defText(s, name)).toMatch(/^tangent_from\(P, c, .+\)$/u);
        const v = valueOf(s, name);
        if (v.kind !== 'line') throw new Error('not a line');
        // Through P: the cross product of d and P − p is 0.
        expect(Math.abs(v.d.x * (0 - v.p.y) - v.d.y * (6 - v.p.x))).toBeLessThan(1e-9);
        // Touching c: the touch point p is on c and d is perpendicular to p − O.
        expect(v.p.x * v.p.x + v.p.y * v.p.y).toBeCloseTo(r2, 9);
        expect(v.d.x * v.p.x + v.d.y * v.p.y).toBeCloseTo(0, 9);
        ys.push(v.p.y);
      }
      // The two tangents touch c on opposite sides of OP (the x-axis).
      expect(Math.sign(ys[0] ?? 0) * Math.sign(ys[1] ?? 0)).toBe(-1);
      // One undo removes both.
      const u = applyEdit(s, { kind: 'undo' }, env);
      expect(u.ok && u.state.doc.objects.map((o) => o.name)).toEqual(
        editorOf(fig).doc.objects.map((o) => o.name),
      );
    });

  it('a point on the circle still gives the one tangent there', () => {
    let s = useTool(editorOf(FIG), 'tangent');
    s = run(s, { kind: 'object', id: idOf(s, 'c') }, click(s, 1, 3));
    expect(addedNames(editorOf(FIG), s)).toEqual(['l_1']);
    expect(defText(s, 'l_1')).toBe('tangent(C, c)');
  });

  it('a point inside the circle is refused with the reason, and nothing is built', () => {
    let s = useTool(editorOf(`${FIG}\nP = (1, 1)`), 'tangent');
    s = input(s, click(s, 1, 1));
    refusedWith(s, { kind: 'object', id: idOf(s, 'c') }, /inside the circle: there is no tangent/u);
  });

  it('both tangents keep their sides when the figure moves (dragging P)', () => {
    let s = useTool(editorOf(`${FIG}\nP = (6, 0)`), 'tangent');
    s = run(s, click(s, 6, 0), { kind: 'object', id: idOf(s, 'c') });
    const side = (t: EditorState, name: string) => {
      const v = valueOf(t, name);
      return v.kind === 'line' ? Math.sign(v.p.y) : 0;
    };
    const before = [side(s, 'l_1'), side(s, 'l_2')];
    const id = idOf(s, 'P');
    let t = s;
    for (const e of [
      { kind: 'dragStart', id },
      { kind: 'dragMove', to: { x: 7, y: 0.5 } },
      { kind: 'dragEnd' },
    ] as const) {
      const r = applyEdit(t, e, env);
      if (!r.ok) throw new Error(r.reason);
      t = r.state;
    }
    expect([side(t, 'l_1'), side(t, 'l_2')]).toEqual(before);
  });
});

describe('the intersection tool builds every intersection that is not a point yet', () => {
  it('a line and a circle: both points, one history entry, distinct', () => {
    const fig = `${FIG}\nm = line((-4, 1), (4, 1))`;
    let s = useTool(editorOf(fig), 'intersection');
    s = run(s, { kind: 'object', id: idOf(s, 'm') }, { kind: 'object', id: idOf(s, 'c') });
    const added = addedNames(editorOf(fig), s);
    expect(added).toEqual(['D', 'E']);
    expect(s.history.past).toHaveLength(1);
    const [d, e] = [xyOf(s, 'D'), xyOf(s, 'E')];
    expect(Math.hypot(d[0] - e[0], d[1] - e[1])).toBeGreaterThan(1);
    for (const [x, y] of [d, e]) {
      expect(x * x + y * y).toBeCloseTo(10, 9);
      expect(y).toBeCloseTo(1, 9);
    }
    for (const n of added) expect(defText(s, n)).toMatch(/^intersect\(m, c, .+\)$/u);
  });

  it('a common point that exists already makes the new one other(P), exactly', () => {
    let s = useTool(editorOf(FIG), 'intersection');
    s = run(s, click(s, -6, 0), { kind: 'object', id: idOf(s, 'c') });
    // l meets c at (±√10, 0); A is the centre, not on c, so both are new …
    expect(addedNames(editorOf(FIG), s)).toHaveLength(2);
    // … but a circle through C and a line through C share C: only the other point is built.
    const fig = `${FIG}\nm = line(C, B)`;
    let t = useTool(editorOf(fig), 'intersection');
    t = run(t, { kind: 'object', id: idOf(t, 'm') }, { kind: 'object', id: idOf(t, 'c') });
    expect(addedNames(editorOf(fig), t)).toEqual(['D']);
    expect(defText(t, 'D')).toBe('intersect(m, c, other(C))');
  });

  it('two lines: the one point; curves that do not meet are refused', () => {
    let s = useTool(editorOf(`${FIG}\nm = line(A, C)`), 'intersection');
    s = run(s, { kind: 'object', id: idOf(s, 'l') }, { kind: 'object', id: idOf(s, 'm') });
    expect(defText(s, 'D')).toBe('intersect(l, m)');
    let t = useTool(editorOf(`${FIG}\nm = line((0, 5), (1, 5))`), 'intersection');
    t = input(t, { kind: 'object', id: idOf(t, 'm') });
    refusedWith(t, { kind: 'object', id: idOf(t, 'c') }, /do not meet/u);
  });

  it('when both intersections are points already, nothing is built', () => {
    const fig = `${FIG}\nD = intersect(l, c, along(+))\nE = intersect(l, c, along(-))`;
    let s = useTool(editorOf(fig), 'intersection');
    s = input(s, { kind: 'object', id: idOf(s, 'l') });
    refusedWith(s, { kind: 'object', id: idOf(s, 'c') }, /a point already/u);
  });
});
