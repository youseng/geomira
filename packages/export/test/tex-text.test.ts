import { describe, expect, it } from 'vitest';
import { TEX_TABLE, texText } from '../src/tex-text';

/**
 * SPEC §14's escaping table, one expectation per mapped character, written out by hand:
 * ASCII specials, Greek, ′ ″, ∩ ∪, ∠ ∡, ⟂ ∥, — –, °, ≤ ≥ ≠, →, ℓ with subscripts, √(…).
 * `$…$` marks a character typeset in math mode.
 */
const EXPECTED: Readonly<Record<string, string>> = {
  // ASCII specials
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '\\': '\\textbackslash{}',
  '<': '\\textless{}',
  '>': '\\textgreater{}',
  '|': '\\textbar{}',
  '"': "''",
  // Greek, lowercase
  α: '$\\alpha$',
  β: '$\\beta$',
  γ: '$\\gamma$',
  δ: '$\\delta$',
  ε: '$\\varepsilon$',
  ϵ: '$\\epsilon$',
  ζ: '$\\zeta$',
  η: '$\\eta$',
  θ: '$\\theta$',
  ϑ: '$\\vartheta$',
  ι: '$\\iota$',
  κ: '$\\kappa$',
  λ: '$\\lambda$',
  μ: '$\\mu$',
  ν: '$\\nu$',
  ξ: '$\\xi$',
  ο: '$o$',
  π: '$\\pi$',
  ϖ: '$\\varpi$',
  ρ: '$\\rho$',
  ϱ: '$\\varrho$',
  σ: '$\\sigma$',
  ς: '$\\varsigma$',
  τ: '$\\tau$',
  υ: '$\\upsilon$',
  φ: '$\\varphi$',
  ϕ: '$\\phi$',
  χ: '$\\chi$',
  ψ: '$\\psi$',
  ω: '$\\omega$',
  // Greek, uppercase
  Α: '$\\mathrm{A}$',
  Β: '$\\mathrm{B}$',
  Γ: '$\\Gamma$',
  Δ: '$\\Delta$',
  Ε: '$\\mathrm{E}$',
  Ζ: '$\\mathrm{Z}$',
  Η: '$\\mathrm{H}$',
  Θ: '$\\Theta$',
  Ι: '$\\mathrm{I}$',
  Κ: '$\\mathrm{K}$',
  Λ: '$\\Lambda$',
  Μ: '$\\mathrm{M}$',
  Ν: '$\\mathrm{N}$',
  Ξ: '$\\Xi$',
  Ο: '$\\mathrm{O}$',
  Π: '$\\Pi$',
  Ρ: '$\\mathrm{P}$',
  Σ: '$\\Sigma$',
  Τ: '$\\mathrm{T}$',
  Υ: '$\\Upsilon$',
  Φ: '$\\Phi$',
  Χ: '$\\mathrm{X}$',
  Ψ: '$\\Psi$',
  Ω: '$\\Omega$',
  // primes
  '′': "$'$",
  '″': "$''$",
  '‴': "$'''$",
  '⁗': "$''''$",
  // set, angle, perpendicular, parallel signs
  '∩': '$\\cap$',
  '∪': '$\\cup$',
  '∠': '$\\angle$',
  '∡': '$\\measuredangle$',
  '⟂': '$\\perp$',
  '⊥': '$\\perp$',
  '∥': '$\\parallel$',
  // dashes, degree, comparisons, arrow, operators
  '—': '---',
  '–': '--',
  '°': '$^{\\circ}$',
  '≤': '$\\le$',
  '≥': '$\\ge$',
  '≠': '$\\ne$',
  '→': '$\\to$',
  '·': '$\\cdot$',
  '×': '$\\times$',
  '−': '$-$',
  '±': '$\\pm$',
  // ℓ and sub/superscript digits
  ℓ: '$\\ell$',
  '₀': '$_{0}$',
  '₁': '$_{1}$',
  '₂': '$_{2}$',
  '₃': '$_{3}$',
  '₄': '$_{4}$',
  '₅': '$_{5}$',
  '₆': '$_{6}$',
  '₇': '$_{7}$',
  '₈': '$_{8}$',
  '₉': '$_{9}$',
  '⁰': '$^{0}$',
  '¹': '$^{1}$',
  '²': '$^{2}$',
  '³': '$^{3}$',
  '⁴': '$^{4}$',
  '⁵': '$^{5}$',
  '⁶': '$^{6}$',
  '⁷': '$^{7}$',
  '⁸': '$^{8}$',
  '⁹': '$^{9}$',
  // square root (bare: the radical sign; √(…) below)
  '√': '$\\surd$',
  // white space other than a blank
  '\t': ' ',
  '\n': ' ',
  '\r': ' ',
};

describe('texText: the escaping table (SPEC §14)', () => {
  it('the table maps exactly the characters listed here', () => {
    expect(Object.keys(TEX_TABLE).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [ch, tex] of Object.entries(EXPECTED)) {
    it(`maps U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') ?? ''} ${JSON.stringify(ch)}`, () => {
      const r = texText(ch);
      expect(r.tex).toBe(tex);
      expect(r.warnings).toEqual([]);
    });
  }

  it('passes plain ASCII through unchanged', () => {
    const plain =
      "Let ABC be a triangle (AB < BC is not plain); 1+2=3, x-y: [ok] 'q' `b` @ * / ? !";
    const kept = plain.replaceAll('<', '');
    expect(texText(kept).tex).toBe(kept);
  });

  it('merges neighbouring math characters into one formula', () => {
    expect(texText('ℓ₁₂').tex).toBe('$\\ell_{12}$');
    expect(texText('∠ABC = 60°').tex).toBe('$\\angle$ABC = 60$^{\\circ}$');
    expect(texText('αβ').tex).toBe('$\\alpha\\beta$');
    expect(texText('x²³').tex).toBe('x$^{23}$');
    expect(texText('ω′').tex).toBe("$\\omega'$");
  });

  it('separates a control word from a following letter', () => {
    expect(texText('ωa').tex).toBe('$\\omega$a');
    expect(texText('\\\\a').tex).toBe('\\textbackslash{}\\textbackslash{}a');
  });

  it('√(…) is a square root over its balanced contents', () => {
    expect(texText('√(2)').tex).toBe('$\\sqrt{\\mbox{2}}$');
    expect(texText('√(a(b+c))').tex).toBe('$\\sqrt{\\mbox{a(b+c)}}$');
    expect(texText('√(x_1)').tex).toBe('$\\sqrt{\\mbox{x\\_1}}$');
    expect(texText('2√(3)/3').tex).toBe('2$\\sqrt{\\mbox{3}}$/3');
    // Unbalanced: the radical sign, then the rest as text.
    expect(texText('√(2').tex).toBe('$\\surd$(2');
  });

  it('an unknown character becomes ? with a warning naming it', () => {
    const r = texText('café ☃');
    expect(r.tex).toBe('caf? ?');
    expect(r.warnings).toEqual([
      { char: 'é', codePoint: 0xe9, index: 3 },
      { char: '☃', codePoint: 0x2603, index: 5 },
    ]);
  });

  it('control characters are unknown, never written raw', () => {
    const r = texText('a\u0007b');
    expect(r.tex).toBe('a?b');
    expect(r.warnings.map((w) => w.codePoint)).toEqual([7]);
  });

  it('the empty string is empty', () => {
    expect(texText('')).toEqual({ tex: '', warnings: [] });
  });

  it('a character outside the BMP is one unknown character, not two', () => {
    const r = texText('a😀b');
    expect(r.tex).toBe('a?b');
    expect(r.warnings).toEqual([{ char: '😀', codePoint: 0x1f600, index: 1 }]);
  });
});
