import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { checkInvariants } from '@geomira/kernel/invariants';
import { syncProblems } from '@geomira/kernel/derived';
import { numbersOf, type Value } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import type { Document } from '@geomira/kernel/document';
import { parse } from '../../src/parse';
import { parseInto } from '../../src/parse-into';
import { print } from '../../src/print';
import { docArb } from '../helpers/gen-doc';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';
import { editsArb, mutate, soupArb } from '../helpers/mutate';

/** Parsing, printing and parseInto never throw; every result is a valid, synced document. */
function total(text: string, old: Document): void {
  const r = parse(text, registry);
  expect(checkInvariants(r.doc)).toEqual([]);
  expect(syncProblems(r.doc, registry)).toEqual([]);
  for (const d of r.diagnostics) {
    expect(d.line).toBeGreaterThanOrEqual(1);
    expect(d.column).toBeGreaterThanOrEqual(1);
    expect(d.endColumn).toBeGreaterThan(d.column);
    expect(d.hint.length).toBeGreaterThan(0);
  }
  expect(typeof print(r.doc)).toBe('string');
  expect(checkInvariants(parseInto(old, text, registry).doc)).toEqual([]);
}

/** L1 on a document: evaluation in three fields never throws and holds no NaN or ±Infinity. */
function l1(doc: Document): number {
  const ctx = evalContextFor(doc);
  if (!ctx.ok) return 0;
  let n = 0;
  const check = (v: Value<number>): void => {
    for (const x of numbersOf(v)) expect(Number.isFinite(x)).toBe(true);
  };
  for (const v of evaluate(doc, registry, FloatField, ctx.ctx).values.values()) {
    check(v);
    n += 1;
  }
  evaluate(doc, registry, RationalField, ctx.ctx);
  evaluate(doc, registry, ModPField, ctx.ctx);
  return n;
}

describe('totality (note C): garbage never throws', () => {
  it(
    'token soups, arbitrary strings and mutated files',
    () => {
      let n = 0;
      const old = parse('@version 1\nA = (0, 0)\nk = 1', registry).doc;
      fc.assert(
        fc.property(soupArb, (t) => {
          total(t, old);
        }),
        { numRuns: runs(1500), seed: 11 },
      );
      n += runs(1500);
      fc.assert(
        fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (t) => {
          total(t, old);
        }),
        { numRuns: runs(1000), seed: 12 },
      );
      n += runs(1000);
      fc.assert(
        fc.property(docArb(registry), editsArb, (doc, edits) => {
          total(mutate(print(doc), edits), doc);
        }),
        { numRuns: runs(300), seed: 13 },
      );
      n += runs(300);
      console.warn(`garbage fuzz: ${String(n)} texts`);
    },
    LAW_TIMEOUT,
  );

  it(
    'evaluation of parsed documents stays total (L1 in Float, Rational and ModP)',
    () => {
      let values = 0;
      fc.assert(
        fc.property(docArb(registry), editsArb, (doc, edits) => {
          values += l1(parse(print(doc), registry).doc);
          values += l1(parse(mutate(print(doc), edits), registry).doc);
        }),
        { numRuns: runs(150), seed: 14 },
      );
      console.warn(`L1 on parsed documents: ${String(values)} float values checked`);
      expect(values).toBeGreaterThan(0);
    },
    LAW_TIMEOUT,
  );
});
