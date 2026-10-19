/**
 * Law L1 for the Run 3a tools (SPEC §17; the Run 3a note on ADR-0002): evaluate never
 * throws and no Value holds NaN or ±Infinity, over ≥ 2,000 fuzzed documents built to hit
 * the circle degeneracies exactly and nearly (helpers/fuzz-circles.ts: coincident points,
 * parallel lines, concentric and tangent circles, points off and nearly on circles,
 * (0 : 0) gliders, straight angles, residuals of ±1e-17), in FloatField, RationalField and
 * ModPField. Every degenerate situation listed in REASONS must actually be reached.
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
import { fuzzCircleDocument } from '../helpers/fuzz-circles';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(2000);
const SEED = 20261020;

const REASONS = [
  'coincident points',
  'collinear points',
  'parallel lines',
  'concentric circles',
  'needs P on',
  'ambiguous',
  'no anchor',
  '(0 : 0)',
  'radius',
  'polar is the line at infinity',
  'no other intersection',
  'is undefined',
];

interface Tally {
  objects: number;
  undefined: number;
  inexact: number;
  reasons: Record<string, number>;
}

function check<T>(F: Field<T>, finite: (x: T) => boolean): Tally {
  const t: Tally = {
    objects: 0,
    undefined: 0,
    inexact: 0,
    reasons: Object.fromEntries(REASONS.map((r) => [r, 0])),
  };
  for (let i = 0; i < DOCS; i += 1) {
    const doc = assertInvariants(fuzzCircleDocument(createRng(deriveSeed(SEED, i)), REGISTRY, 24));
    const ev = evaluate(doc, REGISTRY, F, contextOf(doc));
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      expect(v, `${F.name} doc ${String(i)} ${o.name}`).toBeDefined();
      if (v === undefined) continue;
      t.objects += 1;
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
    `L1 circles ${F.name}: ${String(DOCS)} documents, ${String(t.objects)} objects, ` +
      `${String(t.undefined)} Undefined, ${String(t.inexact)} Inexact, 0 throws, 0 non-finite; reached: ` +
      `${Object.entries(t.reasons)
        .map(([k, n]) => `${k} ${String(n)}`)
        .join(', ')}\n`,
  );
  return t;
}

describe(
  `L1 (circles): evaluate is total over ${String(DOCS)} fuzzed documents`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('FloatField: never throws, every number finite, every listed degeneracy reached', () => {
      const t = check(FloatField, (x) => Number.isFinite(x));
      for (const r of REASONS) expect(t.reasons[r], r).toBeGreaterThan(0);
    });
    it('RationalField: never throws', () => {
      expect(check(RationalField, () => true).inexact).toBeGreaterThan(0);
    });
    it('ModPField: never throws', () => {
      expect(check(ModPField, () => true).inexact).toBeGreaterThan(0);
    });
  },
);
