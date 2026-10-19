import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAddOnly, latestRunTag } from './add-only';
import { checkDisabledTests } from './disabled-tests';
import { checkFileLength } from './file-length';
import { listFiles, readFiles } from './files';
import { checkForbiddenWords } from './forbidden-words';
import { checkTestCount, parseTestFloor, TEST_COUNT_FILE, type TestCount } from './test-count';
import { checkTolerance } from './tolerance';
import type { CommandResult, Git, RuleId, Violation } from './types';

/** Fixture trees for the rule tests: intentionally full of violations, never scanned. */
export const FIXTURE_DIR = 'scripts/check-rules/fixtures/';

export interface RuleReport {
  readonly rule: RuleId;
  /** What was checked, for the log (file counts, test count, compared tag). */
  readonly info: string;
  readonly violations: readonly Violation[];
}

export interface RunOptions {
  readonly root: string;
  readonly git: Git;
  readonly countTests: (root: string) => TestCount;
  readonly exclude: readonly string[];
}

export const realGit: Git = (cwd, args): CommandResult => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
  return {
    ok: result.status === 0,
    stdout: result.stdout,
    stderr: result.error?.message ?? result.stderr,
  };
};

/** Counts Vitest tests without running them (`vitest list --json`). */
export function countVitestTests(root: string): TestCount {
  const dir = mkdtempSync(join(tmpdir(), 'geomira-list-'));
  const out = join(dir, 'tests.json');
  try {
    const bin = join(root, 'node_modules', '.bin', 'vitest');
    const result = spawnSync(bin, ['list', `--json=${out}`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0 || !existsSync(out)) {
      return {
        ok: false,
        error: `vitest list exited with ${String(result.status)}: ${result.stderr}`,
      };
    }
    const parsed: unknown = JSON.parse(readFileSync(out, 'utf8'));
    return Array.isArray(parsed)
      ? { ok: true, count: parsed.length }
      : { ok: false, error: 'vitest list did not return an array' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function adrExists(root: string, id: string): boolean {
  const dir = join(root, 'docs', 'adr');
  return (
    existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(`${id}-`) && f.endsWith('.md'))
  );
}

function readOptional(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

/** Runs every rule of `pnpm rules` on the tree at `options.root`. */
export function runRules(options: RunOptions): RuleReport[] {
  const { root, git } = options;
  const files = readFiles(root, listFiles(git, root, options.exclude));
  const floorText = readOptional(join(root, TEST_COUNT_FILE));
  const counted = options.countTests(root);
  const tag = latestRunTag(git, root);
  const scanned = `${String(files.length)} files scanned`;
  const countInfo = counted.ok ? `${String(counted.count)} tests` : 'tests not counted';
  const floor = parseTestFloor(floorText);
  return [
    { rule: 'tolerance', info: scanned, violations: checkTolerance(files) },
    { rule: 'file-length', info: scanned, violations: checkFileLength(files) },
    {
      rule: 'test-count',
      info: `${countInfo}, floor ${floor === undefined ? 'unreadable' : String(floor)}`,
      violations: checkTestCount(floorText, counted),
    },
    { rule: 'disabled-tests', info: scanned, violations: checkDisabledTests(files) },
    {
      rule: 'add-only',
      info:
        tag === undefined
          ? 'no run-* tag yet: nothing frozen'
          : `frozen tests compared with ${tag}`,
      violations: checkAddOnly({ git, root, adrExists: (id) => adrExists(root, id) }),
    },
    { rule: 'forbidden-words', info: scanned, violations: checkForbiddenWords(files) },
  ];
}

export function formatReport(reports: readonly RuleReport[]): string {
  const lines: string[] = [];
  for (const report of reports) {
    const mark = report.violations.length === 0 ? 'ok  ' : 'FAIL';
    lines.push(
      `${mark} ${report.rule}: ${report.info}, ${String(report.violations.length)} violation(s)`,
    );
    for (const v of report.violations) {
      lines.push(`     ${v.file}${v.line > 0 ? `:${String(v.line)}` : ''}  ${v.message}`);
    }
  }
  return lines.join('\n');
}
