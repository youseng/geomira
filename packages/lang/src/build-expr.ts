/**
 * From syntax to kernel expressions (SPEC §5): names become references, numbers exact
 * literals (kept as written), `(x, y)` point(x, y), operators the arithmetic tools, and
 * selectors kernel Selectors. `on(obj)` without a parameter is desugared to an explicit one
 * (ADR-0004 item 9, ADR-0009). Then every call is checked where it stands: arguments no
 * overload takes (the registry's message) and the kernel's selector checks (ADR-0006
 * item 14: bare index, missing or misapplied selectors), reported at the call's position.
 */
import {
  lit,
  call,
  ref,
  selectorExprs,
  type CallExpr,
  type Expr,
  type Selector,
} from '@geomira/kernel/expr';
import { exprKinds, type KindTable } from '@geomira/kernel/derived';
import { rejection, type Registry } from '@geomira/kernel/registry';
import { callDiagnostics, type KindsOfRef } from '@geomira/kernel/selector-check';
import type { ExprNode, SelectorNode } from './ast';
import { error, type Diagnostic, type Span } from './diagnostic';
import { exactLiteral } from './lex-literals';
import { makeSelector } from './selectors';
import { suggest } from './suggest';

export interface ExprEnv {
  readonly registry: Registry;
  /** The id of a name; on failure the resolver records why and returns undefined. */
  resolve(name: string, span: Span): number | undefined;
  /** The explicit parameters of on(obj), or why there are none. */
  gliderDefault(obj: Expr): readonly Expr[] | string;
  /** Names of objects (for "k is an object, not a tool"). */
  isObjectName(name: string): boolean;
  readonly diags: Diagnostic[];
}

export interface CallSite {
  readonly call: CallExpr;
  readonly span: Span;
}

export interface Converted {
  readonly expr: Expr;
  /** Every call, outermost first (pre-order), with its source span. */
  readonly calls: readonly CallSite[];
}

/** Converts one node; undefined (with diagnostics) when some part does not resolve. */
export function convert(node: ExprNode, env: ExprEnv): Converted | undefined {
  const calls: CallSite[] = [];
  const e = toExpr(node, env, calls);
  return e === undefined ? undefined : { expr: e, calls };
}

function toExpr(n: ExprNode, env: ExprEnv, calls: CallSite[]): Expr | undefined {
  switch (n.kind) {
    case 'num': {
      const r = exactLiteral(n.text);
      if (!r.ok) env.diags.push(error(n.span, r.reason, r.hint));
      return r.ok ? lit(r.value, n.text) : undefined;
    }
    case 'name': {
      const id = env.resolve(n.name, n.span);
      return id === undefined ? undefined : ref(id);
    }
    case 'str':
      return { kind: 'str', value: n.value };
    case 'pair':
      return built('point', [n.x, n.y], n.span, env, calls);
    case 'binary':
      return built(n.op, [n.left, n.right], n.span, env, calls);
    case 'neg':
      return built('neg', [n.operand], n.span, env, calls);
    case 'call':
      return callExpr(n, env, calls);
    default:
      return undefined;
  }
}

function built(
  tool: string,
  args: readonly ExprNode[],
  span: Span,
  env: ExprEnv,
  calls: CallSite[],
): Expr | undefined {
  const site = calls.length;
  const xs = args.map((a) => toExpr(a, env, calls));
  if (xs.some((x) => x === undefined)) return undefined;
  const c = call(
    tool,
    xs.filter((x): x is Expr => x !== undefined),
  );
  calls.splice(site, 0, { call: c, span });
  return c;
}

function unknownTool(name: string, span: Span, env: ExprEnv): undefined {
  if (env.isObjectName(name)) {
    env.diags.push(
      error(span, `${name} is an object, not a tool`, `write ${name} without parentheses`),
    );
    return undefined;
  }
  const near = suggest(
    name,
    env.registry.tools.map((t) => t.name),
  );
  env.diags.push(
    error(
      span,
      `unknown tool "${name}"${near === undefined ? '' : `: did you mean ${near}?`}`,
      near === undefined ? 'see docs/language.md for the tools' : `write ${near}(…)`,
    ),
  );
  return undefined;
}

function callExpr(
  n: Extract<ExprNode, { kind: 'call' }>,
  env: ExprEnv,
  calls: CallSite[],
): Expr | undefined {
  if (env.registry.get(n.tool) === undefined) {
    unknownTool(n.tool, n.span, env);
    return undefined;
  }
  const site = calls.length;
  const args = n.args.map((a) => toExpr(a, env, calls));
  const sels = n.selectors.map((s) => toSelector(s, env, calls));
  if (args.some((x) => x === undefined) || sels.some((x) => x === undefined)) return undefined;
  let argExprs = args.filter((x): x is Expr => x !== undefined);
  const first = argExprs[0];
  if (n.tool === 'on' && argExprs.length === 1 && sels.length === 0 && first !== undefined) {
    const d = env.gliderDefault(first);
    if (typeof d === 'string') {
      env.diags.push(error(n.span, d, 'write the parameter: on(l, t), on(c, u, v) or on(c, θ)'));
      return undefined;
    }
    argExprs = [first, ...d];
  }
  const c = call(
    n.tool,
    argExprs,
    sels.filter((x): x is Selector => x !== undefined),
  );
  calls.splice(site, 0, { call: c, span: n.span });
  return c;
}

function toSelector(s: SelectorNode, env: ExprEnv, calls: CallSite[]): Selector | undefined {
  if (!('args' in s)) return makeSelector(s.kind, [], false, s.sign);
  const args = s.args.map((a) => toExpr(a, env, calls));
  if (args.some((x) => x === undefined)) return undefined;
  const xs = args.filter((x): x is Expr => x !== undefined);
  return makeSelector(s.kind, xs, s.kind === 'on_arc' ? s.not : false, 1);
}

/** Whether x is a direct argument or selector expression of `parent`. */
function isChild(parent: CallExpr, x: CallExpr): boolean {
  return parent.args.includes(x) || parent.selectors.some((s) => selectorExprs(s).includes(x));
}

/**
 * The diagnostics of every call of a converted expression, each at its own position: the
 * kernel's selector checks first (callDiagnostics lists a call's own problems before those
 * of its nested calls, so a call's own share is the difference; a bare index keeps its
 * selector hint), then argument kinds that no overload takes.
 */
export function checkCalls(
  conv: Converted,
  registry: Registry,
  kindsOfRef: KindsOfRef,
  table: KindTable,
  show: (e: Expr) => string,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const site of conv.calls) {
    const all = callDiagnostics(site.call, kindsOfRef, registry, show);
    const nested = conv.calls
      .filter((s) => s.call !== site.call && isChild(site.call, s.call))
      .reduce((n, s) => n + callDiagnostics(s.call, kindsOfRef, registry, show).length, 0);
    const own = all.slice(0, Math.max(0, all.length - nested));
    for (const d of own) out.push(error(site.span, d.message, d.hint));
    if (own.length > 0) continue;
    const kinds = site.call.args.map((a) => exprKinds(a, table, registry));
    const tool = registry.get(site.call.tool);
    if (
      tool !== undefined &&
      kinds.every((k) => k !== undefined) &&
      exprKinds(site.call, table, registry) === undefined
    ) {
      const msg = rejection(
        tool,
        kinds.map((k) => ({ kind: k.join(' | ') })),
      );
      out.push(error(site.span, msg, 'pass arguments of the kinds a signature takes'));
    }
  }
  return out;
}
