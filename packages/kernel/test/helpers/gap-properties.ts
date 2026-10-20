/**
 * Property tests of ninepoint_center, power and radius (the SPEC §6.2 tools added by the
 * Run 3b audit), spread into tools.property.test.ts's PROPERTIES.
 */
import { call } from '../../src/expr';
import { vDot, vSub } from '../../src/geom';
import { num } from './doc';
import { asNum, asPoint, numIs, samePoints } from './figure';
import { BOTH, FLOAT, asCircle, type CircleProperty } from './circle-properties';

export const GAP_PROPERTIES: readonly CircleProperty[] = [
  {
    tools: ['ninepoint_center'],
    name: 'ninepoint_center is the midpoint of OH and the centre of the nine-point circle',
    build: (b, [A, B, C]) => {
      b.call('N', 'ninepoint_center', A, B, C);
      b.call('M', 'midpoint', call('circumcenter', [A, B, C]), call('orthocenter', [A, B, C]));
      b.call('N_2', 'center', call('ninepoint_circle', [A, B, C]));
    },
    required: ['N'],
    check: (f) => samePoints(f, 'N', 'M') && samePoints(f, 'N', 'N_2'),
    fields: BOTH,
  },
  {
    tools: ['power'],
    name: 'power(P, circle(O, A)) = |PO|² − |OA|², zero at A and −|OA|² at O',
    build: (b, [A, B, C]) => {
      b.call('c', 'circle', A, B);
      b.call('p', 'power', C, b.ref('c'));
      b.call('p_B', 'power', B, b.ref('c'));
      b.call('p_A', 'power', A, b.ref('c'));
    },
    required: ['p'],
    check: (f) => {
      const { F } = f;
      const [A, B, C] = [asPoint(f.get('A')), asPoint(f.get('B')), asPoint(f.get('C'))];
      const d2 = (P: typeof A, Q: typeof A) => vDot(F, vSub(F, P, Q), vSub(F, P, Q));
      const expected = F.sub(d2(C, A), d2(B, A));
      return (
        F.isZero(F.sub(asNum(f.get('p')), expected), 'area', f.ctx) &&
        F.isZero(asNum(f.get('p_B')), 'area', f.ctx) &&
        F.isZero(F.add(asNum(f.get('p_A')), d2(B, A)), 'area', f.ctx)
      );
    },
    fields: BOTH,
  },
  {
    tools: ['radius'],
    name: 'radius(circle(O, r)) = r exactly',
    build: (b, [A]) => {
      b.call('r', 'radius', call('circle', [A, num('7/3')]));
    },
    required: ['r'],
    check: (f) => numIs(f, 'r', '7/3'),
    fields: BOTH,
  },
  {
    tools: ['radius'],
    name: 'radius(c)² = r² of c, and radius(diameter_circle(A, B)) = |AB| / 2',
    build: (b, [A, B, C]) => {
      b.call('c', 'circle', A, B, C);
      b.call('r', 'radius', b.ref('c'));
      b.call('h', 'radius', call('diameter_circle', [A, B]));
      b.call('d', 'dist', A, B);
    },
    required: ['r', 'h'],
    check: (f) => {
      const { F } = f;
      const [r, h, d] = [asNum(f.get('r')), asNum(f.get('h')), asNum(f.get('d'))];
      return (
        F.isZero(F.sub(F.mul(r, r), asCircle(f.get('c')).r2), 'area', f.ctx) &&
        F.isZero(F.sub(F.add(h, h), d), 'length', f.ctx)
      );
    },
    fields: FLOAT,
  },
];
