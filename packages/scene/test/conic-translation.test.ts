import { describe, expect, it } from 'vitest';
import { FloatField } from '@geomira/num/float-field';
import { createRegistry } from '@geomira/kernel/registry';
import { pointOf, type Value } from '@geomira/kernel/value';
import { conicShapeOf, conicPoint } from '../src/conic-shape';

const registry = createRegistry();
describe('translated conic drawing uses the retained local polynomial', () => {
  for (const offset of [0, 100000, 1000000, -1000000]) {
    it(`draws the same radius-5 circle at ${String(offset)}`, () => {
      const args: Value<number>[] = [
        [5, 0],
        [0, 5],
        [-5, 0],
        [0, -5],
        [3, 4],
      ].map(([x, y]) => pointOf(offset + (x ?? 0), offset + (y ?? 0)));
      const k = registry.get('conic')?.compute(FloatField, args, { scale: 10 });
      if (k?.kind !== 'conic') throw new Error('conic unavailable');
      const shape = conicShapeOf(k, { scale: 10 });
      expect(shape?.type).toBe('ellipse');
      if (shape === undefined) throw new Error('shape unavailable');
      expect(shape.c.x).toBeCloseTo(offset, 8);
      expect(shape.c.y).toBeCloseTo(offset, 8);
      expect(shape.a).toBeCloseTo(5, 10);
      expect(shape.b).toBeCloseTo(5, 10);
      for (const t of [0, Math.PI / 3, Math.PI]) {
        const p = conicPoint(shape, 1, t);
        expect(Math.hypot(p.x - offset, p.y - offset)).toBeCloseTo(5, 8);
      }
    });
  }
});
