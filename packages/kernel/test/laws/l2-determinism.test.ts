/**
 * Law L2 (SPEC §17): evaluation is deterministic (bit-identical within one engine), and
 * evaluateFrom (incremental) equals a full evaluate after any edit.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { add, fromNumber } from '@geomira/num/rational';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { Document } from '../../src/document';
import { addObject, redefineObject, removeCascade } from '../../src/edit';
import { evaluate, evaluateFrom, type Evaluation } from '../../src/evaluate';
import { call, lit } from '../../src/expr';
import { assertInvariants } from '../../src/invariants';
import { createRegistry } from '../../src/registry';
import { numbersOf, type Value } from '../../src/value';
import { REGISTRY, contextOf } from '../helpers/doc';
import { freePointIds, fuzzDocument } from '../helpers/fuzz';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';

const SEED = 77;
const DOCS = lawCount(300);
const EDITS = 4;

/** Bit-identical equality: Object.is on JS numbers (so −0 ≠ 0), structural otherwise. */
function sameValue<T>(a: Value<T>, b: Value<T>): boolean {
  if (a.kind !== b.kind) return false;
  const [x, y] = [numbersOf(a), numbersOf(b)];
  const same = (u: T, i: number): boolean =>
    typeof u === 'number'
      ? Object.is(u, y[i])
      : JSON.stringify(u, bigintSafe) === JSON.stringify(y[i], bigintSafe);
  if (x.length !== y.length || !x.every(same)) return false;
  return JSON.stringify(a, bigintSafe) === JSON.stringify(b, bigintSafe);
}

function bigintSafe(_key: string, v: unknown): unknown {
  return typeof v === 'bigint' ? `${v.toString()}n` : v;
}

function sameEvaluation<T>(a: Evaluation<T>, b: Evaluation<T>): string | undefined {
  if (a.values.size !== b.values.size) return 'different sizes';
  for (const [id, v] of a.values) {
    const w = b.values.get(id);
    if (w === undefined || !sameValue(v, w)) return `object #${String(id)} differs`;
  }
  return undefined;
}

type Edit = { doc: Document; changed: number[] };

/** A random edit: move a free point (exactly, or by a tiny offset), add, or remove. */
function randomEdit(rng: Rng, doc: Document): Edit | undefined {
  const r = rng.nextFloat();
  const free = freePointIds(doc);
  const target = free[rng.nextInt(Math.max(1, free.length))];
  if (r < 0.6 && target !== undefined) {
    const o = doc.objects.find((x) => x.id === target);
    const [x, y] = o?.def.kind === 'call' ? o.def.args : [];
    if (x?.kind !== 'lit' || y?.kind !== 'lit') return undefined;
    const dx = fromNumber(rng.nextFloat() < 0.5 ? 0 : rng.uniform(-1, 1));
    const res = redefineObject(doc, target, call('point', [lit(add(x.value, dx)), y]));
    return res.ok ? { doc: res.doc, changed: [target] } : undefined;
  }
  const victim = doc.objects[rng.nextInt(Math.max(1, doc.objects.length))];
  if (r < 0.8 && victim !== undefined) {
    const res = removeCascade(doc, victim.id);
    return res.ok ? { doc: res.doc, changed: [] } : undefined;
  }
  const pts = doc.objects.filter((o) => o.name.startsWith('P'));
  const [a, b] = [
    pts[rng.nextInt(Math.max(1, pts.length))],
    pts[rng.nextInt(Math.max(1, pts.length))],
  ];
  if (a === undefined || b === undefined) return undefined;
  const res = addObject(doc, {
    name: `M${String(doc.nextId)}`,
    def: call('midpoint', [
      { kind: 'ref', id: a.id },
      { kind: 'ref', id: b.id },
    ]),
  });
  return res.ok ? { doc: res.doc, changed: [] } : undefined;
}

function incremental<T>(F: Field<T>): number {
  let edits = 0;
  for (let i = 0; i < DOCS; i += 1) {
    const rng = createRng(deriveSeed(SEED, i));
    let doc = fuzzDocument(rng, REGISTRY, { points: 4, calls: 16, degenerate: true, maxDepth: 3 });
    const ctx = contextOf(doc);
    let prev = evaluate(doc, REGISTRY, F, ctx);
    for (let k = 0; k < EDITS; k += 1) {
      const e = randomEdit(rng, doc);
      if (e === undefined) continue;
      doc = assertInvariants(e.doc);
      const inc = evaluateFrom(prev, doc, REGISTRY, F, ctx, e.changed);
      const full = evaluate(doc, REGISTRY, F, ctx);
      expect(
        sameEvaluation(inc, full),
        `${F.name} doc ${String(i)} edit ${String(k)}`,
      ).toBeUndefined();
      prev = inc;
      edits += 1;
    }
  }
  return edits;
}

describe('L2: determinism', { timeout: LAW_TIMEOUT }, () => {
  for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
    it(`${F.name}: evaluating the same document twice is bit-identical (${String(DOCS)} documents)`, () => {
      for (let i = 0; i < DOCS; i += 1) {
        const doc = fuzzDocument(createRng(deriveSeed(SEED + 1, i)), REGISTRY, {
          points: 4,
          calls: 20,
          degenerate: true,
          maxDepth: 3,
        });
        const ctx = contextOf(doc);
        const a = evaluate(doc, REGISTRY, F, ctx);
        const b = evaluate(doc, REGISTRY, F, ctx);
        expect(sameEvaluation(a, b)).toBeUndefined();
      }
    });
  }
});

describe('L2: evaluateFrom equals evaluate after random edits', { timeout: LAW_TIMEOUT }, () => {
  for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
    it(F.name, () => {
      const edits = incremental(F);
      process.stdout.write(
        `L2 ${F.name}: ${String(edits)} incremental evaluations equal to full ones\n`,
      );
      expect(edits).toBeGreaterThanOrEqual(DOCS * 2);
    });
  }

  it('falls back to a full evaluate when the scale, field or registry differs', () => {
    const doc = fuzzDocument(createRng(5), REGISTRY, {
      points: 4,
      calls: 10,
      degenerate: false,
      maxDepth: 3,
    });
    const ctx = contextOf(doc);
    const prev = evaluate(doc, REGISTRY, FloatField, ctx);
    const bigger = { scale: ctx.scale * 2 };
    const inc = evaluateFrom(prev, doc, REGISTRY, FloatField, bigger, []);
    expect(inc.ctx).toBe(bigger);
    expect(sameEvaluation(inc, evaluate(doc, REGISTRY, FloatField, bigger))).toBeUndefined();
    const other = evaluateFrom(
      prev as Evaluation<unknown>,
      doc,
      REGISTRY,
      RationalField as Field<unknown>,
      ctx,
      [],
    );
    expect(other.field).toBe(RationalField);
    const registry = createRegistry();
    const fresh = evaluateFrom(prev, doc, registry, FloatField, ctx, []);
    expect(fresh.registry).toBe(registry);
    expect(sameEvaluation(fresh, prev)).toBeUndefined();
  });
});
