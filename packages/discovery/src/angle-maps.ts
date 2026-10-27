/**
 * The maps' angle congruences (ADR-0039), for the angle lattice (angle-lattice.ts): a similarity
 * turns every direction by its φ (reverses it when anti: the mirror's axis then bisects φ and
 * every XX* is perpendicular to it), and about a fixed point P of a direct similarity the
 * triangles P X X* are all similar; an inversion with centre O makes ∡OXY = ∡X*Y*O.
 */
import { lineDir, pointDir } from './angle-rules';
import { AngleVars, degrees, Row } from './angles';
import type { ClosureState } from './closure-view';
import { imagesOf, pointPairs } from './closure-maps';
import type { Vector } from './lattice';
import type { MapRecord } from './terms';

/** Congruences from the maps of one figure at most (pairs of image pairs grow quadratically). */
export const MAX_MAP_ROWS = 2000;

/** A map's congruences: a similarity turns every direction by its φ (reverses it when anti). */
function similarityRows(c: ClosureState, vars: AngleVars, m: MapRecord): Vector[] {
  const s = m.type === 'similarity' ? 1 : -1;
  const phi = `phi:${m.key}`;
  const out: Vector[] = [];
  const turn = degrees(m.turn);
  if (s === 1 && turn !== undefined) out.push(new Row(vars).add(phi, 1).equals(turn));
  const pairs = pointPairs(c, m);
  for (let i = 0; i < pairs.length; i++)
    for (let j = i + 1; j < pairs.length; j++) {
      const [[x, xi], [y, yi]] = [pairs[i] ?? ['', ''], pairs[j] ?? ['', '']];
      const [d, di] = [pointDir(c, x, y), pointDir(c, xi, yi)];
      if (d !== undefined && di !== undefined)
        out.push(new Row(vars).add(di, 1).add(d, -s).add(phi, -1).equals(0));
    }
  for (const x of imagesOf(c, m)) {
    const [d, di] = [lineDir(c, x.pre), lineDir(c, x.img)];
    if (d !== undefined && di !== undefined)
      out.push(new Row(vars).add(di, 1).add(d, -s).add(phi, -1).equals(0));
  }
  // About a fixed point P of a direct similarity, the triangles P X X* are all similar:
  // ∡(PX, XX*) is one angle (a variable of the map) for every X.
  const [p] = m.fixedPoints;
  if (s === 1 && p !== undefined)
    for (const [x, xi] of pairs) {
      const [a, b] = [pointDir(c, x, xi), pointDir(c, p, x)];
      if (a !== undefined && b !== undefined && !c.points.same(x, p))
        out.push(new Row(vars).add(a, 1).add(b, -1).add(`alpha:${m.key}`, -1).equals(0));
    }
  const axis = m.fixedCurve === undefined ? undefined : lineDir(c, m.fixedCurve);
  if (s === -1 && axis !== undefined) {
    out.push(new Row(vars).add(phi, 1).add(axis, -2).equals(0));
    for (const [x, xi] of pairs) {
      const d = pointDir(c, x, xi);
      if (d !== undefined) out.push(new Row(vars).add(d, 1).add(axis, -1).equals(90));
    }
  }
  return out;
}

/** An inversion with centre O: ∡OXY = ∡X*Y*O, i.e. d(X*Y*) + d(XY) ≡ d(OX) + d(OY). */
function inversionRows(c: ClosureState, vars: AngleVars, m: MapRecord): Vector[] {
  const o = m.center;
  if (o === undefined) return [];
  const pairs = pointPairs(c, m).filter(([x, xi]) => c.apart(x, o) && c.apart(xi, o));
  const out: Vector[] = [];
  for (let i = 0; i < pairs.length; i++)
    for (let j = i + 1; j < pairs.length; j++) {
      const [[x, xi], [y, yi]] = [pairs[i] ?? ['', ''], pairs[j] ?? ['', '']];
      const ds = [pointDir(c, xi, yi), pointDir(c, x, y), pointDir(c, o, x), pointDir(c, o, y)];
      const [a, b, d1, d2] = ds;
      if (a === undefined || b === undefined || d1 === undefined || d2 === undefined) continue;
      out.push(new Row(vars).add(a, 1).add(b, 1).add(d1, -1).add(d2, -1).equals(0));
    }
  return out;
}

/** Every map's congruences (at most MAX_MAP_ROWS). */
export function mapRows(c: ClosureState, vars: AngleVars): Vector[] {
  const out: Vector[] = [];
  for (const m of c.terms.maps.values()) {
    if (m.type === 'similarity' || m.type === 'anti-similarity')
      out.push(...similarityRows(c, vars, m));
    if (m.type === 'inversion') out.push(...inversionRows(c, vars, m));
    if (out.length >= MAX_MAP_ROWS) return out.slice(0, MAX_MAP_ROWS);
  }
  return out;
}
