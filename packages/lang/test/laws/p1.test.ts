import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '@geomira/kernel/invariants';
import { canonicalDocument, sameUpToIds, stable } from '../../src/canonical';
import { formatDiagnostic } from '../../src/diagnostic';
import { parse } from '../../src/parse';
import { print } from '../../src/print';
import { docArb } from '../helpers/gen-doc';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';

describe('law P1: parse(print(doc)) = doc up to ids (SPEC §11.3, L4)', () => {
  it(
    'holds on registry-generated documents (nesting, selectors, derived layers, views, claims, assumptions, comments)',
    () => {
      const seen = {
        docs: 0,
        objects: 0,
        images: 0,
        claims: 0,
        assumptions: 0,
        derived: 0,
        views: 0,
        comments: 0,
      };
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          expect(checkInvariants(doc)).toEqual([]);
          const r = parse(print(doc), registry);
          expect(r.diagnostics.map(formatDiagnostic)).toEqual([]);
          if (!sameUpToIds(doc, r.doc))
            expect(stable(canonicalDocument(r.doc))).toBe(stable(canonicalDocument(doc)));
          seen.docs += 1;
          seen.objects += doc.objects.length;
          seen.images += doc.objects.filter((o) => o.managedBy !== undefined).length;
          seen.claims += doc.claims.length;
          seen.assumptions += doc.assumptions.length;
          seen.derived += doc.layers.filter((l) => l.rule !== undefined).length;
          seen.views += doc.views.length;
          seen.comments += doc.meta.comments?.length ?? 0;
        }),
        { numRuns: runs(400), seed: 20261020 },
      );
      console.warn(`P1: ${JSON.stringify(seen)}`);
      expect(seen.docs).toBe(runs(400));
    },
    LAW_TIMEOUT,
  );

  it(
    'the parsed document is valid and is itself a fixed point',
    () => {
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          const once = parse(print(doc), registry).doc;
          expect(checkInvariants(once)).toEqual([]);
          expect(print(once)).toBe(print(doc));
        }),
        { numRuns: runs(100), seed: 7 },
      );
    },
    LAW_TIMEOUT,
  );
});
