/**
 * The data behind the web app's Objects and Claims panels (SPEC §15), computed from the
 * editor's state with the owners' functions: objects grouped by layer with the Undefined
 * and Inexact reasons of their values (SPEC §4: shown as undefined, never as garbage);
 * the claims with their live three-valued badges for the CURRENT figure (packages/claims'
 * evalClaim: never a sampler, SPEC §10.2); the assume lines with the current figure's
 * status (claims' hypothesesInFigure, note B of Run 8b); and the line of each claim and
 * assumption in the printed text, so the panel can say where a statement is.
 */
import { evalClaim, type ClaimValue } from '@geomira/claims/eval-claim';
import { hypothesesInFigure, type FigureStatus } from '@geomira/claims/figure-hypotheses';
import type { Document } from '@geomira/kernel/document';
import { formatExpr } from '@geomira/kernel/selector';
import { print } from '@geomira/lang/print';
import type { EditorEnv, EditorState } from './state';

export interface ObjectRow {
  readonly id: number;
  readonly name: string;
  /** The definition as text, with names. */
  readonly definition: string;
  /** The value's kind (point, line, …, undefined, inexact). */
  readonly kind: string;
  readonly status: 'ok' | 'undefined' | 'inexact';
  /** Why the value is Undefined or Inexact. */
  readonly reason?: string;
  /** A managed image of a derived layer. */
  readonly managed: boolean;
  readonly hidden: boolean;
}

export interface LayerGroup {
  readonly id: string;
  readonly name: string;
  readonly derived: boolean;
  readonly visible: boolean;
  readonly rows: readonly ObjectRow[];
}

function rowOf(state: EditorState, o: Document['objects'][number], names: Names): ObjectRow {
  const v = state.values.values.get(o.id);
  const row = {
    id: o.id,
    name: o.name,
    definition: formatExpr(o.def, names),
    managed: o.managedBy !== undefined,
    hidden: o.style.hidden === true,
  };
  if (v === undefined)
    return { ...row, kind: 'undefined', status: 'undefined', reason: 'not evaluated' };
  if (v.kind === 'undefined' || v.kind === 'inexact')
    return { ...row, kind: v.kind, status: v.kind, reason: v.reason };
  return { ...row, kind: v.kind, status: 'ok' };
}

type Names = (id: number) => string | undefined;

/** Every layer with its objects, in construction order (an object in two layers is in both). */
export function objectsByLayer(state: EditorState): LayerGroup[] {
  const byId = new Map(state.doc.objects.map((x) => [x.id, x.name]));
  const names: Names = (id) => byId.get(id);
  return state.doc.layers.map((l) => ({
    id: l.id,
    name: l.name,
    derived: l.rule !== undefined,
    visible: l.visible,
    rows: state.doc.objects
      .filter((o) => o.layers.includes(l.id))
      .map((o) => rowOf(state, o, names)),
  }));
}

export interface StatementLine {
  /** 1-based line in print(doc). */
  readonly line: number;
  readonly text: string;
}

/**
 * The line of every claim and assumption in the printed text. The printer writes the
 * assumptions, then the claims, each on one line starting with `assume ` / `claim `, in the
 * document's order (comment lines start with `#`, object lines with a name).
 */
export function statementLines(doc: Document): {
  claims: Map<number, StatementLine>;
  assumptions: Map<number, StatementLine>;
} {
  const lines = print(doc).split('\n');
  const at = (prefix: string) =>
    lines.flatMap((text, i) => (text.startsWith(prefix) ? [{ line: i + 1, text }] : []));
  const [a, c] = [at('assume '), at('claim ')];
  return {
    claims: new Map(doc.claims.flatMap((x, i) => (c[i] === undefined ? [] : [[x.id, c[i]]]))),
    assumptions: new Map(
      doc.assumptions.flatMap((x, i) => (a[i] === undefined ? [] : [[x.id, a[i]]])),
    ),
  };
}

export interface ClaimRow {
  readonly id: number;
  readonly line: number;
  readonly text: string;
  readonly badge: ClaimValue;
}

/** The claims with their badges for the current figure (evalClaim, deterministic). */
export function claimRows(state: EditorState, env: EditorEnv): ClaimRow[] {
  const lines = statementLines(state.doc).claims;
  return state.doc.claims.map((c) => ({
    id: c.id,
    line: lines.get(c.id)?.line ?? 0,
    text: lines.get(c.id)?.text ?? `claim ${c.kind}`,
    badge: evalClaim(state.doc, c.id, env.registry),
  }));
}

export interface HypothesisRow {
  readonly id: number;
  readonly line: number;
  readonly text: string;
  readonly status: FigureStatus;
  /** The plain sentence when the current figure does not satisfy the line. */
  readonly message: string | null;
}

/** The assume lines and whether the current figure satisfies each (note B of Run 8b). */
export function hypothesisRows(state: EditorState, env: EditorEnv): HypothesisRow[] {
  const lines = statementLines(state.doc).assumptions;
  return hypothesesInFigure(state.doc, env.registry).map((h) => ({
    id: h.id,
    line: lines.get(h.id)?.line ?? 0,
    text: lines.get(h.id)?.text ?? `assume ${h.text}`,
    status: h.status,
    message: h.message,
  }));
}
