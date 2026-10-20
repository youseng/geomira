/**
 * Signature.radical (ADR-0008): an overload is flagged iff its VALUE needs a square root or
 * a trigonometric function. Checked both ways on random arguments of every capability:
 *   - an unflagged, non-branch overload never returns Inexact for a root or trigonometric
 *     reason, over Q or mod p (so a closure without flagged overloads is algebraic);
 *   - a flagged overload returns such an Inexact over Q on generic rational input.
 * Branch overloads with two candidates are excluded: their roots are avoided by other(P),
 * and packages/claims reads BranchShape for them.
 */
import type { Field } from '@geomira/num/field';
import { ModPField } from '@geomira/num/modp';
import { rational, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { Signature, ToolSpec } from '../src/tool';
import type { Capability, Value } from '../src/value';
import { REGISTRY } from './helpers/doc';

const DRAWS = 40;
const ROOT_OR_TRIG =
  /square roots are not evaluable|trigonometry is not evaluable|is not rational|not a rational number of degrees/;

function small(rng: Rng): Rational {
  return rational(BigInt(rng.nextInt(41) - 20), BigInt(rng.nextInt(7) + 1));
}

function nonzero(rng: Rng): Rational {
  for (;;) {
    const r = small(rng);
    if (r.num !== 0n) return r;
  }
}

function lift<T>(F: Field<T>, r: Rational): T {
  const v = F.fromRational(r);
  if (typeof v === 'object' && v !== null && 'kind' in v) throw new Error(v.reason);
  return v;
}

/** A random value of a capability; numbers carry no exact value unless `exact`. */
function draw<T>(F: Field<T>, cap: Capability, rng: Rng, exact: boolean): Value<T> {
  const n = () => lift(F, small(rng));
  const v = () => ({ x: n(), y: n() });
  switch (cap) {
    case 'point':
      return { kind: 'point', ...v() };
    case 'linear':
    case 'curve':
      return {
        kind: 'line',
        p: v(),
        d: { x: lift(F, nonzero(rng)), y: n() },
        lo: null,
        hi: null,
        chiral: false,
      };
    case 'round': {
      const c = v();
      const r = nonzero(rng);
      const r2 = lift(F, rational(r.num * r.num * 3n, r.den * r.den));
      return { kind: 'circle', c, r2, arc: null };
    }
    case 'number': {
      const r = small(rng);
      return exact
        ? { kind: 'number', v: lift(F, r), exact: r }
        : { kind: 'number', v: lift(F, r) };
    }
    case 'transform':
      return {
        kind: 'transform',
        t: {
          type: 'similarity',
          anti: rng.nextInt(2) === 1,
          a: { re: lift(F, nonzero(rng)), im: n() },
          b: { re: n(), im: n() },
        },
      };
    case 'polygon':
      return { kind: 'polygon', pts: [v(), v(), v()] };
    default:
      throw new Error(`unknown capability ${String(cap)}`);
  }
}

function args<T>(F: Field<T>, s: Signature, rng: Rng, exact: boolean): Value<T>[] {
  const caps = s.rest === undefined ? s.params : [...s.params, s.rest];
  return caps.map((c) => draw(F, c, rng, exact));
}

function reasons<T>(
  F: Field<T>,
  tool: ToolSpec,
  s: Signature,
  seed: number,
  exact: boolean,
): string[] {
  const rng = createRng(seed);
  const out: string[] = [];
  for (let i = 0; i < DRAWS; i++) {
    const r = tool.compute(F, args(F, s, rng, exact), { scale: 1 });
    if (r.kind === 'inexact') out.push(r.reason);
  }
  return out;
}

const OVERLOADS = REGISTRY.tools.flatMap((tool) =>
  tool.signatures
    .filter((s) => s.branch === undefined || s.branch.candidates === 1)
    .map((s, i) => ({ tool, s, label: `${tool.name}#${String(i)}(${s.params.join(', ')})` })),
);

describe('Signature.radical is sound', () => {
  for (const { tool, s, label } of OVERLOADS.filter((o) => o.s.radical !== true)) {
    it(`${label}: no root or trigonometric Inexact over Q or mod p`, () => {
      for (const exact of [false, true]) {
        const found = [
          ...reasons(RationalField, tool, s, 11, exact),
          ...reasons(ModPField, tool, s, 12, exact),
        ].filter((r) => ROOT_OR_TRIG.test(r));
        expect(found, label).toEqual([]);
      }
    });
  }
});

describe('Signature.radical is not set needlessly', () => {
  const flagged = OVERLOADS.filter((o) => o.s.radical === true);

  it('the flagged overloads are exactly the expected ones', () => {
    expect(flagged.map((o) => o.tool.name).sort()).toEqual(
      [
        ...['angle', 'bisector', 'cos', 'dangle', 'excenter', 'excircle', 'ext_bisector'],
        ...['incenter', 'incircle', 'on', 'radius', 'ratio', 'sin', 'sqrt', 'tan'],
        ...['dist', 'dist'],
        ...Array<string>(4).fill('rotate'),
      ].sort(),
    );
  });

  for (const { tool, s, label } of flagged) {
    it(`${label}: generic rational input needs a root or trigonometry`, () => {
      expect(
        reasons(RationalField, tool, s, 13, false).some((r) => ROOT_OR_TRIG.test(r)),
        label,
      ).toBe(true);
    });
  }
});
