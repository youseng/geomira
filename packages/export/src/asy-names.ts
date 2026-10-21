/**
 * Asymptote identifiers for object names. Asymptote names are ASCII letters, digits and `_`,
 * so a name is spelled out: primes as `p` (`H'` → `Hp`), an image's stars as `s`
 * (`A*` → `As`), braces dropped (`M_{ab}` → `M_ab`), Greek letters by their names
 * (`ω` → `omega`, `Γ_1` → `Gamma_1`). A name that is a keyword or type of Asymptote, one
 * the export itself calls (plain functions, the olympiad functions of the aops dialect,
 * the `gm` helpers), or one an earlier object already took gets `_` (then `_2`, `_3`, …)
 * appended, so every object has its own identifier and no call is shadowed.
 */

const GREEK_NAMES: Readonly<Record<string, string>> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  ζ: 'zeta',
  η: 'eta',
  θ: 'theta',
  ι: 'iota',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  ν: 'nu',
  ξ: 'xi',
  ο: 'omicron',
  π: 'pi',
  ρ: 'rho',
  ς: 'varsigma',
  σ: 'sigma',
  τ: 'tau',
  υ: 'upsilon',
  φ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'omega',
};

/** Keywords, types and the functions an export calls: never used as object identifiers. */
export const ASY_RESERVED: readonly string[] = Object.freeze([
  // keywords and literals
  ...'if else while for do return break continue struct typedef new access import include from unravel quote static public private restricted this explicit true false null cycle operator var newframe'.split(
    ' ',
  ),
  // types
  ...'void bool int real pair triple string pen path guide transform picture frame file'.split(' '),
  // plain functions and constants the export writes
  ...'abs arc box circle clip cross dot draw fill filldraw format label labelmargin length linetype linewidth max min nullpath opacity point realMax reflect rgb rotate roundcap roundjoin scale shift sqrt texpreamble unit unitsize write defaultpen fontsize inverse pt'.split(
    ' ',
  ),
  // olympiad functions the aops dialect calls (ADR-0014)
  'olympiad',
  'foot',
  'circumcenter',
  'incenter',
]);

function spelled(name: string): string {
  let out = '';
  for (const c of name) {
    if (/^[A-Za-z0-9_]$/u.test(c)) out += c;
    else if (c === "'") out += 'p';
    else if (c === '*') out += 's';
    else if (c === '{' || c === '}') continue;
    else {
      const lower = c.toLowerCase();
      const g = GREEK_NAMES[lower];
      if (g === undefined) out += '_';
      else out += lower === c ? g : g.charAt(0).toUpperCase() + g.slice(1);
    }
  }
  return /^[A-Za-z]/u.test(out) ? out : `x${out}`;
}

/** Identifiers for names, unique and unreserved (module comment); one instance per export. */
export class AsyNames {
  private readonly taken = new Set<string>();
  private readonly byName = new Map<string, string>();

  /** The identifier of an object name (the same name always gets the same identifier). */
  of(name: string): string {
    const known = this.byName.get(name);
    if (known !== undefined) return known;
    const base = spelled(name);
    let id = ASY_RESERVED.includes(base) || base.startsWith('gm') ? `${base}_` : base;
    for (let k = 2; this.taken.has(id); k++) id = `${base}_${String(k)}`;
    this.taken.add(id);
    this.byName.set(name, id);
    return id;
  }
}
