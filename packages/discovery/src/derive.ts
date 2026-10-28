/**
 * What follows from what is known (ADR-0039): the closure of the construction facts with the
 * maps' facts and the shown facts (closure.ts), the angle lattice of the same (angles.ts), and
 * transport through a map: a fact about images is the corresponding fact about their preimages
 * (a similarity keeps every kind; an inversion or another Möbius map keeps equal points,
 * incidence, tangency, clines and cross ratios of points; a projective map keeps equal points,
 * the incidence of points and lines and cross ratios, ADR-0040), so when the preimages' fact
 * follows, the image fact does.
 * `derives` names the rule a fact follows by; every rule is sound, so a fact it does not name
 * is never hidden.
 */
import { assertNever } from '@geomira/num/assert';
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import { closureSteps, termArgs, type Closure, type FactData } from './closure';
import type { TermArg } from './closure-view';
import { fixedBy, imagesOf } from './closure-maps';
import { harmonicByInversion } from './harmonic-maps';
import { crossRatioBySection } from './harmonic-sections';
import { anglesFollow, latticeSteps } from './angle-lattice';
import { AngleVars } from './angles';
import type { Lattice } from './lattice';
import type { Ticking } from './ticking';
import type { MapRecord, Terms } from './terms';
import type { DeriveRule } from './types';

/**
 * Kinds an inversion or another Möbius map keeps (with their objects' images): a Möbius map also
 * keeps the complex cross ratio of four points up to conjugation, so their real cross ratio
 * (ADR-0040).
 */
const MOEBIUS_KINDS: readonly string[] = [
  'equal',
  'on',
  'tangent',
  'concyclic',
  'cross_ratio',
  'harmonic',
];

/**
 * Kinds a projective map keeps (ADR-0040): equal points, the incidence of points and lines, and
 * cross ratios; never lengths, angles, circles or tangency.
 */
const PROJECTIVE_KINDS: readonly string[] = [
  'equal',
  'on',
  'collinear',
  'concurrent',
  'cross_ratio',
  'harmonic',
  'cross_ratio_lines',
  'harmonic_lines',
];

/** Whether a map of this type keeps facts of this kind. */
function keeps(type: MapRecord['type'], kind: string): boolean {
  switch (type) {
    case 'similarity':
    case 'anti-similarity':
      return true;
    case 'inversion':
    case 'moebius':
      return MOEBIUS_KINDS.includes(kind);
    case 'projective':
      return PROJECTIVE_KINDS.includes(kind);
    default:
      return assertNever(type, 'map type');
  }
}

export class Knowledge {
  constructor(
    readonly closure: Closure,
    readonly vars: AngleVars,
    readonly lattice: Lattice,
  ) {}

  /** The rule `fact` follows by, or undefined (it is not known to follow). */
  derives(fact: FactData): Exclude<DeriveRule, 'part'> | undefined {
    return this.derivesTerms(fact.kind, termArgs(fact.args), true);
  }

  private derivesTerms(
    kind: string,
    args: readonly TermArg[],
    transport: boolean,
  ): Exclude<DeriveRule, 'part'> | undefined {
    if (this.closure.holds(kind, args)) return 'incidence';
    if (anglesFollow(this.closure, this.vars, this.lattice, kind, args)) return 'angles';
    if (transport && this.transported(kind, args)) return 'transport';
    if (harmonicByInversion(this.closure, kind, args)) return 'transport';
    if (crossRatioBySection(this.closure, kind, args)) return 'incidence';
    return undefined;
  }

  /** Whether the preimages' fact follows under some map whose images (or fixed objects) these are. */
  private transported(kind: string, args: readonly TermArg[]): boolean {
    for (const m of this.closure.terms.maps.values()) {
      if (!keeps(m.type, kind)) continue;
      // An anti-similarity reverses ∡(l, m): its literal would change sign.
      if (m.type === 'anti-similarity' && kind === 'dangle_lines') continue;
      const pre = this.preimages(m, args);
      if (pre === undefined || pre.every((a, i) => sameArg(a, args[i]))) continue;
      if (this.derivesTerms(kind, pre, false) !== undefined) return true;
      // A Möbius map takes a circle or a line to a circle or a line.
      if (
        (m.type === 'inversion' || m.type === 'moebius') &&
        kind === 'concyclic' &&
        this.derivesTerms('collinear', pre, false) !== undefined
      )
        return true;
    }
    return false;
  }

  /** The arguments under the map's inverse: images to their sources, fixed objects to themselves. */
  private preimages(m: MapRecord, args: readonly TermArg[]): TermArg[] | undefined {
    const c = this.closure;
    const images = imagesOf(c, m);
    const out: TermArg[] = [];
    for (const a of args) {
      if ('lit' in a) {
        out.push(a);
        continue;
      }
      const hit = images.find((x) => c.classOf(x.img) === c.classOf(a.key));
      if (hit !== undefined) out.push({ key: hit.pre });
      else if (fixedBy(c, m, a.key)) out.push(a);
      else return undefined;
    }
    return out;
  }
}

function sameArg(a: TermArg, b: TermArg | undefined): boolean {
  if (b === undefined) return false;
  return 'key' in a && 'key' in b ? a.key === b.key : a === b;
}

export interface KnowledgeOptions {
  /** Facts taken as known besides the construction (the shown facts above). */
  readonly extra?: readonly FactData[];
  readonly values?: ReadonlyMap<number, Value<number>>;
  readonly terms?: Terms;
}

/** The knowledge of a document and the facts given, in bounded steps. */
export function* knowledgeSteps(
  doc: Document,
  registry: Registry,
  kinds: ClaimKinds,
  options: KnowledgeOptions = {},
): Ticking<Knowledge> {
  const closure = yield* closureSteps(doc, registry, kinds, options);
  yield undefined;
  const vars = new AngleVars();
  const given = (options.extra ?? []).map((f) => ({ kind: f.kind, args: termArgs(f.args) }));
  const lattice = yield* latticeSteps(closure, vars, given);
  return new Knowledge(closure, vars, lattice);
}
