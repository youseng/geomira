/**
 * The nightly's mutation score line for one shard (nightly.yml, SPEC §17 L15). Stryker's
 * incremental mode keeps in its report the old results of mutants outside the current
 * `--mutate` scope (Stryker 10's IncrementalDiffer: "old mutants that didn't run this time
 * around aren't forgotten"), so a shard seeded from a coarser shard's cache, or one line range
 * of a split file, reports mutants that are not its own. The score counts only the shard's own
 * mutants (`inScope`), and the line says how many others the report carried.
 *
 * `tsx scripts/mutation-summary.ts <shard id> <mutation.json>` prints the line.
 *
 * The gate (SPEC §17 L15, from v1.1): `tsx scripts/mutation-summary.ts --gate <dir>` reads every
 * shard's report from `<dir>/mutation-report-<id>/mutation.json` (the layout
 * actions/download-artifact writes), sums each package's in-scope mutants over its shards
 * (kernel: every kernel-* shard), prints one line per package and per shard, and exits 1 when a
 * package scores below its threshold (num 80%, kernel and claims 75%) or a shard's report is
 * missing or malformed: the gate never passes by omission.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inScope, SHARDS, type Shard } from './mutation-shards';

/** One mutant of Stryker's JSON report: its status and its first and last line (1-based). */
export interface Mutant {
  readonly status: string;
  readonly start: number;
  readonly end: number;
}

export interface Tally {
  readonly detected: number;
  readonly undetected: number;
  /** Mutants of the report outside the shard's scope (not counted). */
  readonly outside: number;
}

const DETECTED: ReadonlySet<string> = new Set(['Killed', 'Timeout']);
const UNDETECTED: ReadonlySet<string> = new Set(['Survived', 'NoCoverage']);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function lineOf(position: unknown): number | undefined {
  return isRecord(position) && typeof position.line === 'number' ? position.line : undefined;
}

function mutantOf(m: unknown): Mutant | undefined {
  if (!isRecord(m) || typeof m.status !== 'string' || !isRecord(m.location)) return undefined;
  const start = lineOf(m.location.start);
  const end = lineOf(m.location.end);
  return start === undefined || end === undefined ? undefined : { status: m.status, start, end };
}

/** The report's mutants by file. A malformed report is an error, never a score. */
export function readReport(report: unknown): Map<string, Mutant[]> {
  if (!isRecord(report) || !isRecord(report.files))
    throw new Error('mutation.json: no "files" object');
  const out = new Map<string, Mutant[]>();
  for (const [file, entry] of Object.entries(report.files)) {
    const list: unknown = isRecord(entry) ? entry.mutants : undefined;
    if (!Array.isArray(list)) throw new Error(`mutation.json: ${file} has no mutants list`);
    out.set(
      file,
      list.map((m: unknown, i) => {
        const mutant = mutantOf(m);
        if (mutant === undefined) throw new Error(`mutation.json: ${file}, mutant ${String(i)}`);
        return mutant;
      }),
    );
  }
  return out;
}

/** Detected (Killed, Timeout) and undetected (Survived, NoCoverage) mutants of the shard. */
export function tally(shard: Shard, mutants: ReadonlyMap<string, readonly Mutant[]>): Tally {
  let detected = 0;
  let undetected = 0;
  let outside = 0;
  for (const [file, list] of mutants)
    for (const m of list) {
      if (!inScope(shard, file, m.start, m.end)) outside++;
      else if (DETECTED.has(m.status)) detected++;
      else if (UNDETECTED.has(m.status)) undetected++;
    }
  return { detected, undetected, outside };
}

export function summaryLine(shard: Shard, t: Tally): string {
  const total = t.detected + t.undetected;
  const score = total === 0 ? 'n/a' : `${((100 * t.detected) / total).toFixed(2)}%`;
  const target = shard.pkg === 'num' ? 80 : 75;
  const carried =
    t.outside === 0 ? '' : `; ${String(t.outside)} mutants outside the shard not counted`;
  return (
    `${shard.id} mutation score: ${score} (${String(t.detected)} detected, ` +
    `${String(t.undetected)} undetected${carried}; target ${String(target)}%, gated from v1.1)`
  );
}

/** The gate's threshold of a package, in percent (SPEC §17 L15). */
export function threshold(pkg: Shard['pkg']): number {
  return pkg === 'num' ? 80 : 75;
}

/** One shard's result: its tally, or why it has none (a missing or malformed report). */
export type ShardResult =
  | { readonly shard: Shard; readonly tally: Tally }
  | { readonly shard: Shard; readonly problem: string };

export interface PackageResult {
  readonly pkg: Shard['pkg'];
  readonly detected: number;
  readonly undetected: number;
  /** The shards of the package without a usable report. */
  readonly missing: readonly string[];
  readonly pass: boolean;
}

/** The shard's report in `dir` (`mutation-report-<id>/mutation.json`), tallied. */
export function readShard(dir: string, shard: Shard): ShardResult {
  const path = join(dir, `mutation-report-${shard.id}`, 'mutation.json');
  if (!existsSync(path)) return { shard, problem: `no report (${path})` };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return { shard, tally: tally(shard, readReport(parsed)) };
  } catch (e) {
    return { shard, problem: `malformed report: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * The packages' results. A package passes when every shard of it has a report and
 * detected / (detected + undetected) reaches its threshold (compared in integers, so exactly
 * 80.00% passes at 80); a package without any shard or any counted mutant fails (nothing was
 * measured).
 */
export function gate(results: readonly ShardResult[]): PackageResult[] {
  const pkgs: readonly Shard['pkg'][] = ['num', 'kernel', 'claims'];
  return pkgs.map((pkg) => {
    const own = results.filter((r) => r.shard.pkg === pkg);
    let detected = 0;
    let undetected = 0;
    const missing: string[] = [];
    for (const r of own) {
      if ('problem' in r) missing.push(r.shard.id);
      else {
        detected += r.tally.detected;
        undetected += r.tally.undetected;
      }
    }
    const total = detected + undetected;
    const pass =
      own.length > 0 &&
      missing.length === 0 &&
      total > 0 &&
      100 * detected >= threshold(pkg) * total;
    return { pkg, detected, undetected, missing, pass };
  });
}

/** "kernel mutation gate: 97.10% (… detected, … undetected; threshold 75%): pass". */
export function gateLine(p: PackageResult): string {
  const total = p.detected + p.undetected;
  const score = total === 0 ? 'n/a' : `${((100 * p.detected) / total).toFixed(2)}%`;
  const missing = p.missing.length === 0 ? '' : `; missing reports: ${p.missing.join(', ')}`;
  return (
    `${p.pkg} mutation gate: ${score} (${String(p.detected)} detected, ` +
    `${String(p.undetected)} undetected${missing}; threshold ${String(threshold(p.pkg))}%): ` +
    (p.pass ? 'pass' : 'FAIL')
  );
}

/** The gate's lines for a directory of shard artifacts, and whether every package passes. */
export function runGate(
  dir: string,
  shards: readonly Shard[] = SHARDS,
): { readonly lines: readonly string[]; readonly pass: boolean } {
  const results = shards.map((s) => readShard(dir, s));
  const packages = gate(results);
  const lines = [
    ...packages.map(gateLine),
    ...results.map((r) =>
      'problem' in r ? `${r.shard.id}: ${r.problem}` : summaryLine(r.shard, r.tally),
    ),
  ];
  return { lines, pass: packages.every((p) => p.pass) };
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isMain && process.argv[2] === '--gate') {
  const dir = process.argv[3];
  if (dir === undefined) throw new Error('usage: tsx scripts/mutation-summary.ts --gate <dir>');
  const { lines, pass } = runGate(dir);
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exitCode = pass ? 0 : 1;
} else if (isMain) {
  const [id, path] = process.argv.slice(2);
  const shard = SHARDS.find((s) => s.id === id);
  if (shard === undefined || path === undefined)
    throw new Error('usage: tsx scripts/mutation-summary.ts <shard id> <mutation.json>');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  process.stdout.write(`${summaryLine(shard, tally(shard, readReport(parsed)))}\n`);
}
