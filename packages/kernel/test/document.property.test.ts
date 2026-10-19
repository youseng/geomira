/**
 * Property (Run 2, item 2; law L7 at the document level): random sequences of the
 * immutable helpers keep invariants I1–I8, never mutate their input, and a failed edit
 * returns an error instead of a document. Starts from fuzzed constructions and from a
 * document with a derived layer (rules are built by hand until the derived-layer run).
 */
import { fromNumber } from '@geomira/num/rational';
import { createRng, deriveSeed, type Rng } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import type { Document } from '../src/document';
import {
  addObject,
  redefineObject,
  removeCascade,
  renameObject,
  setObjectLayers,
  setStyle,
  type EditResult,
} from '../src/edit';
import { call, lit, ref, type Expr } from '../src/expr';
import { assertInvariants } from '../src/invariants';
import { addLayer, removeLayer, updateLayer } from '../src/layers';
import { REGISTRY } from './helpers/doc';
import { derivedDocument } from './helpers/derived';
import { fuzzDocument } from './helpers/fuzz';
import { LAW_TIMEOUT, lawCount } from './helpers/laws';

const SEQUENCES = lawCount(400);
const STEPS = 12;

function pick<X>(rng: Rng, xs: readonly X[]): X | undefined {
  return xs[rng.nextInt(Math.max(1, xs.length))];
}

function randomDef(rng: Rng, doc: Document): Expr {
  const o = pick(rng, doc.objects);
  const p = pick(rng, doc.objects);
  const id = (x: typeof o) => ref(x?.id ?? 999);
  switch (rng.nextInt(4)) {
    case 0:
      return call('point', [
        lit(fromNumber(rng.uniform(-5, 5))),
        lit(fromNumber(rng.uniform(-5, 5))),
      ]);
    case 1:
      return call('midpoint', [id(o), id(p)]);
    case 2:
      return call('line', [id(o), call('foot', [id(p), id(o), id(o)])]);
    default:
      return call('apply', [id(o), id(p)]);
  }
}

function randomName(rng: Rng): string {
  return (
    pick(rng, ['A', 'B', 'X', 'Q_1', "P'", 'k', 'ω', 'Ma', 'claim', 'A*', '', 'l2', 'm']) ?? 'X'
  );
}

function randomLayers(rng: Rng, doc: Document): string[] {
  const ids = doc.layers.map((l) => l.id);
  const out = ids.filter(() => rng.nextFloat() < 0.5);
  if (rng.nextFloat() < 0.1) out.push('L999');
  if (rng.nextFloat() < 0.05) out.push(ids[0] ?? 'main');
  return out;
}

/** One random helper call (valid or not) on a random target. */
function step(rng: Rng, doc: Document): EditResult {
  const target = pick(rng, doc.objects)?.id ?? 0;
  const layer = pick(rng, doc.layers)?.id ?? 'main';
  switch (rng.nextInt(10)) {
    case 0:
      return addObject(doc, {
        name: `${randomName(rng)}${String(rng.nextInt(9))}`,
        def: randomDef(rng, doc),
        layers: randomLayers(rng, doc),
      });
    case 1:
      return removeCascade(doc, target);
    case 2:
      return renameObject(doc, target, randomName(rng));
    case 3:
      return redefineObject(doc, target, randomDef(rng, doc));
    case 4:
      return setStyle(doc, target, rng.nextFloat() < 0.5 ? { noimage: true } : { color: 'red' });
    case 5:
      return setObjectLayers(doc, target, randomLayers(rng, doc));
    case 6:
      return addLayer(doc, randomName(rng), { opacity: rng.nextFloat() * 1.2 });
    case 7:
      return removeLayer(doc, layer);
    case 8:
      return updateLayer(doc, layer, { name: randomName(rng), visible: rng.nextFloat() < 0.5 });
    default:
      return addObject(doc, { name: `P${String(doc.nextId)}`, def: randomDef(rng, doc) });
  }
}

function snapshot(doc: Document): string {
  return JSON.stringify(doc, (_k, v: unknown) => (typeof v === 'bigint' ? `${v.toString()}n` : v));
}

describe('random helper sequences keep invariants I1–I8', { timeout: LAW_TIMEOUT }, () => {
  it(`${String(SEQUENCES)} sequences of ${String(STEPS)} edits`, () => {
    let applied = 0;
    let refused = 0;
    for (let i = 0; i < SEQUENCES; i += 1) {
      const rng = createRng(deriveSeed(11, i));
      let doc =
        i % 3 === 0
          ? derivedDocument().doc
          : fuzzDocument(rng, REGISTRY, { points: 3, calls: 8, degenerate: false, maxDepth: 3 });
      assertInvariants(doc);
      for (let k = 0; k < STEPS; k += 1) {
        const before = snapshot(doc);
        const r = step(rng, doc);
        expect(snapshot(doc), 'the input is never mutated').toBe(before);
        if (!r.ok) {
          expect(r.error.length).toBeGreaterThan(0);
          refused += 1;
          continue;
        }
        expect(
          () => assertInvariants(r.doc),
          `sequence ${String(i)} step ${String(k)}`,
        ).not.toThrow();
        doc = r.doc;
        applied += 1;
      }
    }
    process.stdout.write(
      `invariants: ${String(applied)} edits applied, ${String(refused)} refused, all valid\n`,
    );
    expect(applied).toBeGreaterThan(SEQUENCES * STEPS * 0.3);
    expect(refused).toBeGreaterThan(0);
  });
});
