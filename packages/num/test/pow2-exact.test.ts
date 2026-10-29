/**
 * Run 16c audit (the claims sampler near its time limit): tryToNumber's power of two comes from
 * a frozen table instead of a fresh DataView per call. The table must give 2^e exactly for every
 * exponent the conversion uses, subnormals included: each power of two 2^e (as a rational)
 * converts to the double whose bits are those of 2^e, and halving or doubling it is exact.
 */
import { describe, expect, it } from 'vitest';
import { rational, tryToNumber } from '../src/rational';

/** The double 2^e built from its bits (the reference, independent of the code under test). */
function bits(e: number): number {
  const view = new DataView(new ArrayBuffer(8));
  if (e >= -1022) view.setUint32(0, (e + 1023) * 2 ** 20);
  else view.setBigUint64(0, 1n << BigInt(e + 1074));
  return view.getFloat64(0);
}

describe('powers of two convert exactly at every exponent', () => {
  it('2^e for e in [-1074, 1023], and 3·2^e where it is a double', () => {
    for (let e = -1074; e <= 1023; e++) {
      const r = e >= 0 ? rational(1n << BigInt(e)) : rational(1n, 1n << BigInt(-e));
      expect(tryToNumber(r), String(e)).toBe(bits(e));
      if (e <= 1021) {
        const t = e >= 0 ? rational(3n << BigInt(e)) : rational(3n, 1n << BigInt(-e));
        expect(tryToNumber(t), `3·2^${String(e)}`).toBe(3 * bits(e));
      }
    }
  });
});
