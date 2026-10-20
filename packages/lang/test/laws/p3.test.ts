import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Document, Style } from '@geomira/kernel/document';
import { checkInvariants } from '@geomira/kernel/invariants';
import { syncProblems } from '@geomira/kernel/derived';
import { sortImageRuns } from '../../src/canonical';
import { parse } from '../../src/parse';
import { parseInto } from '../../src/parse-into';
import { print } from '../../src/print';
import { docArb } from '../helpers/gen-doc';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';
import { editsArb, mutate } from '../helpers/mutate';

/** The text without any attribute group or style line: no styles stated. */
function unstyled(text: string): string {
  return text
    .split('\n')
    .filter((l) => !l.startsWith('style '))
    .map((l) =>
      l.startsWith('@') || l.startsWith('claim') ? l : l.replace(/ \[[^\]"]*\]( #.*)?$/u, '$1'),
    )
    .join('\n');
}

describe("law P3: parseInto keeps the ids of persisting names; styles are exactly the text's (SPEC §11.3, L4)", () => {
  it(
    'parseInto(doc, print(doc)) is doc itself, ids and nextId included (images in canonical run order)',
    () => {
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          const r = parseInto(doc, print(doc), registry);
          expect(r.diagnostics).toEqual([]);
          expect(sortImageRuns(r.doc).objects).toEqual(sortImageRuns(doc).objects);
          expect(r.doc.layers).toEqual(doc.layers);
          expect(r.doc.claims).toEqual(doc.claims);
          expect(r.doc.assumptions).toEqual(doc.assumptions);
          expect(r.doc.nextId).toBe(doc.nextId);
        }),
        { numRuns: runs(200), seed: 31 },
      );
    },
    LAW_TIMEOUT,
  );

  it(
    'after random edits: every persisting name keeps its id; new ids are fresh; the result is valid',
    () => {
      fc.assert(
        fc.property(docArb(registry), editsArb, (doc, edits) => {
          const r = parseInto(doc, mutate(print(doc), edits), registry);
          expect(checkInvariants(r.doc)).toEqual([]);
          expect(syncProblems(r.doc, registry)).toEqual([]);
          for (const o of r.doc.objects) {
            const old = doc.objects.find(
              (x) =>
                x.name === o.name && (x.managedBy === undefined) === (o.managedBy === undefined),
            );
            if (old !== undefined) expect(o.id).toBe(old.id);
            else expect(o.id).toBeGreaterThanOrEqual(doc.nextId);
          }
          expect(r.doc.nextId).toBeGreaterThanOrEqual(doc.nextId);
        }),
        { numRuns: runs(200), seed: 32 },
      );
    },
    LAW_TIMEOUT,
  );

  it(
    'styles are exactly what the new text says (edited texts): the same as parsing the text alone',
    () => {
      fc.assert(
        fc.property(docArb(registry), editsArb, (doc, edits) => {
          const text = mutate(print(doc), edits);
          const into = parseInto(doc, text, registry).doc;
          const alone = parse(text, registry).doc;
          const styles = (d: Document): Map<string, Style> =>
            new Map(d.objects.map((o) => [o.name, o.style]));
          expect(styles(into)).toEqual(styles(alone));
        }),
        { numRuns: runs(200), seed: 34 },
      );
    },
    LAW_TIMEOUT,
  );

  it(
    'a text that states no style gives every object the default style; printing brings no style back',
    () => {
      let reset = 0;
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          const text = unstyled(print(doc));
          const r = parseInto(doc, text, registry);
          for (const o of r.doc.objects) {
            const stated = parse(text, registry).doc.objects.find((x) => x.name === o.name)?.style;
            expect(o.style).toEqual(stated);
            const old = doc.objects.find((x) => x.id === o.id);
            if (
              old !== undefined &&
              Object.keys(old.style).length > 0 &&
              Object.keys(o.style).length === 0
            )
              reset += 1;
          }
          expect(
            print(r.doc)
              .split('\n')
              .filter((l) => l.startsWith('style ')),
          ).toEqual([]);
        }),
        { numRuns: runs(150), seed: 33 },
      );
      expect(reset).toBeGreaterThan(0);
    },
    LAW_TIMEOUT,
  );
});
