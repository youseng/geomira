/**
 * The lexer (SPEC §11.2, ADR-0009): one line at a time, total (never throws). Tokens carry
 * their column range and whether whitespace precedes them (juxtaposed point names form
 * segments and angles in claims). A `#` outside a string starts a comment.
 *
 * Names. A POINT name is an uppercase Latin letter, then digits or `_` + (digits | one
 * letter | `{alnum+}`), then primes, then any glued run of `*` (always part of the name:
 * points are never multiplied, so `A*B*` is A*, B*). Any other name starts with a lowercase
 * Latin or a Greek letter (`\omega` → ω), continues with letters, digits, `_` and Greek
 * letters, then primes; a glued run of `*` is part of it iff the next character is NOT a
 * letter, digit, `_`, `(` or `\` (`l*`, `w*,` and `w*)` are names; `a*b`, `k*2` and
 * `r*(1+r)` are products). `a* b` (a starred name, whitespace, then an operand) is an
 * error: write `a * b`. `Ma` is an error with the hint "did you mean M_a?".
 *
 * Geomdraw's capitals (ADR-0025): a capitalised word followed by `(` is a call name
 * (`Midpoint(A, B)` is midpoint(A, B)), and a capitalised statement keyword starts a line
 * (`Triangle ABC`); both are lowercased. Neither was a valid point name.
 */
import { error, type Diagnostic } from './diagnostic';
import { GREEK, SYMBOL_ESCAPES } from './symbols';
import { lexNumber, lexString } from './lex-literals';
import type { Token } from './token';

export interface LexedLine {
  readonly tokens: readonly Token[];
  /** The text after `#`, when the line has a comment. */
  readonly comment?: string;
  readonly diagnostics: readonly Diagnostic[];
}

const LOWER_OR_GREEK = /[a-zα-ωΑ-Ω]/u;
const NAME_CONT = /[A-Za-z0-9_α-ωΑ-Ω]/u;
const OPERAND_START = /[\p{L}0-9_(\\]/u;
const PUNCT: Readonly<Record<string, string>> = {
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  ',': ',',
  '=': '=',
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '·': '·',
  '⋅': '·',
  '/': '/',
  '<': '<',
  '>': '>',
  '≠': '≠',
  '≤': '≤',
  '≥': '≥',
  '∡': '∡',
  '∠': '∠',
  '⟂': '⟂',
  '⊥': '⟂',
  '∥': '∥',
};
const TWO_CHAR: Readonly<Record<string, string>> = { '!=': '≠', '<=': '≤', '>=': '≥' };

/** Mutable cursor state of one line (local to lexLine). */
interface Cursor {
  readonly src: string;
  readonly line: number;
  i: number;
  space: boolean;
  readonly tokens: Token[];
  readonly diags: Diagnostic[];
}

function at(c: Cursor, k = 0): string {
  return c.src[c.i + k] ?? '';
}

function push(c: Cursor, kind: Token['kind'], start: number, text: string, value = text): void {
  c.tokens.push({
    kind,
    text,
    value,
    line: c.line,
    column: start + 1,
    endColumn: c.i + 1,
    spaceBefore: c.space,
  });
  c.space = false;
}

function fail(c: Cursor, start: number, message: string, hint: string): void {
  c.diags.push(
    error(
      { line: c.line, column: start + 1, endColumn: Math.max(c.i, start + 1) + 1 },
      message,
      hint,
    ),
  );
}

/** `\word`: a Greek letter, or undefined (the caller decides). */
function escapeWord(c: Cursor): string {
  const m = /^\\([A-Za-z]+)/u.exec(c.src.slice(c.i));
  return m?.[1] ?? '';
}

/** Lexes one line into tokens, an optional comment and diagnostics. */
export function lexLine(src: string, line: number): LexedLine {
  const c: Cursor = { src, line, i: 0, space: true, tokens: [], diags: [] };
  while (c.i < src.length) {
    const ch = at(c);
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      c.i += 1;
      c.space = true;
    } else if (ch === '#') {
      return { tokens: c.tokens, comment: src.slice(c.i + 1), diagnostics: c.diags };
    } else {
      lexToken(c, ch);
    }
  }
  return { tokens: c.tokens, diagnostics: c.diags };
}

function lexToken(c: Cursor, ch: string): void {
  const start = c.i;
  if (/[A-Z]/u.test(ch)) {
    lexPoint(c);
    return;
  }
  if (LOWER_OR_GREEK.test(ch)) {
    lexName(c);
    return;
  }
  if (/[0-9]/u.test(ch)) {
    lexNumberToken(c);
    return;
  }
  if (ch === '"') {
    const r = lexString(c.src, c.i);
    c.i = r.end;
    if (r.ok) push(c, 'string', start, c.src.slice(start, r.end), r.value);
    else fail(c, start, r.message, r.hint);
    return;
  }
  if (ch === '\\') {
    lexEscape(c);
    return;
  }
  if (ch === '@') {
    const m = /^@([a-z]+)/u.exec(c.src.slice(c.i));
    c.i += m === null ? 1 : m[0].length;
    if (m === null)
      fail(c, start, 'a directive is @ followed by a word', 'write @version 1, @layer …');
    else push(c, 'directive', start, m[0], m[1] ?? '');
    return;
  }
  const two = TWO_CHAR[c.src.slice(c.i, c.i + 2)];
  if (two !== undefined) {
    c.i += 2;
    push(c, 'punct', start, c.src.slice(start, c.i), two);
    return;
  }
  const p = PUNCT[ch];
  c.i += ch.length;
  if (p !== undefined) {
    push(c, 'punct', start, ch, p);
    return;
  }
  if (ch === '°') {
    fail(c, start, '° follows a number', 'write 60°');
    return;
  }
  fail(c, start, `unexpected character "${ch}"`, 'remove it');
}

function lexEscape(c: Cursor): void {
  const start = c.i;
  const word = escapeWord(c);
  if (GREEK[word] !== undefined) {
    lexName(c);
    return;
  }
  const sym = SYMBOL_ESCAPES[word];
  c.i += 1 + word.length;
  if (sym !== undefined) {
    push(c, 'punct', start, c.src.slice(start, c.i), sym);
    return;
  }
  fail(
    c,
    start,
    `unknown escape "\\${word}"`,
    'Greek letters are \\alpha … \\omega; symbols \\angle, \\measuredangle, \\cdot, \\neq',
  );
}

function lexNumberToken(c: Cursor): void {
  const start = c.i;
  const r = lexNumber(c.src, c.i);
  c.i = r.end;
  push(c, 'number', start, c.src.slice(start, r.end));
}

/** Statement keywords a line may start with in capitals (Geomdraw's `Triangle A B C`). */
const KEYWORDS: readonly string[] = Object.freeze([
  'triangle',
  'point',
  'points',
  'claim',
  'assume',
  'style',
  'label',
]);

/** `Midpoint(` or a capitalised keyword at the start of a line: a lowercase name token. */
function capitalised(c: Cursor): boolean {
  const word = /^[A-Z][a-z][A-Za-z0-9_]*/u.exec(c.src.slice(c.i))?.[0];
  if (word === undefined) return false;
  const after = c.src.slice(c.i + word.length).trimStart();
  const lower = word.toLowerCase();
  const keyword = c.tokens.length === 0 && KEYWORDS.includes(lower) && !after.startsWith('=');
  if (!after.startsWith('(') && !keyword) return false;
  const start = c.i;
  c.i += word.length;
  push(c, 'name', start, word, lower);
  return true;
}

/** A point name: letter, optional index, primes, then glued stars. */
function lexPoint(c: Cursor): void {
  if (capitalised(c)) return;
  const start = c.i;
  const m = /^[A-Z](?:[0-9]+|_(?:[0-9]+|[A-Za-z]|\{[A-Za-z0-9]+\}))?'*\**/u.exec(c.src.slice(c.i));
  const text = m?.[0] ?? at(c);
  c.i += text.length;
  const next = at(c);
  if (/^[A-Z]$/u.test(text) && /[a-z]/u.test(next)) {
    badSubscript(c, start, text);
    return;
  }
  if (/^[A-Z]_[A-Za-z]$/u.test(text) && /[a-z0-9]/u.test(next)) {
    badSubscript(c, start, text);
    return;
  }
  if (text.length === 1 && next === '_') {
    c.i += 1;
    fail(c, start, `"${text}_" needs an index`, `write ${text}_1, ${text}_a or ${text}_{ab}`);
    return;
  }
  push(c, 'point', start, text);
}

/** `Ma` / `M_ab`: a point name glued to letters. */
function badSubscript(c: Cursor, start: number, head: string): void {
  const rest = /^[A-Za-z0-9]*/u.exec(c.src.slice(c.i))?.[0] ?? '';
  c.i += rest.length;
  const letter = head[0] ?? 'M';
  const index = head.length > 1 ? head.slice(2) + rest : rest;
  const fix = index.length === 1 ? `${letter}_${index}` : `${letter}_{${index}}`;
  const written = c.src.slice(start, c.i);
  fail(c, start, `"${written}" is not a valid name: did you mean ${fix}?`, `write ${fix}`);
}

/** A lowercase or Greek name, with the star rule. */
function lexName(c: Cursor): void {
  const start = c.i;
  let value = '';
  for (;;) {
    const ch = at(c);
    if (ch === '\\') {
      const g = GREEK[escapeWord(c)];
      if (g === undefined) break;
      value += g;
      c.i += 1 + escapeWord(c).length;
    } else if (value === '' ? LOWER_OR_GREEK.test(ch) : NAME_CONT.test(ch)) {
      value += ch;
      c.i += ch.length;
    } else break;
  }
  while (at(c) === "'") {
    value += "'";
    c.i += 1;
  }
  const stars = /^\**/u.exec(c.src.slice(c.i))?.[0] ?? '';
  const after = at(c, stars.length);
  if (stars !== '' && !OPERAND_START.test(after)) {
    c.i += stars.length;
    value += stars;
    starThenOperand(c, start, value);
  }
  push(c, 'name', start, c.src.slice(start, c.i), value);
}

/** `a* b`: a starred name, whitespace, then an operand. */
function starThenOperand(c: Cursor, start: number, name: string): void {
  let k = c.i;
  while (c.src[k] === ' ' || c.src[k] === '\t') k += 1;
  if (k > c.i && OPERAND_START.test(c.src[k] ?? '')) {
    const base = name.replace(/\*+$/u, '');
    c.diags.push(
      error(
        { line: c.line, column: start + 1, endColumn: k + 2 },
        `"${name}" followed by an operand: a name ending in * is a managed image`,
        `write ${base} * … for multiplication`,
      ),
    );
  }
}
