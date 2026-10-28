/**
 * A harmonic quadruple that holds by an inversion alone (ADR-0040 decision 18, in the manner of
 * ADR-0039's map rules): for the inversion in a circle c with centre O, a point X and its image
 * X*, and the two points P, Q where line OX meets c, (P, Q; X, X*) = −1 (inverse points divide
 * the diameter PQ harmonically; a classical fact). The rule reads what the closure knows: X* the
 * image of X, P and Q on the fixed circle (fixed by the map), O, P, X and O, Q, X collinear, P
 * and Q apart. Every arrangement of the harmonic symmetry is tried, so the rule is sound for
 * the claim, whatever order its arguments come in.
 */
import type { TermArg } from './closure-view';
import { fixedBy, imagesOf } from './closure-maps';
import type { Closure } from './closure';

/** The arrangements (P, Q; X, X*) of a harmonic claim's arguments, up to its symmetries. */
const ARRANGEMENTS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3],
  [0, 1, 3, 2],
  [2, 3, 0, 1],
  [2, 3, 1, 0],
];

/** Whether harmonic(args) follows from an inversion's images and its fixed circle. */
export function harmonicByInversion(c: Closure, kind: string, args: readonly TermArg[]): boolean {
  if (kind !== 'harmonic' || args.length !== 4) return false;
  const keys = args.map((a) => ('key' in a ? a.key : undefined));
  for (const m of c.terms.maps.values()) {
    const o = m.center;
    if (m.type !== 'inversion' || o === undefined || m.fixedCurve === undefined) continue;
    const images = imagesOf(c, m);
    for (const [i, j, k, l] of ARRANGEMENTS) {
      const [p, q, x, y] = [keys[i], keys[j], keys[k], keys[l]];
      if (p === undefined || q === undefined || x === undefined || y === undefined) continue;
      const paired = images.some(
        (r) => c.classOf(r.pre) === c.classOf(x) && c.classOf(r.img) === c.classOf(y),
      );
      if (!paired || !c.apart(p, q) || !fixedBy(c, m, p) || !fixedBy(c, m, q)) continue;
      const onLine = (a: string) => c.holds('collinear', [{ key: o }, { key: a }, { key: x }]);
      if (onLine(p) && onLine(q)) return true;
    }
  }
  return false;
}
