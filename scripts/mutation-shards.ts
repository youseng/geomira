/**
 * The nightly mutation matrix (nightly.yml, SPEC §17 L15). Each shard is one job with its own
 * incremental file and cache key, so a shard that finishes saves its progress even when
 * another times out. The kernel is split into eleven shards by file group (its full run takes
 * about four hours on a GitHub runner); num and claims finish within an hour and run whole.
 * The last kernel shard is "every other tool file" (negated globs), so a new file under
 * tools/ is always mutated by some shard. scripts/mutation-shards.test.ts checks that the
 * kernel shards partition the files of stryker.kernel.json's `mutate`.
 *
 * `tsx scripts/mutation-shards.ts` prints the matrix as JSON for the workflow's plan job.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Shard {
  /** Job and cache name: the incremental file is cached under `stryker-<id>-…`. */
  readonly id: string;
  /** The package whose stryker.<pkg>.json and `pnpm mutation:<pkg>` the shard runs. */
  readonly pkg: 'num' | 'kernel' | 'claims';
  /** `--mutate` globs (negations allowed); empty = the config's own `mutate`. */
  readonly mutate: readonly string[];
  /**
   * A shard whose cached incremental file covers this shard's files (an earlier, coarser
   * split), restored when this shard has no cache of its own yet; '' = none.
   */
  readonly parent: string;
}

const K = 'packages/kernel/src';

/** The end line of an open-ended range (far beyond any file's length; files ≤ 400 lines). */
export const OPEN_END = 100_000;

/** A mutate entry without its `:start-end` line range. */
export function fileOf(entry: string): string {
  return entry.replace(/:\d+-\d+$/u, '');
}

/** The two glob forms the configs and shards use: an exact path and `<dir>/**\/*.ts`. */
export function matchesGlob(pattern: string, file: string): boolean {
  const suffix = '/**/*.ts';
  if (pattern.endsWith(suffix))
    return file.startsWith(pattern.slice(0, -suffix.length + 1)) && file.endsWith('.ts');
  return pattern === file;
}

/**
 * Whether a mutant of `file` (repo-relative; lines 1-based, as in Stryker's JSON report) is the
 * shard's own, by Stryker's rule: a `file:a-b` entry holds a mutant only when the whole mutant
 * lies in lines a..b, and `!glob` removes files. A shard without `mutate` owns its whole report.
 */
export function inScope(shard: Shard, file: string, start: number, end: number): boolean {
  if (shard.mutate.length === 0) return true;
  const minus = shard.mutate.filter((m) => m.startsWith('!')).map((m) => m.slice(1));
  if (minus.some((p) => matchesGlob(p, file))) return false;
  return shard.mutate
    .filter((m) => !m.startsWith('!'))
    .some((entry) => {
      if (!matchesGlob(fileOf(entry), file)) return false;
      const r = /:(\d+)-(\d+)$/u.exec(entry);
      return r === null || (Number(r[1]) <= start && end <= Number(r[2]));
    });
}

/**
 * Run 13's tool files (v1.1: 554 mutants, 256 of them static, i.e. each runs the whole kernel
 * suite). In the catch-all shard they would push it past its time limit, so they join the two
 * lightest shards (kernel-a: geom.ts and similarity.ts, 80 static mutants on main; kernel-b:
 * transforms.ts lines 1–132, 84): the conjugates and poles to kernel-a, the arc and its range
 * to kernel-b. A file of these lists that does not exist at this commit is left out of its
 * group; the catch-all's negations then do not exclude it either, so a renamed file is still
 * mutated (by kernel-h) and never drops out.
 */
export const V11_A: readonly string[] = [`${K}/tools/conjugates.ts`, `${K}/tools/poles.ts`];
export const V11_B: readonly string[] = [`${K}/tools/arc.ts`, `${K}/tools/arc-range.ts`];

/**
 * Run 14's Möbius code (ADR-0032): transform/ joins stryker.kernel.json's scope and tools/
 * gains map-ops.ts (compose, inverse and apply, moved out of transforms.ts). The frozen shard
 * test keeps eleven kernel shards, so the files join existing ones by weight: the unit
 * inversion's small helpers kernel-a, its per-kind maps kernel-b, the tool specs (mostly static
 * literals) the light kernel-j, the map core kernel-k (lighter since compose, inverse and apply
 * left transforms.ts).
 */
const T = `${K}/transform`;
export const MOBIUS_A: readonly string[] = [`${T}/j-core.ts`, `${T}/proj-range.ts`];
export const MOBIUS_B: readonly string[] = [`${T}/j-lines.ts`, `${T}/j-circles.ts`];
export const MOBIUS_J: readonly string[] = [`${K}/tools/map-ops.ts`, `${T}/inversion-tools.ts`];
export const MOBIUS_K: readonly string[] = [`${T}/mobius.ts`, `${T}/apply-map.ts`];

function present(files: readonly string[]): string[] {
  return files.filter((f) => existsSync(join(import.meta.dirname, '..', f)));
}

/**
 * The kernel's file groups. The first split (four groups: kernel-1 … kernel-4) took 51–58
 * minutes per full shard on a GitHub runner, and two shards ran past 75; each group was
 * halved. In the eight-way split the full runs took 9–53 minutes, the "rest" shard the
 * longest, so lines.ts got its own shard; in the nine-way split (full runs measured with
 * full=true) transforms.ts alone took more than 50 minutes, so it is cut into three line
 * ranges, cut only between top-level statements (a mutant that spans two ranges belongs to
 * neither; scripts/mutation-shards.test.ts checks the cuts). The last group takes every other
 * file under tools/. `parent` names an earlier shard that held the files (its cache seeds this
 * shard's first run).
 */
const KERNEL_GROUPS: readonly { readonly files: readonly string[]; readonly parent: string }[] = [
  {
    files: [`${K}/geom.ts`, `${K}/similarity.ts`, ...present(V11_A), ...present(MOBIUS_A)],
    parent: 'kernel-1',
  },
  // transforms.ts alone took more than 50 minutes: three line ranges (Stryker's
  // `file:start-end` form) cover it, the last one open-ended so no line can drop out.
  {
    files: [`${K}/tools/transforms.ts:1-132`, ...present(V11_B), ...present(MOBIUS_B)],
    parent: 'kernel-b',
  },
  {
    files: [`${K}/tools/pairs.ts`, `${K}/tools/intersect.ts`, `${K}/tools/range.ts`],
    parent: 'kernel-2',
  },
  {
    files: [`${K}/tools/tangent-from.ts`, `${K}/tools/tangents.ts`, `${K}/tools/other.ts`],
    parent: 'kernel-2',
  },
  { files: [`${K}/tools/points.ts`, `${K}/tools/triangle.ts`], parent: 'kernel-3' },
  { files: [`${K}/tools/circles.ts`, `${K}/tools/incircle.ts`], parent: 'kernel-3' },
  {
    files: [`${K}/tools/measures.ts`, `${K}/tools/functions.ts`, `${K}/tools/display.ts`],
    parent: 'kernel-4',
  },
  { files: [`${K}/tools/lines.ts`], parent: 'kernel-h' },
  { files: [`${K}/tools/transforms.ts:133-265`, ...present(MOBIUS_J)], parent: 'kernel-b' },
  {
    files: [`${K}/tools/transforms.ts:266-${String(OPEN_END)}`, ...present(MOBIUS_K)],
    parent: 'kernel-b',
  },
];

const toolsInGroups = [
  ...new Set(
    KERNEL_GROUPS.flatMap((g) => g.files)
      .map(fileOf)
      .filter((f) => f.startsWith(`${K}/tools/`)),
  ),
];

const LETTERS = 'abcdefghijk';

export const SHARDS: readonly Shard[] = [
  { id: 'num', pkg: 'num', mutate: [], parent: '' },
  ...KERNEL_GROUPS.map((g, i) => ({
    // a … g, then i, j, k (h is the rest shard, kept under its name so it keeps its cache).
    id: `kernel-${LETTERS[i < 7 ? i : i + 1] ?? String(i)}`,
    pkg: 'kernel' as const,
    mutate: g.files,
    parent: g.parent,
  })),
  {
    id: 'kernel-h',
    pkg: 'kernel',
    mutate: [`${K}/tools/**/*.ts`, ...toolsInGroups.map((f) => `!${f}`)],
    parent: 'kernel-4',
  },
  { id: 'claims', pkg: 'claims', mutate: [], parent: '' },
];

/** The GitHub Actions matrix: one entry per shard, `mutate` joined for Stryker's `--mutate`. */
export function matrix(): {
  include: { id: string; pkg: string; mutate: string; parent: string }[];
} {
  return {
    include: SHARDS.map((s) => ({
      id: s.id,
      pkg: s.pkg,
      mutate: s.mutate.join(','),
      parent: s.parent,
    })),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(`${JSON.stringify(matrix())}\n`);
}
