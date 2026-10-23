/**
 * Number and string literals: lexing, their values, and quoting for the printer.
 * Exact numbers (SPEC §3.4) are `2`, `0.1`, `2/3`, optionally negative (`-3/4`) and with a
 * degree sign (`60°`); attribute and viewport values are doubles and may also carry an
 * exponent (`2.5e21`).
 */
import { parseRational, type Rational } from '@geomira/num/rational';

const NUMBER = /^[0-9]+(?:\.[0-9]+|\/[0-9]+)?(?:[eE][+-]?[0-9]+)?°?/u;
const NO_FRACTION = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?°?/u;

/**
 * The end of the number starting at `i` (src[i] is a digit). With `fraction` false (right
 * after a division operator), `2/3` is not one literal: `a/2/3` is (a/2)/3.
 */
export function lexNumber(src: string, i: number, fraction = true): { readonly end: number } {
  const m = (fraction ? NUMBER : NO_FRACTION).exec(src.slice(i));
  return { end: i + (m?.[0].length ?? 1) };
}

export type LiteralResult =
  | { readonly ok: true; readonly value: Rational }
  | { readonly ok: false; readonly reason: string; readonly hint: string };

/**
 * The exact value of a literal as written (`-3/4`, `0.1`, `60°`). Degenerate: an exponent,
 * a zero denominator, anything else → not ok, with the reason.
 */
export function exactLiteral(text: string): LiteralResult {
  const body = text.endsWith('°') ? text.slice(0, -1) : text;
  if (/[eE]/u.test(body)) {
    return {
      ok: false,
      reason: `"${text}": exact numbers have no exponent`,
      hint: 'write the decimal, e.g. 0.001, or a fraction, e.g. 1/1000',
    };
  }
  const r = parseRational(body);
  return r.ok
    ? { ok: true, value: r.value }
    : { ok: false, reason: r.reason, hint: 'write 2, 0.1, 2/3 or -3/4' };
}

/** A double written in an attribute (`0.5`, `-2`, `2.5e21`, `-0`), or undefined. */
export function floatLiteral(text: string): number | undefined {
  if (!/^-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u.test(text)) return undefined;
  const x = Number(text);
  return Number.isFinite(x) ? x : undefined;
}

/** The shortest text that reads back as exactly `x` (finite; `-0` kept). */
export function formatFloat(x: number): string {
  return Object.is(x, -0) ? '-0' : String(x);
}

export type StringResult =
  | { readonly ok: true; readonly end: number; readonly value: string }
  | { readonly ok: false; readonly end: number; readonly message: string; readonly hint: string };

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  n: '\n',
  t: '\t',
  r: '\r',
};

/** Reads the string literal starting at src[i] = '"'. */
export function lexString(src: string, i: number): StringResult {
  let value = '';
  let k = i + 1;
  while (k < src.length) {
    const ch = src[k] ?? '';
    if (ch === '"') return { ok: true, end: k + 1, value };
    if (ch !== '\\') {
      value += ch;
      k += 1;
      continue;
    }
    const e = src[k + 1] ?? '';
    const simple = ESCAPES[e];
    const u = /^u\{([0-9a-fA-F]{1,6})\}/u.exec(src.slice(k + 1));
    const cp = u === null ? NaN : Number.parseInt(u[1] ?? '', 16);
    if (simple !== undefined) {
      value += simple;
      k += 2;
    } else if (u !== null && cp <= 0x10ffff) {
      value += String.fromCodePoint(cp);
      k += 1 + u[0].length;
    } else {
      return {
        ok: false,
        end: src.length,
        message: `unknown escape "\\${e}" in a string`,
        hint: 'use \\" \\\\ \\n \\t \\r or \\u{hex}',
      };
    }
  }
  return { ok: false, end: src.length, message: 'the string is not closed', hint: 'end it with "' };
}

/** Whether a code unit sequence needs an escape (control characters, lone surrogates). */
function needsEscape(cp: number): boolean {
  return (
    cp < 0x20 ||
    (cp >= 0x7f && cp < 0xa0) ||
    cp === 0x2028 ||
    cp === 0x2029 ||
    (cp >= 0xd800 && cp <= 0xdfff)
  );
}

/** A string literal that lexString reads back as `s`. */
export function quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === '"' || ch === '\\') out += `\\${ch}`;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (needsEscape(cp)) out += `\\u{${cp.toString(16)}}`;
    else out += ch;
  }
  return `${out}"`;
}
