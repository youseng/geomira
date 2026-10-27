/**
 * Direction variables and the angle rows of particular constructions (ADR-0039), for the angle
 * lattice of angles.ts: a direction is the parallel class of a known line, else its segment;
 * a midline MN (closure-mid.ts) is parallel to YZ; a bisector l of ∠PVQ (internal or external)
 * satisfies 2·d(l) ≡ d(VP) + d(VQ) (mod 180°), which holds in every case its tool defines,
 * the straight and the zero angle included; an isosceles triangle MXY has equal base angles,
 * d(MX) + d(MY) ≡ 2·d(XY).
 */
import { midlines } from './closure-mid';
import type { ClosureState } from './closure-view';

/** A linear congruence Σ k·var ≡ value (mod 180°). */
export interface Linear {
  readonly terms: readonly (readonly [string, number])[];
  readonly value: number;
}

/** Tools whose line l through V bisects ∠PVQ (args P, V, Q). */
const BISECTORS: readonly string[] = ['bisector', 'ext_bisector'];

/** The direction variable of the line through two apart points. */
export function pointDir(c: ClosureState, p: string, q: string): string | undefined {
  if (!c.apart(p, q)) return undefined;
  const l = c.lineThrough(p, q);
  return l === undefined ? `S:${c.segment(p, q)}` : `P:${c.parallelClass(l)}`;
}

/** The direction variable of a line term. */
export function lineDir(c: ClosureState, l: string): string | undefined {
  return c.isLine(l) ? `P:${c.parallelClass(c.lines.find(l))}` : undefined;
}

/** d(MN) ≡ d(YZ) for each midline. */
function midlineRows(c: ClosureState): Linear[] {
  const out: Linear[] = [];
  for (const [m, n, y, z] of midlines(c)) {
    const [a, b] = [pointDir(c, m, n), pointDir(c, y, z)];
    if (a !== undefined && b !== undefined && a !== b)
      out.push({
        terms: [
          [a, 1],
          [b, -1],
        ],
        value: 0,
      });
  }
  return out;
}

/** 2·d(l) − d(VP) − d(VQ) ≡ 0 for each bisector term l of ∠PVQ. */
function bisectorRows(c: ClosureState): Linear[] {
  const out: Linear[] = [];
  for (const [key, t] of c.terms.terms) {
    if (t.expr.kind !== 'call' || !BISECTORS.includes(t.expr.tool)) continue;
    const [p, v, q] = t.expr.args.map((a) => c.terms.exprKeys.get(a));
    if (p === undefined || v === undefined || q === undefined) continue;
    const [l, a, b] = [lineDir(c, key), pointDir(c, v, p), pointDir(c, v, q)];
    if (l === undefined || a === undefined || b === undefined) continue;
    out.push({
      terms: [
        [l, 2],
        [a, -1],
        [b, -1],
      ],
      value: 0,
    });
  }
  return out;
}

/** d(MX) + d(MY) − 2·d(XY) ≡ 0 for each isosceles triangle MXY (MX = MY): its base angles. */
function isoscelesRows(c: ClosureState): Linear[] {
  const out: Linear[] = [];
  for (const key of c.isosceles) {
    const [m, x, y] = key.split('|');
    if (m === undefined || x === undefined || y === undefined) continue;
    const [a, b, base] = [pointDir(c, m, x), pointDir(c, m, y), pointDir(c, x, y)];
    if (a === undefined || b === undefined || base === undefined) continue;
    out.push({
      terms: [
        [a, 1],
        [b, 1],
        [base, -2],
      ],
      value: 0,
    });
  }
  return out;
}

/** The rows of the particular constructions above. */
export function constructionRows(c: ClosureState): Linear[] {
  return [...midlineRows(c), ...bisectorRows(c), ...isoscelesRows(c)];
}
