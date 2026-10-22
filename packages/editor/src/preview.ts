/**
 * The live preview of the active tool (Geomdraw's rubber band, ADR-0024): what the tool
 * would build if its last pick were the point under the cursor (an existing point, else the
 * cursor's position, snapped to a curve or an intersection as a click would be). Computed
 * with the kernel's own tool code over the current values; never an edit and never part of
 * the document. A tool previews when one point is all it still needs: the lines, circles,
 * centers and measures after their other picks, a perpendicular once its line is picked,
 * both tangents once the circle is picked, a polygon's next vertex.
 */
import { emptyDocument, MAIN_LAYER_ID, type DocObject } from '@geomira/kernel/document';
import { lit, type Expr } from '@geomira/kernel/expr';
import type { Selector } from '@geomira/kernel/expr';
import type { Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { fromInteger, parseRational, toNumber } from '@geomira/num/rational';
import { buildScene } from '@geomira/scene/build';
import type { HitResult } from '@geomira/scene/hit';
import type { Scene } from '@geomira/scene/types';
import type { EditorEnv, EditorState } from './state';
import { openSteps, stepsOf } from './tool-steps';
import { toolUI, type ToolUI } from './tools';

type V = Value<number>;

/** The point a click at the cursor would pick or make, as a value. */
function cursorValue(state: EditorState, hit: HitResult, world: Vec<number>): V {
  const p = hit.hits.find((h) => h.kind === 'point');
  const v = p === undefined ? undefined : state.values.values.get(p.id);
  if (v?.kind === 'point') return v;
  const at = hit.virtual.kind === 'none' ? world : hit.virtual.world;
  return { kind: 'point', x: at.x, y: at.y };
}

function compute(
  env: EditorEnv,
  state: EditorState,
  tool: string,
  args: readonly V[],
  s?: Selector,
) {
  const r = env.registry.resolve(tool, args);
  if (!r.ok) return undefined;
  const sel = s === undefined ? [] : [{ selector: s, args: [], text: '' }];
  return r.tool.compute(FloatField, args, state.values.ctx, sel);
}

/** The values the tool would build with `cursor` filling its open point step, or none. */
function previewValues(state: EditorState, tool: ToolUI, cursor: V, env: EditorEnv): V[] {
  const ts = state.toolState;
  const { steps, rest } = stepsOf(tool, ts);
  const open = openSteps(tool, ts);
  const [step] = open;
  const completes = ts.picks.length + 1 >= steps.length;
  if (open.length !== 1 || step?.step.pick !== 'point' || !completes) return [];
  const picked = ts.picks.map((id, i) => ({
    v: state.values.values.get(id),
    slot: ts.slots[i] ?? i,
  }));
  const all = [...picked, { v: cursor, slot: step.index }].sort((a, b) => a.slot - b.slot);
  const args = all.map((p) => p.v).filter((v): v is V => v !== undefined);
  if (args.length !== all.length) return [];
  const b = tool.build;
  if (b.kind === 'tangent') {
    const both = [1, -1] as const;
    return both.flatMap(
      (sign) => compute(env, state, 'tangent_from', args, { kind: 'orient', sign }) ?? [],
    );
  }
  if (b.kind !== 'call' || (rest !== undefined && args.length < steps.length)) return [];
  // The typed number of rotate, homothety, a radius (none, or not a number: no preview).
  const value =
    tool.value === undefined ? undefined : parseRational(ts.value.trim().replace(/°$/u, ''));
  if (value !== undefined && !value.ok) return [];
  const extra: V[] = value === undefined ? [] : [{ kind: 'number', v: toNumber(value.value) }];
  const v = compute(env, state, b.tool, [...args, ...extra]);
  return v === undefined ? [] : [v];
}

/** The definition of a preview object (unused: its value is given). */
const PLACEHOLDER: Expr = lit(fromInteger(0));

/**
 * The preview as a scene of its own (world primitives, no labels), for the canvas to draw
 * over the figure; null when the tool previews nothing here.
 */
export function toolPreview(
  state: EditorState,
  hit: HitResult,
  world: Vec<number>,
  env: EditorEnv,
): Scene | null {
  const tool = toolUI(state.tool);
  if (tool === undefined || state.drag !== null) return null;
  const values = previewValues(state, tool, cursorValue(state, hit, world), env);
  const drawn = values.filter((v) => ['point', 'line', 'circle', 'polygon'].includes(v.kind));
  if (drawn.length === 0) return null;
  const objects: DocObject[] = drawn.map((_, i) => ({
    id: i + 1,
    name: `preview${String(i)}`,
    def: PLACEHOLDER,
    style: { label: '' },
    layers: [MAIN_LAYER_ID],
  }));
  const doc = { ...emptyDocument(), objects, nextId: objects.length + 1 };
  return buildScene(doc, new Map(drawn.map((v, i) => [i + 1, v])));
}
