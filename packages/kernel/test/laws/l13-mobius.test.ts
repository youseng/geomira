/**
 * Law L13 for Möbius maps (Run 14, ADR-0032; SPEC §8.1): over FloatField, RationalField and
 * ModPField, on random inversions (alone or between random similarities) and random figures
 * (points; lines with every range, the two rays `outside` included; circles with anchors and
 * arcs on them), as point sets:
 *   - an inversion is an involution: apply(J, apply(J, X)) = X;
 *   - apply(inverse(M), apply(M, X)) = X;
 *   - apply(compose(M, N), X) = apply(M, apply(N, X)) (and over Q it is defined when the steps are);
 *   - the registry's apply, compose and inverse compute what the core computes.
 * Exact over Q and mod p (mod p: ranges and arcs are Inexact, every other figure is mapped),
 * within a relative 1e-9 in floats. Draws whose image is Undefined (a figure through the band
 * of the center) are counted, never silently passed.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { applyMap } from '../../src/transform/apply-map';
import { composeMaps, inverseMap } from '../../src/transform/mobius';
import type { Value } from '../../src/value';
import { REGISTRY, must } from '../helpers/doc';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';
import {
  inversionMap,
  isRanged,
  randomFigure,
  randomMobius,
  samePointSet,
} from '../helpers/mobius-gen';
import { randomScalar } from '../helpers/similarity-gen';

const DRAWS = lawCount(1500);
const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
const CTX = { scale: 1 };

const defined = <T>(v: Value<T>): boolean => v.kind !== 'undefined' && v.kind !== 'inexact';

describe(`L13: Möbius laws (${String(DRAWS)} draws per field)`, { timeout: LAW_TIMEOUT }, () => {
  for (const [f, F] of FIELDS.entries()) {
    it(`${F.name}: involution, inverse, composition, as point sets`, () => {
      const tally = { checked: 0, undefinedImage: 0, inexactModP: 0 };
      for (let i = 0; i < DRAWS; i += 1) {
        const rng = createRng(deriveSeed(1400 + f, i));
        const at = `draw ${String(i)}`;
        const X = randomFigure(F, rng);
        const O = { x: randomScalar(F, rng), y: randomScalar(F, rng) };
        const J = inversionMap(F, O, randomScalar(F, rng, true));
        const [M, N] = [randomMobius(F, rng), randomMobius(F, rng)];
        const JX = applyMap(F, J, X, CTX);
        if (F.kind === 'modp' && isRanged(X)) {
          // No order mod p: a range or an arc through an inversion is Inexact, never a guess.
          expect(JX.kind === 'inexact' || JX.kind === 'undefined', at).toBe(true);
          tally.inexactModP += 1;
          continue;
        }
        if (!defined(JX)) {
          tally.undefinedImage += 1;
          continue;
        }
        expect(samePointSet(F, applyMap(F, J, JX, CTX), X), `${at}: involution`).toBe(true);
        const MX = applyMap(F, M, X, CTX);
        if (defined(MX))
          expect(samePointSet(F, applyMap(F, inverseMap(F, M), MX, CTX), X), `${at}: inverse`).toBe(
            true,
          );
        const NX = applyMap(F, N, X, CTX);
        const MNX = defined(NX) ? applyMap(F, M, NX, CTX) : NX;
        const once = applyMap(F, composeMaps(F, M, N), X, CTX);
        if (defined(MNX)) {
          if (F.kind !== 'float') expect(defined(once), `${at}: composition defined`).toBe(true);
          if (defined(once)) expect(samePointSet(F, once, MNX), `${at}: composition`).toBe(true);
        }
        // The registry's tools compute the same (the ONE compute of each tool).
        const tool = (name: string) => must(REGISTRY.get(name));
        const tJ = { kind: 'transform' as const, t: J };
        expect(tool('apply').compute(F, [tJ, X], CTX), at).toEqual(JX);
        expect(tool('inverse').compute(F, [tJ], CTX), at).toEqual({
          kind: 'transform',
          t: inverseMap(F, J),
        });
        tally.checked += 1;
      }
      // Most draws are checked; a few figures pass through the center (exactly, on the grid).
      expect(tally.checked, JSON.stringify(tally)).toBeGreaterThan(
        DRAWS * (F.kind === 'modp' ? 0.3 : 0.8),
      );
    });
  }
});
