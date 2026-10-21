/**
 * LaTeX text escaping (SPEC §14): `texText(s)` writes any string as LaTeX text-mode input
 * that compiles with the standard LaTeX kernel plus amssymb (for ∡). Printable ASCII passes
 * through, except the specials of TEX_TABLE; Greek letters, primes, the geometry signs
 * (∩ ∪ ∠ ∡ ⟂ ∥ °), comparisons (≤ ≥ ≠), the arrow, ℓ, sub- and superscript digits and the
 * radical become inline math, and neighbouring math characters share one formula
 * (`ℓ₁₂` → `$\ell_{12}$`). `√(…)` with balanced parentheses is a square root over its
 * contents (escaped the same way); a lone `√` is the radical sign. Every other character
 * (accented letters, control characters, emoji, …) becomes `?` and is reported in
 * `warnings` (character, code point, index in code points), so the exporters can write a
 * `% Warning` line and the UI can say what was replaced. Total: every string has an output.
 */
import { assertNever } from '@geomira/num/assert';

export interface TexWarning {
  readonly char: string;
  readonly codePoint: number;
  /** Position of the character in the input, counted in code points. */
  readonly index: number;
}

export interface TexResult {
  readonly tex: string;
  readonly warnings: readonly TexWarning[];
}

/**
 * How one character is written: plain text, a math atom, a math sub- or superscript
 * (its contents), or primes (math).
 */
export type TexEntry =
  | { readonly kind: 'text'; readonly tex: string }
  | { readonly kind: 'atom'; readonly tex: string }
  | { readonly kind: 'sub' | 'sup'; readonly tex: string }
  | { readonly kind: 'prime'; readonly n: number };

const text = (tex: string): TexEntry => ({ kind: 'text', tex });
const atom = (tex: string): TexEntry => ({ kind: 'atom', tex });

const GREEK: readonly (readonly [string, string])[] = [
  ['α', '\\alpha'],
  ['β', '\\beta'],
  ['γ', '\\gamma'],
  ['δ', '\\delta'],
  ['ε', '\\varepsilon'],
  ['ϵ', '\\epsilon'],
  ['ζ', '\\zeta'],
  ['η', '\\eta'],
  ['θ', '\\theta'],
  ['ϑ', '\\vartheta'],
  ['ι', '\\iota'],
  ['κ', '\\kappa'],
  ['λ', '\\lambda'],
  ['μ', '\\mu'],
  ['ν', '\\nu'],
  ['ξ', '\\xi'],
  ['ο', 'o'],
  ['π', '\\pi'],
  ['ϖ', '\\varpi'],
  ['ρ', '\\rho'],
  ['ϱ', '\\varrho'],
  ['σ', '\\sigma'],
  ['ς', '\\varsigma'],
  ['τ', '\\tau'],
  ['υ', '\\upsilon'],
  ['φ', '\\varphi'],
  ['ϕ', '\\phi'],
  ['χ', '\\chi'],
  ['ψ', '\\psi'],
  ['ω', '\\omega'],
  ['Α', '\\mathrm{A}'],
  ['Β', '\\mathrm{B}'],
  ['Γ', '\\Gamma'],
  ['Δ', '\\Delta'],
  ['Ε', '\\mathrm{E}'],
  ['Ζ', '\\mathrm{Z}'],
  ['Η', '\\mathrm{H}'],
  ['Θ', '\\Theta'],
  ['Ι', '\\mathrm{I}'],
  ['Κ', '\\mathrm{K}'],
  ['Λ', '\\Lambda'],
  ['Μ', '\\mathrm{M}'],
  ['Ν', '\\mathrm{N}'],
  ['Ξ', '\\Xi'],
  ['Ο', '\\mathrm{O}'],
  ['Π', '\\Pi'],
  ['Ρ', '\\mathrm{P}'],
  ['Σ', '\\Sigma'],
  ['Τ', '\\mathrm{T}'],
  ['Υ', '\\Upsilon'],
  ['Φ', '\\Phi'],
  ['Χ', '\\mathrm{X}'],
  ['Ψ', '\\Psi'],
  ['Ω', '\\Omega'],
];

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Every character texText does not pass through as itself (see the module comment). */
export const TEX_TABLE: Readonly<Record<string, TexEntry>> = Object.freeze(
  Object.fromEntries<TexEntry>([
    ['#', text('\\#')],
    ['$', text('\\$')],
    ['%', text('\\%')],
    ['&', text('\\&')],
    ['_', text('\\_')],
    ['{', text('\\{')],
    ['}', text('\\}')],
    ['~', text('\\textasciitilde{}')],
    ['^', text('\\textasciicircum{}')],
    ['\\', text('\\textbackslash{}')],
    ['<', text('\\textless{}')],
    ['>', text('\\textgreater{}')],
    ['|', text('\\textbar{}')],
    // The OT1 encoding has no straight double quote; closing quotes look closest.
    ['"', text("''")],
    ...GREEK.map(([c, t]) => [c, atom(t)] as const),
    ['′', { kind: 'prime', n: 1 }],
    ['″', { kind: 'prime', n: 2 }],
    ['‴', { kind: 'prime', n: 3 }],
    ['⁗', { kind: 'prime', n: 4 }],
    ['∩', atom('\\cap')],
    ['∪', atom('\\cup')],
    ['∠', atom('\\angle')],
    ['∡', atom('\\measuredangle')],
    ['⟂', atom('\\perp')],
    ['⊥', atom('\\perp')],
    ['∥', atom('\\parallel')],
    ['—', text('---')],
    ['–', text('--')],
    ['°', { kind: 'sup', tex: '\\circ' }],
    ['≤', atom('\\le')],
    ['≥', atom('\\ge')],
    ['≠', atom('\\ne')],
    ['→', atom('\\to')],
    ['·', atom('\\cdot')],
    ['×', atom('\\times')],
    ['−', atom('-')],
    ['±', atom('\\pm')],
    ['ℓ', atom('\\ell')],
    ...Array.from(SUB_DIGITS, (c, i) => [c, { kind: 'sub', tex: String(i) }] as const),
    ...Array.from(SUP_DIGITS, (c, i) => [c, { kind: 'sup', tex: String(i) }] as const),
    ['√', atom('\\surd')],
    ['\t', text(' ')],
    ['\n', text(' ')],
    ['\r', text(' ')],
  ]),
);

/** The table's entry of a character, or undefined. */
export function texEntry(c: string): TexEntry | undefined {
  return Object.hasOwn(TEX_TABLE, c) ? TEX_TABLE[c] : undefined;
}

/** Printable ASCII that is not in the table is written as itself. */
function plainAscii(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  return code >= 0x20 && code <= 0x7e;
}

/** a + b, with a space when a ends in a control word and b starts with a letter. */
export function joinTex(a: string, b: string): string {
  return /\\[A-Za-z]+$/u.test(a) && /^[A-Za-z]/u.test(b) ? `${a} ${b}` : a + b;
}

/**
 * One formula under construction: atoms, each with its pending scripts (sub, sup, primes),
 * written as `atom_{sub}^{\prime… sup}` so a prime and a superscript, or two neighbouring
 * scripts, never make a double script (a second one starts an empty nucleus `{}`).
 */
export class MathBuilder {
  private out = '';
  private sub: string | null = null;
  private sup: string | null = null;
  private primes = 0;
  private last: 'atom' | 'sub' | 'sup' | 'prime' | null = null;

  atom(tex: string): void {
    this.flush();
    this.out = joinTex(this.out, tex);
    this.last = 'atom';
  }

  script(kind: 'sub' | 'sup', tex: string): void {
    const slot = kind === 'sub' ? this.sub : this.sup;
    if (slot !== null && this.last === kind) {
      if (kind === 'sub') this.sub = slot + tex;
      else this.sup = slot + tex;
      return;
    }
    if (slot !== null) this.restart();
    if (kind === 'sub') this.sub = tex;
    else this.sup = tex;
    this.last = kind;
  }

  prime(n: number): void {
    if (this.sup !== null) this.restart();
    this.primes += n;
    this.last = 'prime';
  }

  /** The formula's contents (without dollars). */
  done(): string {
    this.flush();
    return this.out;
  }

  get empty(): boolean {
    return this.out === '' && this.last === null;
  }

  private restart(): void {
    this.flush();
    this.out += '{}';
    this.last = 'atom';
  }

  private flush(): void {
    if (this.sub !== null) this.out += `_{${this.sub}}`;
    if (this.sup !== null) this.out += `^{${'\\prime '.repeat(this.primes)}${this.sup}}`;
    else this.out += "'".repeat(this.primes);
    this.sub = null;
    this.sup = null;
    this.primes = 0;
  }
}

/** The index (in `chars`) of the `)` that closes the `(` at `open`, or -1. */
function closing(chars: readonly string[], open: number): number {
  let depth = 0;
  for (let i = open; i < chars.length; i++) {
    if (chars[i] === '(') depth++;
    else if (chars[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/** The writer of one texText call: text so far, the open formula, the warnings. */
class TextWriter {
  out = '';
  math = new MathBuilder();
  readonly warnings: TexWarning[] = [];

  text(tex: string): void {
    this.close();
    this.out = joinTex(this.out, tex);
  }

  close(): void {
    if (this.math.empty) return;
    this.out += `$${this.math.done()}$`;
    this.math = new MathBuilder();
  }
}

function write(w: TextWriter, chars: readonly string[], offset: number): void {
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? '';
    if (c === '√' && chars[i + 1] === '(') {
      const end = closing(chars, i + 1);
      if (end > 0) {
        const inner = new TextWriter();
        write(inner, chars.slice(i + 2, end), offset + i + 2);
        inner.close();
        w.warnings.push(...inner.warnings);
        w.math.atom(`\\sqrt{\\mbox{${inner.out}}}`);
        i = end;
        continue;
      }
    }
    const e = texEntry(c);
    if (e === undefined) {
      if (plainAscii(c)) w.text(c);
      else {
        w.warnings.push({ char: c, codePoint: c.codePointAt(0) ?? 0, index: offset + i });
        w.text('?');
      }
      continue;
    }
    switch (e.kind) {
      case 'text':
        w.text(e.tex);
        break;
      case 'atom':
        w.math.atom(e.tex);
        break;
      case 'sub':
      case 'sup':
        w.math.script(e.kind, e.tex);
        break;
      case 'prime':
        w.math.prime(e.n);
        break;
      default:
        assertNever(e, 'tex entry');
    }
  }
}

/** `s` as LaTeX text-mode input, with the characters it could not write (module comment). */
export function texText(s: string): TexResult {
  const w = new TextWriter();
  write(w, Array.from(s), 0);
  w.close();
  return { tex: w.out, warnings: w.warnings };
}
