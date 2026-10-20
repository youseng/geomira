import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { DocObject, Document } from '@geomira/kernel/document';
import { refsOf } from '@geomira/kernel/expr';
import { checkInvariants } from '@geomira/kernel/invariants';
import { createRng, type Rng } from '@geomira/num/rng';
import { docArb } from '../../../../packages/lang/test/helpers/gen-doc';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { layout } from '@geomira/scene/display';
import { hitTest } from '@geomira/scene/hit';
import { sceneBounds } from '@geomira/scene/bounds';
import type { Scene } from '@geomira/scene/types';
import { fitViewport } from '@geomira/scene/viewport';
import { figureOfDoc, LAW_TIMEOUT, registry, runs } from '../helpers';

/** The runs of adjacent managed images: [start, end) index ranges of length ≥ 2. */
function imageRuns(doc: Document): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  doc.objects.forEach((o, i) => {
    const managed = o.managedBy !== undefined;
    if (managed && start < 0) start = i;
    if (!managed && start >= 0) {
      if (i - start >= 2) out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0 && doc.objects.length - start >= 2) out.push([start, doc.objects.length]);
  return out;
}

/** A random order of a run that keeps every reference inside the run pointing backwards. */
function shuffleRun(run: readonly DocObject[], rng: Rng): DocObject[] {
  const ids = new Set(run.map((o) => o.id));
  const left = [...run];
  const placed = new Set<number>();
  const out: DocObject[] = [];
  while (left.length > 0) {
    const ready = left.filter((o) => refsOf(o.def).every((r) => !ids.has(r) || placed.has(r)));
    const pick = ready[Math.floor(rng.uniform(0, ready.length))] ?? ready[0];
    if (pick === undefined) break;
    out.push(pick);
    placed.add(pick.id);
    left.splice(left.indexOf(pick), 1);
  }
  return out;
}

function permuteImages(doc: Document, seed: number): { doc: Document; moved: number } {
  const rng = createRng(seed);
  const objects = [...doc.objects];
  let moved = 0;
  for (const [a, b] of imageRuns(doc)) {
    const run = shuffleRun(objects.slice(a, b), rng);
    run.forEach((o, k) => {
      if (objects[a + k]?.id !== o.id) moved++;
      objects[a + k] = o;
    });
  }
  return { doc: { ...doc, objects }, moved };
}

const SIZE = { width: 640, height: 480 };

/** The hits at a grid of cursors (ids, parts) and the virtual hits. */
function hitsOf(scene: Scene): unknown[] {
  const d = layout(scene, { viewport: fitViewport(sceneBounds(scene), SIZE, 40), size: SIZE });
  const out: unknown[] = [];
  for (let x = 20; x < SIZE.width; x += 40)
    for (let y = 20; y < SIZE.height; y += 40) out.push(hitTest(d, { x, y }));
  for (const item of d.items)
    for (const p of item.paths) if (p.kind === 'dot') out.push(hitTest(d, p.c));
  return out;
}

/** A scene without ids (names identify objects across a text round trip). */
function byName(doc: Document, scene: Scene): unknown {
  const layerName = new Map(doc.layers.map((l) => [l.id, l.name]));
  return {
    primitives: scene.primitives.map((p) => ({
      name: p.name,
      shape: p.shape,
      style: p.style,
      label: p.label,
      layer: layerName.get(p.layer),
    })),
    unavailable: scene.unavailable.map((u) => [u.name, u.reason]),
    coincident: scene.coincident.map((id) => doc.objects.find((o) => o.id === id)?.name),
  };
}

describe('note A (ADR-0009, ADR-0010): the scene does not depend on the order of adjacent images', () => {
  it(
    'permuting the images inside any run of adjacent images leaves scene and hits unchanged',
    () => {
      const seen = { docs: 0, runs: 0, moved: 0 };
      fc.assert(
        fc.property(docArb(registry), fc.nat(), (doc, seed) => {
          const { doc: perm, moved } = permuteImages(doc, seed);
          expect(checkInvariants(perm)).toEqual([]);
          const [a, b] = [figureOfDoc(doc).scene, figureOfDoc(perm).scene];
          expect(b).toEqual(a);
          expect(hitsOf(b)).toEqual(hitsOf(a));
          seen.docs++;
          seen.runs += imageRuns(doc).length;
          seen.moved += moved;
        }),
        { numRuns: runs(300), seed: 7 },
      );
      console.warn(`note A (permuted image runs): ${JSON.stringify(seen)}`);
      expect(seen.moved).toBeGreaterThan(0);
    },
    LAW_TIMEOUT,
  );

  it(
    'a text round trip (which may reorder adjacent images) gives the same scene up to ids',
    () => {
      let reordered = 0;
      fc.assert(
        fc.property(docArb(registry), (doc) => {
          const back = parse(print(doc), registry).doc;
          const order = (d: Document) => d.objects.map((o) => o.name).join(' ');
          if (order(back) !== order(doc)) reordered++;
          expect(byName(back, figureOfDoc(back).scene)).toEqual(
            byName(doc, figureOfDoc(doc).scene),
          );
        }),
        { numRuns: runs(200), seed: 11 },
      );
      console.warn(`note A (round trips that reordered objects): ${String(reordered)}`);
    },
    LAW_TIMEOUT,
  );
});
