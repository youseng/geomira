import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { listFiles, readFiles } from './files';
import { realGit } from './run';
import type { SourceFile, Violation } from './types';

/** Helpers for the check-rules tests (fixture trees and throwaway git repositories). */
export const FIXTURES = join(import.meta.dirname, 'fixtures');

export function fixtureFiles(rule: string, variant: string): SourceFile[] {
  const root = join(FIXTURES, rule, variant);
  return readFiles(root, listFiles(realGit, root, []));
}

/** `file:line` of each violation, for compact assertions. */
export function where(found: readonly Violation[]): string[] {
  return found.map((v) => `${v.file}:${String(v.line)}`);
}

export interface TempRepo {
  readonly root: string;
  write(path: string, text: string): void;
  remove(path: string): void;
  git(...args: string[]): string;
  commit(message: string): void;
  dispose(): void;
}

/** A fresh git repository in the OS temp directory, isolated from user/global config. */
export function tempRepo(): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'geomira-rules-'));
  const git = (...args: string[]): string => {
    const result = spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Rules Test');
  git('config', 'user.email', 'rules@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  return {
    root,
    git,
    write(path, text) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    },
    remove(path) {
      rmSync(join(root, path));
    },
    commit(message) {
      git('add', '-A');
      git('commit', '-q', '--allow-empty', '-m', message);
    },
    dispose() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
