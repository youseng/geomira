/**
 * lz-string 1.5.0's decompressFromEncodedURIComponent with a bound on the text it produces
 * (ADR-0018). lz-string's text can grow with the square of the payload, and the library
 * builds all of it before returning, so a short link could freeze the page; this decoder
 * follows the same format and stops as soon as the text would exceed `max` characters.
 * Callers still check that the library's own compressor gives the payload back (share.ts), so a
 * difference between this decoder and the library can only refuse a link, never open another
 * figure. Degenerate cases: a character outside the alphabet, a stream without its end mark,
 * or an unknown dictionary code → 'unreadable'; a text longer than `max` → 'too large'.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
/** Six bits per character, read from the highest (lz-string's resetValue 32). */
const RESET = 32;

interface Reader {
  readonly input: string;
  val: number;
  position: number;
  index: number;
}

function valueAt(input: string, i: number): number {
  return i < input.length ? ALPHABET.indexOf(input.charAt(i)) : 0;
}

/** The next `n` bits, least significant first (lz-string's bit order). */
function bits(r: Reader, n: number): number {
  let out = 0;
  for (let k = 0; k < n; k++) {
    if ((r.val & r.position) > 0) out |= 1 << k;
    r.position >>= 1;
    if (r.position === 0) {
      r.position = RESET;
      r.val = valueAt(r.input, r.index++);
    }
  }
  return out;
}

/** The text, or why there is none. */
export type Bounded = { readonly text: string } | { readonly problem: 'unreadable' | 'too large' };

const UNREADABLE: Bounded = { problem: 'unreadable' };

/** The text of `input` (see the module comment). */
export function decompressBounded(input: string, max: number): Bounded {
  if (!/^[A-Za-z0-9+\-$]+$/u.test(input)) return UNREADABLE;
  const r: Reader = { input, val: valueAt(input, 0), position: RESET, index: 1 };
  const first = bits(r, 2);
  if (first === 2) return { text: '' };
  if (first !== 0 && first !== 1) return UNREADABLE;
  const c0 = String.fromCharCode(bits(r, first === 0 ? 8 : 16));
  const dictionary: string[] = ['', '', '', c0];
  const parts: string[] = [c0];
  let [length, enlargeIn, numBits, w] = [1, 4, 3, c0];
  for (;;) {
    if (r.index > input.length) return UNREADABLE;
    let c = bits(r, numBits);
    if (c === 2) return { text: parts.join('') };
    if (c === 0 || c === 1) {
      dictionary.push(String.fromCharCode(bits(r, c === 0 ? 8 : 16)));
      c = dictionary.length - 1;
      if (--enlargeIn === 0) [enlargeIn, numBits] = [2 ** numBits, numBits + 1];
    }
    const known = c >= 3 ? dictionary[c] : undefined;
    const entry = known ?? (c === dictionary.length ? w + w.charAt(0) : undefined);
    if (entry === undefined) return UNREADABLE;
    length += entry.length;
    if (length > max) return { problem: 'too large' };
    parts.push(entry);
    dictionary.push(w + entry.charAt(0));
    w = entry;
    if (--enlargeIn === 0) [enlargeIn, numBits] = [2 ** numBits, numBits + 1];
  }
}
