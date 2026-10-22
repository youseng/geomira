/**
 * Names for objects and layers the GUI creates. Points take the first free capital
 * A, B, …, Z, then A_1 … Z_1, A_2 …; other kinds a lowercase base with subscripts (l, l_1,
 * l_2 …). A name is free when no object, claim or layer uses it and the kernel accepts it
 * (SPEC §11.2 grammar: every name produced here is grammatical).
 */
import type { Document } from '@geomira/kernel/document';
import { nameProblem } from '@geomira/kernel/names';

export type NameKind =
  | 'point'
  | 'line'
  | 'circle'
  | 'polygon'
  | 'distance'
  | 'angle'
  | 'number'
  | 'mark'
  | 'text'
  | 'transform'
  | 'layer';

const BASES: Readonly<Record<Exclude<NameKind, 'point'>, string>> = Object.freeze({
  line: 'l',
  circle: 'c',
  polygon: 'poly',
  distance: 'd',
  angle: 'α',
  number: 'k',
  mark: 'mk',
  text: 'txt',
  transform: 'f',
  layer: 'image',
});

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function used(doc: Document): Set<string> {
  return new Set([
    ...doc.objects.map((o) => o.name),
    ...doc.claims.flatMap((c) => (c.name === undefined ? [] : [c.name])),
    ...doc.layers.map((l) => l.name),
  ]);
}

/** The first free name of a kind in `doc` (deterministic). */
export function freshName(doc: Document, kind: NameKind): string {
  const taken = used(doc);
  const ok = (n: string) => !taken.has(n) && nameProblem(n) === undefined;
  for (let k = 0; ; k++) {
    if (kind === 'point') {
      for (const c of LETTERS) {
        const n = k === 0 ? c : `${c}_${String(k)}`;
        if (ok(n)) return n;
      }
    } else {
      const base = BASES[kind];
      const n = k === 0 ? base : `${base}_${String(k)}`;
      if (ok(n)) return n;
    }
  }
}
