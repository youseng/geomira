/**
 * Law L1 for sqrt, sin, cos and tan (SPEC §17; ADR-0005): evaluate never throws and no Value
 * holds NaN or ±Infinity, over ≥ 2,000 documents built to hit their degeneracies exactly
 * and nearly (helpers/fuzz-functions.ts), in FloatField, RationalField and ModPField. num
 * throws on √ of a negative and on division by 0, so a missed classification shows up here.
 * In FloatField the classification itself is checked call by call against the argument:
 *   - sqrt: an exact argument is decided exactly; otherwise x > 0 → √x (also inside the
 *     band), −BAND < x ≤ 0 → 0, x ≤ −BAND → Undefined;
 *   - tan: Undefined at 90° (mod 180°) exactly when |cos θ| < BAND in FloatField.
 * The in-band negatives and positives, the negatives and the near-90° values must all be
 * reached.
 */
import { isInexact, type Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { sign } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { BAND } from '@geomira/num/tolerance';
import { describe, expect, it } from 'vitest';
import { evaluate, type Evaluation } from '../../src/evaluate';
import { assertInvariants } from '../../src/invariants';
import { FLOAT_ARG_LIMIT } from '../../src/limits';
import { numbersOf, type Num, type Value } from '../../src/value';
import { contextOf, REGISTRY } from '../helpers/doc';
import { fuzzFunctionDocument, type FunctionCall } from '../helpers/fuzz-functions';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(2000);
const SEED = 20261021;
const NEGATIVE = 'sqrt of a negative number';
const RIGHT = 'tan is undefined at 90° (mod 180°)';

interface Tally {
  objects: number;
  calls: number;
  undefined: number;
  inexact: number;
  negative: number;
  right: number;
  /** FloatField: sqrt of a negative measured number inside the band, counted as 0. */
  bandZero: number;
  /** FloatField: sqrt of a positive measured number inside the band: its root. */
  bandRoot: number;
  /** FloatField: tan defined although |cos θ| < 1e-3 (just outside the band). */
  nearRight: number;
}

function tally0(): Tally {
  return {
    objects: 0,
    calls: 0,
    undefined: 0,
    inexact: 0,
    negative: 0,
    right: 0,
    bandZero: 0,
    bandRoot: 0,
    nearRight: 0,
  };
}

/**
 * Whether the argument is a number that `evaluate` passes to the tool: FloatField
 * arguments beyond FLOAT_ARG_LIMIT give Inexact before any tool runs (ADR-0003 item 19).
 */
function passed(x: Value<number>, y: Value<number>): x is Num<number> {
  if (x.kind !== 'number') return false;
  if (Math.abs(x.v) <= FLOAT_ARG_LIMIT) return true;
  expect(y.kind).toBe('inexact');
  return false;
}

/** The FloatField classification of one sqrt call (see the module comment). */
function checkSqrt(x: Value<number>, y: Value<number>, t: Tally): void {
  if (!passed(x, y)) return;
  if (x.exact !== undefined) {
    expect(y.kind === 'undefined', 'exact sign decides').toBe(sign(x.exact) < 0);
    return;
  }
  if (x.v > 0) {
    expect(y).toEqual({ kind: 'number', v: Math.sqrt(x.v) });
    if (x.v < BAND) t.bandRoot += 1;
  } else if (x.v > -BAND) {
    expect(y).toEqual({ kind: 'number', v: 0 });
    if (x.v < 0) t.bandZero += 1;
  } else expect(y).toEqual({ kind: 'undefined', reason: NEGATIVE });
}

/** The FloatField classification of one tan call. */
function checkTan(x: Value<number>, y: Value<number>, t: Tally): void {
  if (!passed(x, y)) return;
  const cos = FloatField.cos(x.v);
  if (isInexact(cos)) throw new Error(cos.reason);
  const c = Math.abs(cos);
  expect(y.kind === 'undefined' && y.reason === RIGHT, `tan(${String(x.v)})`).toBe(c < BAND);
  if (c >= BAND && c < 1e-3 && y.kind === 'number') t.nearRight += 1;
}

function checkCalls(ev: Evaluation<number>, calls: readonly FunctionCall[], t: Tally): void {
  for (const c of calls) {
    const [x, y] = [ev.values.get(c.argId), ev.values.get(c.id)];
    if (x === undefined || y === undefined) throw new Error('missing value');
    if (c.tool === 'sqrt') checkSqrt(x, y, t);
    if (c.tool === 'tan') checkTan(x, y, t);
  }
}

/** Runs the documents over F; `inspect` sees each evaluation with its function calls. */
function check<T>(
  F: Field<T>,
  finite: (x: T) => boolean,
  t: Tally = tally0(),
  inspect?: (ev: Evaluation<T>, calls: readonly FunctionCall[]) => void,
): Tally {
  for (let i = 0; i < DOCS; i += 1) {
    const { doc, calls } = fuzzFunctionDocument(createRng(deriveSeed(SEED, i)), 24);
    assertInvariants(doc);
    const ev = evaluate(doc, REGISTRY, F, contextOf(doc));
    t.calls += calls.length;
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      expect(v, `${F.name} doc ${String(i)} ${o.name}`).toBeDefined();
      if (v === undefined) continue;
      t.objects += 1;
      if (v.kind === 'undefined' || v.kind === 'inexact') {
        expect(v.reason.length).toBeGreaterThan(0);
        t[v.kind] += 1;
        if (v.reason === NEGATIVE) t.negative += 1;
        if (v.reason === RIGHT) t.right += 1;
      }
      expect(
        numbersOf(v).filter((x) => !finite(x)),
        `${F.name} doc ${String(i)} ${o.name}`,
      ).toEqual([]);
    }
    inspect?.(ev, calls);
  }
  process.stdout.write(
    `L1 functions ${F.name}: ${String(DOCS)} documents, ${String(t.objects)} objects, ` +
      `${String(t.calls)} sqrt/sin/cos/tan calls, ${String(t.undefined)} Undefined, ` +
      `${String(t.inexact)} Inexact, 0 throws, 0 non-finite; reached: negative ${String(t.negative)}, ` +
      `90° ${String(t.right)}, in-band negatives → 0 ${String(t.bandZero)}, in-band positives → √x ${String(t.bandRoot)}, near 90° defined ${String(t.nearRight)}\n`,
  );
  return t;
}

describe(
  `L1 (sqrt, sin, cos, tan): evaluate is total over ${String(DOCS)} fuzzed documents`,
  { timeout: LAW_TIMEOUT },
  () => {
    it('FloatField: never throws, every number finite, the band rules hold call by call', () => {
      const t = tally0();
      check(
        FloatField,
        (x) => Number.isFinite(x),
        t,
        (ev, calls) => {
          checkCalls(ev, calls, t);
        },
      );
      for (const k of ['negative', 'right', 'bandZero', 'bandRoot', 'nearRight'] as const)
        expect(t[k], k).toBeGreaterThan(0);
    });
    it('RationalField: never throws', () => {
      const t = check(RationalField, () => true);
      expect(t.inexact).toBeGreaterThan(0);
      expect(t.negative).toBeGreaterThan(0);
      expect(t.right).toBeGreaterThan(0);
    });
    it('ModPField: never throws', () => {
      const t = check(ModPField, () => true);
      expect(t.inexact).toBeGreaterThan(0);
      expect(t.negative).toBeGreaterThan(0);
      expect(t.right).toBeGreaterThan(0);
    });
  },
);
