/**
 * The nightly's mutation gate (SPEC §17 L15 from v1.1; scripts/mutation-summary.ts `--gate`):
 * per package over all its shards, in-scope mutants only, a missing or malformed shard report
 * fails, the threshold is inclusive.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SHARDS } from './mutation-shards';
import { gate, runGate, threshold, type ShardResult } from './mutation-summary';

const T = 'packages/kernel/src/tools/transforms.ts';
const GEOM = 'packages/kernel/src/geom.ts';

function mutant(status: string, line: number) {
  return { status, location: { start: { line, column: 1 }, end: { line, column: 9 } } };
}

/** `killed` Killed and `survived` Survived mutants at `line` of `file`. */
function report(file: string, killed: number, survived: number, line = 10) {
  const mutants = [
    ...Array.from({ length: killed }, () => mutant('Killed', line)),
    ...Array.from({ length: survived }, () => mutant('Survived', line)),
  ];
  return { files: { [file]: { mutants } } };
}

function fileOfShard(id: string): string {
  if (id === 'num') return 'packages/num/src/rational.ts';
  if (id === 'claims') return 'packages/claims/src/kinds.ts';
  const s = SHARDS.find((x) => x.id === id);
  const first = s?.mutate.find((m) => !m.startsWith('!'));
  if (first === undefined) throw new Error(id);
  // kernel-h's first entry is a glob: a tools file no other group lists.
  return first.endsWith('**/*.ts')
    ? 'packages/kernel/src/tools/arithmetic.ts'
    : first.replace(/:\d+-\d+$/u, '');
}

/** The line of the shard's own range (transforms.ts is cut into three line ranges). */
function lineOfShard(id: string): number {
  const s = SHARDS.find((x) => x.id === id);
  const r = /:(\d+)-\d+$/u.exec(s?.mutate[0] ?? '');
  return r === null ? 10 : Number(r[1]) + 1;
}

let dir = '';

function write(id: string, content: unknown): void {
  const d = join(dir, `mutation-report-${id}`);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'mutation.json'), JSON.stringify(content));
}

/** Every shard with `killed` / `survived` mutants of its own. */
function writeAll(killed: number, survived: number): void {
  for (const s of SHARDS)
    write(s.id, report(fileOfShard(s.id), killed, survived, lineOfShard(s.id)));
}

function line(lines: readonly string[], pkg: string): string {
  return lines.find((l) => l.startsWith(`${pkg} mutation gate:`)) ?? '';
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gate-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('the nightly mutation gate', () => {
  it('thresholds: num 80%, kernel and claims 75%', () => {
    expect([threshold('num'), threshold('kernel'), threshold('claims')]).toEqual([80, 75, 75]);
  });

  it('passes when every package reaches its threshold, summing the kernel shards', () => {
    writeAll(9, 1);
    const { lines, pass } = runGate(dir);
    expect(pass).toBe(true);
    const kernelShards = SHARDS.filter((s) => s.pkg === 'kernel').length;
    expect(line(lines, 'kernel')).toBe(
      `kernel mutation gate: 90.00% (${String(9 * kernelShards)} detected, ${String(kernelShards)} undetected; threshold 75%): pass`,
    );
    expect(line(lines, 'num')).toContain('num mutation gate: 90.00% (9 detected, 1 undetected');
    // One line per package, then one per shard.
    expect(lines).toHaveLength(3 + SHARDS.length);
  });

  it('fails when any one package is below its threshold', () => {
    for (const [pkg, killed, survived] of [
      ['num', 79, 21],
      ['claims', 74, 26],
    ] as const) {
      writeAll(9, 1);
      write(pkg, report(fileOfShard(pkg), killed, survived));
      const { lines, pass } = runGate(dir);
      expect(pass, pkg).toBe(false);
      expect(line(lines, pkg)).toMatch(/: FAIL$/u);
      for (const other of ['num', 'kernel', 'claims'].filter((p) => p !== pkg))
        expect(line(lines, other)).toMatch(/: pass$/u);
    }
    // The kernel fails on its sum: every shard at 70%.
    writeAll(7, 3);
    expect(line(runGate(dir).lines, 'kernel')).toMatch(/70\.00%.*: FAIL$/u);
  });

  it('a low shard is fine when its package as a whole reaches the threshold', () => {
    writeAll(99, 1);
    write('kernel-a', report(GEOM, 1, 9));
    expect(runGate(dir).pass).toBe(true);
  });

  it('the threshold is inclusive: exactly 80.00% and 75.00% pass', () => {
    writeAll(3, 1);
    write('num', report(fileOfShard('num'), 4, 1));
    const { lines, pass } = runGate(dir);
    expect(pass).toBe(true);
    expect(line(lines, 'num')).toContain('80.00%');
    expect(line(lines, 'claims')).toContain('75.00%');
  });

  it('a missing shard report fails its package, never a pass by omission', () => {
    writeAll(10, 0);
    rmSync(join(dir, 'mutation-report-kernel-e'), { recursive: true });
    const { lines, pass } = runGate(dir);
    expect(pass).toBe(false);
    expect(line(lines, 'kernel')).toMatch(/missing reports: kernel-e; .*: FAIL$/u);
    expect(lines).toContain(
      `kernel-e: no report (${join(dir, 'mutation-report-kernel-e', 'mutation.json')})`,
    );
    expect(line(lines, 'num')).toMatch(/: pass$/u);
  });

  it('a malformed report fails its package', () => {
    writeAll(10, 0);
    write('claims', { files: { 'packages/claims/src/kinds.ts': { mutants: [{ status: 1 }] } } });
    const bad = runGate(dir);
    expect(bad.pass).toBe(false);
    expect(bad.lines.some((l) => l.startsWith('claims: malformed report'))).toBe(true);
    const d = join(dir, 'mutation-report-num');
    writeFileSync(join(d, 'mutation.json'), '{ not json');
    expect(line(runGate(dir).lines, 'num')).toMatch(/missing reports: num; .*: FAIL$/u);
  });

  it("counts only each shard's in-scope mutants", () => {
    writeAll(10, 0);
    // kernel-b owns transforms.ts lines 1–132; survivors at line 300 belong to kernel-k.
    write('kernel-b', {
      files: {
        [T]: {
          mutants: [
            mutant('Killed', 10),
            ...Array.from({ length: 50 }, () => mutant('Survived', 300)),
          ],
        },
      },
    });
    const { lines, pass } = runGate(dir);
    expect(pass).toBe(true);
    expect(lines.find((l) => l.startsWith('kernel-b mutation score'))).toContain(
      '100.00% (1 detected, 0 undetected; 50 mutants outside the shard not counted',
    );
  });

  it('a package with nothing measured fails', () => {
    const empty: ShardResult[] = SHARDS.map((shard) => ({
      shard,
      tally: { detected: 0, undetected: 0, outside: 0 },
    }));
    expect(gate(empty).map((p) => p.pass)).toEqual([false, false, false]);
    expect(gate([]).every((p) => !p.pass)).toBe(true);
  });

  it('the CLI exits 1 below a threshold and 0 when every package passes', () => {
    const run = () =>
      execFileSync('pnpm', ['exec', 'tsx', 'scripts/mutation-summary.ts', '--gate', dir], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    writeAll(9, 1);
    expect(run()).toContain('claims mutation gate: 90.00%');
    writeAll(1, 9);
    expect(run).toThrow(/Command failed/u);
  });
});
