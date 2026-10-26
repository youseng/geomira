/**
 * Bug found by L3 in Run 14 (the inversion presets compose `power`): power(P, c) = |PO|² − r²
 * cancelled two quantities of size r² for a huge circle (cline of nearly collinear points,
 * radius ≈ 2·10⁷), so the float value was off by about 0.03 in −18177.79 (1.5·10⁻⁶ relative,
 * against L3's 10⁻⁹). Measured from the circle's anchor A (a point on it), the power is
 * |PA|² + 2·(P − A)·(A − O): no r², the same value exactly over Q and mod p.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { rational, tryToNumber } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, lit } from '../src/expr';
import { Builder, contextOf, evalDoc, valueOf } from './helpers/doc';

const p = (x: bigint, y: bigint, dx = 512n, dy = 512n) =>
  call('point', [lit(rational(x, dx)), lit(rational(y, dy))]);

function figure(): Builder {
  const b = new Builder();
  b.add('P', p(-4779n, 4515n));
  b.add(
    'k',
    call('cline', [p(-27819n, 59811n), p(-45n, -3261n, 128n, 256n), p(-525n, -957n, 128n, 256n)]),
  );
  b.add('w', call('power', [b.ref('P'), b.ref('k')]));
  return b;
}

describe('power(P, c) of a huge circle', () => {
  it('agrees with the exact value within 10⁻⁹ in floats', () => {
    const b = figure();
    const ctx = contextOf(b.doc);
    const f = valueOf(b.doc, evalDoc(b.doc, FloatField, ctx), 'w');
    const r = valueOf(b.doc, evalDoc(b.doc, RationalField, ctx), 'w');
    if (f.kind !== 'number' || r.kind !== 'number') throw new Error('not numbers');
    const exact = tryToNumber(r.v) ?? Number.NaN;
    expect(Math.abs(f.v - exact)).toBeLessThan(1e-9 * Math.abs(exact));
  });

  it('is the same exact value mod p as over Q (the anchor lies on the circle)', () => {
    const b = figure();
    const ctx = contextOf(b.doc);
    const r = valueOf(b.doc, evalDoc(b.doc, RationalField, ctx), 'w');
    const m = valueOf(b.doc, evalDoc(b.doc, ModPField, ctx), 'w');
    if (r.kind !== 'number' || m.kind !== 'number') throw new Error('not numbers');
    expect(m.v).toBe(ModPField.fromRational(r.v));
  });
});
