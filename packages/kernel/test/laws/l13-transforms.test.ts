/**
 * Law L13, the transformation part (SPEC §8.1, §17): over FloatField, RationalField and
 * ModPField, on random similarities (direct and anti) and random values of every kind
 * (points, lines / segments / rays of either chirality, circles with and without anchors
 * and arcs, polygons):
 *   apply∘inverse = id (both ways); compose is associative;
 *   apply(compose(S, T)) = apply(S)∘apply(T); the registry's tools agree with the core.
 * Exact in the exact fields, within a relative 1e-9 in floats. Incidence preservation is
 * fuzzed on registry-driven random documents in l13-incidence.test.ts.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import {
  applySimilarity,
  composeSimilarities,
  inverseSimilarity,
  transformOf,
} from '../../src/similarity';
import { REGISTRY, must } from '../helpers/doc';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';
import { randomSimilarity, randomValue, sameValues } from '../helpers/similarity-gen';

const DRAWS = lawCount(3000);
const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];
const CTX = { scale: 1 };

function tool(name: string) {
  return must(REGISTRY.get(name));
}

describe(
  `L13: similarity laws (${String(DRAWS)} draws per field)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const [f, F] of FIELDS.entries()) {
      it(`${F.name}: apply∘inverse = id, associativity, apply(compose(S, T)) = apply(S)∘apply(T)`, () => {
        const kinds = new Map<string, number>();
        let anti = 0;
        for (let i = 0; i < DRAWS; i += 1) {
          const rng = createRng(deriveSeed(130 + f, i));
          const [R, S, T] = [0, 1, 2].map(() => randomSimilarity(F, rng));
          if (R === undefined || S === undefined || T === undefined) throw new Error('draw');
          const X = randomValue(F, rng);
          kinds.set(X.kind, (kinds.get(X.kind) ?? 0) + 1);
          if (S.anti) anti += 1;
          const at = `draw ${String(i)}`;
          const Si = inverseSimilarity(F, S);
          expect(sameValues(F, applySimilarity(F, Si, applySimilarity(F, S, X)), X), at).toBe(true);
          expect(sameValues(F, applySimilarity(F, S, applySimilarity(F, Si, X)), X), at).toBe(true);
          const left = composeSimilarities(F, composeSimilarities(F, R, S), T);
          const right = composeSimilarities(F, R, composeSimilarities(F, S, T));
          expect(sameValues(F, transformOf(left), transformOf(right)), at).toBe(true);
          const ST = composeSimilarities(F, S, T);
          const twice = applySimilarity(F, S, applySimilarity(F, T, X));
          expect(sameValues(F, applySimilarity(F, ST, X), twice), at).toBe(true);
          // The registry's tools compute the same (the ONE compute of each tool).
          const [tS, tT] = [transformOf(S), transformOf(T)];
          expect(tool('compose').compute(F, [tS, tT], CTX)).toEqual(transformOf(ST));
          expect(tool('inverse').compute(F, [tS], CTX)).toEqual(transformOf(Si));
          expect(tool('apply').compute(F, [tS, X], CTX)).toEqual(applySimilarity(F, S, X));
        }
        process.stdout.write(
          `L13 ${F.name}: ${String(DRAWS)} draws (${String(anti)} anti), kinds ${JSON.stringify(Object.fromEntries(kinds))}\n`,
        );
        expect(anti).toBeGreaterThan(DRAWS / 3);
        expect(kinds.size).toBe(4);
      });
    }
  },
);
