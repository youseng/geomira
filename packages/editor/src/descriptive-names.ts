/**
 * Names that say what an object is (ADR-0050): a line, segment, ray, circle or tangent a GUI
 * tool builds from named points is named from those points, the tool's letter, `_`, then the
 * points' names glued in pick order:
 *
 *   line(A, C) → l_AC, segment(A, C) → s_AC, ray(A, C) → r_AC, circle(A, B, C) → c_ABC,
 *   circle(O, A) and circle(O, 2) → c_O, tangent at A (or from A) → t_A,
 *   perp(P, l) and parallel(P, l) → l_P.
 *
 * Rules (each a test in descriptive-names.test.ts):
 * - Every point is named by the point grammar (SPEC §11.2: A, A1, A_1, M_a, H'); a point with
 *   another name (a lowercase name, a managed image A*) asks for no descriptive name.
 * - The name must be grammatical (kernel `nameProblem`): M_{ab} (braces) and a primed point
 *   anywhere but last (l_H'A) are not, so they ask for none.
 * - At most MAX_DESCRIPTIVE_NAME code points (c_A_12B_12C_12 is too long).
 * - Taken (by an object, a claim or a layer): the next free variant base_2, base_3, … in turn;
 *   a base that ends with a prime has no grammatical variant, so it then asks for none.
 * Asking for none leaves the usual rule of names.ts (l, l_1, …; c, c_1, …). Existing objects
 * are never renamed: a descriptive name is only chosen for a new object.
 */
import type { Document } from '@geomira/kernel/document';
import { isPointName, nameProblem } from '@geomira/kernel/names';

/** The longest descriptive name chosen, in code points (variants may add `_2`, `_3`, …). */
export const MAX_DESCRIPTIVE_NAME = 12;

/** How a GUI tool names what it builds: its letter and the picks that name it. */
export interface Description {
  /** The tool's letter: l (line), s (segment), r (ray), c (circle), t (tangent). */
  readonly prefix: 'l' | 's' | 'r' | 'c' | 't';
  /** Every pick names it (line AC, circle ABC), or the first only (the center, the point). */
  readonly picks: 'all' | 'first';
}

function taken(doc: Document, name: string): boolean {
  return (
    doc.objects.some((o) => o.name === name) ||
    doc.claims.some((c) => c.name === name) ||
    doc.layers.some((l) => l.name === name)
  );
}

/**
 * The descriptive base for points named `names` (pick order), or undefined when a point is
 * unnamed or not named by the point grammar, or the result is ungrammatical or too long.
 */
export function descriptiveBase(
  d: Description,
  names: readonly (string | undefined)[],
): string | undefined {
  const used = d.picks === 'first' ? names.slice(0, 1) : names;
  const points = used.filter((n): n is string => n !== undefined && isPointName(n));
  if (used.length === 0 || points.length !== used.length) return undefined;
  const base = `${d.prefix}_${points.join('')}`;
  if (nameProblem(base) !== undefined) return undefined;
  return Array.from(base).length <= MAX_DESCRIPTIVE_NAME ? base : undefined;
}

/**
 * The first free grammatical variant of the descriptive name (base, base_2, base_3, …), or
 * undefined when there is none (see descriptiveBase; a taken base ending with a prime).
 */
export function descriptiveName(
  doc: Document,
  d: Description | undefined,
  names: readonly (string | undefined)[],
): string | undefined {
  const base = d === undefined ? undefined : descriptiveBase(d, names);
  if (base === undefined) return undefined;
  for (let k = 1; ; k++) {
    const name = k === 1 ? base : `${base}_${String(k)}`;
    if (nameProblem(name) !== undefined) return undefined;
    if (!taken(doc, name)) return name;
  }
}

/**
 * The name a GUI build asks for: the conventional name when it is free (ADR-0016 decision 23:
 * it wins), else the descriptive one, else none (the usual rule of names.ts then applies).
 */
export function wantedName(
  doc: Document,
  conventional: string | undefined,
  d: Description | undefined,
  names: readonly (string | undefined)[],
): string | undefined {
  if (conventional !== undefined && nameProblem(conventional) === undefined)
    if (!taken(doc, conventional)) return conventional;
  return descriptiveName(doc, d, names);
}
