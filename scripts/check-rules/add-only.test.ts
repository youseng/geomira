import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adrReferences, checkAddOnly, latestRunTag, removedLines } from './add-only';
import { realGit } from './run';
import { tempRepo, type TempRepo } from './testing';

const FROZEN = 'packages/kernel/test/a.test.ts';
const BODY = "import { it } from 'vitest';\nit('one', () => {});\nit('two', () => {});\n";

let repo: TempRepo;

function check(adrs: readonly string[] = []) {
  return checkAddOnly({ git: realGit, root: repo.root, adrExists: (id) => adrs.includes(id) });
}

beforeEach(() => {
  repo = tempRepo();
  repo.write(FROZEN, BODY);
  repo.write('packages/kernel/src/a.ts', 'export const A = 1;\n');
  repo.commit('run 0');
});

afterEach(() => {
  repo.dispose();
});

describe('rule (e): add-only guard', () => {
  it('is inactive before the first run-* tag', () => {
    repo.write(FROZEN, 'rewritten\n');
    repo.commit('rewrite');
    expect(check()).toEqual([]);
  });

  it('accepts added lines, new tests and source edits after the tag', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, `${BODY}it('three', () => {});\n`);
    repo.write('packages/kernel/test/b.test.ts', 'new\n');
    repo.write('packages/kernel/src/a.ts', 'export const A = 2;\n');
    repo.commit('add tests');
    expect(check()).toEqual([]);
  });

  it('fails on a modified line', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("'two'", "'2'"));
    repo.commit('tweak');
    const found = check();
    expect(found.map((v) => `${v.file}:${String(v.line)}`)).toEqual([`${FROZEN}:3`]);
    expect(found[0]?.message).toContain('cites no ADR');
  });

  it('fails on a deleted line and on a deleted file', () => {
    repo.write('packages/kernel/test/c.test.ts', 'keep\n');
    repo.commit('c');
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("it('one', () => {});\n", ''));
    repo.remove('packages/kernel/test/c.test.ts');
    repo.commit('remove');
    expect(check().map((v) => v.file)).toEqual([
      'packages/kernel/test/a.test.ts',
      'packages/kernel/test/c.test.ts',
    ]);
  });

  it('fails on uncommitted modifications even when earlier commits cite an ADR', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("'one'", "'1'"));
    repo.commit('ADR-0002: rename');
    repo.write(FROZEN, BODY.replace("'two'", "'2'").replace("'one'", "'1'"));
    expect(check(['0002'])[0]?.message).toContain('uncommitted');
  });

  it('fails when the cited ADR does not exist', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("'two'", "'2'"));
    repo.commit('Loosen per ADR-0009');
    expect(check(['0002'])[0]?.message).toContain('ADR-0009 (missing)');
  });

  it('passes when every removing commit cites an existing ADR', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("'two'", "'2'"));
    repo.commit('Rename test, see ADR-0002');
    expect(check(['0002'])).toEqual([]);
  });

  it('fails when one of several removing commits lacks an ADR', () => {
    repo.git('tag', 'run-0');
    repo.write(FROZEN, BODY.replace("'two'", "'2'"));
    repo.commit('ADR-0002 rename');
    repo.write(FROZEN, BODY.replace("'two'", "'2'").replace("'one'", "'1'"));
    repo.commit('sneaky');
    expect(check(['0002'])[0]?.message).toContain('cites no ADR');
  });

  it('compares against the latest run tag in version order', () => {
    repo.git('tag', 'run-9');
    repo.write(FROZEN, BODY.replace("'two'", "'2'"));
    repo.commit('ADR-0003 run 10 change');
    repo.git('tag', 'run-10');
    expect(latestRunTag(realGit, repo.root)).toBe('run-10');
    expect(check()).toEqual([]);
  });

  it('fails in a shallow clone instead of switching off', () => {
    repo.git('tag', 'run-0');
    repo.commit('second');
    const clone = tempRepo();
    try {
      clone.git('fetch', '-q', '--depth=1', `file://${repo.root}`, 'main');
      clone.git('checkout', '-q', 'FETCH_HEAD');
      const found = checkAddOnly({ git: realGit, root: clone.root, adrExists: () => true });
      expect(found.map((v) => v.message)).toEqual(['shallow clone: fetch full history and tags']);
    } finally {
      clone.dispose();
    }
  });
});

describe('add-only helpers', () => {
  it('reads removed lines of a unified diff with old-side numbers', () => {
    const diff = [
      'diff --git a/x b/x',
      '--- a/x',
      '+++ b/x',
      '@@ -2 +2 @@',
      '-old two',
      '+new two',
      '@@ -7,2 +6,0 @@',
      '-seven',
      '-eight',
      '\\ No newline at end of file',
    ].join('\n');
    expect(removedLines(diff)).toEqual([
      { line: 2, text: 'old two' },
      { line: 7, text: 'seven' },
      { line: 8, text: 'eight' },
    ]);
  });

  it('finds ADR references', () => {
    expect(adrReferences('Fix (ADR-0012), see also ADR-0003; not ADR-12 or XADR-0001')).toEqual([
      '0012',
      '0003',
    ]);
  });
});
