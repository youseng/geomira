/**
 * Law L1 for branch selection (Run 3b; the Run 1 note on ADR-0002): evaluate never throws
 * and no Value holds NaN or ±Infinity, over ≥ 2,000 fuzzed documents aimed at the
 * branchable tools (helpers/fuzz-branch.ts: exactly and nearly tangent lines and circles,
 * concentric and equal circles, P on / nearly on / inside c and at the centre, coincident
 * points, segments and rays, random and degenerate selector references, misused selectors,
 * bare indices, huge literals), in FloatField, RationalField and ModPField. Every situation
 * in REASONS must be reached in FloatField, and the double point of a tangency (a curve
 * pair with no selector that is defined) must occur.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { assertInvariants } from '../../src/invariants';
import { numbersOf } from '../../src/value';
import { REGISTRY, contextOf } from '../helpers/doc';
import { fuzzBranchDocument } from '../helpers/fuzz-branch';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(2000);
const SEED = 20261021;

const REASONS = [
  'the line misses the circle',
  'the circles are apart',
  'one circle lies inside the other',
  'concentric circles',
  'P lies inside the circle',
  'ambiguous: add a selector',
  'satisfies',
  'does not apply to',
  'may appear only once',
  'bare index',
  'takes no selectors',
  'needs the point on',
  'within the band of incidence',
  'lies on the line',
  'needs two distinct',
  'is undefined',
  'coincident points',
];

interface Tally {
  objects: number;
  branch: number;
  doubles: number;
  undefined: number;
  inexact: number;
  reasons: Record<string, number>;
}

function check<T>(F: Field<T>, finite: (x: T) => boolean): Tally {
  const t: Tally = {
    objects: 0,
    branch: 0,
    doubles: 0,
    undefined: 0,
    inexact: 0,
    reasons: Object.fromEntries(REASONS.map((r) => [r, 0])),
  };
  for (let i = 0; i < DOCS; i += 1) {
    const doc = assertInvariants(fuzzBranchDocument(createRng(deriveSeed(SEED, i)), REGISTRY, 14));
    const ev = evaluate(doc, REGISTRY, F, contextOf(doc));
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      expect(v, `${F.name} doc ${String(i)} ${o.name}`).toBeDefined();
      if (v === undefined) continue;
      t.objects += 1;
      const def = o.def.kind === 'call' ? o.def : undefined;
      if (def !== undefined && REGISTRY.get(def.tool)?.candidates !== undefined) {
        t.branch += 1;
        if (def.selectors.length === 0 && (v.kind === 'point' || v.kind === 'line')) t.doubles += 1;
      }
      if (v.kind === 'undefined' || v.kind === 'inexact') {
        expect(v.reason.length).toBeGreaterThan(0);
        t[v.kind] += 1;
        for (const r of REASONS) if (v.reason.includes(r)) t.reasons[r] = (t.reasons[r] ?? 0) + 1;
      }
      expect(
        numbersOf(v).filter((x) => !finite(x)),
        `${F.name} doc ${String(i)} ${o.name}`,
      ).toEqual([]);
    }
  }
  process.stdout.write(
    `L1 branch ${F.name}: ${String(DOCS)} documents, ${String(t.objects)} objects (${String(t.branch)} branchable calls, ` +
      `${String(t.doubles)} defined without selectors: double points and lone intersections), ${String(t.undefined)} Undefined, ` +
      `${String(t.inexact)} Inexact, 0 throws, 0 non-finite; reached: ${Object.entries(t.reasons)
        .map(([k, n]) => `${k} ${String(n)}`)
        .join(', ')}\n`,
  );
  return t;
}

describe(
  `L1 (branch selection): evaluate is total over ${String(DOCS)} fuzzed documents`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('FloatField: never throws, every number finite, every listed situation reached', () => {
      const t = check(FloatField, (x) => Number.isFinite(x));
      for (const r of REASONS) expect(t.reasons[r], r).toBeGreaterThan(0);
      expect(t.doubles).toBeGreaterThan(0);
    });
    it('RationalField: never throws', () => {
      const t = check(RationalField, () => true);
      expect(t.inexact).toBeGreaterThan(0);
      expect(t.doubles).toBeGreaterThan(0);
    });
    it('ModPField: never throws', () => {
      const t = check(ModPField, () => true);
      expect(t.inexact).toBeGreaterThan(0);
    });
  },
);
