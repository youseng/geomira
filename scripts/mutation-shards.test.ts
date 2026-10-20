import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matrix, SHARDS } from './mutation-shards';

const ROOT = join(import.meta.dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

/** The two glob forms the configs and shards use: an exact path and `<dir>/**\/*.ts`. */
function matches(pattern: string, file: string): boolean {
  const suffix = '/**/*.ts';
  if (pattern.endsWith(suffix))
    return file.startsWith(pattern.slice(0, -suffix.length + 1)) && file.endsWith('.ts');
  return pattern === file;
}

/** Files selected by a Stryker `mutate` list (positive globs, then `!` exclusions). */
function selected(patterns: readonly string[], universe: readonly string[]): string[] {
  const plus = patterns.filter((p) => !p.startsWith('!'));
  const minus = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  return universe.filter(
    (f) => plus.some((p) => matches(p, f)) && !minus.some((p) => matches(p, f)),
  );
}

function configMutate(pkg: string): string[] {
  const config = JSON.parse(readFileSync(join(ROOT, `stryker.${pkg}.json`), 'utf8')) as {
    mutate: string[];
  };
  return config.mutate;
}

describe('nightly mutation shards', () => {
  const universe = filesUnder('packages/kernel/src');
  const kernel = SHARDS.filter((s) => s.pkg === 'kernel');

  it('the kernel is split into eight shards, each seeded from a four-way shard', () => {
    expect(kernel.map((s) => s.id)).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `kernel-${x}`),
    );
    expect(new Set(kernel.map((s) => s.parent))).toEqual(
      new Set(['kernel-1', 'kernel-2', 'kernel-3', 'kernel-4']),
    );
  });

  it("the kernel shards partition stryker.kernel.json's files, each file in exactly one", () => {
    const all = selected(configMutate('kernel'), universe);
    expect(all.length).toBeGreaterThan(20);
    const counts = new Map<string, number>();
    for (const shard of kernel) {
      const files = selected(shard.mutate, universe);
      expect(files.length, shard.id).toBeGreaterThan(0);
      for (const f of files) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...all].sort());
    expect([...counts.values()].every((c) => c === 1)).toBe(true);
  });

  it('every file a shard names exists (a renamed file cannot drop out silently)', () => {
    for (const shard of SHARDS)
      for (const p of shard.mutate.filter((m) => !m.includes('*')))
        expect(universe, p).toContain(p.replace(/^!/, ''));
  });

  it('num and claims run their whole config; ids are unique', () => {
    expect(SHARDS.filter((s) => s.pkg !== 'kernel').map((s) => [s.id, s.mutate, s.parent])).toEqual(
      [
        ['num', [], ''],
        ['claims', [], ''],
      ],
    );
    expect(new Set(SHARDS.map((s) => s.id)).size).toBe(SHARDS.length);
  });

  it('the matrix joins each mutate list with commas for --mutate', () => {
    const m = matrix();
    expect(m.include).toHaveLength(SHARDS.length);
    expect(m.include[1]?.mutate.split(',')).toEqual(SHARDS[1]?.mutate);
  });
});
