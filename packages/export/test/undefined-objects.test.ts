/**
 * Undefined objects in exports (maintainer's review before merge): an undefined object has no
 * position, so no format draws it or invents coordinates for it; every format lists it, with
 * its reason, as a warning (the dialog's message, a `Warning` comment in TikZ and Asymptote).
 * Objects Asymptote cannot construct keep their coordinates (`// numeric`).
 */
import { describe, expect, it } from 'vitest';
import { exportAs, warningMessages, type ExportChoice } from '../src/formats';
import { frameOf, REGISTRY } from './helpers/figure';

const TEXT = [
  '@version 1',
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'l = line(A, B)',
  'c = circle(A, C)',
  'd = circle(B, C)',
  'e = circle(A, 1)',
  'D = other(c, d, C)',
  'E = other(l, c, C)',
  'F = homothety(C, A, 0)',
  'm = polar(A, c)',
  'r = radical_axis(c, e)',
  'G = midpoint(E, B)',
  'H = rotate(C, A, 90)',
  'h = line(A, (1, 1)) [hidden]',
  'K = intersect(h, e, along(+))',
].join('\n');

const CHOICES: readonly ExportChoice[] = [
  { format: 'svg' },
  { format: 'png', pixelRatio: 1 },
  { format: 'tikz', standalone: false },
  { format: 'tikz', standalone: true },
  { format: 'asy', dialect: 'standalone' },
  { format: 'asy', dialect: 'aops' },
];

const UNDEFINED = ['E', 'F', 'm', 'r', 'G'];

describe('undefined objects in every export', () => {
  for (const choice of CHOICES)
    it(`${JSON.stringify(choice)}: each undefined object is listed, none is drawn`, () => {
      const f = frameOf(TEXT);
      const out = exportAs(f, choice, REGISTRY);
      const listed = out.warnings.flatMap((w) => (w.kind === 'undefined' ? [w.object] : []));
      expect([...listed].sort()).toEqual([...UNDEFINED].sort());
      const messages = warningMessages(out);
      expect(messages).toContain(
        'E is undefined in this figure (other(a, b, P) needs P on the line): not drawn',
      );
      const ids = (names: string[]) =>
        f.doc.objects.filter((o) => names.includes(o.name)).map((o) => o.id);
      for (const id of ids(UNDEFINED)) expect(out.drawn).not.toContain(id);
      for (const id of ids(['D', 'H', 'K'])) expect(out.drawn).toContain(id);
      if (out.kind === 'text') {
        expect(out.text).not.toMatch(/NaN|Infinity/u);
        if (choice.format !== 'svg') {
          const comment = choice.format === 'tikz' ? '%' : '//';
          for (const m of messages) expect(out.text).toContain(`${comment} Warning: ${m}`);
        }
      }
    });

  it('Asymptote declares no undefined object, and keeps coordinates where it cannot construct', () => {
    const out = exportAs(frameOf(TEXT), { format: 'asy', dialect: 'standalone' }, REGISTRY);
    const text = out.kind === 'text' ? out.text : '';
    for (const n of UNDEFINED)
      expect(text).not.toMatch(new RegExp(`^(pair|path|gmline|gmcircle) ${n} =`, 'mu'));
    expect(text).toMatch(/^pair D = \(1, -3\); \/\/ numeric$/mu);
    expect(text).toMatch(/^pair H = rotate\(90, A\) \* C;$/mu);
  });

  it('a hidden undefined object is not listed (it is not shown on the canvas either)', () => {
    const out = exportAs(
      frameOf(`${TEXT}\nL = other(l, c, B) [hidden]`),
      { format: 'svg' },
      REGISTRY,
    );
    expect(out.warnings.some((w) => w.kind === 'undefined' && w.object === 'L')).toBe(false);
  });
});
