/**
 * Lines through a projective map (ADR-0040 decision 18): a projective map takes collinear points
 * to collinear points, so for every line class of the closure the images of its points (those
 * whose images are finite points of the figure) lie on one line. Added to the raw line sets, they
 * merge like any other incidence (closure-merge.ts), so the angle lattice and the incidence rules
 * know the images' lines (the angles at an image point between images of collinear points follow).
 * A map that takes the line at infinity onto a line l (send_to_infinity(l)) puts the image of
 * every point at infinity of the figure on l.
 * Sound: it only follows the map's images; a point at infinity is never put on a line.
 */
import { imagesOf } from './closure-maps';
import type { Sets } from './closure-merge';
import type { ClosureState } from './closure-view';

/** Adds the points to the raw line set `key`; whether it grew. */
function addTo(raw: Sets, key: string, pts: readonly string[]): boolean {
  const set = raw.get(key) ?? new Set<string>();
  const before = set.size;
  for (const k of pts) set.add(k);
  raw.set(key, set);
  return set.size > before;
}

/** Adds the image lines of every projective map; whether any raw line set grew. */
export function projectiveLines(c: ClosureState, raw: { readonly lines: Sets }): boolean {
  let changed = false;
  for (const m of c.terms.maps.values()) {
    if (m.type !== 'projective') continue;
    const image = new Map<string, string>();
    const atInfinity: string[] = [];
    for (const x of imagesOf(c, m)) {
      if (c.ideal.has(x.pre) && c.at(x.img) !== undefined) atInfinity.push(x.img);
      if (c.isLine(x.pre) || c.isCircle(x.pre) || c.at(x.img) === undefined) continue;
      image.set(c.points.find(x.pre), x.img);
    }
    for (const [cls, pts] of c.lineSets) {
      const imgs = [...pts].flatMap((p) => {
        const k = image.get(c.points.find(p));
        return k === undefined ? [] : [k];
      });
      if (imgs.length < 2) continue;
      if (addTo(raw.lines, `~proj|${m.key}|${cls}`, imgs)) changed = true;
    }
    if (m.infinityImage !== undefined && atInfinity.length > 0)
      if (addTo(raw.lines, m.infinityImage, atInfinity)) changed = true;
  }
  return changed;
}
