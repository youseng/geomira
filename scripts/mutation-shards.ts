/**
 * The nightly mutation matrix (nightly.yml, SPEC §17 L15). Each shard is one job with its own
 * incremental file and cache key, so a shard that finishes saves its progress even when
 * another times out. The kernel is split into four shards by file group (its full run
 * exceeds two hours on a GitHub runner); num and claims finish within an hour and run whole.
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
}

const K = 'packages/kernel/src';

/** Shard 1–3 files; shard 4 takes every other tool file. */
const KERNEL_GROUPS: readonly (readonly string[])[] = [
  [`${K}/geom.ts`, `${K}/similarity.ts`, `${K}/tools/transforms.ts`],
  [
    `${K}/tools/pairs.ts`,
    `${K}/tools/intersect.ts`,
    `${K}/tools/tangent-from.ts`,
    `${K}/tools/tangents.ts`,
    `${K}/tools/other.ts`,
    `${K}/tools/range.ts`,
  ],
  [
    `${K}/tools/points.ts`,
    `${K}/tools/circles.ts`,
    `${K}/tools/incircle.ts`,
    `${K}/tools/triangle.ts`,
  ],
];

const toolsInGroups = KERNEL_GROUPS.flat().filter((f) => f.startsWith(`${K}/tools/`));

export const SHARDS: readonly Shard[] = [
  { id: 'num', pkg: 'num', mutate: [] },
  ...KERNEL_GROUPS.map((files, i) => ({
    id: `kernel-${String(i + 1)}`,
    pkg: 'kernel' as const,
    mutate: files,
  })),
  {
    id: `kernel-${String(KERNEL_GROUPS.length + 1)}`,
    pkg: 'kernel',
    mutate: [`${K}/tools/**/*.ts`, ...toolsInGroups.map((f) => `!${f}`)],
  },
  { id: 'claims', pkg: 'claims', mutate: [] },
];

/** The GitHub Actions matrix: one entry per shard, `mutate` joined for Stryker's `--mutate`. */
export function matrix(): { include: { id: string; pkg: string; mutate: string }[] } {
  return { include: SHARDS.map((s) => ({ id: s.id, pkg: s.pkg, mutate: s.mutate.join(',') })) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(`${JSON.stringify(matrix())}\n`);
}
