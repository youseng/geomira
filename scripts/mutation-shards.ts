/**
 * The nightly mutation matrix (nightly.yml, SPEC §17 L15). Each shard is one job with its own
 * incremental file and cache key, so a shard that finishes saves its progress even when
 * another times out. The kernel is split into nine shards by file group (its full run takes
 * about four hours on a GitHub runner); num and claims finish within an hour and run whole.
 * The last kernel shard is "every other tool file" (negated globs), so a new file under
 * tools/ is always mutated by some shard. scripts/mutation-shards.test.ts checks that the
 * kernel shards partition the files of stryker.kernel.json's `mutate`.
 *
 * `tsx scripts/mutation-shards.ts` prints the matrix as JSON for the workflow's plan job.
 */
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

/**
 * The kernel's file groups. The first split (four groups: kernel-1 … kernel-4) took 51–58
 * minutes per full shard on a GitHub runner, and two shards ran past 75; each group was
 * halved. In the eight-way split the full runs took 9–53 minutes, the "rest" shard the
 * longest, so lines.ts got its own shard. The last group takes every other file under
 * tools/. `parent` names an earlier shard that held the files (its cache seeds this shard's
 * first run).
 */
const KERNEL_GROUPS: readonly { readonly files: readonly string[]; readonly parent: string }[] = [
  { files: [`${K}/geom.ts`, `${K}/similarity.ts`], parent: 'kernel-1' },
  { files: [`${K}/tools/transforms.ts`], parent: 'kernel-1' },
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
];

const toolsInGroups = KERNEL_GROUPS.flatMap((g) => g.files).filter((f) =>
  f.startsWith(`${K}/tools/`),
);

const LETTERS = 'abcdefghi';

export const SHARDS: readonly Shard[] = [
  { id: 'num', pkg: 'num', mutate: [], parent: '' },
  ...KERNEL_GROUPS.map((g, i) => ({
    // a … g, then i (h is the rest shard, kept under its name so it keeps its cache).
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
