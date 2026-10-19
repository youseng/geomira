import { isCodeFile, isTestFile } from './files';
import { lineOf, violation, type SourceFile, type Violation } from './types';

/** Banned anywhere in code: a call of the test modifiers skip, only, todo, fails, skipIf, runIf. */
const EVERYWHERE = /\.(?:skip|only|todo|fails|skipIf|runIf)\s*\(/g;

/**
 * Banned in test files only (the names are too common elsewhere): Jasmine-style `xit(`,
 * `fit(`, `xdescribe(`, … and Playwright's `test.fixme(` / `test.fail(`.
 */
const IN_TESTS =
  /(?<![\w$.])(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|\b(?:it|test|describe|suite)(?:\.\w+)*\.(?:fixme|fail)\s*\(/g;

/** Rule (d): no disabled, focused, todo or expected-failure tests. */
export function checkDisabledTests(files: readonly SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;
    const patterns = isTestFile(file.path) ? [EVERYWHERE, IN_TESTS] : [EVERYWHERE];
    for (const pattern of patterns) {
      for (const match of file.text.matchAll(pattern)) {
        found.push(
          violation(
            'disabled-tests',
            file.path,
            lineOf(file.text, match.index),
            `\`${match[0].replace(/\s+/g, '')}\` disables, focuses or inverts a test`,
          ),
        );
      }
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
