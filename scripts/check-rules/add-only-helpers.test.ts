/**
 * ADR-0021 (audit proposal P4): from the tag `run-10` on, the add-only guard freezes every
 * file under a `test/` or `e2e/` directory — helpers, corpora, fixtures — not only
 * `*.test.ts(x)` and `*.spec.ts(x)`; snapshot baselines and generated output stay free.
 * Tags before run-10 keep the old scope, so the helpers that existed at run-9b are frozen
 * from the next tag on.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkAddOnly } from './add-only';
import { helpersFrozenAt, isFrozenTestFile } from './files';
import { realGit } from './run';
import { tempRepo, type TempRepo } from './testing';

const HELPER = 'packages/kernel/test/helpers/corpus.ts';
const E2E_HELPER = 'apps/web/e2e/helpers.ts';
const FIXTURE = 'packages/lang/test/fixtures/migration/old.geo';
const SNAPSHOT = 'packages/export/test/__snapshots__/euler-line/standalone.svg';
const PW_SNAPSHOT = 'apps/web/e2e/scene.spec.ts-snapshots/euler-line-desktop-linux.png';
const VITEST_SNAP = 'packages/scene/test/__snapshots__/display.test.ts.snap';
const BODY = 'one\ntwo\nthree\n';
const FILES = [HELPER, E2E_HELPER, FIXTURE, SNAPSHOT, PW_SNAPSHOT, VITEST_SNAP];

let repo: TempRepo;

function check(adrs: readonly string[] = []) {
  return checkAddOnly({ git: realGit, root: repo.root, adrExists: (id) => adrs.includes(id) });
}

function rewriteAll(): void {
  for (const f of FILES) repo.write(f, BODY.replace('two', '2'));
}

beforeEach(() => {
  repo = tempRepo();
  for (const f of FILES) repo.write(f, BODY);
  repo.write('packages/kernel/src/a.ts', 'export const A = 1;\n');
  repo.commit('base');
});

afterEach(() => {
  repo.dispose();
});

describe('the scope of the add-only guard by tag (ADR-0021)', () => {
  it('before run-10 (run-9b): helpers, fixtures and snapshots are not frozen', () => {
    repo.git('tag', 'run-9b');
    rewriteAll();
    repo.commit('rewrite helpers');
    expect(check()).toEqual([]);
  });

  it('from run-10: every file under test/ and e2e/ is frozen, except snapshots', () => {
    repo.git('tag', 'run-10');
    rewriteAll();
    repo.commit('rewrite helpers');
    expect(check().map((v) => v.file)).toEqual([E2E_HELPER, HELPER, FIXTURE].sort());
  });

  it('from run-10: a commit citing an existing ADR may change a helper', () => {
    repo.git('tag', 'run-10');
    repo.write(HELPER, BODY.replace('two', '2'));
    repo.commit('Corpus fix, see ADR-0021');
    expect(check(['0021'])).toEqual([]);
    expect(check()[0]?.message).toContain('ADR-0021 (missing)');
  });

  it('from run-10: a deleted helper fails; added lines and new helpers pass', () => {
    repo.git('tag', 'run-10');
    repo.remove(HELPER);
    repo.write(E2E_HELPER, `${BODY}four\n`);
    repo.write('packages/kernel/test/helpers/new.ts', 'new\n');
    repo.commit('remove a helper');
    expect(check().map((v) => v.file)).toEqual([HELPER]);
  });
});

describe('isFrozenTestFile and helpersFrozenAt', () => {
  it('reads the run number of a tag, suffix letters included', () => {
    expect(helpersFrozenAt('run-9b')).toBe(false);
    expect(helpersFrozenAt('run-3a')).toBe(false);
    expect(helpersFrozenAt('run-10')).toBe(true);
    expect(helpersFrozenAt('run-10b')).toBe(true);
    expect(helpersFrozenAt('run-12')).toBe(true);
    expect(helpersFrozenAt('run-x')).toBe(false);
  });

  it('classifies paths with and without the helpers scope', () => {
    const tests = ['packages/kernel/test/a.test.ts', 'apps/web/e2e/flows.spec.ts'];
    for (const p of tests) {
      expect(isFrozenTestFile(p, false), p).toBe(true);
      expect(isFrozenTestFile(p, true), p).toBe(true);
    }
    for (const p of [HELPER, E2E_HELPER, FIXTURE, 'apps/web/test/helpers.ts']) {
      expect(isFrozenTestFile(p, false), p).toBe(false);
      expect(isFrozenTestFile(p, true), p).toBe(true);
    }
    const free = [
      SNAPSHOT,
      PW_SNAPSHOT,
      VITEST_SNAP,
      'apps/web/test-results/x/trace.zip',
      'apps/web/playwright-report/index.html',
      'tests/fixtures/export/extreme-huge.geo',
      'packages/kernel/src/a.ts',
    ];
    for (const p of free) expect(isFrozenTestFile(p, true), p).toBe(false);
  });
});
