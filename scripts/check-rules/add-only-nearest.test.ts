/**
 * ADR-0041: the add-only guard compares with the PREVIOUS run's tag, the run tag on the most
 * recent commit of HEAD's history, not the highest run number. Run 17 was done before Run 16a,
 * so `run-17b` sorts after `run-16a` by version although `run-16a` is the later tag; comparing
 * with `run-17b` left every test file Run 16a added or changed unfrozen.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkAddOnly, latestRunTag } from './add-only';
import { realGit } from './run';
import { tempRepo, type TempRepo } from './testing';

const OLD = 'packages/kernel/test/a.test.ts';
const NEW = 'packages/kernel/test/b.test.ts';
const BODY = "import { it } from 'vitest';\nit('one', () => {});\nit('two', () => {});\n";

let repo: TempRepo;

const check = () => checkAddOnly({ git: realGit, root: repo.root, adrExists: () => false });

beforeEach(() => {
  repo = tempRepo();
  repo.write(OLD, BODY);
  repo.commit('run 17');
  repo.git('tag', 'run-17b');
  repo.write(NEW, BODY);
  repo.commit('run 16a adds a test');
  repo.git('tag', 'run-16a');
});

afterEach(() => {
  repo.dispose();
});

describe('the add-only guard compares with the nearest run tag (ADR-0041)', () => {
  it('a later tag with a lower run number is the previous run', () => {
    expect(latestRunTag(realGit, repo.root)).toBe('run-16a');
  });

  it('a test file added in the latest run is frozen', () => {
    repo.write(NEW, BODY.replace("'two'", "'2'"));
    repo.commit('weaken the new test');
    expect(check().map((v) => v.file)).toEqual([NEW]);
    expect(check()[0]?.message).toContain('frozen at run-16a');
  });

  it('a tag on a commit outside HEAD’s history is not used', () => {
    repo.git('checkout', '-q', '-b', 'side', 'run-17b');
    repo.write('x.txt', 'x\n');
    repo.commit('side work');
    repo.git('tag', 'run-99');
    repo.git('checkout', '-q', 'main');
    expect(latestRunTag(realGit, repo.root)).toBe('run-16a');
  });

  it('two tags on one commit: the higher version', () => {
    repo.git('tag', 'run-16b');
    expect(latestRunTag(realGit, repo.root)).toBe('run-16b');
  });

  it('no run tag in HEAD’s history: the guard is inactive', () => {
    repo.git('checkout', '-q', '--orphan', 'fresh');
    repo.git('rm', '-rq', '--cached', '.');
    repo.write('y.txt', 'y\n');
    repo.git('add', 'y.txt');
    repo.git('commit', '-q', '-m', 'unrelated');
    expect(latestRunTag(realGit, repo.root)).toBeUndefined();
  });
});
