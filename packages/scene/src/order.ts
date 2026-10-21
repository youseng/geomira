/**
 * Layer set semantics and draw order (SPEC §8.2, §13; note A of Run 7; ADR-0010).
 *
 * An object belongs to a SET of layers. It is visible iff it is not hidden and ANY of its
 * layers is visible; it is drawn ONCE, in its DRAWING LAYER: the visible layer of its set
 * with the highest `order` (ties: the later layer in the document), whose opacity it takes.
 *
 * The draw order is a sort by stable keys, never by an object's index in the object list
 * (an image's index depends on edit history, ADR-0009): the drawing layer's order (then its
 * position), the style's z, a fixed kind order (polygons, circles, lines, segment marks,
 * angle marks, points, texts; ADR-0010, ADR-0011), the
 * position of the object's origin (the user object its chain of sources starts from), then
 * the positions of the rules along that chain. Permuting the images inside a run of
 * adjacent images changes none of these keys.
 */
import type { DocObject, Layer } from '@geomira/kernel/document';
import type { DocIndex } from './doc-index';
import type { ShapeKind } from './types';

const KIND_RANK: Readonly<Record<ShapeKind, number>> = Object.freeze({
  polygon: 0,
  circle: 1,
  line: 2,
  segment_mark: 3,
  angle_mark: 4,
  point: 5,
  text: 6,
});

function finiteOr0(x: number): number {
  return Number.isFinite(x) ? x : 0;
}

/** The layer an object is drawn in, or undefined when none of its layers is visible. */
export function drawingLayer(index: DocIndex, o: DocObject): Layer | undefined {
  let best: Layer | undefined;
  for (const id of o.layers) {
    const l = index.layer.get(id);
    if (l?.visible !== true) continue;
    if (best === undefined || compare(layerKey(index, l), layerKey(index, best)) > 0) best = l;
  }
  return best;
}

function layerKey(index: DocIndex, l: Layer): number[] {
  return [finiteOr0(l.order), index.layerPosition.get(l.id) ?? -1];
}

/** The draw-order key of an object drawn in `layer` as a shape of `kind` with depth `z`. */
export function drawKey(
  index: DocIndex,
  o: DocObject,
  layer: Layer,
  kind: ShapeKind,
  z: number,
): number[] {
  const origin = index.origin(o);
  return [...layerKey(index, layer), z, KIND_RANK[kind], origin.position, ...origin.rules];
}

/** Lexicographic comparison; a proper prefix sorts first. */
export function compare(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return a.length - b.length;
}
