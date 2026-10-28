/**
 * Cross ratios through a pencil (ADR-0040 decision 18): four concurrent lines through O cut a
 * line not through O, and a circle through O, in four points with the same cross ratio as the
 * lines (the pencil's cross ratio is the cross ratio of any section; from a point of a circle,
 * the inscribed angles make the section of the circle a section of a line). So a known
 * cross_ratio_lines / harmonic_lines fact gives the points' fact on each such section, and a
 * known cross_ratio / harmonic fact on four points of a line or a circle gives the lines' fact
 * from each point O (off the line, on the circle) joined to them, in the same argument order and
 * with the same literal. The rule reads what the closure knows (the line and circle classes and
 * the facts it was given), so a pair like harmonic(A, C; P, X) and the pencil cutting it out is
 * one fact, not two. Sound: every incidence used is one the closure holds; the four lines are
 * distinct line classes and the four points distinct point classes.
 */
import { claimKey, type KeyArg } from '@geomira/claims/symmetry';
import type { Closure } from './closure';
import type { TermArg } from './closure-view';

/** The kind of the other form: points ↔ lines. */
const PAIRED: Readonly<Record<string, string>> = {
  harmonic: 'harmonic_lines',
  cross_ratio: 'cross_ratio_lines',
  harmonic_lines: 'harmonic',
  cross_ratio_lines: 'cross_ratio',
};

/** Whether the paired kind over these classes (and the same literals) was given. */
function given(c: Closure, kind: string, classes: readonly string[], lits: readonly TermArg[]) {
  const spec = c.kinds.get(kind);
  if (spec === undefined) return false;
  const args: KeyArg[] = [
    ...classes.map((key) => ({ key })),
    ...lits.flatMap((a) => ('lit' in a ? [{ lit: a.lit }] : [])),
  ];
  return c.generic.has(claimKey(spec, args));
}

/** The point classes on every one of these sets. */
function common(sets: readonly (ReadonlySet<string> | undefined)[]): string[] {
  const [first, ...rest] = sets;
  if (first === undefined) return [];
  return [...first].filter((p) => rest.every((s) => s?.has(p) === true));
}

function distinct(xs: readonly string[]): boolean {
  return new Set(xs).size === xs.length;
}

/** Points → lines: a pencil from a point off their line, or on their circle, was given. */
function fromPoints(c: Closure, kind: string, pts: readonly string[], lits: readonly TermArg[]) {
  const onLine = [...c.lineSets].filter(([, s]) => pts.every((p) => s.has(p)));
  const onCircle = [...c.circleSets].filter(([, s]) => pts.every((p) => s.has(p)));
  const centres = new Set<string>();
  for (const [, s] of onCircle) for (const o of s) if (!pts.includes(o)) centres.add(o);
  if (onLine.length > 0)
    for (const s of c.lineSets.values())
      for (const o of s) if (!onLine.some(([, t]) => t.has(o))) centres.add(o);
  for (const o of centres) {
    const ls = pts.map((p) => c.lineThrough(o, p));
    const classes = ls.flatMap((l) => (l === undefined ? [] : [`L${l}`]));
    if (classes.length === 4 && distinct(classes) && given(c, PAIRED[kind] ?? '', classes, lits))
      return true;
  }
  return false;
}

/** Lines → points: a section by a line off their common point, or a circle through it, was given. */
function fromLines(c: Closure, kind: string, ls: readonly string[], lits: readonly TermArg[]) {
  if (!distinct(ls)) return false;
  const sets = ls.map((l) => c.lineSets.get(l));
  for (const o of common(sets)) {
    const sections = [
      ...[...c.lineSets].filter(([t, s]) => !ls.includes(t) && !s.has(o)).map(([, s]) => s),
      ...[...c.circleSets.values()].filter((s) => s.has(o)),
    ];
    for (const t of sections) {
      const pts = sets.map((s) => common([s, t]).filter((p) => p !== o));
      if (pts.some((x) => x.length !== 1)) continue;
      const classes = pts.map((x) => `P${x[0] ?? ''}`);
      if (distinct(classes) && given(c, PAIRED[kind] ?? '', classes, lits)) return true;
    }
  }
  return false;
}

/** Whether a cross-ratio fact follows from its paired form given on a pencil and a section. */
export function crossRatioBySection(c: Closure, kind: string, args: readonly TermArg[]): boolean {
  if (PAIRED[kind] === undefined || args.length < 4) return false;
  const keys = args.slice(0, 4).map((a) => ('key' in a ? a.key : undefined));
  const lits = args.slice(4);
  if (keys.some((k) => k === undefined)) return false;
  const ks = keys.filter((k): k is string => k !== undefined);
  return kind.endsWith('_lines')
    ? fromLines(
        c,
        kind,
        ks.map((k) => c.lines.find(k)),
        lits,
      )
    : fromPoints(
        c,
        kind,
        ks.map((k) => c.points.find(k)),
        lits,
      );
}
