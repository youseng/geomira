import { describe, expect, it } from 'vitest';
import { rational } from '@geomira/num/rational';
import { exprEquals, lit } from '../src/expr';

describe('literals keep their written form (ADR-0009)', () => {
  it('stores text only when it differs from the canonical form', () => {
    expect(lit(rational(1n, 2n))).toEqual({ kind: 'lit', value: rational(1n, 2n) });
    expect(lit(rational(1n, 2n), '1/2')).toEqual({ kind: 'lit', value: rational(1n, 2n) });
    expect(lit(rational(1n, 2n), '0.5')).toEqual({
      kind: 'lit',
      value: rational(1n, 2n),
      text: '0.5',
    });
    expect('text' in lit(rational(3n), '3')).toBe(false);
  });

  it('the written form is presentation only: equality reads the value', () => {
    expect(exprEquals(lit(rational(1n, 2n), '0.5'), lit(rational(1n, 2n)))).toBe(true);
    expect(exprEquals(lit(rational(1n, 2n), '0.5'), lit(rational(1n, 3n), '0.5'))).toBe(false);
  });
});
