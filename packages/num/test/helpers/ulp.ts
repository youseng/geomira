/** IEEE-754 neighbours of a finite double, for tests at and around thresholds. */

function bitsOf(x: number): bigint {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  return view.getBigInt64(0);
}

function fromBits(bits: bigint): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigInt64(0, bits);
  return view.getFloat64(0);
}

/** The smallest double greater than x (x finite). */
export function nextUp(x: number): number {
  if (x === 0) return Number.MIN_VALUE;
  const bits = bitsOf(x);
  return fromBits(x > 0 ? bits + 1n : bits - 1n);
}

/** The largest double smaller than x (x finite). */
export function nextDown(x: number): number {
  return -nextUp(-x);
}
