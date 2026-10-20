/**
 * Law L1 for the transformations and derived layers (Run 4, note B on ADR-0002): fuzzed
 * documents (helpers/fuzz.ts, degenerate mode: every registry tool, the maps included)
 * plus injected DEGENERATE maps — reflection in a degenerate line, homothety with k = 0
 * and k = 1e-12, rotation about an Undefined centre, spirals with coincident points,
 * compositions that collapse — their images and inverses, and a derived layer of the
 * whole document under one of them (applyDocEdit). Evaluated over Float, Rational and
 * ModP: evaluate never throws, no float value holds NaN or ±Infinity, and every listed
 * degenerate situation is reached.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '../../src/context';
import type { Document } from '../../src/document';
import { applyDocEdit } from '../../src/doc-edit';
import { evaluate } from '../../src/evaluate';
import { call, ref, type Expr } from '../../src/expr';
import { assertInvariants } from '../../src/invariants';
import { numbersOf } from '../../src/value';
import { REGISTRY, num } from '../helpers/doc';
import { fuzzDocument } from '../helpers/fuzz';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const DOCS = lawCount(1500);
const SEED = 20261021;

const REASONS = [
  'homothety: the ratio k is 0',
  'coincident points: line(A, B)',
  'is undefined',
  'the map collapses the plane',
  'spiral(A, B, C, D) needs',
  'apply does not accept',
];

function pick<X>(rng: Rng, xs: readonly X[]): X {
  const x = xs[rng.nextInt(xs.length)];
  if (x === undefined) throw new Error('empty');
  return x;
}

/** Adds degenerate and ordinary maps, images, inverses and a derived layer. */
function withMaps(rng: Rng, doc: Document): Document {
  let d = doc;
  const add = (def: Expr): number | undefined => {
    const r = applyDocEdit(d, REGISTRY, {
      kind: 'add',
      object: { name: `m${String(d.nextId)}`, def },
    });
    if (!r.ok) return undefined;
    d = r.doc;
    return r.id;
  };
  const points = () =>
    d.objects.filter((o) => o.def.kind === 'call' && o.def.tool === 'point').map((o) => ref(o.id));
  const P = () => pick(rng, points());
  const maps: number[] = [];
  for (let k = 0; k < 4; k += 1) {
    const [A, B, C] = [P(), P(), P()];
    const undefinedCentre = call('intersect', [
      call('line', [A, B]),
      call('parallel', [C, call('line', [A, B])]),
    ]);
    const def = pick(rng, [
      call('reflect', [call('line', [A, A])]),
      call('homothety', [A, num(pick(rng, [0, 1e-12, 2, -1]))]),
      call('rotate', [undefinedCentre, num(90)]),
      call('rotate', [A, num(pick(rng, [90, 60, 0]))]),
      call('spiral', [A, B, C, pick(rng, [C, P()])]),
      call('reflect', [call('line', [A, B])]),
      call('translate', [A, B]),
    ]);
    const id = add(def);
    if (id !== undefined) maps.push(id);
  }
  const T = () => ref(pick(rng, maps));
  if (maps.length > 0) {
    add(call('compose', [T(), call('homothety', [P(), num('1/100000')])]));
    add(call('compose', [call('homothety', [P(), num('1/100000')]), T()]));
    add(call('inverse', [T()]));
    for (const o of d.objects.slice(0, 6)) add(call('apply', [T(), ref(o.id)]));
    const r = applyDocEdit(d, REGISTRY, {
      kind: 'addDerivedLayer',
      spec: { name: 'img', transform: pick(rng, maps), source: 'main' },
    });
    if (r.ok) d = r.doc;
  }
  return assertInvariants(d);
}

function run<T>(F: Field<T>, reached: Record<string, number>): { objects: number; images: number } {
  let [objects, images] = [0, 0];
  for (let i = 0; i < DOCS; i += 1) {
    const rng = createRng(deriveSeed(SEED, i));
    const doc = withMaps(
      rng,
      fuzzDocument(rng, REGISTRY, { points: 4, calls: 12, degenerate: true, maxDepth: 3 }),
    );
    const c = evalContextFor(doc);
    if (!c.ok) continue;
    const ev = evaluate(doc, REGISTRY, F, c.ctx);
    for (const o of doc.objects) {
      const v = ev.values.get(o.id);
      if (v === undefined) throw new Error(`no value for ${o.name}`);
      objects += 1;
      if (o.managedBy !== undefined) images += 1;
      if (v.kind === 'undefined')
        for (const r of REASONS) if (v.reason.includes(r)) reached[r] = (reached[r] ?? 0) + 1;
      if (F.kind !== 'float') continue;
      const bad = numbersOf(v).filter((x) => !Number.isFinite(F.toNumber(x)));
      expect(bad, `${F.name} doc ${String(i)} ${o.name}`).toEqual([]);
    }
  }
  return { objects, images };
}

describe(
  `L1: transformations and derived layers (${String(DOCS)} documents per field)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
      it(`${F.name}: total, finite, every degenerate map reached`, () => {
        const reached: Record<string, number> = {};
        const { objects, images } = run(F, reached);
        process.stdout.write(
          `L1 transforms ${F.name}: ${String(DOCS)} documents, ${String(objects)} objects (${String(images)} images), 0 throws; reached ${JSON.stringify(reached)}\n`,
        );
        expect(images).toBeGreaterThan(DOCS);
        for (const r of REASONS) {
          // A scale factor collapses only within EPS of 0, in floats: an exact non-zero
          // product of non-zero factors never vanishes (over Q and mod p).
          if (r === 'the map collapses the plane' && F.kind !== 'float') continue;
          expect(reached[r] ?? 0, r).toBeGreaterThan(0);
        }
      });
    }
  },
);
