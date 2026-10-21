/**
 * The mod-p rung (SPEC §10.5) draws every free input of the figure mod p from the
 * cryptographic source: the value of params (whose bounds stay) first, then point
 * coordinates, line-glider parameters and the (u : v) of circle gliders in construction order;
 * explicit radii are constants. A
 * scripted source fixes the values: each claim below is true for the scripted values only
 * and false in the figure itself, so an input that the rung did not redraw shows as FALSE.
 * (Run 10, note A: the claims mutation survivors of modpAssignments.)
 */
import { describe, expect, it } from 'vitest';
import type { EntropySource } from '@geomira/num/rng';
import { createRng } from '@geomira/num/rng';
import { prepare } from '../src/prepare';
import { decideSample, type SampleOutcome } from '../src/rungs';
import { c, Figure, n, REGISTRY } from './helpers/build';

/** A source that yields the given values mod p, two 32-bit words each (p has 61 bits). */
function scripted(values: readonly bigint[]): EntropySource & { readonly used: () => number } {
  const words = values.flatMap((v) => [Number(v >> 32n), Number(v & 0xffffffffn)]);
  let i = 0;
  return {
    nextUint32: () => {
      const w = words[i++];
      if (w === undefined) throw new Error('the rung drew more values than scripted');
      return w;
    },
    used: () => i / 2,
  };
}

/** The current figure decided with the exact-over-Q rung skipped (budget 1 bit). */
function modp(f: Figure, claim: number, values: readonly bigint[]): SampleOutcome {
  const p = prepare(f.doc, claim, REGISTRY);
  if (!p.ok) throw new Error(p.reason);
  const src = scripted(values);
  const o = decideSample(p.prepared, p.prepared.doc, {
    budgetBits: 1,
    entropy: src,
    rng: createRng(1),
    hypotheses: false,
  });
  expect(src.used(), 'every scripted value is drawn').toBe(values.length);
  return o;
}

const TRUE = { kind: 'true', rung: 'exact mod p' };

describe('the mod-p rung redraws every free input', () => {
  it('free points: both coordinates of each, in construction order', () => {
    const f = new Figure().point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
    const claim = f.claim('collinear', 'A', 'B', 'C');
    expect(modp(f, claim, [1n, 2n, 3n, 4n, 5n, 6n])).toEqual(TRUE);
    expect(modp(f, claim, [1n, 2n, 3n, 4n, 5n, 7n])).toMatchObject({
      kind: 'false',
      rung: 'exact mod p',
    });
  });

  it('a line glider: its parameter (after the points it is built on)', () => {
    const f = new Figure().point('A', 0, 0).point('B', 4, 0);
    f.add('P', c('on', c('line', 'A', 'B'), n('1/3')));
    const claim = f.claim('equal', 'P', 'B');
    expect(modp(f, claim, [5n, 6n, 7n, 9n, 1n])).toEqual(TRUE);
  });

  it('a circle glider: its (u : v); (1 : 0) is the anchor', () => {
    const f = new Figure().point('O', 0, 0).point('X', 3, 0).def('w', 'circle', 'O', 'X');
    f.add('P', c('on', 'w', n(2), n(1)));
    const claim = f.claim('equal', 'P', 'X');
    expect(modp(f, claim, [5n, 6n, 7n, 9n, 1n, 0n])).toEqual(TRUE);
  });

  it('a param: its value (its bounds stay), drawn before the other inputs', () => {
    const f = new Figure().point('A', 0, 0).point('B', 4, 0);
    f.add('k', c('param', n(0), n(1), n('1/2'))).def('M', 'divide', 'A', 'B', 'k');
    const claim = f.claim('equal', 'M', 'A');
    expect(modp(f, claim, [0n, 5n, 6n, 7n, 9n])).toEqual(TRUE);
    expect(modp(f, claim, [1n, 5n, 6n, 7n, 9n])).toMatchObject({ kind: 'false' });
  });

  it('an explicit radius is a constant: nothing is drawn for it', () => {
    const f = new Figure().point('O', 0, 0).def('w', 'circle', 'O', n(5)).point('A', 3, 4);
    const claim = f.claim('on', 'A', 'w');
    // Two points (four values); the radius 5 takes none and stays: |OA|² = 9 + 16.
    expect(modp(f, claim, [1n, 2n, 4n, 6n])).toEqual(TRUE);
    expect(modp(f, claim, [1n, 2n, 4n, 7n])).toMatchObject({ kind: 'false' });
  });
});
