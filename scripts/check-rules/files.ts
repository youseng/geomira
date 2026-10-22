import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Git, SourceFile } from './types';

const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']);

/** Extensions whose files must stay within the 400-line limit (code and text sources). */
const LENGTH_EXTENSIONS = new Set([...CODE_EXTENSIONS, 'css', 'html', 'yml', 'yaml', 'tex', 'asy']);

/** Generated files exempt from the length limit. */
const GENERATED = new Set(['pnpm-lock.yaml']);

/** Extensions read as text when scanning apps/ for forbidden words. */
const TEXT_EXTENSIONS = new Set([...LENGTH_EXTENSIONS, 'json', 'md', 'svg', 'txt']);

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

export function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.has(extensionOf(path));
}

export function isLengthChecked(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return LENGTH_EXTENSIONS.has(extensionOf(path)) && !GENERATED.has(base);
}

export function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(path));
}

/**
 * Test files: `*.test.*` / `*.spec.*`, or anything under a `test/`, `tests/`, `e2e/` or
 * `__tests__/` directory (helpers and fixtures of tests).
 */
export function isTestFile(path: string): boolean {
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return true;
  return /(^|\/)(test|tests|e2e|__tests__)\//.test(path);
}

/** The first run whose tag freezes helpers, fixtures and corpora too (ADR-0021). */
const HELPERS_FROZEN_FROM = 10;

/** Whether the add-only guard at `tag` (run-N or run-Nx) freezes everything under test/ and e2e/. */
export function helpersFrozenAt(tag: string): boolean {
  const m = /^run-(\d+)[a-z]*$/.exec(tag);
  return m !== null && Number(m[1]) >= HELPERS_FROZEN_FROM;
}

/** Snapshot baselines (Vitest, Playwright) and generated test output: never frozen. */
function isSnapshotOrOutput(path: string): boolean {
  return (
    /(^|\/)__snapshots__\//.test(path) ||
    /\.snap$/.test(path) ||
    /-snapshots\//.test(path) ||
    /(^|\/)(test-results|playwright-report|coverage)\//.test(path)
  );
}

/**
 * Files frozen by the add-only guard: `*.test.ts(x)` and Playwright `*.spec.ts(x)`; with
 * `helpers` (tags from run-10, ADR-0021) also every other file under a `test/` or `e2e/`
 * directory (helpers, corpora, fixtures), except snapshots and generated output.
 */
export function isFrozenTestFile(path: string, helpers: boolean): boolean {
  if (/\.(test|spec)\.tsx?$/.test(path)) return true;
  if (!helpers || isSnapshotOrOutput(path)) return false;
  return /(^|\/)(test|e2e)\//.test(path);
}

/**
 * Lists the files of `root` that git sees (tracked, plus untracked but not ignored),
 * as POSIX paths relative to `root`, skipping deleted files and `exclude` prefixes.
 */
export function listFiles(git: Git, root: string, exclude: readonly string[]): string[] {
  const result = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  if (!result.ok) {
    throw new Error(`git ls-files failed in ${root}: ${result.stderr.trim()}`);
  }
  const unique = new Set(result.stdout.split('\0').filter((p) => p.length > 0));
  return [...unique]
    .filter((p) => !exclude.some((prefix) => p.startsWith(prefix)))
    .filter((p) => existsSync(join(root, p)))
    .sort();
}

export function readFiles(root: string, paths: readonly string[]): SourceFile[] {
  return paths.map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));
}
