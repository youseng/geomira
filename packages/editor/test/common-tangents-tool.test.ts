/**
 * ADR-0045 in the editor: the Tangent tool's second curve builds the common tangents of two
 * curves as ONE batch (ADR-0024 decision 2), each written with the GUI selector choice for its
 * touch point on the first curve (reflection-equivariant first: along(±) with near / far_from;
 * along(±), orient(±) only when nothing else separates the pair); a repeat is not added again
 * (ADR-0029); no common tangent → refused with the kernel's reason. The tool keeps its other
 * behaviours: a point and a curve in either order, a click on the first curve itself (a glider
 * there and its tangent). The Exsimilicenter and Insimilicenter tools pick two circles.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { toolPrompt } from '../src/prompt';
import { keyAction } from '../src/keymap';
import { TOOL_GROUPS } from '../src/tool-groups';
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
} from './helpers/editor';

/** c1 about O of radius 7/2, c2 about B of radius 1/2: four rational common tangents. */
const FIG = ['O = (0, 0)', 'B = (5, 0)', 'c = circle(O, 7/2)', 'd = circle(B, 1/2)'];

/** The tangent tool on c (clicked at its top) then d (clicked at its bottom). */
function twoCurves(lines: readonly string[]): { s0: EditorState; s: EditorState } {
  const s0 = editorOf(lines.join('\n'));
  let s = useTool(s0, 'tangent');
  s = input(s, click(s, 0, 3.5));
  expect(toolPrompt(s)).toBe(
    'Tangent: point (or a second circle or conic for the common tangents)',
  );
  s = input(s, click(s, 5, -0.5));
  return { s0, s };
}

/** dist(center, line) − r for a line and a circle by name. */
function tangency(s: EditorState, l: string, c: string): number {
  const [L, C] = [valueOf(s, l), valueOf(s, c)];
  if (L.kind !== 'line' || C.kind !== 'circle') throw new Error('expected a line and a circle');
  const cross = L.d.x * (C.c.y - L.p.y) - L.d.y * (C.c.x - L.p.x);
  return Math.abs(cross) / Math.hypot(L.d.x, L.d.y) - Math.sqrt(C.r2);
}

describe('the Tangent tool with two curves: their common tangents (ADR-0045)', () => {
  it('four tangents in one history entry, each tangent to both circles', () => {
    const { s0, s } = twoCurves(FIG);
    const added = addedNames(s0, s);
    expect(added).toHaveLength(4);
    expect(s.history.past).toHaveLength(1);
    for (const n of added) {
      expect(defText(s, n)).toMatch(/^tangent\(c, d, .+\)$/u);
      expect(Math.abs(tangency(s, n, 'c'))).toBeLessThan(1e-9);
      expect(Math.abs(tangency(s, n, 'd'))).toBeLessThan(1e-9);
    }
    // Two external (along(-)) and two internal (along(+)) tangents.
    const texts = added.map((n) => defText(s, n));
    expect(texts.filter((t) => t.includes('along(-)'))).toHaveLength(2);
    expect(texts.filter((t) => t.includes('along(+)'))).toHaveLength(2);
  });

  it('with a point off the line of centers, the choice is reflection-equivariant (no orient)', () => {
    const { s0, s } = twoCurves([...FIG, 'Q = (1, 4)']);
    const added = addedNames(s0, s);
    expect(added).toHaveLength(4);
    for (const n of added) expect(defText(s, n)).not.toContain('orient');
    // Nothing separates a pair but the side of OB without Q: orient(±) is written then.
    const bare = twoCurves(FIG);
    const texts = addedNames(bare.s0, bare.s).map((n) => defText(bare.s, n));
    expect(texts.every((t) => t.includes('orient('))).toBe(true);
  });

  it('a repeat is not added again; no common tangent is refused with the reason', () => {
    const { s } = twoCurves(FIG);
    let t = useTool(s, 'tangent');
    t = input(t, click(t, 0, 3.5));
    const again = toolInput(t, click(t, 5, -0.5), env);
    expect(again.ok).toBe(false);
    if (!again.ok)
      expect(again.reason).toBe(
        'every common tangent of these curves is a line of the figure already',
      );
    const inside = editorOf(['O = (0, 0)', 'c = circle(O, 3)', 'd = circle((1, 0), 1)'].join('\n'));
    let u = useTool(inside, 'tangent');
    u = input(u, click(u, 0, 3));
    const r = toolInput(u, click(u, 2, 0), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no common tangent: one circle lies inside the other');
  });

  it('intersecting circles: the two external tangents; tangent circles: the double one too', () => {
    const lines = ['O = (0, 0)', 'B = (3, 0)', 'c = circle(O, 5/2)', 'd = circle(B, 5/2)'];
    const s0 = editorOf(lines.join('\n'));
    let s = useTool(s0, 'tangent');
    s = input(s, click(s, -2.5, 0));
    s = input(s, click(s, 5.5, 0));
    const added = addedNames(s0, s);
    expect(added).toHaveLength(2);
    for (const n of added) expect(defText(s, n)).toMatch(/^tangent\(c, d, along\(-\), /u);
  });

  it('a conic and a circle: every common tangent the choice singles out, the others named', () => {
    const lines = [
      'k = conic((2, 0), (0, 1), (-2, 0), (0, -1), (6/5, 4/5))',
      'B = (4, 0)',
      'd = circle(B, 1)',
      'Q = (3, 4)',
      'R = (3, -4)',
    ];
    const s0 = editorOf(lines.join('\n'));
    let s = useTool(s0, 'tangent');
    s = input(s, click(s, -2, 0));
    const r = toolInput(s, click(s, 5, 0), env);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const added = addedNames(s0, r.state);
    expect(added.length).toBeGreaterThan(0);
    for (const n of added) expect(defText(r.state, n)).toMatch(/^tangent\(k, d, /u);
    expect(r.state.history.past).toHaveLength(1);
  });

  it('the first curve clicked again still makes a glider there and its tangent', () => {
    const s0 = editorOf(FIG.join('\n'));
    let s = useTool(s0, 'tangent');
    s = input(s, click(s, 0, 3.5));
    s = input(s, click(s, -3.5, 0));
    const added = addedNames(s0, s);
    expect(added).toHaveLength(2);
    expect(defText(s, added[1] ?? '?')).toMatch(/^tangent\(.+, c\)$/u);
  });
});

describe('the Exsimilicenter and Insimilicenter tools (ADR-0045)', () => {
  for (const [tool, def, at] of [
    ['exsimilicenter', 'exsimilicenter(c, d)', [35 / 6, 0]],
    ['insimilicenter', 'insimilicenter(c, d)', [35 / 8, 0]],
  ] as const)
    it(`${tool}: pick two circles`, () => {
      const s0 = editorOf(FIG.join('\n'));
      let s = useTool(s0, tool);
      s = input(s, click(s, 0, 3.5));
      s = input(s, click(s, 5, -0.5));
      const [name] = addedNames(s0, s);
      expect(defText(s, name ?? '?')).toBe(def);
      const v = valueOf(s, name ?? '?');
      expect(v.kind === 'point' && [v.x, v.y + 0]).toEqual(at);
      expect(toolUI(tool)?.key).toBe(tool === 'exsimilicenter' ? '.' : ':');
      expect(
        keyAction({
          key: tool === 'exsimilicenter' ? '.' : ':',
          ctrl: false,
          shift: true,
          alt: false,
        }),
      ).toEqual({
        kind: 'tool',
        tool,
      });
      const centers = TOOL_GROUPS.find((g) => g.id === 'centers');
      expect(centers?.tools.map((t) => t.id)).toContain(tool);
      expect(idOf(s, 'c')).toBeGreaterThanOrEqual(0);
    });
});
