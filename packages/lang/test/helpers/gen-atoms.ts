/**
 * Random atoms for the language laws: names of every grammatical shape (point names with
 * digits, subscripts, braces and primes; lowercase, Greek and primed names), exact literals
 * in every written form (integers, decimals with trailing zeros, unreduced fractions,
 * leading zeros, degrees, `-0`), doubles, and free text for comments and labels.
 */
import { lit, type LitExpr } from '@geomira/kernel/expr';
import { isUserName } from '@geomira/kernel/names';
import { rational } from '@geomira/num/rational';
import type { Rng } from '@geomira/num/rng';
import { exactLiteral } from '../../src/lex-literals';

export function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(Math.max(1, xs.length))];
  if (x === undefined) throw new Error('pick from an empty list');
  return x;
}

export function chance(rng: Rng, p: number): boolean {
  return rng.nextFloat() < p;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψωΓΔΘΛΞΠΣΥΦΨΩ';

export function pointName(rng: Rng): string {
  let n = pick(rng, Array.from(UPPER));
  const r = rng.nextInt(6);
  if (r === 1) n += String(rng.nextInt(30));
  if (r === 2) n += `_${String(rng.nextInt(12))}`;
  if (r === 3) n += `_${pick(rng, [...Array.from(LOWER), ...Array.from(UPPER)])}`;
  if (r === 4) n += `_{${pick(rng, ['ab', 'BC', 'a1', 'x2y'])}}`;
  if (chance(rng, 0.2)) n += "'".repeat(1 + rng.nextInt(2));
  return n;
}

export function otherName(rng: Rng): string {
  const head = chance(rng, 0.2) ? pick(rng, Array.from(GREEK)) : pick(rng, Array.from(LOWER));
  let n = head;
  const len = rng.nextInt(4);
  for (let k = 0; k < len; k++)
    n += pick(rng, [...Array.from(LOWER), ...Array.from('0123456789_ABZωα')]);
  if (chance(rng, 0.1)) n += "'";
  return n;
}

/** A fresh user name of the given style. */
export function freshName(rng: Rng, taken: (n: string) => boolean, point: boolean): string {
  for (let k = 0; k < 50; k++) {
    const n = point ? pointName(rng) : otherName(rng);
    if (isUserName(n) && !taken(n)) return n;
  }
  for (let k = 0; ; k++)
    if (!taken(`${point ? 'Q' : 'x'}${String(k)}`)) return `${point ? 'Q' : 'x'}${String(k)}`;
}

/** An exact literal in a random written form (the kernel stores the text when not canonical). */
export function literal(
  rng: Rng,
  opts: { readonly integer?: boolean; readonly positive?: boolean } = {},
): LitExpr {
  const neg = !opts.positive && chance(rng, 0.3);
  const sign = neg ? '-' : '';
  const n = rng.nextInt(opts.positive ? 20 : 21) + (opts.positive ? 1 : 0);
  const forms = opts.integer
    ? [`${sign}${String(n)}`, `${sign}0${String(n)}`]
    : [
        `${sign}${String(n)}`,
        `${sign}${String(n)}.${String(rng.nextInt(100))}`,
        `${sign}${String(n)}.50`,
        `${sign}${String(n)}/${String(1 + rng.nextInt(12))}`,
        `${sign}${String(2 * n)}/${String(2 + 2 * rng.nextInt(6))}`,
        `${sign}${String(n)}°`,
        neg ? '-0' : '0',
        `${sign}00${String(n)}`,
      ];
  const text = pick(rng, forms);
  const r = exactLiteral(text);
  if (!r.ok || (opts.positive === true && r.value.num <= 0n)) return lit(rational(BigInt(n || 1)));
  return lit(r.value, text);
}

/** A finite double of any magnitude (styles, opacities, viewports). */
export function double(rng: Rng, lo: number, hi: number): number {
  const x = pick(rng, [
    rng.uniform(lo, hi),
    Math.round(rng.uniform(lo, hi)),
    lo,
    hi,
    (lo + hi) / 2,
    rng.uniform(lo, hi) * 1e-9,
  ]);
  return Math.min(hi, Math.max(lo, x));
}

/** Free text without line breaks (comments, labels, titles): quotes, #, escapes, Unicode. */
export function text(rng: Rng, allowControls: boolean): string {
  const chars = [
    ...Array.from('ab Z 09'),
    '#',
    '"',
    '\\',
    'é',
    '∡',
    '·',
    '*',
    '[',
    ']',
    '=',
    ' ',
    '\t',
    'ω',
    '😀',
  ];
  if (allowControls) chars.push('\u0001', '\u007f', ' ', '\ud800');
  let s = '';
  const len = rng.nextInt(12);
  for (let k = 0; k < len; k++) s += pick(rng, chars);
  return s;
}
