import { describe, expect, it } from 'vitest';
import { print } from '../src/print';
import { parseOk } from './helpers/lang';

/**
 * Regression (found by the NIGHTLY=1 run of note A's round-trip law, apps/web
 * image-order.test.ts seed 11, case 1986, on the Run 8a branch 10ae9a1): two derived layers
 * with the same map, source and suffix, the second excluding the images it would clash on.
 * An excluded name may be an image that appears only later in the text (Y* is made when Y
 * is defined), and the builder imaged Y* into both layers before the name Y* resolved, so
 * the printed text of a valid document failed to parse ("the image name Y** of Y* in layer
 * b is already used").
 */
describe('exclude names an image made later in the text', () => {
  const text = [
    '@version 1',
    '@layer one = image(T, main)',
    '@layer two = image(T, one)',
    '@layer b = image(T, one) [exclude=X*,Y*]',
    'X = (1, 0)',
    'T = reflect(line((0, 0), (0, 1)))',
    'Y = (2, 0)',
    '',
  ].join('\n');

  it('parses, excludes both images from b, and prints back the same text', () => {
    const doc = parseOk(text);
    const names = doc.objects.map((o) => o.name);
    expect(names).toEqual(['X', 'T', 'X*', 'X**', 'Y', 'Y*', 'Y**']);
    const b = doc.layers.find((l) => l.name === 'b');
    expect(doc.objects.filter((o) => o.managedBy === b?.id)).toEqual([]);
    expect(print(parseOk(print(doc)))).toBe(print(doc));
  });
});
