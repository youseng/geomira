/** Backslash escapes of the language: Greek letters and a few symbols (ADR-0009). */

/** `\alpha` → α, …, `\Omega` → Ω (the letters the name grammar allows). */
export const GREEK: Readonly<Record<string, string>> = Object.freeze({
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
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
});

/** Symbol escapes for keyboards without them. */
export const SYMBOL_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  angle: '∠',
  measuredangle: '∡',
  cdot: '·',
  neq: '≠',
  ne: '≠',
});
