/**
 * Claims and assumptions, built after every object exists (they may name any object).
 * Their arguments are checked like definitions (selector checks, argument kinds), then by
 * packages/claims itself: `claimProblem` (kind, number and form of the arguments) and
 * `assumptionProblem` (unknown kinds, equality assumptions: "construct it"), reported at
 * the statement (note B of Run 6: never re-implemented here).
 */
import type { Assumption, Claim, CommentAnchor } from '@geomira/kernel/document';
import type { Expr } from '@geomira/kernel/expr';
import { nameProblem } from '@geomira/kernel/names';
import { claimProblem } from '@geomira/claims/check';
import { assumptionProblem } from '@geomira/claims/hypotheses';
import type { Attr, Condition } from './ast';
import { byKey, textAttr } from './attr-values';
import { expression } from './build-defs';
import type { State } from './build-state';
import { error } from './diagnostic';

export interface Deferred {
  readonly kind: 'claim' | 'assume';
  readonly condition: Condition;
  readonly attrs: readonly Attr[];
  readonly line: number;
  readonly lines: readonly string[];
  readonly inline?: string;
}

function args(st: State, c: Condition): Expr[] | undefined {
  const out: Expr[] = [];
  for (const a of c.args) {
    const e = expression(st, a);
    if (e === undefined) return undefined;
    out.push(e);
  }
  return out;
}

function claimName(st: State, attrs: readonly Attr[]): { ok: boolean; name?: string } {
  const n = st.diags.length;
  const m = byKey(attrs, ['name'], 'a claim', { diags: st.diags });
  const a = m.get('name');
  const name = a === undefined ? undefined : textAttr(a, true, { diags: st.diags });
  if (a !== undefined && name !== undefined) {
    const problem =
      nameProblem(name) ??
      (st.ids.has(name) || st.doc.claims.some((c) => c.name === name)
        ? `the name ${name} is already used`
        : undefined);
    if (problem !== undefined) st.diags.push(error(a.span, problem, 'choose another claim name'));
  }
  if (st.diags.length > n) return { ok: false };
  return name === undefined ? { ok: true } : { ok: true, name };
}

/** Builds one claim or assumption; its comment anchor, or undefined when not applied. */
function one(st: State, d: Deferred): CommentAnchor | undefined {
  st.line = Number.MAX_SAFE_INTEGER;
  const xs = args(st, d.condition);
  if (xs === undefined) return undefined;
  const id = st.doc.nextId;
  if (d.kind === 'assume') {
    const a: Assumption = { id, kind: d.condition.kind, args: xs };
    const problem = assumptionProblem(a);
    if (problem !== undefined) {
      st.diags.push(
        error(d.condition.span, problem, 'see the assumption forms in docs/language.md'),
      );
      return undefined;
    }
    st.doc = { ...st.doc, nextId: id + 1, assumptions: [...st.doc.assumptions, a] };
    return { kind: 'assumption', id };
  }
  const problem = claimProblem({ kind: d.condition.kind, args: xs });
  if (problem !== undefined) {
    st.diags.push(error(d.condition.span, problem, 'see the claim forms in docs/language.md'));
    return undefined;
  }
  const named = claimName(st, d.attrs);
  if (!named.ok) return undefined;
  const c: Claim =
    named.name === undefined
      ? { id, kind: d.condition.kind, args: xs }
      : { id, name: named.name, kind: d.condition.kind, args: xs };
  st.doc = { ...st.doc, nextId: id + 1, claims: [...st.doc.claims, c] };
  return { kind: 'claim', id };
}

/** Every deferred statement in text order; returns each one's anchor (undefined: not applied). */
export function buildDeferred(
  st: State,
  items: readonly Deferred[],
): (CommentAnchor | undefined)[] {
  return items.map((d) => one(st, d));
}
