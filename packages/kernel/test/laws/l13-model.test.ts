/**
 * Kernel-level model-based fuzzing (Run 4, item 6; laws L1, L7, L13) with fast-check's
 * fc.commands: random sequences of every document edit (helpers/model-commands.ts),
 * applied through applyDocEdit. After EVERY command:
 *   L1  evaluate is total over FloatField, RationalField and ModPField, and no float
 *       value holds NaN or ±Infinity;
 *   L7  invariants I1–I8 hold;
 *   L13 the managed objects match the rules exactly (syncProblems is empty), and over Q
 *       every image's value is apply(T, X) of the current values (Undefined when T or X
 *       is: images are never stale).
 * ≥ 500 runs in CI (fixed seed); NIGHTLY=1 runs 20,000.
 */
import fc from 'fast-check';
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../../src/context';
import { emptyDocument, findLayer, type Document } from '../../src/document';
import { sourceOf, syncProblems } from '../../src/derived';
import { evaluate } from '../../src/evaluate';
import { assertInvariants } from '../../src/invariants';
import { applySimilarity } from '../../src/similarity';
import { numbersOf, undef, type Value } from '../../src/value';
import { REGISTRY } from '../helpers/doc';
import { lawCount } from '../helpers/laws';
import { commandArbs, type Model, type Real, type Stats } from '../helpers/model-commands';
import { sameValues } from '../helpers/similarity-gen';

const NIGHTLY = process.env.NIGHTLY === '1';
const RUNS = NIGHTLY ? 20_000 : lawCount(500);
const SEED = 20261020;
const FIELDS = [FloatField, RationalField, ModPField] as Field<unknown>[];

/** What an image must be: apply(T, X) of the current values, or why it is not defined. */
function expectedImage<T>(
  F: Field<T>,
  t: Value<T> | undefined,
  x: Value<T> | undefined,
  names: { t: string; x: string },
): Value<T> | undefined {
  if (t === undefined || x === undefined) return undefined;
  if (t.kind === 'undefined') return undef(`${names.t} is undefined`);
  if (t.kind === 'inexact') return t;
  if (x.kind === 'undefined') return undef(`${names.x} is undefined`);
  if (x.kind === 'inexact') return x;
  if (t.kind !== 'transform') return undefined;
  return applySimilarity(F, t.t, x);
}

function lawsHold(doc: Document): void {
  assertInvariants(doc);
  expect(syncProblems(doc, REGISTRY)).toEqual([]);
  const c = evalContextFor(doc);
  if (!c.ok) return;
  for (const F of FIELDS) {
    const ev = evaluate(doc, REGISTRY, F, c.ctx);
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      if (v === undefined) throw new Error(`no value for ${o.name}`);
      if (F.kind === 'float')
        expect(
          numbersOf(v).every((x) => Number.isFinite(F.toNumber(x))),
          o.name,
        ).toBe(true);
      if (o.managedBy === undefined || F.kind !== 'rational') continue;
      const rule = findLayer(doc, o.managedBy)?.rule;
      const src = sourceOf(o);
      const T =
        rule === undefined ? undefined : doc.objects.find((x) => x.id === rule.transform.id);
      const X = doc.objects.find((x) => x.id === src);
      if (T === undefined || X === undefined) throw new Error(`${o.name} has no map or source`);
      const want = expectedImage(F, ev.values.get(T.id), ev.values.get(X.id), {
        t: T.name,
        x: X.name,
      });
      // A map that is not a transform (a number) leaves the registry's rejection reason.
      if (want !== undefined) expect(sameValues(F, v, want), o.name).toBe(true);
    }
  }
}

function newStats(): Stats {
  return {
    tried: {},
    applied: {},
    chains: 0,
    maxObjects: 0,
    maxImages: 0,
    dragsThrough: 0,
    notDraggable: 0,
    dragsAtCursor: 0,
  };
}

describe(`model-based fuzzing of document edits (${String(RUNS)} runs, fc.commands)`, () => {
  it('L1, L7 and L13 hold after every command', { timeout: NIGHTLY ? 7_200_000 : 600_000 }, () => {
    const stats = newStats();
    fc.assert(
      fc.property(fc.commands(commandArbs(), { maxCommands: 40, size: 'max' }), (cmds) => {
        const setup = (): { model: Model; real: Real } => ({
          model: { steps: 0 },
          real: { doc: emptyDocument(), stats, check: lawsHold },
        });
        fc.modelRun(setup, cmds);
      }),
      { seed: SEED, numRuns: RUNS, endOnFailure: true },
    );
    process.stdout.write(
      `L13 model: ${String(RUNS)} runs (seed ${String(SEED)}); ${JSON.stringify(stats)}\n`,
    );
    const applied = (k: string) => stats.applied[k] ?? 0;
    for (const k of [
      'add',
      'remove',
      'rename',
      'redefine',
      'redefineT',
      'moveTLater',
      'move',
      'noimage',
      'setLayers',
      'addLayer',
      'updateLayer',
      'removeLayer',
      'addDerived',
      'updateRule',
      'removeRule',
      'view',
      'drag',
    ])
      expect(applied(k), k).toBeGreaterThan(0);
    expect(stats.chains).toBeGreaterThan(0);
    expect(stats.dragsThrough).toBeGreaterThan(0);
    expect(stats.notDraggable).toBeGreaterThan(0);
    expect(stats.dragsAtCursor).toBeGreaterThan(0);
  });
});
