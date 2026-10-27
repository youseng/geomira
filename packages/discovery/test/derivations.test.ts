/**
 * ADR-0039's soundness laws for hidden facts, on the request's figures (maps, the
 * incenter–excenter and nine-point figures, an inversion over a theorem) and the corpora:
 *   - every hidden fact holds: evaluated in the figure (construction facts and every listed
 *     consequence), and in the local test (a sample of them);
 *   - every consequence's parents are facts shown above it, its own fact included;
 *   - a fact that does not hold is never derived: no candidate the screen calls false, and no
 *     claim of the false corpus, follows from the construction and the maps.
 */
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { evalClaim } from '@geomira/claims/eval-claim';
import { runJob } from '@geomira/claims/job';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import { screenSteps } from '@geomira/claims/screen';
import { baseFigure } from '../../claims/test/helpers/corpus';
import { FALSE_CLAIMS } from '../../claims/test/helpers/corpus-false';
import { objectify } from '../../claims/test/helpers/objectify';
import { poolsOf, type Candidate } from '../src/candidates';
import { knowledgeSteps } from '../src/derive';
import { find, withFact } from '../src/find';
import { scanKinds } from '../src/scan';
import { drain } from '../src/ticking';
import type { Fact } from '../src/types';
import {
  homothetyFigure,
  incenterExcenterFigure,
  incenterInversionFigure,
  inversionCurvesFigure,
  inversionFigure,
  ninePointFigure,
  reflectionFigure,
  rotationFigure,
  spiralFigure,
} from './figures';
import { REGISTRY, show, triangle } from './helpers';

const KINDS = claimKindRegistry();

const FIGURES: readonly (readonly [string, () => { doc: Document }])[] = [
  ['inversion', inversionFigure],
  ['reflection', reflectionFigure],
  ['rotation', rotationFigure],
  ['homothety', homothetyFigure],
  ['spiral', spiralFigure],
  ['inversion of a line and a circle', inversionCurvesFigure],
  ['incenter–excenter', incenterExcenterFigure],
  ['incenter–excenter under an inversion', incenterInversionFigure],
  ['triangle centres', triangle],
  ['nine-point circle', ninePointFigure],
];

function holdsIn(doc: Document, f: Pick<Fact, 'kind' | 'args'>): string {
  const w = withFact(doc, f);
  return evalClaim(w.doc, w.id, REGISTRY).value;
}

function localKind(doc: Document, f: Pick<Fact, 'kind' | 'args'>): string {
  const w = withFact(doc, f);
  const it = runJob(
    { kind: 'testClaim', regime: 'local', doc: w.doc, claim: w.id, seed: 11, n: 12 },
    { registry: REGISTRY, kinds: KINDS },
  );
  for (let r = it.next(); ; r = it.next())
    if (r.done === true) return r.value.kind === 'verdict' ? r.value.verdict.kind : r.value.kind;
}

describe('every hidden fact holds; its parents are shown', () => {
  for (const [name, make] of FIGURES)
    it(
      name,
      () => {
        const { doc } = make();
        const r = find(
          { kind: 'find', doc, seed: 4, budget: { n: 12, tests: 30 } },
          { registry: REGISTRY },
        );
        if (r.kind !== 'found') throw new Error(r.kind);
        const shown = r.facts.map((x) => x.key);
        const hidden: Fact[] = [...r.construction.shown];
        r.facts.forEach((f, i) => {
          for (const h of f.consequences?.shown ?? []) {
            hidden.push(h);
            expect(h.parents, show(doc, h)).toContain(f.key);
            expect(h.parents).toEqual(shown.slice(0, i + 1));
          }
        });
        expect(hidden.length).toBeGreaterThan(0);
        for (const h of hidden) expect(holdsIn(doc, h), show(doc, h)).toBe('true');
        // The local test, on every 25th hidden fact (each run is 12 figures).
        for (const h of hidden.filter((_, i) => i % 25 === 0))
          expect(localKind(doc, h), show(doc, h)).toBe('holds');
      },
      120_000,
    );
});

/**
 * Mutants of a fact: each exact literal plus one (AB = 2·CD, ∡ABC = 2·∡DEF, θ + 1°), and the
 * last object replaced by each other object of the figure.
 */
function mutants(doc: Document, f: Fact): Pick<Fact, 'kind' | 'args'>[] {
  const out: Pick<Fact, 'kind' | 'args'>[] = [];
  f.args.forEach((a, i) => {
    if (!('lit' in a)) return;
    const args = f.args.map((b, j) =>
      j === i ? { lit: { num: a.lit.num + a.lit.den, den: a.lit.den } } : b,
    );
    out.push({ kind: f.kind, args });
  });
  const last = f.args.reduce((k, a, i) => ('id' in a ? i : k), -1);
  for (const o of doc.objects) {
    if (f.args.some((a) => 'id' in a && a.id === o.id)) continue;
    out.push({ kind: f.kind, args: f.args.map((b, j) => (j === last ? { id: o.id } : b)) });
  }
  return out;
}

/** The candidates the screen calls false in a figure (a bounded scan of every kind). */
function falseCandidates(doc: Document): Candidate[] {
  const screen = drain(screenSteps(doc, REGISTRY, 9));
  if ('reason' in screen) throw new Error(screen.reason);
  const pools = poolsOf(
    doc.objects.map((o) => o.id),
    screen.values,
    screen.ctx.scale,
  );
  const out: Candidate[] = [];
  const scan = scanKinds(
    'find',
    KINDS,
    pools,
    { candidatesPerKind: 1500, countLimit: 200_000 },
    (c) => {
      if (screen.decide(c.kind, c.args).kind === 'false') out.push(c);
    },
  );
  for (let r = scan.next(); r.done !== true; r = scan.next());
  return out;
}

describe('a fact that does not hold is never derived', () => {
  for (const [name, make] of FIGURES)
    it(`${name}: no candidate the screen calls false`, () => {
      const { doc } = make();
      const k = drain(knowledgeSteps(doc, REGISTRY, KINDS));
      const bad = falseCandidates(doc);
      expect(bad.length).toBeGreaterThan(20);
      for (const c of bad)
        expect(
          k.derives({ kind: c.kind.name, args: c.args }),
          show(doc, { ...c, kind: c.kind.name }),
        ).toBeUndefined();
    }, 120_000);

  for (const [name, make] of FIGURES)
    it(`${name}: no mutant of a hidden fact that is false`, () => {
      const { doc } = make();
      const r = find(
        { kind: 'find', doc, seed: 4, budget: { n: 12, tests: 30 } },
        { registry: REGISTRY },
      );
      if (r.kind !== 'found') throw new Error(r.kind);
      const hidden = [
        ...r.construction.shown,
        ...r.facts.flatMap((f) => f.consequences?.shown ?? []),
      ];
      const k = drain(knowledgeSteps(doc, REGISTRY, KINDS));
      let checked = 0;
      for (const h of hidden)
        for (const m of mutants(doc, h)) {
          if (holdsIn(doc, m) !== 'false') continue;
          checked++;
          expect(k.derives(m), show(doc, m)).toBeUndefined();
        }
      expect(checked).toBeGreaterThan(20);
    }, 120_000);

  it('the false corpus', () => {
    for (const e of FALSE_CLAIMS) {
      const f = baseFigure();
      const id = e.build(f);
      let o: ReturnType<typeof objectify> | undefined;
      try {
        o = objectify(f.doc, id);
      } catch {
        o = undefined; // a claim on an image of an Undefined map: no object to name
      }
      if (o === undefined) continue;
      const k = drain(knowledgeSteps(o.doc, REGISTRY, KINDS));
      expect(k.derives({ kind: o.kind, args: o.args }), e.name).toBeUndefined();
    }
  }, 120_000);
});
