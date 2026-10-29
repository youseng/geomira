/**
 * Run 16c audit (ADR-0044): the scene draws a conic with the kernel's type decision, the
 * figure's scale included. The thin hyperbola (x − x₀)²/0.01 − (y − 0.2)²/10⁸ = 1 (the image of a
 * small hyperbola under a projective map) was drawn as one far "parabola" (and, centred at the
 * origin, listed as "not finite"): it is drawn as a hyperbola, its centre in the figure.
 */
import { describe, expect, it } from 'vitest';
import { Doc } from './helpers/docs';

/** The thin hyperbola centred at (x0, 0.2). */
function thin(x0: number): Doc {
  const t = new Doc();
  const pts = [
    [0.1, 0],
    [-0.1, 0],
    [0.125, 0.075],
    [0.125, -0.075],
    [-0.125, 0.075],
  ] as const;
  pts.forEach(([x, y], i) => t.point('ABCDE'[i] ?? 'Z', x + x0, y + 0.2));
  t.add('h', t.call('conic', 'A', 'B', 'C', 'D', 'E'));
  t.add(
    'f',
    t.call(
      'projective',
      ...[
        [0, 0.2],
        [1, 0.2],
        [0, 0.20001],
        [1, 0.20001],
        [0, 0.2],
        [1, 0.2],
        [0, 1.2],
        [1, 1.2],
      ].map(([x, y]) => t.call('point', x ?? 0, y ?? 0)),
    ),
  );
  t.add('k', t.call('apply', 'f', 'h'));
  return t;
}

describe('a thin hyperbola is drawn as a hyperbola', () => {
  for (const x0 of [0.3, 0])
    it(`centred at (${String(x0)}, 0.2)`, () => {
      const s = thin(x0).scene();
      const k = s.primitives.find((p) => p.name === 'k');
      expect(k?.shape.kind === 'conic' && k.shape.type).toBe('hyperbola');
      if (k?.shape.kind === 'conic') {
        expect(k.shape.c.x).toBeCloseTo(x0, 6);
        expect(k.shape.c.y).toBeCloseTo(0.2, 6);
      }
    });
});
