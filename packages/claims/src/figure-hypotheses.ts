/**
 * The hypotheses (`assume` lines) in the CURRENT figure (note B of Run 8b, ADR-0013): for
 * each assumption, whether the figure on the screen satisfies it, decided exactly as the
 * tester decides a sample (checkAssumption on the float values of its arguments, with the
 * band), and, when it does not, a plain sentence with the deciding measure ("This figure is
 * not acute: ∠B ≈ 104°"). The web app shows the sentence at the assumption's line, so a
 * test run on a figure outside its declared configuration is explained by the figure
 * itself rather than by a generic "hard to satisfy". The tests still run.
 *
 * Statuses: holds · fails · ambiguous (a deciding quantity inside the band: "at the edge of")
 * · undefined (an argument is Undefined or of the wrong kind, with the reason) · invalid (the
 * claims package does not accept the assumption, or the figure has no evaluation context).
 */
import { FloatField } from '@geomira/num/float-field';
import { evalContextFor } from '@geomira/kernel/context';
import type { Assumption, Document } from '@geomira/kernel/document';
import { evaluate } from '@geomira/kernel/evaluate';
import type { Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { formatExpr } from '@geomira/kernel/selector';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value } from '@geomira/kernel/value';
import * as f from './float';
import { assumptionProblem, checkAssumption, comparisonDim, type HypStatus } from './hypotheses';
import { addProbes } from './probes';

export type FigureStatus = HypStatus | 'undefined' | 'invalid';

export interface FigureHypothesis {
  /** The assumption's id. */
  readonly id: number;
  /** The assumption as the user reads it ("acute(A, B, C)", "AB > AC"). */
  readonly text: string;
  readonly status: FigureStatus;
  /** Why the figure does not satisfy it; null when it does. */
  readonly message: string | null;
}

type Names = (id: number) => string | undefined;

const COMPARISON: Readonly<Record<string, string>> = Object.freeze({
  less: '<',
  greater: '>',
  not_equal: '≠',
});

/** A measure as written: AB for dist(A, B), ∠ABC for angle(A, B, C) of named points. */
function measureText(e: Expr, names: Names): string {
  if (e.kind === 'call' && e.selectors.length === 0 && e.args.every((a) => a.kind === 'ref')) {
    const ns = e.args.map((a) => formatExpr(a, names));
    const glued = ns.every((x) => /^[A-Z]/u.test(x));
    if (glued && e.tool === 'dist' && ns.length === 2) return ns.join('');
    if (glued && e.tool === 'angle' && ns.length === 3) return `∠${ns.join('')}`;
  }
  return formatExpr(e, names);
}

/** The assumption as the user reads it. */
export function assumptionText(a: Assumption, names: Names): string {
  const t = (e: Expr) => formatExpr(e, names);
  const op = COMPARISON[a.kind];
  const [x, y] = a.args;
  if (op !== undefined && x !== undefined && y !== undefined)
    return `${measureText(x, names)} ${op} ${measureText(y, names)}`;
  if (a.kind === 'inside' && x !== undefined && y !== undefined) return `${t(x)} inside ${t(y)}`;
  if (a.kind === 'in_order' && a.args.length >= 2) {
    const curve = a.args[a.args.length - 1];
    const pts = a.args.slice(0, -1).map(t).join(', ');
    return curve === undefined ? pts : `${pts} in order on ${t(curve)}`;
  }
  return `${a.kind}(${a.args.map(t).join(', ')})`;
}

/** Degrees with at most one decimal; lengths with three significant digits. */
function degrees(x: number): string {
  return `${String(Math.round(x * 10) / 10)}°`;
}
function length(x: number): string {
  return String(Number(x.toPrecision(3)));
}

/** The angle at p[i] of the triangle p, degrees. */
function angleAt(p: readonly f.V[], i: number): number {
  const [a, b, c] = [p[i], p[(i + 1) % 3], p[(i + 2) % 3]];
  if (a === undefined || b === undefined || c === undefined) return 0;
  const [u, v] = [f.sub(b, a), f.sub(c, a)];
  return (Math.atan2(Math.abs(f.cross(u, v)), f.dot(u, v)) * 180) / Math.PI;
}

function points(args: readonly Value<number>[]): f.V[] {
  return args.flatMap((v) => (v.kind === 'point' ? [v] : []));
}

/** The deciding measure of a failed or ambiguous assumption, or '' when none is shown. */
function measure(a: Assumption, args: readonly Value<number>[], names: Names): string {
  const t = (i: number) => {
    const e = a.args[i];
    return e === undefined ? '?' : formatExpr(e, names);
  };
  switch (a.kind) {
    case 'acute': {
      const p = points(args);
      const angles = [0, 1, 2].map((i) => angleAt(p, i));
      const worst = angles.indexOf(Math.max(...angles));
      return `∠${t(worst)} ≈ ${degrees(angles[worst] ?? 0)}`;
    }
    case 'scalene': {
      const p = points(args);
      const sides = [0, 1, 2].map((i) => {
        const [u, v] = [p[i], p[(i + 1) % 3]];
        return { name: `${t(i)}${t((i + 1) % 3)}`, len: u && v ? f.dist(u, v) : 0 };
      });
      const pairs = [
        [0, 1],
        [1, 2],
        [0, 2],
      ].map(([i, j]) => ({ s: sides[i ?? 0], r: sides[j ?? 0] }));
      const close = pairs.reduce((m, q) =>
        Math.abs((q.s?.len ?? 0) - (q.r?.len ?? 0)) < Math.abs((m.s?.len ?? 0) - (m.r?.len ?? 0))
          ? q
          : m,
      );
      return `${close.s?.name ?? ''} ≈ ${close.r?.name ?? ''} ≈ ${length(close.s?.len ?? 0)}`;
    }
    case 'convex':
      return a.args.map((_, i) => t(i)).join(', ');
    case 'less':
    case 'greater':
    case 'not_equal':
      return a.args
        .map((e, i) => {
          const v = args[i];
          if (e.kind === 'lit' || v?.kind !== 'number') return formatExpr(e, names);
          const isAngle = e.kind === 'call' && e.tool === 'angle';
          return `${measureText(e, names)} ≈ ${isAngle ? degrees(v.v) : length(v.v)}`;
        })
        .join(', ');
    default:
      return '';
  }
}

function sentence(a: Assumption, status: HypStatus, text: string, m: string): string | null {
  if (status === 'holds') return null;
  const tail = m === '' ? '' : `: ${m}`;
  if (status === 'ambiguous') return `This figure is at the edge of ${text}${tail}`;
  switch (a.kind) {
    case 'acute':
    case 'scalene':
    case 'convex':
      return `This figure is not ${a.kind}${tail}`;
    case 'inside':
    case 'in_order':
      return `This figure does not have ${text}`;
    default:
      return `This figure does not satisfy ${text}${tail}`;
  }
}

function judge(
  a: Assumption,
  args: readonly Value<number>[],
  ctx: EvalContext,
  names: Names,
): FigureHypothesis {
  const text = assumptionText(a, names);
  const problem = assumptionProblem(a);
  if (problem !== undefined) return { id: a.id, text, status: 'invalid', message: problem };
  const bad = args.findIndex((v) => v.kind === 'undefined' || v.kind === 'inexact');
  const badValue = args[bad];
  const badExpr = a.args[bad];
  if (badValue !== undefined && badExpr !== undefined) {
    const reason = 'reason' in badValue ? badValue.reason : '';
    const what = `${formatExpr(badExpr, names)} is undefined (${reason})`;
    return {
      id: a.id,
      text,
      status: 'undefined',
      message: `This figure does not satisfy ${text}: ${what}`,
    };
  }
  const d = comparisonDim(a.args);
  const status = checkAssumption(a.kind, args, d.ok ? d.dim : 'number', ctx);
  const m = status === 'holds' ? '' : measure(a, args, names);
  return { id: a.id, text, status, message: sentence(a, status, text, m) };
}

/** Every assumption of `doc` in its current figure (see the module comment), in order. */
export function hypothesesInFigure(doc: Document, registry: Registry): FigureHypothesis[] {
  const names = new Map(doc.objects.map((o) => [o.id, o.name]));
  const nameOf: Names = (id) => names.get(id);
  const c = evalContextFor(doc);
  if (!c.ok)
    return doc.assumptions.map((a) => ({
      id: a.id,
      text: assumptionText(a, nameOf),
      status: 'invalid',
      message: c.reason,
    }));
  const probed = addProbes(
    doc,
    doc.assumptions.flatMap((a) => a.args),
  );
  const values = evaluate(probed.doc, registry, FloatField, c.ctx).values;
  let k = 0;
  return doc.assumptions.map((a) => {
    const ids = probed.ids.slice(k, k + a.args.length);
    k += a.args.length;
    const args = ids.map(
      (id): Value<number> => values.get(id) ?? { kind: 'undefined', reason: 'missing' },
    );
    return judge(a, args, c.ctx, nameOf);
  });
}
