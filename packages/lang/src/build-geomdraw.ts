/**
 * Geomdraw's statements (ADR-0025), built as the definitions they stand for:
 * - `points A B C [attrs]`: free points at places drawn from the statement (free-points.ts);
 * - `X, Y = intersect(a, b)` (any two-candidate call: tangent_from, tangent_point, …): X with
 *   the call's low-level selector `along(+)` or `orient(+)`, Y with `along(-)` / `orient(-)`
 *   (SPEC §7: the branches by the line's direction or by orientation, never an index). The
 *   claims tester reports when a claim depends on that choice (ORIENTATION-DEPENDENT); a
 *   semantic selector (same_side, on_arc, other) is then the fix, as for any call.
 */
import type { CallExpr, Expr } from '@geomira/kernel/expr';
import { staticKinds } from '@geomira/kernel/selector-check';
import type { BranchShape } from '@geomira/kernel/tool';
import type { ValueKind } from '@geomira/kernel/value';
import type { ExprNode, Statement } from './ast';
import { convert } from './build-expr';
import { define, freePoint } from './build-defs';
import { exprEnv } from './build-env';
import type { State } from './build-state';
import { error } from './diagnostic';
import { freePlaces } from './free-points';

type Points = Extract<Statement, { kind: 'points' }>;
type Branches = Extract<Statement, { kind: 'branches' }>;

/** `points A B C`: the first point's id (for comments), or undefined when none was built. */
export function pointsStatement(st: State, s: Points, line: number): number | undefined {
  const places = freePlaces(
    'points',
    s.points.map((p) => p.name),
  );
  const ids = s.points.map((p, i) =>
    define(st, p, freePoint(p, places[i] ?? ['0', '0']), s.attrs, line),
  );
  return ids.find((id) => id !== undefined);
}

/** The branch shapes of a call for every combination of its arguments' static kinds. */
function shapesOf(st: State, c: CallExpr): BranchShape[] | undefined {
  let combos: ValueKind[][] = [[]];
  for (const a of c.args) {
    const ks = staticKinds(a, (id) => st.staticKinds.get(id), st.registry);
    if (ks === undefined) return undefined;
    combos = combos.flatMap((k) => ks.map((x) => [...k, x]));
  }
  const shapes: BranchShape[] = [];
  for (const kinds of combos) {
    const r = st.registry.resolve(
      c.tool,
      kinds.map((kind) => ({ kind })),
    );
    if (r.ok && r.signature.branch !== undefined) shapes.push(r.signature.branch);
  }
  return shapes;
}

type Low = 'along' | 'orient' | { readonly message: string; readonly hint: string };

/** The low-level selector that tells the two branches apart, or why there is none. */
function lowOf(st: State, e: Expr): Low {
  const one = 'write one point per line, each with its own selector';
  if (e.kind !== 'call') return { message: 'two names take a call with two candidates', hint: one };
  const shapes = shapesOf(st, e);
  if (shapes === undefined)
    return { message: 'the kinds of the arguments are not known', hint: one };
  if (shapes.length === 0 || shapes.some((s) => s.candidates !== 2))
    return {
      message: `${e.tool}(…) does not have two candidates here`,
      hint: `write one name: X = ${e.tool}(…)`,
    };
  const lows = [...new Set(shapes.map((s) => s.low))];
  const [low] = lows;
  if (lows.length !== 1 || low === undefined || low === 'none')
    return {
      message: `the two candidates of ${e.tool}(…) cannot be told apart by along(±) or orient(±)`,
      hint: one,
    };
  return low;
}

/** Why a `X, Y = …` statement cannot be read, before its call is converted. */
function shapeProblem(s: Branches): { message: string; hint: string } | undefined {
  const node = s.expr;
  if (s.targets.length !== 2)
    return {
      message: 'a call has two branches: write two names',
      hint: 'write X, Y = intersect(a, b)',
    };
  if (node.kind !== 'call' || node.glued === true)
    return {
      message: 'two names take a call with two candidates',
      hint: 'write X, Y = intersect(a, b) or t1, t2 = tangent_from(P, c)',
    };
  if (node.selectors.length > 0)
    return {
      message: 'with two names the branches are chosen by along(±) or orient(±): write no selector',
      hint: 'or write each point on its own line with its own selector',
    };
  return undefined;
}

/** `X, Y = call(…)`: the first id built, or undefined (failures are reported). */
export function branchesStatement(st: State, s: Branches, line: number): number | undefined {
  st.line = line;
  const failed = (): void => {
    for (const t of s.targets) st.failed.set(t.name, line);
  };
  const before = shapeProblem(s);
  const n = st.diags.length;
  const conv = before === undefined ? convert(s.expr, exprEnv(st)) : undefined;
  const low = conv === undefined || st.diags.length > n ? undefined : lowOf(st, conv.expr);
  const problem = before ?? (typeof low === 'object' ? low : undefined);
  if (problem !== undefined) st.diags.push(error(s.span, problem.message, problem.hint));
  if (low !== 'along' && low !== 'orient') {
    failed();
    return undefined;
  }
  const ids = s.targets.map((t, i) => {
    const sel = { kind: low, sign: i === 0 ? 1 : -1, span: s.expr.span } as const;
    const branch: ExprNode = s.expr.kind === 'call' ? { ...s.expr, selectors: [sel] } : s.expr;
    return define(st, t, branch, s.attrs, line);
  });
  return ids.find((id) => id !== undefined);
}
