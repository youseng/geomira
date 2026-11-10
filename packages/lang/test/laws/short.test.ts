/**
 * The laws of the short notation (ADR-0061), on generated documents. S1: wherever the
 * canonical text reads back without diagnostics (law P1's domain), the short text does too,
 * to the SAME document (compared by its canonical text, which is the document up to ids).
 * S2: printShort∘parse is idempotent on that text. S3: the short text is never longer.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse';
import { print } from '../../src/print';
import { printShort } from '../../src/print-short';
import { docArb } from '../helpers/gen-doc';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';

describe('the short notation reads back to the same document', () => {
  it(
    'S1, S2, S3 on generated documents',
    () => {
      let shorter = 0;
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          const canonical = print(doc);
          const back = parse(canonical, registry);
          fc.pre(back.diagnostics.length === 0);
          const short = printShort(back.doc, registry);
          const r = parse(short, registry);
          expect(r.diagnostics).toEqual([]);
          expect(print(r.doc)).toBe(canonical);
          expect(printShort(r.doc, registry)).toBe(short);
          expect(short.length).toBeLessThanOrEqual(canonical.length);
          if (short !== canonical) shorter += 1;
        }),
        { numRuns: runs(300) },
      );
      // The generator does write lines, triangles and branches: the law is not vacuous.
      expect(shorter).toBeGreaterThan(0);
    },
    LAW_TIMEOUT,
  );
});
