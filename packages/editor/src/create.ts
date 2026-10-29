/**
 * The point a click creates where no point is (SPEC §12, the scene's virtual hits): a free
 * point at the cursor, a glider on the curve under it, or the intersection under it (with
 * the GUI selector choice of choice.ts when the curves can meet twice). Coordinates and
 * glider parameters are rounded as at drag end (rounding.ts), so a new point sits within
 * ROUNDING_PX of the click and its definition prints as short decimals.
 */
import { evalContextFor } from '@geomira/kernel/context';
import type { DocObject } from '@geomira/kernel/document';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { dragParameter, type GliderParameter } from '@geomira/kernel/glider';
import type { Vec } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { isInexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import type { VirtualHit } from '@geomira/scene/hit';
import { chooseSelectors } from './choice';
import { roundedDefinition } from './drag';
import { decimalText, gridExponent, roundTo } from './rounding';
import type { EditorEnv, EditorState } from './state';

/** The drag-end grid exponent of the editor's figure at its zoom. */
export function gridOf(state: EditorState): number {
  const c = evalContextFor(state.doc);
  return gridExponent(c.ok ? c.ctx.scale : 1, state.viewport.zoom);
}

/** point(x, y) on the grid 10^e, printed as decimals. */
export function freePoint(at: Vec<number>, e: number): Expr {
  const [x, y] = [roundTo(fromNumber(at.x), e), roundTo(fromNumber(at.y), e)];
  return call('point', [lit(x, decimalText(x, e)), lit(y, decimalText(y, e))]);
}

function paramExprs(p: GliderParameter<number>): Expr[] {
  const q = (x: number) => lit(fromNumber(x));
  return p.form === 'line' ? [q(p.t)] : p.form === 'stereo' ? [q(p.u), q(p.v)] : [q(p.degrees)];
}

/** on(curve, …) at the point of the curve nearest to `at`, parameters rounded. */
export function gliderAt(state: EditorState, curve: number, at: Vec<number>): Expr | string {
  const c = state.values.values.get(curve);
  if (c?.kind !== 'line' && c?.kind !== 'circle' && c?.kind !== 'conic')
    return 'there is no curve there';
  // A conic glider is on(k, u, v) from its known point (ADR-0042): none, no glider.
  if (c.kind === 'conic' && c.anchor === undefined)
    return 'the conic has no known point to glide from';
  const form = c.kind === 'line' ? 'line' : c.anchor === undefined ? 'angle' : 'stereo';
  const p = dragParameter(FloatField, c, at, form, state.values.ctx);
  if (isInexact(p) || 'kind' in p) return p.reason;
  const def = call('on', [ref(curve), ...paramExprs(p)]);
  const tmp: DocObject = {
    id: state.doc.nextId,
    name: 'new',
    def,
    style: {},
    layers: [state.activeLayer],
  };
  return roundedDefinition(state.doc, tmp, gridOf(state), state.values);
}

/** intersect(a, b, …): selectors only when the pair can meet twice (the GUI choice). */
export function intersectionAt(
  state: EditorState,
  a: number,
  b: number,
  at: Vec<number>,
  env: EditorEnv,
): Expr | string {
  const [va, vb] = [state.values.values.get(a), state.values.values.get(b)];
  if (va === undefined || vb === undefined) return 'the curves are gone';
  const r = env.registry.resolve('intersect', [va, vb]);
  if (!r.ok) return r.reason;
  if (r.signature.branch === undefined || r.signature.branch.candidates === 1)
    return call('intersect', [ref(a), ref(b)]);
  const ch = chooseSelectors(state.doc, state.values, env.registry, 'intersect', [a, b], at);
  return ch.ok ? call('intersect', [ref(a), ref(b)], ch.selectors) : ch.reason;
}

/** The definition of the point a click at a virtual hit creates, or why there is none. */
export function createdPoint(state: EditorState, v: VirtualHit, env: EditorEnv): Expr | string {
  switch (v.kind) {
    case 'free':
      return freePoint(v.world, gridOf(state));
    case 'on':
      return gliderAt(state, v.curve, v.world);
    case 'intersection':
      return intersectionAt(state, v.a, v.b, v.world, env);
    case 'none':
      return 'there is nothing to create here: pick the point under the cursor';
    default:
      return assertNever(v, 'virtual hit');
  }
}
