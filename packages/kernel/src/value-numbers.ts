/**
 * Every field element inside a value (internal; re-exported by value.ts as `numbersOf`): the
 * evaluator's range checks, the L3 oracle and the baselines read them in a fixed order.
 */
import { assertNever } from '@geomira/num/assert';
import type { TransformData, Value } from './value-types';

/**
 * The entries of a map: a and b, then c and d for a Möbius map; a projective map's matrix row by
 * row; a composite's maps in turn.
 */
function transformNumbers<T>(t: TransformData<T>): T[] {
  switch (t.type) {
    case 'similarity':
      return [t.a.re, t.a.im, t.b.re, t.b.im];
    case 'mobius':
      return [t.a.re, t.a.im, t.b.re, t.b.im, t.c.re, t.c.im, t.d.re, t.d.im];
    case 'projective':
      return [...t.m];
    case 'composite':
      return t.maps.flatMap((x) => transformNumbers(x));
    default:
      return assertNever(t, 'transform');
  }
}

/** Every field element inside a value (coordinates, bounds, radii…), in a fixed order. */
export function numbersOf<T>(v: Value<T>): T[] {
  switch (v.kind) {
    case 'point':
      return [v.x, v.y];
    case 'ideal_point':
      return [v.d.x, v.d.y];
    case 'line':
      return [
        v.p.x,
        v.p.y,
        v.d.x,
        v.d.y,
        ...(v.lo === null ? [] : [v.lo]),
        ...(v.hi === null ? [] : [v.hi]),
      ];
    case 'circle': {
      const arc = v.arc === null ? [] : [v.arc.from.x, v.arc.from.y, v.arc.to.x, v.arc.to.y];
      const anchor = v.anchor === undefined ? [] : [v.anchor.x, v.anchor.y];
      return [v.c.x, v.c.y, v.r2, ...arc, ...anchor];
    }
    case 'number':
      return [v.v];
    case 'polygon':
      return v.pts.flatMap((p) => [p.x, p.y]);
    case 'transform':
      return transformNumbers(v.t);
    case 'conic': {
      const anchor = v.anchor === undefined ? [] : [v.anchor.x, v.anchor.y];
      return [v.a, v.b, v.c, v.d, v.e, v.f, ...anchor];
    }
    case 'angle_mark':
      return [v.b.x, v.b.y, v.from.x, v.from.y, v.to.x, v.to.y];
    case 'segment_mark':
      return [v.p.x, v.p.y, v.q.x, v.q.y];
    case 'text':
      return [v.at.x, v.at.y];
    case 'string':
    case 'undefined':
    case 'inexact':
      return [];
    default:
      return assertNever(v, 'value');
  }
}
