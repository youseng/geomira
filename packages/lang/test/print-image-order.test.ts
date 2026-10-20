import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { print } from '../src/print';
import { parseOk } from './helpers/lang';

/**
 * Regression (found by the NIGHTLY=1 run of P1's fixed-point test, seed 7, case 224, on the
 * Run 6 merge 91b0b0f): the printer wrote images' `style X*` lines in the document's order
 * of a run of adjacent images, which edits can leave non-canonical (ADR-0009 decision 20),
 * so print(parse(print(doc))) differed from print(doc). The text must not depend on that
 * order (note A of Run 7).
 */
describe('printing does not depend on the order of adjacent images', () => {
  const text = [
    '@version 1',
    '@layer two = image(s, main) [suffix=**]',
    '@layer one = image(s, main)',
    'A = (1, 2)',
    's = translate((0, 0), (1, 0))',
    '# the first image',
    'style A** [color=red]',
    'style A* [color=blue]  # the second',
    '',
  ].join('\n');

  function swapImages(doc: Document): Document {
    const i = doc.objects.findIndex((o) => o.managedBy !== undefined);
    const objects = [...doc.objects];
    const [a, b] = [objects[i], objects[i + 1]];
    if (a === undefined || b?.managedBy === undefined) throw new Error('no run of two images');
    objects[i] = b;
    objects[i + 1] = a;
    return { ...doc, objects };
  }

  it('a permuted run of images prints the same text, and printing is a fixed point', () => {
    const doc = parseOk(text);
    expect(print(doc)).toBe(text);
    const swapped = swapImages(doc);
    expect(swapped.objects.map((o) => o.name)).not.toEqual(doc.objects.map((o) => o.name));
    expect(print(swapped)).toBe(text);
    expect(print(parseOk(print(swapped)))).toBe(print(swapped));
  });
});
