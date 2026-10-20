/**
 * The nightly's mutation score line for one shard (nightly.yml, SPEC §17 L15). Stryker's
 * incremental mode keeps in its report the old results of mutants outside the current
 * `--mutate` scope (Stryker 10's IncrementalDiffer: "old mutants that didn't run this time
 * around aren't forgotten"), so a shard seeded from a coarser shard's cache, or one line range
 * of a split file, reports mutants that are not its own. The score counts only the shard's own
 * mutants (`inScope`), and the line says how many others the report carried.
 *
 * `tsx scripts/mutation-summary.ts <shard id> <mutation.json>` prints the line.
 */
import { readFileSync } from 'node:fs';
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [id, path] = process.argv.slice(2);
  const shard = SHARDS.find((s) => s.id === id);
  if (shard === undefined || path === undefined)
    throw new Error('usage: tsx scripts/mutation-summary.ts <shard id> <mutation.json>');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  process.stdout.write(`${summaryLine(shard, tally(shard, readReport(parsed)))}\n`);
}
