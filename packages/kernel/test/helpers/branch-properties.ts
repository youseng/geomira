/**
 * Property tests of the branchable tools of Run 3b (tangent_point, tangent_from; intersect
 * with curves is also covered by the selector and theorem tests), spread into
 * tools.property.test.ts's PROPERTIES. P is built as the corner B + rot90(B − A) of the
 * square on AB, so |AP|² = 2r² and the touch points of the tangents from P to circle(A, B)
 * are rational (B and its mirror image in AP): the checks run exactly over Q.
 */
import { call, type Expr, type Selector } from '../../src/expr';
import { vCross, vDot, vSub } from '../../src/geom';
import type { Builder } from './doc';
import { asPoint, samePoints, type Figure } from './figure';
import {
  BOTH,
  asCircle,
  asLine,
  onCircle,
  onLine,
  power,
  type CircleProperty,
} from './circle-properties';

const along = (sign: 1 | -1): Selector => ({ kind: 'along', sign });
const orient = (sign: 1 | -1): Selector => ({ kind: 'orient', sign });

/** c = circle(A, B) and P = B + rot90(B − A) (via intersect with along(+), exact). */
function square(b: Builder, A: Expr, B: Expr): void {
  b.call('c', 'circle', A, B);
  b.add(
    'P',
    call('intersect', [call('tangent', [B, b.ref('c')]), call('circle', [B, A])], [along(1)]),
  );
}

export const BRANCH_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['tangent_point', 'intersect'],
    name: 'tangent_point(P, c, orient(±)): on c, AT ⟂ PT, |PT|² = power(P, c), orient signs, one of them B',
    build: (b, [A, B]) => {
      square(b, A, B);
      b.add('T_1', call('tangent_point', [b.ref('P'), b.ref('c')], [orient(1)]));
      b.add('T_2', call('tangent_point', [b.ref('P'), b.ref('c')], [orient(-1)]));
    },
    required: ['T_1', 'T_2'],
    check: <T>(f: Figure<T>) => {
      const { F } = f;
      const [A, P, c] = [asPoint(f.get('A')), asPoint(f.get('P')), asCircle(f.get('c'))];
      return (
        ['T_1', 'T_2'].every((t, i) => {
          const T = asPoint(f.get(t));
          const [PT, AT] = [vSub(F, T, P), vSub(F, T, A)];
          const sign = F.sign(vCross(F, vSub(F, A, P), PT), 'area', f.ctx);
          return (
            onCircle(f, t, 'c') &&
            F.isZero(vDot(F, PT, AT), 'area', f.ctx) &&
            F.isZero(F.sub(vDot(F, PT, PT), power(F, P, c)), 'area', f.ctx) &&
            sign === (i === 0 ? 1 : -1)
          );
        }) &&
        (samePoints(f, 'T_1', 'B') || samePoints(f, 'T_2', 'B'))
      );
    },
    fields: BOTH,
  },
  {
    tools: ['tangent_from'],
    name: 'tangent_from(P, c, orient(±)) is the chiral tangent at tangent_point(P, c, orient(±)) and passes through P',
    build: (b, [A, B]) => {
      square(b, A, B);
      for (const s of [1, -1] as const) {
        const k = s === 1 ? '1' : '2';
        b.add(`t_${k}`, call('tangent_from', [b.ref('P'), b.ref('c')], [orient(s)]));
        b.add(`T_${k}`, call('tangent_point', [b.ref('P'), b.ref('c')], [orient(s)]));
      }
    },
    required: ['t_1', 't_2'],
    check: <T>(f: Figure<T>) => {
      const { F } = f;
      const A = asPoint(f.get('A'));
      return ['1', '2'].every((k) => {
        const [l, T] = [asLine(f.get(`t_${k}`)), asPoint(f.get(`T_${k}`))];
        return (
          l.chiral &&
          F.isZero(vSub(F, l.p, T).x, 'length', f.ctx) &&
          F.isZero(vSub(F, l.p, T).y, 'length', f.ctx) &&
          F.isZero(vDot(F, l.d, vSub(F, T, A)), 'area', f.ctx) &&
          onLine(f, 'P', `t_${k}`)
        );
      });
    },
    fields: BOTH,
  },
];
