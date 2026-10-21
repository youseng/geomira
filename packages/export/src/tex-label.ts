/**
 * Labels in TeX (note D of Run 9a). A label's runs (scene/label-text.ts: the label grammar
 * of ADR-0010, base text with sub- and superscripts) become TeX:
 *
 * - NAME-LIKE labels (every character a Latin letter, a digit, a Greek letter, a prime, or
 *   an image's star) are math: `M_a` → `$M_{a}$`, `A_{12}` → `$A_{12}$`, `H'` → `$H'$`,
 *   `ω` → `$\omega$`, `A*` → `$A^{*}$`, `H'*` → `$H^{\prime *}$` (a prime and a
 *   superscript share one superscript, never a double script). Each star of an image name
 *   is written as `options.star` (default `*`; for example `\ast`).
 * - Other labels, and every text object (whose string is prose: "Let ω be …"), are text:
 *   base runs through texText, subscripts in `\textsubscript{…}`, superscripts in
 *   `\textsuperscript{…}`.
 *
 * Characters texText cannot write become `?` with a warning (tex-text.ts).
 */
import { assertNever } from '@geomira/num/assert';
import type { LabelRun } from '@geomira/scene/label-text';
import { MathBuilder, joinTex, texEntry, texText, type TexWarning } from './tex-text';

export interface TexLabelOptions {
  /** How each star of a managed image's name is written in math (default `*`). */
  readonly star?: string;
}

export interface TexLabel {
  /** The TeX, including the `$…$` of a math label. */
  readonly tex: string;
  readonly math: boolean;
  readonly warnings: readonly TexWarning[];
}

const PRIMES: Readonly<Record<string, number>> = { '′': 1, '″': 2, '‴': 3, '⁗': 4 };

/** The math of one character of a name-like label, or undefined when it is not one. */
function nameChar(
  c: string,
): { kind: 'atom'; tex: string } | { kind: 'prime'; n: number } | undefined {
  if (/^[A-Za-z0-9]$/u.test(c)) return { kind: 'atom', tex: c };
  const n = PRIMES[c];
  if (n !== undefined) return { kind: 'prime', n };
  const e = texEntry(c);
  // Greek letters: the table's atoms that are letters (a control word or \mathrm{…}, or o).
  return e?.kind === 'atom' &&
    /^(\\[A-Za-z]+|\\mathrm\{[A-Z]\}|o)$/u.test(e.tex) &&
    /\p{L}/u.test(c)
    ? { kind: 'atom', tex: e.tex }
    : undefined;
}

/** The contents of a math sub- or superscript, or undefined when a character is not name-like. */
function scriptContents(s: string, star: string): string | undefined {
  let out = '';
  for (const c of s) {
    if (c === '*') {
      out = joinTex(out, star);
      continue;
    }
    const m = nameChar(c);
    if (m === undefined) return undefined;
    out = joinTex(out, m.kind === 'atom' ? m.tex : '\\prime '.repeat(m.n).trimEnd());
  }
  return out;
}

/** The label as math, or undefined when it is not name-like. */
function mathLabel(runs: readonly LabelRun[], star: string): string | undefined {
  const b = new MathBuilder();
  for (const r of runs) {
    switch (r.pos) {
      case 'base':
        for (const c of r.text) {
          const m = nameChar(c);
          if (m === undefined) return undefined;
          if (m.kind === 'atom') b.atom(m.tex);
          else b.prime(m.n);
        }
        break;
      case 'sub':
      case 'sup': {
        const s = scriptContents(r.text, star);
        if (s === undefined) return undefined;
        b.script(r.pos, s);
        break;
      }
      default:
        assertNever(r.pos, 'run position');
    }
  }
  return b.done();
}

/** The label as text mode (prose), with its warnings. */
function textLabel(runs: readonly LabelRun[]): TexLabel {
  let tex = '';
  const warnings: TexWarning[] = [];
  for (const r of runs) {
    const t = texText(r.text);
    warnings.push(...t.warnings);
    const piece =
      r.pos === 'base'
        ? t.tex
        : r.pos === 'sub'
          ? `\\textsubscript{${t.tex}}`
          : `\\textsuperscript{${t.tex}}`;
    tex = joinTex(tex, piece);
  }
  return { tex, math: false, warnings };
}

/** The TeX of an object's label (module comment). Empty runs give an empty label. */
export function texLabel(runs: readonly LabelRun[], options: TexLabelOptions = {}): TexLabel {
  const math = runs.length === 0 ? undefined : mathLabel(runs, options.star ?? '*');
  return math === undefined ? textLabel(runs) : { tex: `$${math}$`, math: true, warnings: [] };
}

/** The TeX of a text object's string: always prose (module comment). */
export function texProse(runs: readonly LabelRun[]): TexLabel {
  return textLabel(runs);
}
