/**
 * ADR-0051 (in ADR-0039's style): the claim kinds added for the GUI (similar and congruent
 * triangles, AB·CD = EF·GH, AB + CD = EF) reach "What is special?" through the claim-kind
 * registry (ADR-0035) and do not flood it. Triangles similar by construction (a homothety's
 * images, the medial triangle, a mirror image) are everywhere and no closure rule hides them
 * yet, so these kinds are not searched, and the result says so; what is reported is exactly
 * what the registry without them reports.
 */
import { describe, expect, it } from 'vitest';
import type { ClaimKinds } from '@geomira/claims/kind-registry';
import { claimKindRegistry } from '@geomira/claims/kind-registry';
import type { Document } from '@geomira/kernel/document';
import { find } from '../src/find';
import type { FindResult } from '../src/types';
import { homothetyFigure, reflectionFigure } from './figures';
import { REGISTRY, show } from './helpers';

const NEW = [
  'similar',
  'similar_direct',
  'similar_opposite',
  'congruent',
  'congruent_direct',
  'congruent_opposite',
  'length_product',
  'length_sum',
];

/** The registry's kinds without ADR-0051's. */
function without(): ClaimKinds {
  const all = claimKindRegistry();
  const kinds = Object.freeze(all.kinds.filter((k) => !NEW.includes(k.name)));
  return { kinds, get: (name) => kinds.find((k) => k.name === name) };
}

function found(doc: Document, kinds?: ClaimKinds): FindResult {
  const env = kinds === undefined ? { registry: REGISTRY } : { registry: REGISTRY, kinds };
  const r = find({ kind: 'find', doc, seed: 1, budget: { n: 20 } }, env);
  if (r.kind !== 'found') throw new Error(JSON.stringify(r));
  return r;
}

const texts = (doc: Document, r: FindResult): string[] =>
  r.facts.flatMap((f) => (f.chain ?? [f]).map((x) => show(doc, x)));

describe('ADR-0051 kinds do not flood "What is special?"', () => {
  it('the registry offers them; each is not searched, with its reason in the caps', () => {
    const doc = homothetyFigure().doc;
    const r = found(doc);
    for (const k of NEW) {
      expect(claimKindRegistry().get(k), k).toBeDefined();
      const n = r.notSearched.find((x) => x.kind === k);
      expect(n?.reason.length, k).toBeGreaterThan(10);
      expect(
        r.caps.some((c) => c.startsWith(`${k} not searched: `)),
        k,
      ).toBe(true);
    }
  });

  for (const [name, figure] of [
    ['homothety (every triangle and its image are similar)', homothetyFigure],
    ['reflection (every triangle and its image are congruent)', reflectionFigure],
  ] as const) {
    it(`${name}: no fact of a new kind; the same facts as without them`, () => {
      const doc = figure().doc;
      const r = found(doc);
      expect(r.facts.filter((f) => NEW.includes(f.kind))).toEqual([]);
      expect(texts(doc, r)).toEqual(texts(doc, found(doc, without())));
    });
  }
});
