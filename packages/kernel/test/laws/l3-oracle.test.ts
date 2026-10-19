/**
 * Law L3 (SPEC §17): the exact oracle. For every tool, on random rational inputs, the
 * FloatField result agrees with the RationalField result wherever the exact run succeeds
 * (same kind, same Undefined reason, numbers within a relative 1e-9), EXCLUDING inputs
 * within BAND of a degeneracy: a sample is excluded when any zero test or sign decision
 * of the float run sees a quantity below BAND·scale^k (helpers/laws.ts bandWatch).
 * Also a differential check of ModPField: where the exact run is defined and the mod-p
 * run is not Inexact, the mod-p result is the reduction of the exact one.
 */
import { FloatField } from '@geomira/num/float-field';
import { isInexact } from '@geomira/num/field';
import { ModPField } from '@geomira/num/modp';
import { add, mul, rational, tryToNumber, type Rational } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/evaluate';
import { call, lit, type Expr } from '../../src/expr';
import type { Signature, ToolSpec } from '../../src/tool';
import { capabilityKinds, numbersOf, type Value } from '../../src/value';
import { Builder, REGISTRY, contextOf } from '../helpers/doc';
import { LAW_TIMEOUT, bandWatch, lawCount } from '../helpers/laws';

const SAMPLES = lawCount(2400);
const MIN_DEFINED = lawCount(50);
const SEED = 3;
const TOLERANCE = 1e-9;

/** Axis, diagonal and Pythagorean directions: exact lengths and special angles. */
const AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const PYTHAGOREAN: readonly (readonly [number, number])[] = [
  [3, 4],
  [4, -3],
  [-5, 12],
  [12, 5],
  [8, -15],
  [-7, -24],
];

type Mode = 'random' | 'hub' | 'pairs';

class Sampler {
  readonly b = new Builder();
  private n = 0;
  private readonly hub: readonly [Rational, Rational];
  private readonly hubIndex: number;
  private readonly dirs: readonly (readonly [number, number])[];
  private last: readonly [Rational, Rational] | undefined;

  constructor(
    private readonly rng: Rng,
    readonly mode: Mode,
  ) {
    this.hub = [this.coordinate(), this.coordinate()];
    this.hubIndex = rng.nextInt(3);
    this.dirs = rng.nextFloat() < 0.5 ? AXES : PYTHAGOREAN;
  }

  private coordinate(): Rational {
    return rational(BigInt(this.rng.nextInt(16385) - 8192), 512n);
  }

  private step(from: readonly [Rational, Rational]): readonly [Rational, Rational] {
    const v = this.dirs[this.rng.nextInt(this.dirs.length)] ?? [1, 0];
    const k = rational(BigInt(this.rng.nextInt(15) + 1), BigInt(this.rng.nextInt(4) + 1));
    return [
      add(from[0], mul(k, rational(BigInt(v[0])))),
      add(from[1], mul(k, rational(BigInt(v[1])))),
    ];
  }

  /** A new free point: random, or a nice offset from the hub / from the previous point. */
  point(): Expr {
    const i = this.n;
    this.n += 1;
    let xy: readonly [Rational, Rational] = [this.coordinate(), this.coordinate()];
    if (this.mode === 'hub') xy = i === this.hubIndex ? this.hub : this.step(this.hub);
    if (this.mode === 'pairs' && i % 2 === 1 && this.last !== undefined) xy = this.step(this.last);
    this.last = xy;
    return this.b.add(`P${String(i)}`, call('point', [lit(xy[0]), lit(xy[1])]));
  }

  linear(): Expr {
    const kind =
      ['line', 'segment', 'ray', 'parallel', 'perp', 'perp_bisector'][this.rng.nextInt(6)] ??
      'line';
    const [p, q] = [this.point(), this.point()];
    if (kind === 'parallel' || kind === 'perp') {
      return this.b.add(`l${String(this.n)}`, call(kind, [this.point(), call('line', [p, q])]));
    }
    return this.b.add(`l${String(this.n)}`, call(kind, [p, q]));
  }

  number(): Expr {
    return lit(rational(BigInt(this.rng.nextInt(41) - 20), BigInt(this.rng.nextInt(8) + 1)));
  }

  arg(cap: Signature['params'][number]): Expr {
    const kinds = capabilityKinds(cap);
    if (kinds.includes('point')) return this.point();
    if (kinds.includes('line')) return this.linear();
    if (kinds.includes('number')) return this.number();
    const pts = [
      this.point(),
      this.point(),
      this.point(),
      ...(this.rng.nextFloat() < 0.5 ? [this.point()] : []),
    ];
    return this.b.add(`g${String(this.n)}`, call('polygon', pts));
  }
}

interface Tally {
  defined: number;
  undefinedAgree: number;
  inexact: number;
  excluded: number;
  modp: number;
}

/** Why a float value differs from the exact one, or undefined when they agree. */
function disagreement(f: Value<number>, r: Value<Rational>, scale: number): string | undefined {
  if (f.kind !== r.kind) return `kinds ${f.kind} vs ${r.kind}`;
  if (f.kind === 'undefined' && r.kind === 'undefined' && f.reason !== r.reason)
    return `reasons "${f.reason}" vs "${r.reason}"`;
  if (
    f.kind === 'line' &&
    r.kind === 'line' &&
    (f.chiral !== r.chiral ||
      (f.lo === null) !== (r.lo === null) ||
      (f.hi === null) !== (r.hi === null))
  ) {
    return 'line flags or ranges differ';
  }
  if (
    f.kind === 'number' &&
    r.kind === 'number' &&
    JSON.stringify(f.exact, big) !== JSON.stringify(r.exact, big)
  )
    return 'exact values differ';
  const [fs, rs] = [numbersOf(f), numbersOf(r)];
  if (fs.length !== rs.length) return 'shapes differ';
  for (const [i, x] of fs.entries()) {
    const e = rs[i] === undefined ? undefined : tryToNumber(rs[i]);
    if (e === undefined || !(Math.abs(x - e) <= TOLERANCE * Math.max(1, Math.abs(e), scale))) {
      return `component ${String(i)}: ${String(x)} vs ${String(e)}`;
    }
  }
  return undefined;
}

function big(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v;
}

/** The mod-p reduction check; returns whether a comparison was made. */
function modpAgrees(m: Value<bigint>, r: Value<Rational>): boolean {
  if (m.kind === 'inexact' || r.kind === 'inexact' || r.kind === 'undefined') return false;
  expect(m.kind).toBe(r.kind);
  const [ms, rs] = [numbersOf(m), numbersOf(r)];
  expect(ms.length).toBe(rs.length);
  for (const [i, x] of rs.entries()) {
    const red = ModPField.fromRational(x);
    if (!isInexact(red)) expect(ms[i]).toBe(red);
  }
  return true;
}

function sampleTool(tool: ToolSpec, t: number, tally: Tally): void {
  const watch = bandWatch(FloatField);
  for (let k = 0; k < SAMPLES; k += 1) {
    const rng = createRng(deriveSeed(SEED, t * 1_000_000 + k));
    const s = new Sampler(rng, (['random', 'hub', 'hub', 'pairs'] as const)[k % 4] ?? 'random');
    const sig = tool.signatures[rng.nextInt(tool.signatures.length)];
    if (sig === undefined) continue;
    const caps = [...sig.params, ...(sig.rest === undefined ? [] : [sig.rest])];
    const x = s.b.add(
      'x',
      call(
        tool.name,
        caps.map((c) => s.arg(c)),
      ),
    );
    const ctx = contextOf(s.b.doc);
    watch.reset();
    const fv = evaluate(s.b.doc, REGISTRY, watch.field, ctx).values.get(x.id);
    const rv = evaluate(s.b.doc, REGISTRY, RationalField, ctx).values.get(x.id);
    const mv = evaluate(s.b.doc, REGISTRY, ModPField, ctx).values.get(x.id);
    if (fv === undefined || rv === undefined || mv === undefined) throw new Error('missing value');
    if (modpAgrees(mv, rv)) tally.modp += 1;
    if (rv.kind === 'inexact') tally.inexact += 1;
    else if (watch.touched()) tally.excluded += 1;
    else {
      expect(disagreement(fv, rv, ctx.scale), `${tool.name} sample ${String(k)}`).toBeUndefined();
      if (rv.kind === 'undefined') tally.undefinedAgree += 1;
      else tally.defined += 1;
    }
  }
}

describe(
  `L3: FloatField agrees with the exact RationalField oracle (${String(SAMPLES)} samples per tool)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const [t, tool] of REGISTRY.tools.entries()) {
      it(tool.name, () => {
        const tally: Tally = { defined: 0, undefinedAgree: 0, inexact: 0, excluded: 0, modp: 0 };
        sampleTool(tool, t, tally);
        process.stdout.write(
          `L3 ${tool.name}: ${String(tally.defined)} defined + ${String(tally.undefinedAgree)} Undefined agree, ` +
            `${String(tally.inexact)} not exact, ${String(tally.excluded)} excluded (band); mod p ${String(tally.modp)}\n`,
        );
        expect(tally.defined).toBeGreaterThanOrEqual(MIN_DEFINED);
      });
    }
  },
);
