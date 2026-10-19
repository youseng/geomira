/**
 * Law L1 (SPEC §17): evaluate is total and no Value holds NaN or ±Infinity. ADR-0002:
 * num throws RangeError on out-of-domain input, so every division and square root in a
 * tool must be guarded; any missed guard shows up here as a throw. ≥ 2,000 fuzzed
 * documents with exact and near degeneracies (coincident points, parallel lines,
 * residuals from ±1e-17 up to beyond the band), evaluated over Float, Rational and ModP.
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
import { fuzzDocument } from '../helpers/fuzz';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(2000);
const SEED = 20261019;

interface Tally {
  docs: number;
  objects: number;
  undefined: number;
  inexact: number;
  /** How often each degenerate situation was reached (root Undefined reasons). */
  reasons: Record<string, number>;
}

/** The degenerate situations the fuzzer must reach (Run 2 note on ADR-0002). */
const REASONS = [
  'parallel lines',
  'coincident lines',
  'coincident points',
  'collinear points',
  'ambiguous',
  'division by zero',
  'outside the',
];

function tally0(): Tally {
  return {
    docs: 0,
    objects: 0,
    undefined: 0,
    inexact: 0,
    reasons: Object.fromEntries(REASONS.map((r) => [r, 0])),
  };
}

function check<T>(F: Field<T>, finite: (x: T) => boolean, tally: Tally): void {
  for (let i = 0; i < DOCS; i += 1) {
    const rng = createRng(deriveSeed(SEED, i));
    const doc = assertInvariants(
      fuzzDocument(rng, REGISTRY, { points: 4, calls: 24, degenerate: true, maxDepth: 4 }),
    );
    const ev = evaluate(doc, REGISTRY, F, contextOf(doc));
    tally.docs += 1;
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      expect(v, `${F.name} doc ${String(i)} ${o.name}`).toBeDefined();
      if (v === undefined) continue;
      tally.objects += 1;
      if (v.kind === 'undefined') tally.undefined += 1;
      for (const r of REASONS) {
        if (v.kind === 'undefined' && v.reason.includes(r))
          tally.reasons[r] = (tally.reasons[r] ?? 0) + 1;
      }
      if (v.kind === 'inexact') tally.inexact += 1;
      if (v.kind === 'undefined' || v.kind === 'inexact')
        expect(v.reason.length).toBeGreaterThan(0);
      const bad = numbersOf(v).filter((x) => !finite(x));
      expect(bad, `${F.name} doc ${String(i)} ${o.name}`).toEqual([]);
    }
  }
}

function report(name: string, t: Tally): void {
  process.stdout.write(
    `L1 ${name}: ${String(t.docs)} documents, ${String(t.objects)} objects, ` +
      `${String(t.undefined)} Undefined, ${String(t.inexact)} Inexact, 0 throws, 0 non-finite; ` +
      `reached: ${Object.entries(t.reasons)
        .map(([k, n]) => `${k} ${String(n)}`)
        .join(', ')}\n`,
  );
}

describe(
  `L1: evaluate is total over ${String(DOCS)} fuzzed documents`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('FloatField: never throws, every number finite', () => {
      const t = tally0();
      check(FloatField, (x) => Number.isFinite(x), t);
      report('FloatField', t);
      expect(t.docs).toBeGreaterThanOrEqual(DOCS);
      for (const r of REASONS) expect(t.reasons[r], r).toBeGreaterThan(0);
    });

    it('RationalField: never throws', () => {
      const t = tally0();
      check(RationalField, () => true, t);
      report('RationalField', t);
      expect(t.inexact).toBeGreaterThan(0);
    });

    it('ModPField: never throws', () => {
      const t = tally0();
      check(ModPField, () => true, t);
      report('ModPField', t);
      expect(t.inexact).toBeGreaterThan(0);
    });
  },
);
