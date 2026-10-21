/** Helpers of the editor tests: editors on parsed figures, clicks through the real scene. */
import { createRegistry } from '@geomira/kernel/registry';
import type { Document } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import type { Value } from '@geomira/kernel/value';
import { checkInvariants } from '@geomira/kernel/invariants';
import { syncProblems } from '@geomira/kernel/derived';
import { formatExpr } from '@geomira/kernel/selector';
import { parse } from '@geomira/lang/parse';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { hitTest, type HitResult } from '@geomira/scene/hit';
import { toScreen, type View } from '@geomira/scene/viewport';
import { expect } from 'vitest';
import { applyEdit, type Edit } from '../../src/edit';
import { toolInput, type ToolInput } from '../../src/machine';
import type { EditResult } from '../../src/result';
import { createEditor, type EditorEnv, type EditorState } from '../../src/state';

export const registry = createRegistry();
export const env: EditorEnv = { registry };

export function docOf(text: string): Document {
  const r = parse(text.includes('@version') ? text : `@version 1\n${text}`, registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) throw new Error(errors.map((d) => d.message).join('\n'));
  return r.doc;
}

export function editorOf(text: string): EditorState {
  return createEditor(docOf(text), env);
}

/** The state after an edit that must succeed. */
export function ok(r: EditResult): EditorState {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  expect(checkInvariants(r.state.doc)).toEqual([]);
  expect(syncProblems(r.state.doc, registry)).toEqual([]);
  return r.state;
}

export function edit(s: EditorState, e: Edit): EditorState {
  return ok(applyEdit(s, e, env));
}

export function idOf(s: EditorState, name: string): number {
  const o = s.doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(`no object ${name}`);
  return o.id;
}

export function valueOf(s: EditorState, name: string): Value<number> {
  const v = s.values.values.get(idOf(s, name));
  if (v === undefined) throw new Error(`no value of ${name}`);
  return v;
}

export function xyOf(s: EditorState, name: string): [number, number] {
  const v = valueOf(s, name);
  if (v.kind !== 'point') throw new Error(`${name} is a ${v.kind}`);
  return [v.x, v.y];
}

/** A definition as text, with names. */
export function defText(s: EditorState, name: string): string {
  const o = s.doc.objects.find((x) => x.name === name);
  if (o === undefined) throw new Error(`no object ${name}`);
  return show(s, o.def);
}

export function show(s: EditorState, e: Expr): string {
  return formatExpr(e, (id) => s.doc.objects.find((o) => o.id === id)?.name);
}

export const SIZE = { width: 800, height: 600 };

export function viewOf(s: EditorState): View {
  return { viewport: s.viewport, size: SIZE };
}

/** What a click at world (x, y) hits, through the scene the canvas draws. */
export function hitAt(s: EditorState, x: number, y: number): HitResult {
  const d = layout(buildScene(s.doc, s.values.values), viewOf(s));
  return hitTest(d, toScreen(viewOf(s), { x, y }));
}

export function click(s: EditorState, x: number, y: number): ToolInput {
  return { kind: 'click', hit: hitAt(s, x, y), world: { x, y } };
}

/** The state after a tool input that must succeed. */
export function input(s: EditorState, i: ToolInput): EditorState {
  return ok(toolInput(s, i, env));
}

export function useTool(
  s: EditorState,
  tool: EditorState['tool'],
  claimKind?: string,
): EditorState {
  return edit(
    s,
    claimKind === undefined ? { kind: 'tool', tool } : { kind: 'tool', tool, claimKind },
  );
}

/** The names of the objects added between two states. */
export function addedNames(a: EditorState, b: EditorState): string[] {
  const before = new Set(a.doc.objects.map((o) => o.id));
  return b.doc.objects.filter((o) => !before.has(o.id)).map((o) => o.name);
}
