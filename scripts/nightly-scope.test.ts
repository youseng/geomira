/**
 * ADR-0022 (audit proposal P5): which jobs of the nightly workflow run for an event
 * (scripts/nightly-scope.sh, the workflow's `scope` job). The schedule, a dispatch and a
 * push to main run the test suite and incremental mutation testing; a push to any other
 * branch runs only the test job, and only when it changes the nightly's own configuration
 * (the paths the workflow used to filter on).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempRepo, type TempRepo } from './check-rules/testing';

const SCRIPT = join(import.meta.dirname, 'nightly-scope.sh');
const ZERO = '0000000000000000000000000000000000000000';

let repo: TempRepo;

function head(): string {
  return repo.git('rev-parse', 'HEAD').trim();
}

/** The script's `key=value` output for an event (GITHUB_OUTPUT unset: printed). */
function scope(event: string, ref: string, before = ''): Record<string, string> {
  const r = spawnSync('sh', [SCRIPT], {
    cwd: repo.root,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      EVENT: event,
      REF: ref,
      BEFORE: before,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return Object.fromEntries(
    r.stdout
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => l.split('=') as [string, string]),
  );
}

beforeEach(() => {
  repo = tempRepo();
  repo.write('packages/kernel/src/a.ts', 'export const A = 1;\n');
  repo.commit('base');
  repo.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
});

afterEach(() => {
  repo.dispose();
});

describe('nightly scope', () => {
  it('schedule and dispatch: tests and mutation', () => {
    for (const event of ['schedule', 'workflow_dispatch'])
      expect(scope(event, 'refs/heads/main')).toEqual({ test: 'true', mutation: 'true' });
  });

  it('a push to main: tests and mutation, whatever it changes', () => {
    const before = head();
    repo.write('packages/kernel/src/a.ts', 'export const A = 2;\n');
    repo.commit('source only');
    expect(scope('push', 'refs/heads/main', before)).toEqual({ test: 'true', mutation: 'true' });
  });

  it('a push to a branch changing source only: nothing', () => {
    repo.git('checkout', '-q', '-b', 'feature');
    const before = head();
    repo.write('packages/kernel/src/a.ts', 'export const A = 2;\n');
    repo.commit('source only');
    expect(scope('push', 'refs/heads/feature', before)).toEqual({
      test: 'false',
      mutation: 'false',
    });
  });

  it('a push to a branch changing the nightly configuration: the test job only', () => {
    for (const path of [
      '.github/workflows/nightly.yml',
      'stryker.claims.json',
      'vitest.kernel.config.ts',
      'scripts/mutation-shards.ts',
      'scripts/mutation-summary.ts',
      'scripts/nightly-scope.sh',
    ]) {
      const before = head();
      repo.write(path, `${path}\n${before}\n`);
      repo.commit(`change ${path}`);
      expect(scope('push', 'refs/heads/feature', before), path).toEqual({
        test: 'true',
        mutation: 'false',
      });
    }
  });

  it('the first push of a new branch is compared with origin/main', () => {
    repo.git('checkout', '-q', '-b', 'fresh');
    repo.write('stryker.num.json', '{}\n');
    repo.commit('config');
    repo.write('packages/kernel/src/a.ts', 'export const A = 3;\n');
    repo.commit('source');
    expect(scope('push', 'refs/heads/fresh', ZERO)).toEqual({ test: 'true', mutation: 'false' });
  });

  it('the workflow runs the script and gates its jobs on its outputs', () => {
    const yml = readFileSync(
      join(import.meta.dirname, '..', '.github', 'workflows', 'nightly.yml'),
      'utf8',
    );
    expect(yml).toContain('run: sh scripts/nightly-scope.sh');
    expect(yml).toContain("if: needs.scope.outputs.test == 'true'");
    expect(yml).toContain("if: needs.scope.outputs.mutation == 'true'");
    expect(yml).toContain("cron: '17 3 * * *'");
    expect(yml).toContain('group: nightly-${{ github.ref }}');
    expect(yml).not.toMatch(/\n {4}paths:/);
  });
});
