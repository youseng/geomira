import { isCodeFile, isTestFile } from './files';
import { lineOf, violation, type SourceFile, type Violation } from './types';

/** The only file allowed to contain tolerance literals (CLAUDE.md). */
export const TOLERANCE_FILE = 'packages/num/src/tolerance.ts';

/** Numeric literal tokens: digits with optional fraction, `.5` forms, optional exponent. */
const NUMBER = /(?<![\w$.])(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?(?![\w$])/g;

/**
 * Rule (a): a literal is tolerance-like if it has a negative exponent (one, then `e-`,
 * then nine), or is below one with at least three zeros right after the decimal point.
 */
export function isToleranceLiteral(token: string): boolean {
  if (/[eE]-/.test(token)) return true;
  return /^(?:0[0_]*)?\.0{3}/.test(token);
}

/**
 * Rule (a): tolerance-like literals anywhere in code (comments and strings included, as a
 * grep would see them) outside packages/num/src/tolerance.ts and outside tests.
 */
export function checkTolerance(files: readonly SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (!isCodeFile(file.path) || isTestFile(file.path) || file.path === TOLERANCE_FILE) {
      continue;
    }
    for (const match of file.text.matchAll(NUMBER)) {
      if (isToleranceLiteral(match[0])) {
        found.push(
          violation(
            'tolerance',
            file.path,
            lineOf(file.text, match.index),
            `tolerance-like literal ${match[0]}: tolerances live only in ${TOLERANCE_FILE}`,
          ),
        );
      }
    }
  }
  return found;
}
