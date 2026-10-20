/**
 * Registry-driven random expressions: for a wanted capability, a reference to an object of
 * fitting static kinds, a literal, or a nested call of any registered tool whose overload
 * yields that capability (nesting up to depth 2). Branchable calls get selectors chosen so
 * the kernel's static checks pass (the parser would reject the call otherwise).
 */
import type { Document } from '@geomira/kernel/document';
import { call, ref, type CallExpr, type Expr, type Selector } from '@geomira/kernel/expr';
import { exprKinds, objectKinds, type KindTable } from '@geomira/kernel/derived';
import type { Registry } from '@geomira/kernel/registry';
import { callDiagnostics, staticKinds } from '@geomira/kernel/selector-check';
import { formatExpr } from '@geomira/kernel/selector';
import type { Signature, ToolSpec } from '@geomira/kernel/tool';
import { capabilityKinds, type Capability, type ValueKind } from '@geomira/kernel/value';
import type { Rng } from '@geomira/num/rng';
import { chance, literal, pick } from './gen-atoms';

export interface ExprCtx {
  readonly doc: Document;
  readonly registry: Registry;
  readonly rng: Rng;
  readonly kinds: KindTable;
  readonly stat: Map<number, readonly ValueKind[] | undefined>;
}

export function exprCtx(doc: Document, registry: Registry, rng: Rng): ExprCtx {
  const stat = new Map<number, readonly ValueKind[] | undefined>();
  for (const o of doc.objects)
    stat.set(
      o.id,
      staticKinds(o.def, (id) => stat.get(id), registry),
    );
  return { doc, registry, rng, kinds: objectKinds(doc, registry), stat };
}

/** Objects whose possible kinds all have the capability. */
function objectsWith(c: ExprCtx, cap: Capability): number[] {
  const ok = capabilityKinds(cap);
  return c.doc.objects.flatMap((o) => {
    const k = c.kinds.get(o.id);
    return k !== undefined && k.length > 0 && k.every((x) => ok.includes(x)) ? [o.id] : [];
  });
}

function outputs(t: ToolSpec, s: Signature): readonly ValueKind[] {
  return s.output ?? t.outputKinds;
}

/** Overloads whose results all have the capability. */
function producers(c: ExprCtx, cap: Capability): { tool: ToolSpec; sig: Signature }[] {
  const ok = capabilityKinds(cap);
  return c.registry.tools.flatMap((tool) =>
    tool.signatures
      .filter((sig) => outputs(tool, sig).every((k) => ok.includes(k)))
      .map((sig) => ({ tool, sig })),
  );
}

export function anyExpr(c: ExprCtx, cap: Capability, depth: number): Expr | undefined {
  const objs = objectsWith(c, cap);
  const r = c.rng.nextFloat();
  if (cap === 'number' && (r < 0.45 || depth > 1)) return literal(c.rng);
  if (objs.length > 0 && (r < 0.75 || depth > 1)) return ref(pick(c.rng, objs));
  if (depth > 1) return undefined;
  for (let k = 0; k < 4; k++) {
    const e = randomCall(c, cap, depth + 1);
    if (e !== undefined) return e;
  }
  return objs.length > 0 ? ref(pick(c.rng, objs)) : undefined;
}

function show(c: ExprCtx): (e: Expr) => string {
  return (e) => formatExpr(e, (id) => c.doc.objects.find((o) => o.id === id)?.name);
}

/** Selector lists to try on a branchable call, in random order. */
function selectorOptions(c: ExprCtx): Selector[][] {
  const P = objectsWith(c, 'point').map(ref);
  const L = objectsWith(c, 'linear').map(ref);
  const R = objectsWith(c, 'round').map(ref);
  const out: Selector[][] = [[]];
  const s = (x: () => Selector | undefined): void => {
    const v = x();
    if (v !== undefined) out.push([v]);
  };
  const p = (): Expr | undefined => (P.length === 0 ? undefined : pick(c.rng, P));
  const one = (k: 'other' | 'near' | 'far_from'): Selector | undefined => {
    const q = p();
    return q === undefined ? undefined : { kind: k, p: q };
  };
  for (const k of ['other', 'near', 'far_from'] as const) s(() => one(k));
  for (const k of ['along', 'orient'] as const)
    s(() => ({ kind: k, sign: pick(c.rng, [1, -1] as const) }));
  const q = p();
  const l = L.length === 0 ? undefined : pick(c.rng, L);
  if (q !== undefined && l !== undefined)
    s(() => ({ kind: pick(c.rng, ['same_side', 'opposite_side'] as const), q, l }));
  const [b, cc, a] = [p(), p(), p()];
  if (b !== undefined && cc !== undefined && a !== undefined) {
    s(() => ({ kind: 'on_arc', b, c: cc, a, not: chance(c.rng, 0.5) }));
    s(() => ({ kind: 'between', a: b, b: cc }));
  }
  if (R.length > 0)
    s(() => ({ kind: pick(c.rng, ['inside', 'outside'] as const), c: pick(c.rng, R) }));
  const near = one('near');
  const first = out[1 + c.rng.nextInt(Math.max(1, out.length - 1))];
  if (near !== undefined && first !== undefined && first.length === 1 && chance(c.rng, 0.3))
    out.push([...first, near]);
  return shuffle(c.rng, out);
}

function shuffle<X>(rng: Rng, xs: X[]): X[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const [a, b] = [xs[i], xs[j]];
    if (a !== undefined && b !== undefined) [xs[i], xs[j]] = [b, a];
  }
  return xs;
}

/** Whether the parser accepts the call: every overload fits, every selector check passes. */
export function acceptable(c: ExprCtx, e: CallExpr): boolean {
  const fits = (x: Expr): boolean =>
    x.kind !== 'call' || (exprKinds(x, c.kinds, c.registry) !== undefined && x.args.every(fits));
  return fits(e) && callDiagnostics(e, (id) => c.stat.get(id), c.registry, show(c)).length === 0;
}

export function randomCall(c: ExprCtx, cap: Capability, depth: number): Expr | undefined {
  const ps = producers(c, cap);
  if (ps.length === 0) return undefined;
  const { tool, sig } = pick(c.rng, ps);
  const extra = sig.rest === undefined ? 0 : c.rng.nextInt(3);
  const caps = [...sig.params, ...Array.from({ length: extra }, () => sig.rest ?? 'point')];
  const args: Expr[] = [];
  for (const p of caps) {
    const a = anyExpr(c, p, depth);
    if (a === undefined) return undefined;
    args.push(a);
  }
  const options = tool.candidates === undefined ? [[]] : selectorOptions(c);
  for (const sels of options) {
    const e = call(tool.name, args, sels);
    if (acceptable(c, e)) return e;
  }
  return undefined;
}
