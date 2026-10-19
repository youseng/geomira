import ts from 'typescript';
import { isCodeFile, isTestFile, isTextFile } from './files';
import { lineOf, violation, type SourceFile, type Violation } from './types';

/** Candidate occurrences; word boundaries are decided by `isWordAt` (camelCase aware). */
const CANDIDATE = /(?:un)?pro(?:ved|ven|ofs?)/gi;

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z]/.test(ch);
}

function isUpper(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Z]/.test(ch);
}

/**
 * True when text[start, end) is a word of its own: delimited by non-letters, or by a
 * camelCase boundary (`isProven`, `ProofBadge`). `improved` and `waterproof` are not hits.
 */
function isWordAt(text: string, start: number, end: number): boolean {
  const before = text[start - 1];
  const first = text[start];
  const last = text[end - 1];
  const after = text[end];
  const startOk = !isLetter(before) || (!isUpper(before) && isUpper(first));
  const endOk = !isLetter(after) || (isUpper(after) && !isUpper(last));
  return startOk && endOk;
}

/** Offsets (within `text`) of forbidden words: proved, proven, unproven, proof, proofs. */
export function findForbiddenWords(text: string): { word: string; offset: number }[] {
  const hits: { word: string; offset: number }[] = [];
  for (const match of text.matchAll(CANDIDATE)) {
    if (isWordAt(text, match.index, match.index + match[0].length)) {
      hits.push({ word: match[0], offset: match.index });
    }
  }
  return hits;
}

/** String-literal pieces of a TS/JS file, with their offsets (user-facing text candidates). */
export function stringLiterals(path: string, text: string): { text: string; offset: number }[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const pieces: { text: string; offset: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      pieces.push({ text: node.getText(source), offset: node.getStart(source) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return pieces;
}

function report(file: SourceFile, offset: number, word: string, where: string): Violation {
  return violation(
    'forbidden-words',
    file.path,
    lineOf(file.text, offset),
    `"${word}" in ${where}: v1 verdicts say what was checked; the word is reserved for Phase 2`,
  );
}

/**
 * Rule (f): the words proved/proof/proven nowhere in apps/ (any text file) and nowhere in
 * string literals of packages/ (comments and identifiers are not user-facing). Tests are
 * excluded in both.
 */
export function checkForbiddenWords(files: readonly SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (isTestFile(file.path)) continue;
    if (file.path.startsWith('apps/') && isTextFile(file.path)) {
      for (const hit of findForbiddenWords(file.text)) {
        found.push(report(file, hit.offset, hit.word, 'apps/'));
      }
    } else if (file.path.startsWith('packages/') && isCodeFile(file.path)) {
      for (const piece of stringLiterals(file.path, file.text)) {
        for (const hit of findForbiddenWords(piece.text)) {
          found.push(report(file, piece.offset + hit.offset, hit.word, 'a user-facing string'));
        }
      }
    }
  }
  return found;
}
