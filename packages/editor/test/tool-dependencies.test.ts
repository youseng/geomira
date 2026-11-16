/** Release prompt 06: construction identities and GUI input consumption. */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { chooseTool } from '../src/selection-tool';
import { toolInput } from '../src/machine';
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

function picks(state: EditorState, ...names: string[]) {
  return names.reduce((s, name) => input(s, { kind: 'object', id: idOf(s, name) }), state);
}
function selected(state: EditorState, ...names: string[]) {
  return edit(state, { kind: 'select', ids: names.map((n) => idOf(state, n)), mode: 'replace' });
}
function drag(state: EditorState, name: string, x: number, y: number) {
  return edit(
    edit(edit(state, { kind: 'dragStart', id: idOf(state, name) }), {
      kind: 'dragMove',
      to: { x, y },
    }),
    { kind: 'dragEnd' },
  );
}
function tangentDistance(s: EditorState, name: string, circle: string) {
  const [l, c] = [valueOf(s, name), valueOf(s, circle)];
  if (l.kind !== 'line' || c.kind !== 'circle') throw new Error('line/circle missing');
  return (
    Math.abs(l.d.x * (c.c.y - l.p.y) - l.d.y * (c.c.x - l.p.x)) / Math.hypot(l.d.x, l.d.y) -
    Math.sqrt(c.r2)
  );
}
const CIRCLES = 'O=(0,0)\nB=(3,0)\nc=circle(O,2)\nd=circle(B,2)';
const POINTS = 'A=(0,0)\nB=(4,0)\nC=(1,3)\nD=(1,0)\nl=line(A,B)';
const CONIC = 'k=conic((2,0),(0,1),(-2,0),(0,-1),(6/5,4/5))\nl=line((0,0),(1,0))\nt=reflect(l)';

describe('dependent branches are distinct from independent coincident objects', () => {
  it('builds common tangents depending on both circles, and preserves them after moving B', () => {
    const base = editorOf(`${CIRCLES}\na=line((-2,2),(5,2))\nb=line((-2,-2),(5,-2))`);
    let s = picks(useTool(base, 'tangent'), 'c', 'd');
    const names = addedNames(base, s);
    expect(names).toHaveLength(2);
    expect(s.history.past).toHaveLength(1);
    for (const name of names) expect(defText(s, name)).toMatch(/^tangent\(c, d,/u);
    s = drag(s, 'B', 3, 1);
    for (const name of names)
      for (const c of ['c', 'd']) expect(Math.abs(tangentDistance(s, name, c))).toBeLessThan(1e-9);
    expect(Math.abs(tangentDistance(s, 'a', 'd'))).toBeCloseTo(1);
    expect(Math.abs(tangentDistance(s, 'b', 'd'))).toBeCloseTo(1);
    const repeated = picks(useTool(s, 'tangent'), 'c');
    const result = toolInput(repeated, { kind: 'object', id: idOf(s, 'd') }, env);
    expect(result.ok).toBe(false);
    expect(result.state.doc).toBe(s.doc);
  });

  it('does not use saved claim statements as construction identity facts', () => {
    const base = editorOf(
      `${CIRCLES}\na=line((-2,2),(5,2))\n` +
        'b=line((-2,-2),(5,-2))\nclaim tangent(a,c)\nclaim tangent(a,d)',
    );
    const built = picks(useTool(base, 'tangent'), 'c', 'd');
    expect(addedNames(base, built)).toHaveLength(2);
    expect(built.doc.claims).toEqual(base.doc.claims);
  });

  it('builds dependent intersections without changing free coincident P and Q', () => {
    const base = editorOf(
      'O=(0,0)\nA=(-2,0)\nB=(2,0)\nc=circle(O,1)\nl=line(A,B)\nP=(-1,0)\nQ=(1,0)',
    );
    let s = picks(useTool(base, 'intersection'), 'c', 'l');
    const names = addedNames(base, s);
    expect(names).toHaveLength(2);
    expect(s.history.past).toHaveLength(1);
    for (const name of names) expect(defText(s, name)).toMatch(/^intersect\(c, l,/u);
    s = drag(s, 'O', 0, 0.5);
    for (const name of names) {
      const p = valueOf(s, name);
      expect(p.kind).toBe('point');
      if (p.kind !== 'point') throw new Error('missing intersection');
      expect(p.y).toBeCloseTo(0, 9);
      expect(p.x ** 2 + (p.y - 0.5) ** 2).toBeCloseTo(1, 9);
    }
    expect(valueOf(s, 'P')).toMatchObject({ kind: 'point', x: -1, y: 0 });
    expect(valueOf(s, 'Q')).toMatchObject({ kind: 'point', x: 1, y: 0 });
    expect(print(edit(edit(s, { kind: 'undo' }), { kind: 'undo' }).doc)).toBe(print(base.doc));
  });
});

describe('selection consumes semantic inputs exactly as sequential picking', () => {
  for (const [kind, names] of [
    ['perpendicular', ['A', 'B', 'C', 'D']],
    ['parallel', ['l', 'C', 'D']],
    ['concurrent', ['l', 'C', 'D', 'A', 'B']],
  ] as const) {
    it(`${kind} accepts line-or-two-points selections`, () => {
      const base = editorOf(POINTS);
      const configured = useTool(useTool(base, 'claim', kind), 'move');
      const sequential = picks(useTool(configured, 'claim'), ...names);
      const expected = kind === 'concurrent' ? input(sequential, { kind: 'finish' }) : sequential;
      const result = chooseTool(selected(configured, ...names), 'claim', env);
      expect(result.ok).toBe(true);
      expect(result.state.doc.claims).toEqual(expected.doc.claims);
      expect(result.state.doc.claims).toHaveLength(1);
    });
  }
  it('keeps a partial point pair waiting, with no partial document change', () => {
    const base = useTool(useTool(editorOf(POINTS), 'claim', 'perpendicular'), 'move');
    const r = chooseTool(selected(base, 'A', 'B', 'C'), 'claim', env);
    expect(r.ok).toBe(true);
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.toolState.picks).toEqual(['A', 'B', 'C'].map((n) => idOf(base, n)));
    const complete = picks(r.state, 'D');
    expect(complete.doc.claims).toHaveLength(1);
  });
  it('refuses an extra object atomically rather than building a second construction', () => {
    const base = editorOf(POINTS);
    const r = chooseTool(selected(base, 'A', 'B', 'C'), 'midpoint', env);
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.history).toBe(base.history);
    if (!r.ok) throw new Error(r.reason);
    expect(r.notice).toContain('different number');
  });
  it('reports failed automatic polygon finish immediately and keeps recoverable picks', () => {
    const base = edit(editorOf(POINTS), {
      kind: 'updateLayer',
      id: 'main',
      patch: { locked: true },
    });
    const r = chooseTool(selected(base, 'A', 'B', 'C'), 'polygon', env);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.notice).toMatch(/locked/u);
    expect(r.state.doc).toBe(base.doc);
    expect(r.state.toolState.picks).toEqual(['A', 'B', 'C'].map((n) => idOf(base, n)));
  });
});

describe('Apply transformation has its own complete picker capabilities', () => {
  for (const order of [
    ['t', 'k'],
    ['k', 't'],
  ])
    it(`maps conics in order ${order.join(',')}`, () => {
      const base = editorOf(CONIC);
      const s = picks(useTool(base, 'apply_map'), ...order);
      const [name] = addedNames(base, s);
      expect(defText(s, name ?? '?')).toBe('apply(t, k)');
      expect(valueOf(s, name ?? '?').kind).toBe('conic');
      const oracle = editorOf(`${CONIC}\nx=apply(t,k)`);
      expect(valueOf(s, name ?? '?')).toEqual(valueOf(oracle, 'x'));
    });
  it('maps ideal points chosen in the Objects panel', () => {
    const base = editorOf(
      'a=line((0,0),(1,0))\nb=line((0,1),(1,1))\nX=intersect(a,b)\nt=reflect(a)',
    );
    const s = picks(useTool(base, 'apply_map'), 'X', 't');
    const [name] = addedNames(base, s);
    expect(valueOf(s, name ?? '?').kind).toBe('ideal_point');
  });
  for (const [definition, kind] of [
    ['X=(2,3)', 'point'],
    ['X=line((0,0),(2,1))', 'line'],
    ['X=circle((0,0),2)', 'circle'],
    ['X=polygon((0,0),(2,0),(0,1))', 'polygon'],
    ['X=mark_angle((2,0),(0,0),(0,2))', 'angle_mark'],
    ['X=mark_segment((0,0),(2,1))', 'segment_mark'],
    ['X=text((1,1),"mapped")', 'text'],
  ] as const)
    it(`maps supported ${kind} objects`, () => {
      const base = editorOf(`${definition}\nl=line((0,0),(1,0))\nt=reflect(l)`);
      const s = picks(useTool(base, 'apply_map'), 't', 'X');
      const [name] = addedNames(base, s);
      expect(valueOf(s, name ?? '?').kind).toBe(kind);
      expect(valueOf(s, name ?? '?')).toEqual(
        valueOf(
          editorOf(`${definition}\nl=line((0,0),(1,0))\nt=reflect(l)\nimage=apply(t,X)`),
          'image',
        ),
      );
    });
  it('does not admit conics to the reflect sugar that does not support them', () => {
    const s = useTool(editorOf(CONIC), 'reflect');
    const r = toolInput(s, { kind: 'object', id: idOf(s, 'k') }, env);
    expect(r.ok).toBe(false);
    expect(r.state.doc).toBe(s.doc);
  });
});
