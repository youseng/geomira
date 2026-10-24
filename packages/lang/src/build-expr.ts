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
import { error, warning, type Diagnostic, type Span } from './diagnostic';
import { exactLiteral } from './lex-literals';
import { spreadRuns, TOOL_ALIASES, toolName } from './geomdraw';
import { makeSelector } from './selectors';
import { nestedTooDeep } from './parse-expr';
import { assertNever } from '@geomira/num/assert';
import { MAX_EXPR_DEPTH } from '@geomira/kernel/limits';
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
  /** What the glued runs among the call's direct arguments mean (ADR-0025), for hints. */
  readonly runs?: string;
}

export interface Converted {
  readonly expr: Expr;
  /** Every call, outermost first (pre-order), with its source span. */
  readonly calls: readonly CallSite[];
}

/** The children of a node (selector arguments included). */
function children(n: ExprNode): readonly ExprNode[] {
  switch (n.kind) {
    case 'num':
    case 'name':
    case 'str':
      return [];
    case 'pair':
      return [n.x, n.y];
    case 'binary':
      return [n.left, n.right];
    case 'neg':
      return [n.operand];
    case 'call':
      return [...n.args, ...n.selectors.flatMap((s) => ('args' in s ? s.args : []))];
    default:
      return assertNever(n, 'expression node');
  }
}

/** Whether `node` is nested deeper than MAX_EXPR_DEPTH (computed without recursion). */
function tooDeep(node: ExprNode): boolean {
  const stack: [ExprNode, number][] = [[node, 1]];
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const [n, d] = top;
    if (d > MAX_EXPR_DEPTH) return true;
    for (const k of children(n)) stack.push([k, d + 1]);
  }
  return false;
}

/**
 * Converts one node; undefined (with diagnostics) when some part does not resolve or the node
 * is nested deeper than MAX_EXPR_DEPTH (a long operator chain is as deep as it is long).
 */
export function convert(node: ExprNode, env: ExprEnv): Converted | undefined {
  if (tooDeep(node)) {
    const d = nestedTooDeep();
    env.diags.push(error(node.span, d.message, d.hint));
    return undefined;
  }
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
  calls.splice(site, 0, siteOf(c, span, args));
  return c;
}

/** A call site, with the meaning of the glued runs among its direct arguments. */
function siteOf(c: CallExpr, span: Span, args: readonly ExprNode[]): CallSite {
  const runs = args.flatMap((a) => (a.kind === 'call' && a.glued === true ? [runMeaning(a)] : []));
  return runs.length === 0 ? { call: c, span } : { call: c, span, runs: runs.join('; ') };
}

function unknownTool(name: string, span: Span, env: ExprEnv): undefined {
  if (env.isObjectName(name)) {
    env.diags.push(
      error(span, `${name} is an object, not a tool`, `write ${name} without parentheses`),
    );
    return undefined;
  }
  const near = suggest(name, [
    ...env.registry.tools.map((t) => t.name),
    ...Object.keys(TOOL_ALIASES),
  ]);
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
  const tool = toolName(n.tool, env.registry);
  if (env.registry.get(tool) === undefined) {
    unknownTool(n.tool, n.span, env);
    return undefined;
  }
  const site = calls.length;
  const before = env.diags.length;
  const spread = spreadRuns(tool, n.args, env.registry);
  circleThrough(tool, n, spread, env.diags);
  const args = spread.map((a) => toExpr(a, env, calls));
  const sels = n.selectors.map((s) => toSelector(s, env, calls));
  if (args.some((x) => x === undefined) || sels.some((x) => x === undefined)) {
    if (n.glued === true) explainRun(n, env.diags, before);
    return undefined;
  }
  let argExprs = args.filter((x): x is Expr => x !== undefined);
  const first = argExprs[0];
  if (tool === 'on' && argExprs.length === 1 && sels.length === 0 && first !== undefined) {
    const d = env.gliderDefault(first);
    if (typeof d === 'string') {
      env.diags.push(error(n.span, d, 'write the parameter: on(l, t), on(c, u, v) or on(c, θ)'));
      return undefined;
    }
    argExprs = [first, ...d];
  }
  const c = call(
    tool,
    argExprs,
    sels.filter((x): x is Selector => x !== undefined),
  );
  calls.splice(site, 0, siteOf(c, n.span, spread));
  return c;
}

/**
 * `circle(O, AB)`: ADR-0025 spreads the run, so it is the circle through O, A and B; a
 * warning (the line is applied) says so and how to write centre O, radius AB (ADR-0028).
 */
function circleThrough(
  tool: string,
  n: Extract<ExprNode, { kind: 'call' }>,
  spread: readonly ExprNode[],
  diags: Diagnostic[],
): void {
  const [o, run] = n.args;
  if (tool !== 'circle' || n.args.length !== 2 || spread.length !== 3) return;
  if (o?.kind !== 'name' || run?.kind !== 'call' || run.glued !== true) return;
  const [a, b] = run.args.map((x) => (x.kind === 'name' ? x.name : '?'));
  diags.push(
    warning(
      n.span,
      `${n.tool}(${o.name}, ${a ?? '?'}${b ?? '?'}) is the circle through ${o.name}, ${a ?? '?'} and ${b ?? '?'}`,
      `for centre ${o.name} and radius ${a ?? '?'}${b ?? '?'} write circle(${o.name}, dist(${a ?? '?'}, ${b ?? '?'}))`,
    ),
  );
}

/** `AB is line(A, B); the length AB is dist(A, B)`: what a glued run means (ADR-0025). */
function runMeaning(n: Extract<ExprNode, { kind: 'call' }>): string {
  const names = n.args.flatMap((a) => (a.kind === 'name' ? [a.name] : []));
  const list = names.join(', ');
  const length = names.length === 2 ? `; the length ${names.join('')} is dist(${list})` : '';
  return `${names.join('')} is ${n.tool}(${list})${length}`;
}

/**
 * The hints of a glued run's errors say what the run means (ADR-0025): `AB` is line(A, B),
 * and its length is dist(A, B).
 */
function explainRun(n: Extract<ExprNode, { kind: 'call' }>, diags: Diagnostic[], from: number) {
  const meaning = runMeaning(n);
  for (let i = from; i < diags.length; i++) {
    const d = diags[i];
    if (d !== undefined) diags[i] = { ...d, hint: `${d.hint} (${meaning})` };
  }
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
      out.push(error(site.span, msg, site.runs ?? 'pass arguments of the kinds a signature takes'));
    }
  }
  return out;
}
