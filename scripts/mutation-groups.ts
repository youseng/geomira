/**
 * The file groups of the claims and discovery mutation shards (scripts/mutation-shards.ts reads
 * them; ADR-0038, ADR-0039, ADR-0057). Each group is one shard; each package's last shard
 * mutates every other file of the package, so a new file is always mutated by some shard.
 */

export const D = 'packages/discovery/src';

/**
 * Run 17 (ADR-0035): packages/discovery as one shard (3,589 mutants) was 63 % done after 70
 * minutes on a GitHub runner, on course to pass Stryker's 100-minute limit; it is split by file
 * group. The first grouping (about 850 source lines each) took 80, 55, 18 and 17 minutes;
 * most of discovery-a's mutants were timeouts (391 of 542: closure.ts 180, rules.ts 94, rank.ts
 * 78), so rules.ts moved to discovery-c and rank.ts to the last shard. That shard, `discovery`,
 * is "every other file" (negated globs, as kernel-h), so a new file is always mutated by some
 * shard.
 */
export const DISCOVERY_GROUPS: readonly {
  readonly id: string;
  readonly files: readonly string[];
}[] = [
  {
    id: 'discovery-a',
    files: ['closure', 'closure-view', 'terms', 'uf'].map((f) => `${D}/${f}.ts`),
  },
  // ADR-0057: discovery-b, -c, -d and -e each ran past 100 minutes cold on a0d505b (77–82 %
  // done; discovery-d at run-16c's rate, measured side by side): each is halved by source lines,
  // the second halves are discovery-f, -g, -h and -i.
  {
    id: 'discovery-b',
    // ADR-0052: the find job's schedule of the screen joins the scan it schedules.
    files: ['candidates', 'scan', 'ticking', 'job'].map((f) => `${D}/${f}.ts`),
  },
  {
    id: 'discovery-c',
    files: ['lemmas', 'hunt', 'position', 'text'].map((f) => `${D}/${f}.ts`),
  },
  // ADR-0039: the closure's rules (moved out of closure.ts), and the knowledge with the groups.
  {
    id: 'discovery-d',
    // ADR-0042: the conic rules of the closure.
    files: ['closure-merge', 'closure-conics'].map((f) => `${D}/${f}.ts`),
  },
  {
    id: 'discovery-e',
    files: ['derive', 'group'].map((f) => `${D}/${f}.ts`),
  },
  {
    id: 'discovery-f',
    files: ['scan-rounds', 'solve', 'lattice', 'consequences'].map((f) => `${D}/${f}.ts`),
  },
  {
    id: 'discovery-g',
    files: ['rules', 'angles', 'angle-rules', 'angle-maps', 'angle-lattice'].map(
      (f) => `${D}/${f}.ts`,
    ),
  },
  {
    id: 'discovery-h',
    files: ['closure-maps', 'closure-mid'].map((f) => `${D}/${f}.ts`),
  },
  {
    id: 'discovery-i',
    files: ['confirm', 'find-units'].map((f) => `${D}/${f}.ts`),
  },
];

export const C = 'packages/claims/src';

/**
 * ADR-0057: claims as one shard (6,805 mutants on a0d505b, 6,456 on run-16c) was 73 % done after
 * 98 minutes, cold, twice; a full run took 47 minutes when it had 2,342 (Run 8a). Two file groups
 * (the kinds; the tester) and `claims`, every other file (negated globs, as kernel-h and
 * `discovery`), which keeps the shard's id and cache key.
 */
export const CLAIMS_GROUPS: readonly {
  readonly id: string;
  readonly files: readonly string[];
}[] = [
  {
    id: 'claims-a',
    files: [
      'kinds-angles',
      'kinds-incidence',
      'kinds-curves',
      'kinds-projective',
      'kinds-triangles',
      'kinds-conics',
      'kinds-metric',
      'kinds-lengths',
      'kind',
      'kind-hints',
      'kind-registry',
      'ndg',
      'symmetry',
      'collinear-infinity',
    ].map((f) => `${C}/${f}.ts`),
  },
  {
    id: 'claims-b',
    files: [
      'verdict',
      'verdict-line',
      'verdict-notes',
      'job',
      'prepare',
      'rungs',
      'decide',
      'screen',
      'analysis',
    ].map((f) => `${C}/${f}.ts`),
  },
];
