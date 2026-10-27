/**
 * ADR-0035: packages/discovery has its own mutation config and nightly shard, and the gate
 * holds it to 75 %, as claims.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileOf, inScope, matchesGlob, SHARDS } from './mutation-shards';
import { threshold } from './mutation-summary';

const ROOT = join(import.meta.dirname, '..');
const D = 'packages/discovery/src';

/** Files selected by a Stryker `mutate` list (positive globs, then `!` exclusions). */
function selected(patterns: readonly string[], universe: readonly string[]): string[] {
  const plus = patterns.filter((p) => !p.startsWith('!')).map(fileOf);
  const minus = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  return universe.filter(
    (f) => plus.some((p) => matchesGlob(p, f)) && !minus.some((p) => matchesGlob(p, f)),
  );
}

describe('the discovery mutation gate', () => {
  const shards = SHARDS.filter((s) => s.pkg === 'discovery');

  it('four shards (three file groups and every other file), gated at 75 %', () => {
    expect(shards.map((s) => s.id)).toEqual([
      'discovery-a',
      'discovery-b',
      'discovery-c',
      'discovery',
    ]);
    expect(shards.map((s) => s.parent)).toEqual(['', '', '', '']);
    expect(shards[0]?.mutate).toContain(`${D}/closure.ts`);
    expect(shards[1]?.mutate).toContain(`${D}/candidates.ts`);
    expect(shards[2]?.mutate).toContain(`${D}/lemmas.ts`);
    expect(shards[3]?.mutate.slice(0, 2)).toEqual([`${D}/**/*.ts`, `!${D}/index.ts`]);
    expect(threshold('discovery')).toBe(75);
  });

  it("the shards partition stryker.discovery.json's files, each file in exactly one", () => {
    const universe = readdirSync(join(ROOT, D)).map((f) => `${D}/${f}`);
    const config = JSON.parse(readFileSync(join(ROOT, 'stryker.discovery.json'), 'utf8')) as {
      mutate: string[];
    };
    const all = selected(config.mutate, universe);
    expect(all.length).toBeGreaterThan(15);
    const owners = new Map<string, string[]>();
    for (const s of shards) {
      const own = selected(s.mutate, universe);
      expect(own.length, s.id).toBeGreaterThan(0);
      for (const f of own) owners.set(f, [...(owners.get(f) ?? []), s.id]);
    }
    expect([...owners.keys()].sort()).toEqual([...all].sort());
    for (const [f, ids] of owners) expect(ids, f).toHaveLength(1);
    // The gate counts a mutant for the shard that owns its file, and for no other.
    for (const f of all)
      expect(
        shards.filter((s) => inScope(s, f, 1, 1)).map((s) => s.id),
        f,
      ).toEqual(owners.get(f));
  });

  it('a new file of the package is mutated by the last shard', () => {
    const last = shards[shards.length - 1];
    if (last === undefined) throw new Error('no discovery shard');
    expect(inScope(last, `${D}/new-file.ts`, 1, 1)).toBe(true);
    expect(inScope(last, `${D}/index.ts`, 1, 1)).toBe(false);
  });

  it('the config mutates the package source with its own tests', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'stryker.discovery.json'), 'utf8')) as {
      mutate: string[];
      vitest: { configFile: string };
      tsconfigFile: string;
    };
    expect(config.mutate).toEqual([
      'packages/discovery/src/**/*.ts',
      '!packages/discovery/src/index.ts',
    ]);
    expect(config.vitest.configFile).toBe('vitest.discovery.config.ts');
    expect(config.tsconfigFile).toBe('packages/discovery/tsconfig.json');
    expect(readFileSync(join(ROOT, 'vitest.discovery.config.ts'), 'utf8')).toContain(
      "include: ['packages/discovery/test/**/*.test.ts']",
    );
  });
});
