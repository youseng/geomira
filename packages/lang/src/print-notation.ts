/**
 * Printing claims and assumptions in the notation of SPEC §10–§11 (parse-notation.ts reads
 * it back to the same kind and arguments). A form that does not fit the arguments (not
 * point names, a parameter that is not a literal, a wrong count) falls back to the kind
 * call, which every kind accepts: `length(A, B, C, D, 2)`.
 */
import type { Expr, LitExpr } from '@geomira/kernel/expr';
import { isPointName } from '@geomira/kernel/names';
import { eq, ONE } from '@geomira/num/rational';
import { litText, printExpr, type Names } from './print-expr';

function call(kind: string, args: readonly Expr[], names: Names): string {
  return `${kind}(${args.map((a) => printExpr(a, names)).join(', ')})`;
}

/** A point name for a reference to a point-named object, else undefined. */
function pointName(e: Expr | undefined, names: Names): string | undefined {
  const n = e?.kind === 'ref' ? names(e.id) : undefined;
  return n !== undefined && isPointName(n.replace(/\*+$/u, '')) ? n : undefined;
}

/** Glued point names (`AB`, `ABC`) when every argument is one. */
function glued(args: readonly (Expr | undefined)[], names: Names): string | undefined {
  const ns = args.map((a) => pointName(a, names));
  return ns.every((n) => n !== undefined) ? ns.join('') : undefined;
}

function list(args: readonly (Expr | undefined)[], names: Names): string {
  return args.map((a) => (a === undefined ? '' : printExpr(a, names))).join(', ');
}

function seg(a: Expr | undefined, b: Expr | undefined, names: Names): string {
  return glued([a, b], names) ?? `dist(${list([a, b], names)})`;
}

function angle(xs: readonly (Expr | undefined)[], names: Names): string {
  return `∠${glued(xs, names) ?? `(${list(xs, names)})`}`;
}

function dangle(xs: readonly (Expr | undefined)[], names: Names): string {
  return `∡${glued(xs, names) ?? `(${list(xs, names)})`}`;
}

function lit(e: Expr | undefined): LitExpr | undefined {
  return e?.kind === 'lit' ? e : undefined;
}

/** A literal that is exactly 1 with no written form (omitted in `AB = CD`, `∡ABC = ∡DEF`). */
function isPlainOne(l: LitExpr): boolean {
  return l.text === undefined && eq(l.value, ONE);
}

/** Calls that read as special terms on a side of `=`; equal(…) of those keeps the call. */
function plainSide(e: Expr): boolean {
  if (e.kind === 'ref') return true;
  if (e.kind !== 'call') return false;
  return !['angle', 'dist', 'add', 'sub', 'mul', 'div', 'neg'].includes(e.tool);
}

/** `harmonic(A, B; C, D)` and `cross_ratio(A, B, C, D) = k` (ADR-0040); undefined: not that form. */
function crossRatioBody(kind: string, a: readonly Expr[], names: Names): string | undefined {
  if (kind === 'harmonic')
    return a.length === 4
      ? `harmonic(${list(a.slice(0, 2), names)}; ${list(a.slice(2, 4), names)})`
      : undefined;
  const k = lit(a[4]);
  return a.length === 5 && k !== undefined
    ? `cross_ratio(${list(a.slice(0, 4), names)}) = ${litText(k)}`
    : undefined;
}

/** `similar(ABC, DEF)`: two glued triangles when all six are point names (ADR-0051). */
function triangles(kind: string, a: readonly Expr[], names: Names): string | undefined {
  if (a.length !== 6) return undefined;
  const [p, q] = [glued(a.slice(0, 3), names), glued(a.slice(3, 6), names)];
  return p === undefined || q === undefined ? undefined : `${kind}(${p}, ${q})`;
}

/** The bodies of ADR-0051's kinds, or undefined (another kind, or arguments that do not fit). */
function lengthsAndTriangles(kind: string, a: readonly Expr[], names: Names): string | undefined {
  switch (kind) {
    case 'length_product':
      return a.length === 8
        ? `${seg(a[0], a[1], names)}·${seg(a[2], a[3], names)} = ${seg(a[4], a[5], names)}·${seg(a[6], a[7], names)}`
        : undefined;
    case 'length_sum':
      return a.length === 6
        ? `${seg(a[0], a[1], names)} + ${seg(a[2], a[3], names)} = ${seg(a[4], a[5], names)}`
        : undefined;
    case 'similar':
    case 'similar_direct':
    case 'similar_opposite':
    case 'congruent':
    case 'congruent_direct':
    case 'congruent_opposite':
      return triangles(kind, a, names);
    default:
      return undefined;
  }
}

/** `claim …` body (without attributes). */
export function printClaimBody(kind: string, args: readonly Expr[], names: Names): string {
  const a = args;
  const n = a.length;
  const fallback = call(kind, args, names);
  const extra = lengthsAndTriangles(kind, a, names);
  if (extra !== undefined) return extra;
  switch (kind) {
    case 'equal': {
      const [x, y] = a;
      return n === 2 && x !== undefined && y !== undefined && plainSide(x) && plainSide(y)
        ? `${printExpr(x, names)} = ${printExpr(y, names)}`
        : fallback;
    }
    case 'length': {
      const k = lit(a[4]);
      if (n !== 5 || k === undefined) return fallback;
      const scale = isPlainOne(k) ? '' : `${litText(k)}·`;
      return `${seg(a[0], a[1], names)} = ${scale}${seg(a[2], a[3], names)}`;
    }
    case 'ratio':
      return n === 8
        ? `${seg(a[0], a[1], names)}/${seg(a[2], a[3], names)} = ${seg(a[4], a[5], names)}/${seg(a[6], a[7], names)}`
        : fallback;
    case 'ratio_value': {
      const k = lit(a[4]);
      return n === 5 && k !== undefined
        ? `${seg(a[0], a[1], names)}/${seg(a[2], a[3], names)} = ${litText(k)}`
        : fallback;
    }
    case 'dangle': {
      const m = lit(a[0]);
      if (n !== 7 || m === undefined) return fallback;
      return `${isPlainOne(m) ? '' : litText(m)}${dangle(a.slice(1, 4), names)} = ${dangle(a.slice(4, 7), names)}`;
    }
    case 'dangle_lines': {
      const t = lit(a[2]);
      return n === 3 && t !== undefined
        ? `∡(${list(a.slice(0, 2), names)}) = ${litText(t)}`
        : fallback;
    }
    case 'angle_eq':
      return n === 6 ? `${angle(a.slice(0, 3), names)} = ${angle(a.slice(3, 6), names)}` : fallback;
    case 'harmonic':
    case 'cross_ratio':
      return crossRatioBody(kind, a, names) ?? fallback;
    case 'angle_sum':
    case 'angle_diff': {
      const t = lit(a[6]);
      const op = kind === 'angle_sum' ? '+' : '-';
      return n === 7 && t !== undefined
        ? `${angle(a.slice(0, 3), names)} ${op} ${angle(a.slice(3, 6), names)} = ${litText(t)}`
        : fallback;
    }
    default:
      return fallback;
  }
}

/** A measure of a comparison: `AB`, `∠ABC`, a number; undefined for anything else. */
function measure(e: Expr | undefined, names: Names): string | undefined {
  if (e?.kind === 'lit') return litText(e);
  if (e?.kind !== 'call' || e.selectors.length > 0) return undefined;
  if (e.tool === 'dist' && e.args.length === 2) return seg(e.args[0], e.args[1], names);
  if (e.tool === 'angle' && e.args.length === 3)
    return glued(e.args, names) === undefined
      ? `angle(${list(e.args, names)})`
      : angle(e.args, names);
  return undefined;
}

const COMPARE: Readonly<Record<string, string>> = { less: '<', greater: '>', not_equal: '≠' };

/** `assume …` body. */
export function printConditionBody(kind: string, args: readonly Expr[], names: Names): string {
  const fallback = call(kind, args, names);
  const op = COMPARE[kind];
  if (op !== undefined) {
    const [x, y] = [measure(args[0], names), measure(args[1], names)];
    return args.length === 2 && x !== undefined && y !== undefined ? `${x} ${op} ${y}` : fallback;
  }
  if (kind === 'inside') {
    const p = pointName(args[0], names);
    const poly = args[1];
    return args.length === 2 && p !== undefined && poly !== undefined
      ? `${p} inside ${printExpr(poly, names)}`
      : fallback;
  }
  if (kind === 'in_order') {
    const pts = args.slice(0, -1).map((x) => pointName(x, names));
    const curve = args[args.length - 1];
    const ok = pts.length >= 1 && pts.every((x) => x !== undefined) && curve !== undefined;
    return ok ? `${pts.join(', ')} in order on ${printExpr(curve, names)}` : fallback;
  }
  return fallback;
}
