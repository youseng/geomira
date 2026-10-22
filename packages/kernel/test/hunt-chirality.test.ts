/**
 * Run 10 audit, hunt item "chirality flag wrong for some construction (compare with mirrored
 * figures)" (SPEC §4): every line-producing construction against the same construction in
 * the mirrored figure (M: x ↦ −x). The mirrored direction must be s·M(d), with s = +1 on an
 * achiral line and −1 on a chiral one, and the flag must be the same in both figures.
 *
 * Not listed: rotate(line, O, θ) with a literal θ ≠ 180°. Rotation by a fixed angle does not
 * commute with mirroring, so no flag can describe its image; the image keeps its input's flag
 * (SPEC §4). The audit report (docs/audit/2026-10-22.md, K3) proposes an ADR for it.
 */
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import { Builder, evalDoc, num, valueOf } from './helpers/doc';

type P2 = readonly [number, number];
const PTS: Record<string, P2> = {
  A: [1.3, 0.2],
  B: [4.1, 1.7],
  C: [2.2, 5.3],
  O: [0.4, -0.9],
  Q: [7.5, 3.1],
  E: [12.1, -4.3],
};

function build(mirror: boolean): { b: Builder; names: string[] } {
  const b = new Builder();
  const P = (n: string): Expr => b.ref(n);
  for (const [n, [x, y]] of Object.entries(PTS)) b.point(n, mirror ? -x : x, y);
  // A straight angle at B: S2 = 2B − A.
  const [ax, ay] = PTS.A as P2;
  const [bx, by] = PTS.B as P2;
  b.point('S2', mirror ? -(2 * bx - ax) : 2 * bx - ax, 2 * by - ay);
  const c = b.call('c', 'circle', P('O'), P('A'));
  const c2 = b.call('c2', 'circle', P('Q'), P('B'));
  const lAB = b.call('lAB', 'line', P('A'), P('B'));
  const pb = b.call('pb', 'perp_bisector', P('A'), P('C'));
  const near: Selector = { kind: 'near', p: P('C') };
  const defs: Record<string, Expr> = {
    line: call('line', [P('A'), P('B')]),
    segment: call('segment', [P('A'), P('B')]),
    ray: call('ray', [P('A'), P('B')]),
    parallel_achiral: call('parallel', [P('C'), lAB]),
    parallel_chiral: call('parallel', [P('C'), pb]),
    perp_achiral: call('perp', [P('C'), lAB]),
    perp_chiral: call('perp', [P('C'), pb]),
    perp_bisector: call('perp_bisector', [P('A'), P('C')]),
    bisector: call('bisector', [P('A'), P('B'), P('C')]),
    bisector_straight: call('bisector', [P('A'), P('B'), P('S2')]),
    ext_bisector: call('ext_bisector', [P('A'), P('B'), P('C')]),
    ext_bisector_straight: call('ext_bisector', [P('A'), P('B'), P('S2')]),
    tangent: call('tangent', [P('A'), c]),
    tangent_from: call('tangent_from', [P('E'), c], [near]),
    polar: call('polar', [P('E'), c]),
    radical_axis: call('radical_axis', [c, c2]),
    cline_line: call('cline', [P('A'), P('B'), P('S2')]),
    reflect_line_img: call('reflect', [lAB, call('line', [P('O'), P('Q')])]),
    reflect_pb_img: call('reflect', [pb, call('line', [P('O'), P('Q')])]),
    reflect_pt_img: call('reflect', [lAB, P('O')]),
    homothety_img: call('homothety', [pb, P('O'), num(-2)]),
    translate_img: call('translate', [lAB, P('O'), P('Q')]),
    spiral_img: call('spiral', [lAB, P('O'), P('Q'), P('C'), P('E')]),
    rotate180_img: call('rotate', [lAB, P('O'), num(180)]),
    apply_compose: call('apply', [
      call('compose', [
        call('reflect', [call('line', [P('O'), P('Q')])]),
        call('spiral', [P('O'), P('Q'), P('C'), P('E')]),
      ]),
      pb,
    ]),
    apply_inverse_anti: call('apply', [
      call('inverse', [
        call('compose', [call('reflect', [pb]), call('homothety', [P('C'), num(3)])]),
      ]),
      lAB,
    ]),
  };
  const names: string[] = [];
  for (const [n, d] of Object.entries(defs)) {
    b.add(n, d);
    names.push(n);
  }
  return { b, names };
}

describe('the chirality flag of every line construction against the mirrored figure', () => {
  const orig = build(false);
  const mirr = build(true);
  const eo = evalDoc(orig.b.doc, FloatField);
  const em = evalDoc(mirr.b.doc, FloatField);
  for (const n of orig.names) {
    it(n, () => {
      const vo = valueOf(orig.b.doc, eo, n);
      const vm = valueOf(mirr.b.doc, em, n);
      if (vo.kind !== 'line' || vm.kind !== 'line') throw new Error(`${n}: ${JSON.stringify(vo)}`);
      expect(vm.chiral).toBe(vo.chiral);
      const s = vo.chiral ? -1 : 1;
      const want = [s * -vo.d.x, s * vo.d.y];
      const k = Math.hypot(vo.d.x, vo.d.y);
      expect(Math.abs(vm.d.x - (want[0] ?? 0)) / k).toBeLessThan(1e-9);
      expect(Math.abs(vm.d.y - (want[1] ?? 0)) / k).toBeLessThan(1e-9);
    });
  }
});
