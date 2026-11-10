/**
 * The SHORT notation, printed (ADR-0061). The language has always READ Geomdraw's short forms
 * (ADR-0025: `foot(A, BC)`, `circumcenter(ABC)`, `P, Q = tangents(X, ω)`); this printer WRITES
 * them, so the text panel shows a figure the way a person writes it and no longer turns what
 * was typed into the long canonical form. The canonical printer (print.ts) is unchanged: files,
 * share links, exports and every golden text stay as they were, and both notations read back
 * to the same document.
 *
 * What is written short, and only where the reader gives back exactly the same definition
 * (the printer asks the reader's own functions, geomdraw.ts runReading and branches.ts):
 *   1. an argument `line(A, B)` or `circle(A, B, C)` of point names is the run `AB` or `ABC`
 *      (`foot(A, BC)`, `intersect(ω, AB, …)`, `claim perpendicular(AB, CD)`), where the call
 *      takes a line or a circle there;
 *   2. a call of exactly three point names is `tool(ABC)` (`circumcenter(ABC)`, `circle(ABC)`,
 *      `angle(ABC)`), unless the tool has image forms (`translate(X, A, B)` is not a triangle);
 *   3. two adjacent objects that are the two branches of one call, `along(+)` then `along(-)`
 *      or `orient(+)` then `orient(-)`, with the same attributes, are ONE statement:
 *      `X, Y = intersect(ω, AB)`; tangent_from and tangent_point are written `tangents` and
 *      `tangent_points` there.
 * Everything else is the canonical text. Laws (tested): parse(printShort(doc)) is doc up to ids
 * wherever parse(print(doc)) is (law P1's domain), and printShort∘parse is idempotent.
 *
 * Degenerate cases: names that do not glue back into the same names (checked with the lexer),
 * a tool the registry does not know, arguments that are not plain names → the canonical form.
 */
import type { Document } from '@geomira/kernel/document';
import { objectKinds } from '@geomira/kernel/derived';
import { exprEquals, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { isPointName } from '@geomira/kernel/names';
import type { Registry } from '@geomira/kernel/registry';
import { branchLow } from './branches';
import { conditionReading, runReading } from './geomdraw';
import { lexLine } from './lexer';
import { printExpr, type CallHook, type Names } from './print-expr';
import { printIn, type Notation } from './print-document';

/** The names the pair statement writes for a tool (Geomdraw's plurals); others keep their name. */
const PAIR_NAMES: Readonly<Record<string, string>> = Object.freeze({
  tangent_from: 'tangents',
  tangent_point: 'tangent_points',
});

/** Whether the names glued together lex back into exactly these point names, as one run. */
function glues(names: readonly string[]): boolean {
  const lexed = lexLine(names.join(''), 1);
  return (
    lexed.diagnostics.length === 0 &&
    lexed.tokens.length === names.length &&
    lexed.tokens.every(
      (t, i) => t.kind === 'point' && t.value === names[i] && (i === 0 || !t.spaceBefore),
    )
  );
}

/** The point names of references to point-named objects, or undefined when one is not. */
function pointNames(args: readonly Expr[], names: Names): string[] | undefined {
  const out: string[] = [];
  for (const a of args) {
    const n = a.kind === 'ref' ? names(a.id) : undefined;
    if (n === undefined || !isPointName(n.replace(/\*+$/u, ''))) return undefined;
    out.push(n);
  }
  return out;
}

/** `AB` for line(A, B) and `ABC` for circle(A, B, C) of point names that glue; else undefined. */
function runOf(e: Expr, names: Names): string | undefined {
  if (e.kind !== 'call' || e.selectors.length > 0) return undefined;
  const size = e.tool === 'line' ? 2 : e.tool === 'circle' ? 3 : 0;
  if (e.args.length !== size || size === 0) return undefined;
  const ns = pointNames(e.args, names);
  return ns !== undefined && glues(ns) ? ns.join('') : undefined;
}

/** The arguments as texts, with the runs among them, or undefined when none is a run. */
function withRuns(
  args: readonly Expr[],
  names: Names,
  inner: (x: Expr) => string,
): { readonly texts: string[]; readonly sizes: (number | undefined)[] } | undefined {
  const runs = args.map((a) => runOf(a, names));
  if (runs.every((r) => r === undefined)) return undefined;
  return {
    texts: args.map((a, i) => runs[i] ?? inner(a)),
    sizes: args.map((a, i) =>
      runs[i] !== undefined && a.kind === 'call' ? a.args.length : undefined,
    ),
  };
}

/** Rule 2: `tool(ABC)` for a call of exactly three point names that is read back spread. */
function triangleCall(e: CallExpr, names: Names, registry: Registry): string | undefined {
  if (e.args.length !== 3 || e.selectors.length > 0) return undefined;
  const spec = registry.get(e.tool);
  if (spec === undefined || spec.signatures.some((s) => s.imageOf !== undefined)) return undefined;
  const ns = pointNames(e.args, names);
  if (ns === undefined || !glues(ns)) return undefined;
  return runReading(e.tool, [3], registry) === 'spread' ? `${e.tool}(${ns.join('')})` : undefined;
}

function callHook(names: Names, registry: Registry): CallHook {
  return (e, inner) => {
    const tri = triangleCall(e, names, registry);
    if (tri !== undefined) return tri;
    // Rule 1; a call with selectors keeps them after its arguments, as the canonical form does.
    if (e.selectors.length > 0) return undefined;
    const r = withRuns(e.args, names, inner);
    if (r === undefined || runReading(e.tool, r.sizes, registry) !== 'written') return undefined;
    return `${e.tool}(${r.texts.join(', ')})`;
  };
}

/** The low-level selector of a call that has exactly one selector, of that kind. */
function lowSelector(
  e: Expr,
): { kind: 'along' | 'orient'; sign: 1 | -1; call: CallExpr } | undefined {
  if (e.kind !== 'call' || e.selectors.length !== 1) return undefined;
  const [s] = e.selectors;
  if (s === undefined || (s.kind !== 'along' && s.kind !== 'orient')) return undefined;
  return { kind: s.kind, sign: s.sign, call: { ...e, selectors: [] } };
}

/** Rule 3: the objects at `i` and `i + 1` as `X, Y = call(…)`, or undefined. */
function pairText(
  doc: Document,
  i: number,
  names: Names,
  hook: CallHook,
  low: (c: CallExpr) => 'along' | 'orient' | undefined,
): string | undefined {
  const [a, b] = [doc.objects[i], doc.objects[i + 1]];
  if (a === undefined || b === undefined) return undefined;
  const [p, q] = [lowSelector(a.def), lowSelector(b.def)];
  if (p === undefined || q === undefined || p.kind !== q.kind) return undefined;
  if (p.sign !== 1 || q.sign !== -1 || !exprEquals(p.call, q.call)) return undefined;
  if (low(p.call) !== p.kind) return undefined;
  const tool = p.call.tool;
  const text = printExpr(p.call, names, hook);
  const alias = PAIR_NAMES[tool];
  const shown =
    alias !== undefined && text.startsWith(`${tool}(`) ? alias + text.slice(tool.length) : text;
  return `${a.name}, ${b.name} = ${shown}`;
}

/**
 * The short notation of `doc` (never throws). `registry` is the one the text is read with:
 * the printer writes a short form only where that registry's tools read it back.
 */
export function printShort(doc: Document, registry: Registry): string {
  const kinds = objectKinds(doc, registry);
  const low = (c: CallExpr) => branchLow(c, (id) => kinds.get(id), registry);
  const notation: Notation = {
    call: (names) => callHook(names, registry),
    kindCall: (kind, args, names) => {
      const inner = (x: Expr): string => printExpr(x, names, callHook(names, registry));
      const r = withRuns(args, names, inner);
      const texts =
        r !== undefined && conditionReading(kind, r.sizes) === 'written'
          ? r.texts
          : args.map(inner);
      return `${kind}(${texts.join(', ')})`;
    },
    pair: (d, i, names) => pairText(d, i, names, callHook(names, registry), low),
  };
  return printIn(doc, notation);
}
