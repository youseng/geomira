import { describe, expect, it } from 'vitest';
import { OPEN_END, SHARDS } from './mutation-shards';
import { readReport, summaryLine, tally } from './mutation-summary';

const T = 'packages/kernel/src/tools/transforms.ts';

function shard(id: string) {
  const s = SHARDS.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no shard ${id}`);
  return s;
}

function mutant(status: string, start: number, end = start) {
  return { status, location: { start: { line: start, column: 1 }, end: { line: end, column: 9 } } };
}

describe('nightly mutation summary', () => {
  // What a range shard's report holds after its cache was seeded with the whole file's results.
  const report = {
    files: {
      [T]: {
        mutants: [
          mutant('Killed', 10),
          mutant('Survived', 140),
          mutant('Timeout', 200),
          mutant('NoCoverage', 140, 141),
          mutant('CompileError', 150),
          mutant('Killed', 300),
        ],
      },
    },
  };

  it("counts only the shard's own mutants, and says how many others the report carried", () => {
    const j = shard('kernel-j');
    const t = tally(j, readReport(report));
    expect(t).toEqual({ detected: 1, undetected: 2, outside: 2 });
    expect(summaryLine(j, t)).toBe(
      'kernel-j mutation score: 33.33% (1 detected, 2 undetected; 2 mutants outside the shard not counted; target 75%, gated from v1.1)',
    );
    expect(tally(shard('kernel-b'), readReport(report))).toEqual({
      detected: 1,
      undetected: 0,
      outside: 5,
    });
  });

  it("a mutant belongs to a range only when it lies wholly inside (Stryker's rule)", () => {
    const straddling = readReport({ files: { [T]: { mutants: [mutant('Killed', 130, 135)] } } });
    for (const id of ['kernel-b', 'kernel-j', 'kernel-k'])
      expect(tally(shard(id), straddling).outside, id).toBe(1);
  });

  it('every line of a kernel file belongs to exactly one kernel shard', () => {
    const kernel = SHARDS.filter((s) => s.pkg === 'kernel');
    const files = [T, 'packages/kernel/src/geom.ts', 'packages/kernel/src/tools/lines.ts'];
    for (const file of files)
      for (const line of [1, 132, 133, 244, 245, 400, OPEN_END]) {
        const one = readReport({ files: { [file]: { mutants: [mutant('Killed', line)] } } });
        const owners = kernel.filter((s) => tally(s, one).detected === 1).map((s) => s.id);
        expect(owners, `${file}:${String(line)}`).toHaveLength(1);
      }
    const other = readReport({
      files: { 'packages/kernel/src/tools/new-tool.ts': { mutants: [mutant('Killed', 1)] } },
    });
    expect(kernel.filter((s) => tally(s, other).detected === 1).map((s) => s.id)).toEqual([
      'kernel-h',
    ]);
  });

  it('num and claims own their whole report; no mutants scores n/a, never NaN', () => {
    expect(tally(shard('num'), readReport(report))).toEqual({
      detected: 3,
      undetected: 2,
      outside: 0,
    });
    const empty = tally(shard('claims'), readReport({ files: {} }));
    expect(summaryLine(shard('claims'), empty)).toBe(
      'claims mutation score: n/a (0 detected, 0 undetected; target 75%, gated from v1.1)',
    );
    expect(summaryLine(shard('num'), { detected: 4, undetected: 1, outside: 0 })).toContain(
      '80.00% (4 detected, 1 undetected; target 80%',
    );
  });

  it('a malformed report is an error, never a score', () => {
    expect(() => readReport(null)).toThrow('no "files" object');
    expect(() => readReport({ files: [] })).toThrow('no "files" object');
    expect(() => readReport({ files: { [T]: {} } })).toThrow('has no mutants list');
    expect(() => readReport({ files: { [T]: { mutants: [{ status: 'Killed' }] } } })).toThrow(
      'mutant 0',
    );
    expect(() =>
      readReport({
        files: { [T]: { mutants: [{ status: 1, location: mutant('', 1).location }] } },
      }),
    ).toThrow('mutant 0');
  });
});
