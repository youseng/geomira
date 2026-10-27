/**
 * What the closure's rules read (rules.ts), as an interface, so the rules and the closure
 * (closure.ts, which implements it) do not import each other.
 */
import type { UnionFind } from './uf';

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
  isLine(k: string): boolean;
  isCircle(k: string): boolean;
  classOf(k: string): string;
  segment(a: string, b: string): string;
  lineThrough(a: string, b: string): string | undefined;
  parallelClass(lineClass: string): string;
}
