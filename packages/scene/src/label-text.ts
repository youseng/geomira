/**
 * The text grammar of labels (SPEC §13, ADR-0010). A label is an object's name (points by
 * default) or its `label` style text, both read with one grammar:
 *
 *   label  = { piece } ;
 *   piece  = "_" , group          (* subscript: M_a, M_{ab}, A_1 *)
 *          | "^" , group          (* superscript *)
 *          | "'" , { "'" }        (* primes: ′ ″ ‴ ⁗, then repeated ′ *)
 *          | "*" , { "*" }        (* a managed image's stars, raised: A* *)
 *          | "\" , letters        (* a Greek letter by name (\omega → ω), else literal *)
 *          | "\" , char           (* that character literally: \_ \^ \* \' \\ \{ \} *)
 *          | char ;
 *   group  = "{" , { char | "\" , char } , [ "}" ] | char ;
 *
 * Total: every string has a reading. A lone `_` or `^` at the end is literal; an unclosed
 * `{` runs to the end of the text. Adjacent pieces with the same position are merged.
 */

export type RunPosition = 'base' | 'sub' | 'sup';

export interface LabelRun {
  readonly text: string;
  readonly pos: RunPosition;
}

const GREEK: Readonly<Record<string, string>> = Object.freeze({
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  omicron: 'ο',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
});

const PRIMES = ['', '′', '″', '‴', '⁗'];

interface Cursor {
  readonly s: readonly string[];
  i: number;
}

/** `\` + letters (a Greek name, else literal) or `\` + one character. */
function escape(c: Cursor): string {
  const start = c.i + 1;
  let j = start;
  while (j < c.s.length && /^[A-Za-z]$/u.test(c.s[j] ?? '')) j++;
  if (j > start) {
    const word = c.s.slice(start, j).join('');
    const greek = GREEK[word];
    c.i = j;
    return greek ?? `\\${word}`;
  }
  c.i = Math.min(c.s.length, start + 1);
  return c.s[start] ?? '\\';
}

/** A group after `_` or `^`: `{…}` (escapes inside, unclosed runs to the end) or one char. */
function group(c: Cursor): string {
  if (c.s[c.i] !== '{') {
    if (c.s[c.i] === '\\') return escape(c);
    const ch = c.s[c.i] ?? '';
    c.i++;
    return ch;
  }
  c.i++;
  let out = '';
  while (c.i < c.s.length && c.s[c.i] !== '}') {
    if (c.s[c.i] === '\\') out += escape(c);
    else out += c.s[c.i++] ?? '';
  }
  c.i++;
  return out;
}

function count(c: Cursor, ch: string): number {
  let n = 0;
  while (c.s[c.i] === ch) {
    n++;
    c.i++;
  }
  return n;
}

/** One piece at the cursor. */
function piece(c: Cursor): LabelRun {
  const ch = c.s[c.i] ?? '';
  const last = c.i === c.s.length - 1;
  if ((ch === '_' || ch === '^') && !last) {
    c.i++;
    return { text: group(c), pos: ch === '_' ? 'sub' : 'sup' };
  }
  if (ch === "'") {
    const n = count(c, "'");
    return { text: PRIMES[n] ?? '′'.repeat(n), pos: 'base' };
  }
  if (ch === '*') return { text: '*'.repeat(count(c, '*')), pos: 'sup' };
  if (ch === '\\') return { text: escape(c), pos: 'base' };
  c.i++;
  return { text: ch, pos: 'base' };
}

/** The runs of a label text (merged by position, empty runs dropped). */
export function parseLabel(text: string): LabelRun[] {
  // Code points (Array.from): a Greek letter or a prime is one character of the grammar.
  const c: Cursor = { s: Array.from(text), i: 0 };
  const runs: LabelRun[] = [];
  while (c.i < c.s.length) {
    const r = piece(c);
    const prev = runs[runs.length - 1];
    if (r.text === '') continue;
    if (prev?.pos === r.pos) runs[runs.length - 1] = { text: prev.text + r.text, pos: r.pos };
    else runs.push(r);
  }
  return runs;
}
