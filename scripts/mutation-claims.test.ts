/**
 * ADR-0057: packages/claims in three mutation shards (the kinds, the tester, every other file),
 * gated at 75 % on their sum, as discovery's shards (ADR-0038).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileOf, inScope, matchesGlob, SHARDS } from './mutation-shards';
import { threshold } from './mutation-summary';

const ROOT = join(import.meta.dirname, '..');
const C = 'packages/claims/src';

/** Files selected by a Stryker `mutate` list (positive globs, then `!` exclusions). */
function selected(patterns: readonly string[], universe: readonly string[]): string[] {
  const plus = patterns.filter((p) => !p.startsWith('!')).map(fileOf);
  const minus = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  return universe.filter(
    (f) => plus.some((p) => matchesGlob(p, f)) && !minus.some((p) => matchesGlob(p, f)),
  );
}

describe('the claims mutation shards (ADR-0057)', () => {
  const shards = SHARDS.filter((s) => s.pkg === 'claims');

  it('three shards: the kinds, the tester, and every other file under the old id', () => {
    expect(shards.map((s) => [s.id, s.parent])).toEqual([
      ['claims-a', 'claims'],
      ['claims-b', 'claims'],
      ['claims', ''],
    ]);
    expect(shards[0]?.mutate).toContain(`${C}/kinds-angles.ts`);
    expect(shards[1]?.mutate).toContain(`${C}/verdict.ts`);
    expect(shards[2]?.mutate.slice(0, 2)).toEqual([`${C}/**/*.ts`, `!${C}/index.ts`]);
    expect(threshold('claims')).toBe(75);
  });

  it("the shards partition stryker.claims.json's files, each file in exactly one", () => {
    const universe = readdirSync(join(ROOT, C)).map((f) => `${C}/${f}`);
    const config = JSON.parse(readFileSync(join(ROOT, 'stryker.claims.json'), 'utf8')) as {
      mutate: string[];
    };
    const all = selected(config.mutate, universe);
    expect(all.length).toBeGreaterThan(30);
    const owners = new Map<string, string[]>();
    for (const s of shards) {
      const own = selected(s.mutate, universe);
      expect(own.length, s.id).toBeGreaterThan(5);
      for (const f of own) owners.set(f, [...(owners.get(f) ?? []), s.id]);
    }
    expect([...owners.keys()].sort()).toEqual([...all].sort());
    for (const [f, ids] of owners) expect(ids, f).toHaveLength(1);
    for (const f of all)
      expect(
        shards.filter((s) => inScope(s, f, 1, 1)).map((s) => s.id),
        f,
      ).toEqual(owners.get(f));
  });

  it('a new file of the package, and kinds.ts, are mutated by the last shard', () => {
    const last = shards[shards.length - 1];
    if (last === undefined) throw new Error('no claims shard');
    expect(inScope(last, `${C}/new-file.ts`, 1, 1)).toBe(true);
    expect(inScope(last, `${C}/kinds.ts`, 1, 1)).toBe(true);
    expect(inScope(last, `${C}/index.ts`, 1, 1)).toBe(false);
  });
});
