/**
 * Objects not drawable at the zoom (ADR-0023) in exports (ADR-0028): like an undefined object
 * (ADR-0026), every format lists each one as a warning (the dialog's message, a `Warning`
 * comment in TikZ and Asymptote) and none draws it.
 */
import { describe, expect, it } from 'vitest';
import { exportAs, warningMessages, type ExportChoice } from '../src/formats';
import { frameOf, REGISTRY } from './helpers/figure';

const CHOICES: readonly ExportChoice[] = [
  { format: 'svg' },
  { format: 'png', pixelRatio: 1 },
  { format: 'tikz', standalone: false },
  { format: 'tikz', standalone: true },
  { format: 'asy', dialect: 'standalone' },
  { format: 'asy', dialect: 'aops' },
];

const CIRCLE = `@version 1
@viewport 0 0 20
O = (0, 10000000000000000)
P = (0, 0)
c = circle(O, P)
`;

const POLYGON = `@version 1
@viewport 0 0 50
A = (-100000000000000000, 3)
B = (100000000000000000, -3)
C = (0, 100000000000000000)
t = polygon(A, B, C)
Q = (0, 0)
`;

function check(text: string, name: string, choice: ExportChoice) {
  const f = frameOf(text);
  expect(f.display.undrawable.map((u) => u.name)).toEqual([name]);
  const out = exportAs(f, choice, REGISTRY);
  expect(out.warnings).toContainEqual({ kind: 'undrawable', object: name });
  const message = `${name} is not drawable at this zoom: not drawn`;
  expect(warningMessages(out)).toContain(message);
  const id = f.doc.objects.find((o) => o.name === name)?.id;
  expect(out.drawn).not.toContain(id);
  if (out.kind === 'text' && choice.format !== 'svg') {
    const comment = choice.format === 'tikz' ? '%' : '//';
    expect(out.text).toContain(`${comment} Warning: ${message}`);
  }
}

describe('objects not drawable at the zoom, in every export', () => {
  for (const choice of CHOICES) {
    it(`${JSON.stringify(choice)}: a circle of radius 10¹⁶ across the view is listed`, () => {
      check(CIRCLE, 'c', choice);
    });
    it(`${JSON.stringify(choice)}: a polygon with an edge 10¹⁷ long is listed`, () => {
      check(POLYGON, 't', choice);
    });
  }

  it('an ordinary figure has no such warning', () => {
    const f = frameOf('@version 1\nA = (0, 0)\nc = circle(A, 2)\n');
    for (const choice of CHOICES)
      expect(exportAs(f, choice, REGISTRY).warnings.map((w) => w.kind)).not.toContain('undrawable');
  });
});
