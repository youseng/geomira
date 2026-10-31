/**
 * The Scene (SPEC §13): world-coordinate primitives (y up) in draw order, built from a
 * document and its float values by buildScene, consumed by the layout (screen paths for
 * the canvas and for hit-testing) and by the exporters. Every number in a Scene is finite
 * (law L9): degenerate or unavailable values are listed in `unavailable`, never drawn.
 */
import type { Vec2 } from './viewport';
import type { LabelRun } from './label-text';

export type Dash = 'solid' | 'dashed' | 'dotted';

/** The geometry of one drawn object, in world coordinates. */
export type Shape =
  | { readonly kind: 'point'; readonly at: Vec2 }
  /**
   * The points p + t·u, t in [lo, hi] (null = unbounded), u a unit vector; with `outside`
   * (ADR-0032), the two rays t ≤ lo and t ≥ hi.
   */
  | {
      readonly kind: 'line';
      readonly p: Vec2;
      readonly u: Vec2;
      readonly lo: number | null;
      readonly hi: number | null;
      readonly outside?: true;
    }
  /** A circle, or the counter-clockwise arc from angle `from` to `to` (radians). */
  | {
      readonly kind: 'circle';
      readonly c: Vec2;
      readonly r: number;
      readonly arc: { readonly from: number; readonly to: number } | null;
    }
  /**
   * A conic (ADR-0042, conic-shape.ts): an ellipse c + a·cos τ·u + b·sin τ·v, a hyperbola's two
   * branches c ± a·cosh τ·u + b·sinh τ·v, or a parabola c + a·τ²·u + τ·v (v = rot90(u), u a unit
   * vector; a parabola's c is its vertex and b is 0).
   */
  | {
      readonly kind: 'conic';
      readonly type: 'ellipse' | 'hyperbola' | 'parabola';
      readonly c: Vec2;
      readonly u: Vec2;
      readonly a: number;
      readonly b: number;
    }
  | { readonly kind: 'polygon'; readonly pts: readonly Vec2[] }
  /**
   * An angle mark (ADR-0011): `arcs` arcs, or the right-angle square, at vertex b over the
   * counter-clockwise span from angle `from` to `to` (radians, 0 < to − from < π). Its size
   * on screen is fixed in pixels (mark-paths.ts).
   */
  | {
      readonly kind: 'angle_mark';
      readonly b: Vec2;
      readonly from: number;
      readonly to: number;
      readonly arcs: number;
      readonly right: boolean;
    }
  /** `ticks` tick marks across the middle of the segment pq (ADR-0011). */
  | { readonly kind: 'segment_mark'; readonly p: Vec2; readonly q: Vec2; readonly ticks: number }
  /** A text anchored at `at`; the text itself is drawn as the item's label (ADR-0011). */
  | { readonly kind: 'text'; readonly at: Vec2; readonly text: string }
  /**
   * A distance measurement from p to q (ADR-0048): no stroke; its value is the item's label,
   * at the middle of pq, offset to the left of p → q as seen.
   */
  | { readonly kind: 'distance'; readonly p: Vec2; readonly q: Vec2 };

export type ShapeKind = Shape['kind'];

/** The style a primitive is drawn with (resolved: images inherit their source's style). */
export interface DrawStyle {
  /** A CSS colour as written, or null for the theme's default of the kind. */
  readonly color: string | null;
  /** Stroke width in CSS px (points: the dot's radius), finite, in [0, MAX_WIDTH]. */
  readonly width: number;
  readonly dash: Dash;
  /** The drawing layer's opacity, in [0, 1]. */
  readonly opacity: number;
}

/** A label: its text runs, and its offset (angle in degrees, null = automatic; pixels). */
export interface Label {
  readonly text: string;
  readonly runs: readonly LabelRun[];
  readonly angle: number | null;
  readonly dist: number;
}

export interface Primitive {
  /** The document object's id and name. */
  readonly id: number;
  readonly name: string;
  readonly shape: Shape;
  readonly style: DrawStyle;
  /** The layer the object is drawn in (its highest visible layer). */
  readonly layer: string;
  readonly label: Label | null;
}

/** An object that would be drawn but has no value: its reason is shown, never garbage. */
export interface Unavailable {
  readonly id: number;
  readonly name: string;
  readonly reason: string;
  /** A point at infinity (ADR-0040): defined, never drawn; `reason` names its direction. */
  readonly atInfinity?: true;
}

/** A curve that exists but cannot be placed at the current zoom (ADR-0023): listed, not drawn. */
export interface Undrawable {
  readonly id: number;
  readonly name: string;
}

export interface Scene {
  /** In draw order (back to front). */
  readonly primitives: readonly Primitive[];
  /** Visible objects whose value is Undefined or Inexact, with the reason. */
  readonly unavailable: readonly Unavailable[];
  /** Managed images not drawn because they coincide with their drawn source (SPEC §13). */
  readonly coincident: readonly number[];
  /** The figure scale used for the coincidence decisions (SPEC §3.1). */
  readonly scale: number;
}

/** A screen path of the display list (display.ts): CSS px, y down. */
export type Path =
  | { readonly kind: 'dot'; readonly c: Vec2; readonly r: number }
  | { readonly kind: 'poly'; readonly pts: readonly Vec2[]; readonly closed: boolean }
  | {
      readonly kind: 'arc';
      readonly c: Vec2;
      readonly r: number;
      readonly from: number;
      readonly to: number;
    };

export interface DisplayItem {
  readonly id: number;
  readonly name: string;
  readonly kind: ShapeKind;
  readonly style: DrawStyle;
  /**
   * Stroked paths (points: one dot; a text: one dot of radius 0 at its anchor, its handle; a
   * distance measurement: none, its label is all it draws, ADR-0048).
   */
  readonly paths: readonly Path[];
  /** A polygon's clipped interior (where its label goes), or null. */
  readonly region: readonly Vec2[] | null;
  /** The region when it is drawn filled (a coloured polygon, ADR-0016 decision 20), or null. */
  readonly fill: readonly Vec2[] | null;
}
