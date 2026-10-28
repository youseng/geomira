/**
 * What the closure's rules read (rules.ts) and what its merging steps change (closure-merge.ts,
 * closure-maps.ts), as interfaces, so those modules and the closure (closure.ts, which
 * implements them) do not import each other.
 */
import type { Rational } from '@geomira/num/rational';
import type { Terms } from './terms';
import type { UnionFind } from './uf';

/** An argument of a fact over terms: a term key, or an exact literal. */
export type TermArg = { readonly key: string } | { readonly lit: Rational };

export interface ClosureView {
  readonly points: UnionFind;
  readonly lines: UnionFind;
  readonly circles: UnionFind;
  readonly parallels: UnionFind;
  readonly lengths: UnionFind;
  readonly lineSets: ReadonlyMap<string, ReadonlySet<string>>;
  readonly circleSets: ReadonlyMap<string, ReadonlySet<string>>;
  readonly perps: ReadonlyMap<string, ReadonlySet<string>>;
  readonly tangents: ReadonlySet<string>;
  readonly ratios: ReadonlySet<string>;
  readonly terms: Terms;
  isLine(k: string): boolean;
  isCircle(k: string): boolean;
  classOf(k: string): string;
  segment(a: string, b: string): string;
  lineThrough(a: string, b: string): string | undefined;
  parallelClass(lineClass: string): string;
  /** Whether |s| = k·|t| (k as `q…`) is a recorded ratio of their length classes. */
  hasRatio(s: string, t: string, k: string): boolean;
  /** Whether two points are apart in the figure (beyond the band). */
  apart(a: string, b: string): boolean;
  /** The figure's length band (two points closer than it in both coordinates are not apart). */
  readonly band: number;
  /** A point's position in the figure (any object of its class), if known. */
  at(k: string): { readonly x: number; readonly y: number } | undefined;
  /** Object keys whose value in the figure is a point at infinity (ADR-0040). */
  readonly ideal: ReadonlySet<string>;
}

/** The closure while it is built (the merging steps add to it). */
export interface ClosureState extends ClosureView {
  lineSets: Map<string, Set<string>>;
  circleSets: Map<string, Set<string>>;
  /** Circle class → its centre's point class. */
  readonly centerOf: Map<string, string>;
  readonly perps: Map<string, Set<string>>;
  readonly tangents: Set<string>;
  readonly ratios: Set<string>;
  /** Raw circles that are not objects (a point's equidistant points) → their centre's key. */
  readonly virtualCenters: Map<string, string>;
  /** Midpoints `M|X|Y` (point classes when recorded; closure-mid.ts). */
  readonly mids: Set<string>;
  /** Isosceles triangles `M|X|Y` with MX = MY (point classes when recorded; angle-rules.ts). */
  readonly isosceles: Set<string>;
}
