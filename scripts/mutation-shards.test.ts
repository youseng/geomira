import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { fileOf, matchesGlob, matrix, OPEN_END, SHARDS } from './mutation-shards';

const ROOT = join(import.meta.dirname, '..');

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

/** Files selected by a Stryker `mutate` list (positive globs, then `!` exclusions). */
function selected(patterns: readonly string[], universe: readonly string[]): string[] {
  const plus = patterns.filter((p) => !p.startsWith('!')).map(fileOf);
  const minus = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1));
  return universe.filter(
    (f) => plus.some((p) => matchesGlob(p, f)) && !minus.some((p) => matchesGlob(p, f)),
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

  it('the kernel is split into eleven shards, each seeded from an earlier shard', () => {
    expect(kernel.map((s) => s.id).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'].map((x) => `kernel-${x}`),
    );
    expect(new Set(kernel.map((s) => s.parent))).toEqual(
      new Set(['kernel-1', 'kernel-2', 'kernel-3', 'kernel-4', 'kernel-b', 'kernel-h']),
    );
  });

  it("the kernel shards partition stryker.kernel.json's files, each line in exactly one", () => {
    const all = selected(configMutate('kernel'), universe);
    expect(all.length).toBeGreaterThan(20);
    const whole = new Map<string, number>();
    const ranges = new Map<string, [number, number][]>();
    for (const shard of kernel) {
      expect(selected(shard.mutate, universe).length, shard.id).toBeGreaterThan(0);
      for (const entry of shard.mutate.filter((m) => !m.startsWith('!'))) {
        const r = /:(\d+)-(\d+)$/u.exec(entry);
        if (r === null) continue;
        const list = ranges.get(fileOf(entry)) ?? [];
        list.push([Number(r[1]), Number(r[2])]);
        ranges.set(fileOf(entry), list);
      }
      const plain = shard.mutate.filter((m) => !/:\d+-\d+$/u.test(m));
      for (const f of selected(plain, universe)) whole.set(f, (whole.get(f) ?? 0) + 1);
    }
    // A file split into line ranges: the ranges tile [1, OPEN_END] and no shard has it whole.
    for (const [file, list] of ranges) {
      expect(whole.has(file), file).toBe(false);
      const sorted = [...list].sort((a, b) => a[0] - b[0]);
      expect(sorted[0]?.[0], file).toBe(1);
      expect(sorted[sorted.length - 1]?.[1], file).toBe(OPEN_END);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i]?.[0], file).toBe((sorted[i - 1]?.[1] ?? 0) + 1);
    }
    expect([...whole.keys(), ...ranges.keys()].sort()).toEqual([...all].sort());
    expect([...whole.values()].every((c) => c === 1)).toBe(true);
  });

  it('a split file is cut only between top-level statements (a mutant across a cut is in no range)', () => {
    const cutsByFile = new Map<string, number[]>();
    for (const entry of kernel.flatMap((s) => s.mutate)) {
      const r = /:\d+-(\d+)$/u.exec(entry);
      if (r === null || Number(r[1]) === OPEN_END) continue;
      cutsByFile.set(fileOf(entry), [...(cutsByFile.get(fileOf(entry)) ?? []), Number(r[1])]);
    }
    expect(cutsByFile.size).toBeGreaterThan(0);
    for (const [file, cuts] of cutsByFile) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const lineOf = (pos: number) => source.getLineAndCharacterOfPosition(pos).line + 1;
      for (const statement of source.statements) {
        const [a, b] = [lineOf(statement.getStart(source)), lineOf(statement.getEnd())];
        for (const cut of cuts)
          expect(
            a <= cut && b > cut,
            `${file}: lines ${String(a)}-${String(b)} cross ${String(cut)}`,
          ).toBe(false);
      }
    }
  });

  it('every glob a shard uses has a form matchesGlob reads', () => {
    for (const p of SHARDS.flatMap((s) => s.mutate).filter((m) => m.includes('*')))
      expect(p.replace(/^!/, ''), p).toMatch(/^[^*]+\/\*\*\/\*\.ts$/u);
  });

  it('every file a shard names exists (a renamed file cannot drop out silently)', () => {
    for (const shard of SHARDS)
      for (const p of shard.mutate.filter((m) => !m.includes('*')))
        expect(universe, p).toContain(fileOf(p.replace(/^!/, '')));
  });

  it('num and claims run their whole config; ids are unique', () => {
    expect(SHARDS.filter((s) => s.pkg !== 'kernel').map((s) => [s.id, s.mutate, s.parent])).toEqual(
      [
        ['num', [], ''],
        ['claims', [], ''],
        ['discovery', [], ''],
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
