/**
 * Reflection equivariance of the common tangents' selectors (SPEC §7, law L16; ADR-0045): on a
 * mirrored figure (every free point (x, y) ↦ (−x, y)), along(±), near(P), far_from(P) and the
 * side filters select the mirror image of the original choice; orient(±) selects it only when
 * flipped (it is orientation-dependent by SPEC §7's definition).
 */
import { FloatField } from '@geomira/num/float-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, type Selector } from '../src/expr';
import type { Value } from '../src/value';
import { Builder, evalDoc, num, pt, valueOf } from './helpers/doc';

const FIGURES = 120;

/** The value of X in the figure `build` makes, its free points mirrored when asked. */
function valueIn(
  build: (b: Builder, P: (x: number, y: number) => ReturnType<typeof pt>) => void,
  mirror: boolean,
): Value<number> {
  const b = new Builder();
  build(b, (x, y) => pt(mirror ? -x : x, y));
  return valueOf(b.doc, evalDoc(b.doc, FloatField), 'X');
}

const along = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });

function mirrored(a: Value<number>, b: Value<number>): boolean {
  if (a.kind !== 'point' || b.kind !== 'point') return a.kind === b.kind;
  return Math.hypot(a.x + b.x, a.y - b.y) < 1e-9 * (1 + Math.hypot(a.x, a.y));
}

describe('common tangents: reflection equivariance (ADR-0045, L16)', () => {
  it('along(±) with near / far_from / a side filter: the mirror image; orient(±) flips', () => {
    let defined = 0;
    for (let i = 0; i < FIGURES; i++) {
      const rng = createRng(deriveSeed(4516, i));
      const r = () => rng.uniform(-10, 10);
      const c = [r(), r(), r(), r(), r(), r(), r(), r()];
      const [r1, r2] = [rng.uniform(0.5, 3), rng.uniform(0.5, 3)];
      const s1 = rng.nextFloat() < 0.5 ? 1 : -1;
      const s2 = rng.nextFloat() < 0.5 ? 1 : -1;
      const sels = (mirror: boolean): Selector[][] => [
        [along(s1), { kind: 'near', p: pt(mirror ? -(c[4] ?? 0) : (c[4] ?? 0), c[5] ?? 0) }],
        [{ kind: 'far_from', p: pt(mirror ? -(c[6] ?? 0) : (c[6] ?? 0), c[7] ?? 0) }],
        [along(s1), mirror ? orient(s2 === 1 ? -1 : 1) : orient(s2)],
      ];
      for (const k of [0, 1, 2]) {
        const build =
          (mirror: boolean) => (b: Builder, P: (x: number, y: number) => ReturnType<typeof pt>) => {
            const c1 = b.add('c_1', call('circle', [P(c[0] ?? 0, c[1] ?? 0), num(r1)]));
            const c2 = b.add('c_2', call('circle', [P(c[2] ?? 0, c[3] ?? 0), num(r2)]));
            b.add('X', call('tangent_point', [c1, c2], sels(mirror)[k] ?? []));
          };
        const [a, m] = [valueIn(build(false), false), valueIn(build(true), true)];
        expect(mirrored(a, m), `figure ${String(i)} selectors ${String(k)}`).toBe(true);
        if (a.kind === 'point') defined += 1;
      }
    }
    expect(defined).toBeGreaterThan(FIGURES);
  });
});
