/**
 * The common tangents of two curves, built by the Tangent tool when its second pick is a curve
 * too (ADR-0045, ToolUI.pair). As for both tangents from a point and every new intersection
 * (ADR-0024 decision 2), every common tangent that is not a line of the figure yet is built in
 * ONE batch, each written with the GUI selector choice for its touch point on the first curve
 * (choice.ts: tangent(c1, c2, …) is decided as tangent_point(c1, c2, …)); a tangent no selector
 * singles out is named in the notice (with two candidates, the whole build is refused with the
 * reason). A common tangent that is a full line of the figure already is not added again
 * (ADR-0029), and with none left the build is refused with that reason.
 */
import type { Expr, Selector } from '@geomira/kernel/expr';
import { call, ref } from '@geomira/kernel/expr';
import { isZeroNormalized, vCross, vDot, vSub } from '@geomira/kernel/geom';
import type { Line, Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { chooseSelectors } from './choice';
import { refuse, type EditResult } from './result';
import type { EditorEnv, EditorState } from './state';

/** Whether a full line of the figure is the line l (the same carrier, decided with EPS). */
function lineThere(state: EditorState, l: Line<number>): boolean {
  const ctx = state.values.ctx;
  const F = FloatField;
  for (const v of state.values.values.values()) {
    if (v.kind !== 'line' || v.lo !== null || v.hi !== null || v.outside === true) continue;
    const [dd, ll] = [vDot(F, v.d, v.d), vDot(F, l.d, l.d)];
    if (!isZeroNormalized(F, vCross(F, v.d, l.d), F.mul(dd, ll), 'dimensionless', ctx)) continue;
    if (isZeroNormalized(F, vCross(F, vSub(F, l.p, v.p), v.d), dd, 'length', ctx)) return true;
  }
  return false;
}

/** Why the curves have no common tangent: the kernel's reason (any selector reaches it). */
function noneReason(state: EditorState, args: readonly Value<number>[], env: EditorEnv): string {
  const spec = env.registry.get('tangent_point');
  const sel: Selector = { kind: 'near', p: ref(0) };
  const v = spec?.compute(FloatField, args, state.values.ctx, [
    { selector: sel, args: [{ kind: 'point', x: 0, y: 0 }], text: 'near(P)' },
  ]);
  return v?.kind === 'undefined' ? v.reason : 'these curves have no common tangent here';
}

/**
 * The common tangents of the curves `a` and `b` (ids), one batch; `addAll` adds definitions as one
 * history entry, reusing the same constructions (machine-build.ts).
 */
export function commonTangents(
  state: EditorState,
  [a, b]: readonly [number, number],
  env: EditorEnv,
  addAll: (state: EditorState, defs: readonly Expr[]) => EditResult,
): EditResult {
  const vals = [a, b].map((id) => state.values.values.get(id));
  const args = vals.filter((v): v is Value<number> => v !== undefined);
  const [points, lines] = [env.registry.get('tangent_point'), env.registry.get('tangent')];
  if (args.length !== 2 || points?.candidates === undefined || lines?.candidates === undefined)
    return refuse(state, 'an object is gone');
  const ctx = state.values.ctx;
  const at = points.candidates(FloatField, args, ctx);
  const ls = lines.candidates(FloatField, args, ctx);
  if (at.length === 0) return refuse(state, noneReason(state, args, env));
  const fresh: Vec<number>[] = [];
  for (const [i, p] of at.entries()) {
    const l = ls[i];
    if (p.kind === 'point' && !(l?.kind === 'line' && lineThere(state, l))) fresh.push(p);
  }
  if (fresh.length === 0)
    return refuse(state, 'every common tangent of these curves is a line of the figure already');
  const defs: Expr[] = [];
  const missed: string[] = [];
  const notes: string[] = [];
  for (const p of fresh) {
    const ch = chooseSelectors(state.doc, state.values, env.registry, 'tangent', [a, b], p);
    if (!ch.ok && at.length <= 2) return refuse(state, ch.reason);
    if (ch.ok) defs.push(call('tangent', [ref(a), ref(b)], ch.selectors));
    else missed.push(ch.reason);
    if (ch.ok && ch.note !== undefined) notes.push(ch.note);
  }
  if (defs.length === 0) return refuse(state, missed[0] ?? 'nothing to build');
  const r = addAll(state, defs);
  const said = [
    ...(missed.length === 0
      ? []
      : [
          `${String(defs.length)} of ${String(fresh.length)} common tangents built; the others: ${missed[0] ?? ''}`,
        ]),
    ...notes.slice(0, 1),
  ];
  if (!r.ok || said.length === 0) return r;
  const notice = said.join('; ');
  return { ...r, notice: r.notice === undefined ? notice : `${notice}; ${r.notice}` };
}
