/**
 * Claim and assumption edits (SPEC §12 "claims, assumptions"). The kernel stores claims and
 * assumptions as data (ADR-0003 item 5); their meaning and their static checks belong to
 * packages/claims (claimProblem, assumptionProblem: the same messages the language reports),
 * so the editor accepts exactly what the text format accepts. Ids come from the document's
 * counter (never reused, I6); references must exist (I5).
 */
import type { Assumption, Claim, Document } from '@geomira/kernel/document';
import { refsOf, type Expr } from '@geomira/kernel/expr';
import { nameProblem } from '@geomira/kernel/names';
import { claimProblem } from '@geomira/claims/check';
import { assumptionProblem } from '@geomira/claims/hypotheses';

export type DocResult =
  | { readonly ok: true; readonly doc: Document; readonly id?: number }
  | { readonly ok: false; readonly error: string };

export interface NewClaim {
  readonly kind: string;
  readonly args: readonly Expr[];
  readonly name?: string;
}

export interface NewAssumption {
  readonly kind: string;
  readonly args: readonly Expr[];
}

function missing(doc: Document, args: readonly Expr[]): string | undefined {
  const ids = new Set(doc.objects.map((o) => o.id));
  const id = args.flatMap(refsOf).find((x) => !ids.has(x));
  return id === undefined ? undefined : `there is no object #${String(id)}`;
}

function claimName(doc: Document, name: string, self?: number): string | undefined {
  const p = nameProblem(name);
  if (p !== undefined) return p;
  const used =
    doc.objects.some((o) => o.name === name) ||
    doc.claims.some((c) => c.name === name && c.id !== self);
  return used ? `the name ${name} is already used` : undefined;
}

export function addClaim(doc: Document, c: NewClaim): DocResult {
  const problem =
    claimProblem(c) ??
    missing(doc, c.args) ??
    (c.name === undefined ? undefined : claimName(doc, c.name));
  if (problem !== undefined) return { ok: false, error: problem };
  const id = doc.nextId;
  const base = { id, kind: c.kind, args: c.args };
  const claim: Claim = c.name === undefined ? base : { ...base, name: c.name };
  return { ok: true, doc: { ...doc, nextId: id + 1, claims: [...doc.claims, claim] }, id };
}

export function removeClaim(doc: Document, id: number): DocResult {
  if (!doc.claims.some((c) => c.id === id))
    return { ok: false, error: `there is no claim #${String(id)}` };
  return { ok: true, doc: { ...doc, claims: doc.claims.filter((c) => c.id !== id) } };
}

/** Names a claim, or removes its name (`name` undefined). */
export function renameClaim(doc: Document, id: number, name: string | undefined): DocResult {
  const c = doc.claims.find((x) => x.id === id);
  if (c === undefined) return { ok: false, error: `there is no claim #${String(id)}` };
  const problem = name === undefined ? undefined : claimName(doc, name, id);
  if (problem !== undefined) return { ok: false, error: problem };
  const renamed: Claim =
    name === undefined ? { id: c.id, kind: c.kind, args: c.args } : { ...c, name };
  return { ok: true, doc: { ...doc, claims: doc.claims.map((x) => (x.id === id ? renamed : x)) } };
}

export function addAssumption(doc: Document, a: NewAssumption): DocResult {
  const id = doc.nextId;
  const assumption: Assumption = { id, kind: a.kind, args: a.args };
  const problem = assumptionProblem(assumption) ?? missing(doc, a.args);
  if (problem !== undefined) return { ok: false, error: problem };
  return {
    ok: true,
    doc: { ...doc, nextId: id + 1, assumptions: [...doc.assumptions, assumption] },
    id,
  };
}

export function removeAssumption(doc: Document, id: number): DocResult {
  if (!doc.assumptions.some((a) => a.id === id))
    return { ok: false, error: `there is no assumption #${String(id)}` };
  return { ok: true, doc: { ...doc, assumptions: doc.assumptions.filter((a) => a.id !== id) } };
}
