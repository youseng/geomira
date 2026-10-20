/**
 * Text mutations and garbage for the totality laws: deletions, insertions of language
 * fragments, swapped and duplicated lines, and token soups.
 */
import fc from 'fast-check';

export const FRAGMENTS: readonly string[] = [
  'A',
  'B',
  'M_a',
  'l',
  'k',
  'ω',
  '*',
  '**',
  ' ',
  '(',
  ')',
  ',',
  '=',
  '[',
  ']',
  '#',
  '"',
  '-',
  '−',
  '1',
  '/',
  '2',
  '.',
  '°',
  '∡',
  '∠',
  '·',
  '<',
  '>',
  '≠',
  '@',
  '@layer ',
  '@view ',
  '@viewport ',
  '@version ',
  'claim ',
  'assume ',
  'style ',
  'label ',
  'triangle ',
  'image(',
  'on(',
  'near(',
  'other(',
  'along(+)',
  'orient(-)',
  'intersect(',
  'midpoint(',
  'polygon(',
  '\\omega',
  '\\angle',
  '_',
  "'",
  '\n',
  '\t',
  '\r',
  'é',
  '\ud800',
  '😀',
  'in order on ',
  ' inside ',
  'not ',
  'x',
  '0',
  '1e-3',
  '[main]',
  '[exclude=',
  '[layers=',
  '[suffix=**]',
  '=image(',
  'reflect(',
  'line(',
  'circle(',
  ',-',
  '!=',
  '\\',
  '{',
  '}',
];

/** A token soup of language fragments. */
export const soupArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...FRAGMENTS), { maxLength: 80 })
  .map((xs) => xs.join(''));

type Edit = readonly [number, number, number];

/** Applies small random edits to a text. */
export function mutate(text: string, edits: readonly Edit[]): string {
  let s = text;
  for (const [op, a, b] of edits) {
    const i = a % (s.length + 1);
    if (op % 4 === 0) s = s.slice(0, i) + s.slice(i + 1 + (b % 6));
    else if (op % 4 === 1) s = s.slice(0, i) + (FRAGMENTS[b % FRAGMENTS.length] ?? '') + s.slice(i);
    else if (op % 4 === 2) {
      const ls = s.split('\n');
      const [x, y] = [a % ls.length, b % ls.length];
      const lx = ls[x] ?? '';
      ls[x] = ls[y] ?? '';
      ls[y] = lx;
      s = ls.join('\n');
    } else s = s.slice(0, i) + s.slice(i, i + (b % 30)) + s.slice(i);
  }
  return s;
}

export const editsArb: fc.Arbitrary<readonly Edit[]> = fc.array(
  fc.tuple(fc.nat(), fc.nat(), fc.nat()),
  { minLength: 1, maxLength: 6 },
);
