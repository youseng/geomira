/**
 * `pnpm rules`: the repository guard rules of CLAUDE.md (tolerance literals, file length,
 * test-count floor, disabled tests, add-only frozen tests, forbidden words).
 * Usage: tsx scripts/check-rules.ts [root]
 */
import { resolve } from 'node:path';
import { countVitestTests, FIXTURE_DIR, formatReport, realGit, runRules } from './check-rules/run';

const root = resolve(process.argv[2] ?? '.');
const reports = runRules({
  root,
  git: realGit,
  countTests: countVitestTests,
  // docs/design/ holds the maintainer's design reference (Run 9b): not the project's files.
  exclude: [FIXTURE_DIR, 'docs/design/'],
});
console.warn(formatReport(reports));
const failed = reports.filter((r) => r.violations.length > 0).length;
if (failed > 0) {
  console.error(`pnpm rules: ${String(failed)} rule(s) failed`);
  process.exitCode = 1;
}
