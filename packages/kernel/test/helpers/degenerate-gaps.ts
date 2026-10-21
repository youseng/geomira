/**
 * Degenerate cases of the SPEC §6.2 tools that Runs 2 and 3a did not register (found by the
 * Run 3b audit of the registry against SPEC §6.2): ninepoint_center, power, radius. Spread
 * into degenerate.test.ts's table, whose meta-test checks the names against the registry.
 */
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { expect } from 'vitest';
import { call } from '../../src/expr';
import { A, B, C, FIELDS, ORDERED, at, plain, reason } from './degenerate';
import { C5, O0, circ } from './degenerate-circles';
import { num, pt } from './doc';

export const GAP_CASES: Record<string, Record<string, () => void>> = {
  ninepoint_center: {
    'coincident vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'ninepoint_center', A, B, A))).toBe(
          'undefined: coincident points: ninepoint_center needs three distinct vertices',
        );
    },
    'collinear vertices → Undefined': () => {
      for (const F of FIELDS)
        expect(reason(at(F, 'ninepoint_center', A, B, pt(7, 10)))).toBe(
          'undefined: collinear points: ninepoint_center needs a non-degenerate triangle',
        );
      expect(at(FloatField, 'ninepoint_center', A, B, pt(7, 10 + 1e-12)).kind).toBe('undefined');
      expect(at(RationalField, 'ninepoint_center', A, B, pt(7, 10 + 1e-12)).kind).toBe('point');
    },
  },
  power: {
    'P on c → 0': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'power', pt(3, 4), C5))).toBe(0);
        expect(plain(F, at(F, 'power', pt(-5, 0), C5))).toBe(0);
      }
      expect(at(ModPField, 'power', pt(3, -4), C5)).toEqual({ kind: 'number', v: 0n });
    },
    'P = the center → −r²': () => {
      for (const F of ORDERED) {
        expect(plain(F, at(F, 'power', O0, C5))).toBe(-25);
        expect(plain(F, at(F, 'power', C, circ(C, num('3/2'))))).toBe(-9 / 4);
      }
    },
  },
  radius: {
    'r² not the square of a rational → Inexact over Q (always Inexact mod p)': () => {
      const c = circ(O0, pt(1, 1));
      expect(reason(at(RationalField, 'radius', c))).toBe('inexact: √(2) is not rational');
      expect(plain(FloatField, at(FloatField, 'radius', c))).toBe(Math.SQRT2);
      for (const F of ORDERED) expect(plain(F, at(F, 'radius', C5))).toBe(5);
      expect(plain(RationalField, at(RationalField, 'radius', circ(A, num('7/3'))))).toBe(7 / 3);
      expect(at(ModPField, 'radius', C5).kind).toBe('inexact');
      expect(at(ModPField, 'radius', call('circle', [A, B])).kind).toBe('inexact');
    },
  },
};
