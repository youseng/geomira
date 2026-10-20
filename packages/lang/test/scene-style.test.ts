import { describe, expect, it } from 'vitest';
import { findObjectByName } from '@geomira/kernel/document';
import { print } from '../src/print';
import { firstError, parseOk } from './helpers/lang';

/** ADR-0010: the scene's style keys z, label_angle (degrees) and label_dist (pixels). */
describe('the scene style keys (ADR-0010)', () => {
  it('parse into Style.z, labelAngle, labelDist and print back unchanged', () => {
    const t = [
      '@version 1',
      'A = (0, 0) [z=2, label_angle=-45, label_dist=12.5]',
      'B = (1, 0)',
      'l = line(A, B)',
      'style B [label="B_1", z=-1.5]',
      '',
    ].join('\n');
    const doc = parseOk(t);
    expect(findObjectByName(doc, 'A')?.style).toEqual({ z: 2, labelAngle: -45, labelDist: 12.5 });
    expect(findObjectByName(doc, 'B')?.style).toEqual({ label: 'B_1', z: -1.5 });
    expect(print(doc)).toBe(
      t
        .replace('style B [label="B_1", z=-1.5]\n', '')
        .replace('B = (1, 0)', 'B = (1, 0) [label="B_1", z=-1.5]'),
    );
  });

  it('images take them through style lines', () => {
    const t = [
      '@version 1',
      '@layer r = image(s, main)',
      'A = (1, 2)',
      'B = (0, 0)',
      'C = (1, 0)',
      's = reflect(line(B, C))',
      'style A* [label_angle=180]',
      '',
    ].join('\n');
    expect(findObjectByName(parseOk(t), 'A*')?.style).toEqual({ labelAngle: 180 });
  });

  it('a negative label_dist, a non-number or a repeated key is an error with a hint', () => {
    expect(firstError('A = (0, 0) [label_dist=-1]').message).toContain('label_dist');
    expect(firstError('A = (0, 0) [z=top]').message).toContain('"z" takes a number');
    expect(firstError('A = (0, 0) [z=1, z=2]').message).toContain('given twice');
  });
});
