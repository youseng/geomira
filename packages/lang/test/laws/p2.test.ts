import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse';
import { print } from '../../src/print';
import { docArb } from '../helpers/gen-doc';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';
import { editsArb, mutate, soupArb } from '../helpers/mutate';

/** print∘parse applied twice equals once. */
function idempotent(text: string): void {
  const once = print(parse(text, registry).doc);
  const twice = print(parse(once, registry).doc);
  expect(twice).toBe(once);
}

describe('law P2: print∘parse is idempotent (SPEC §11.3, L4)', () => {
  it(
    'on printed documents',
    () => {
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          idempotent(print(doc));
        }),
        { numRuns: runs(150), seed: 2 },
      );
    },
    LAW_TIMEOUT,
  );

  it(
    'on printed documents with random edits (most lines then have errors)',
    () => {
      let n = 0;
      fc.assert(
        fc.property(docArb(registry), editsArb, (doc, edits) => {
          idempotent(mutate(print(doc), edits));
          n += 1;
        }),
        { numRuns: runs(300), seed: 3 },
      );
      console.warn(`P2 (mutated texts): ${String(n)}`);
    },
    LAW_TIMEOUT,
  );

  it(
    'on token soups and arbitrary strings',
    () => {
      fc.assert(fc.property(soupArb, idempotent), { numRuns: runs(1000), seed: 4 });
      fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 120 }), idempotent), {
        numRuns: runs(500),
        seed: 5,
      });
    },
    LAW_TIMEOUT,
  );
});
