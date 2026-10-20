/**
 * Commands of the kernel-level model-based fuzzer (Run 4, item 6): every edit a document
 * can receive — add (to any layer, to a rule's source), remove with cascade, rename (also
 * to reserved names), redefine, redefine a rule's map, move a map later in the order,
 * move, toggle [noimage], set layers, layer and view edits, derived layers (add, change
 * transform / source / suffix / exclusions, remove the rule), and drags (free points and
 * drag-through of images). Parameters are generated blind and resolved against the
 * current document when the command runs; refusals are part of the test.
 */
import fc from 'fast-check';
import { FloatField } from '@geomira/num/float-field';
import type { Document, Layer } from '../../src/document';
import { applyDocEdit, type DocEdit } from '../../src/doc-edit';
import { objectKinds } from '../../src/derived';
import { dragThrough } from '../../src/drag';
import { evaluate } from '../../src/evaluate';
import { REGISTRY, q } from './doc';
import { coord, resolve, shapeArb, type Shape } from './model-defs';
import { call, lit } from '../../src/expr';
import { evalContextFor } from '../../src/context';

export interface Stats {
  readonly tried: Record<string, number>;
  readonly applied: Record<string, number>;
  chains: number;
  maxObjects: number;
  maxImages: number;
  dragsThrough: number;
  notDraggable: number;
  dragsAtCursor: number;
}

export interface Model {
  steps: number;
}

export interface Real {
  doc: Document;
  readonly stats: Stats;
  /** Laws checked after every command (L1, L7, L13). */
  readonly check: (doc: Document) => void;
}

type Make = (doc: Document) => DocEdit | undefined;

const bump = (r: Record<string, number>, k: string): void => {
  r[k] = (r[k] ?? 0) + 1;
};

function at<X>(xs: readonly X[], n: number): X | undefined {
  return xs[n % Math.max(1, xs.length)];
}

const rules = (doc: Document): (Layer & { readonly rule: NonNullable<Layer['rule']> })[] =>
  doc.layers.flatMap((l) => (l.rule === undefined ? [] : [{ ...l, rule: l.rule }]));

class EditCommand implements fc.Command<Model, Real> {
  constructor(
    readonly label: string,
    readonly make: Make,
    readonly detail: string,
  ) {}

  check(): boolean {
    return true;
  }

  run(m: Model, r: Real): void {
    m.steps += 1;
    bump(r.stats.tried, this.label);
    const e = this.make(r.doc);
    if (e !== undefined) {
      const res = applyDocEdit(r.doc, REGISTRY, e);
      if (res.ok) {
        r.doc = res.doc;
        bump(r.stats.applied, this.label);
      }
    }
    const s = r.stats;
    s.maxObjects = Math.max(s.maxObjects, r.doc.objects.length);
    s.maxImages = Math.max(
      s.maxImages,
      r.doc.objects.filter((o) => o.managedBy !== undefined).length,
    );
    if (
      rules(r.doc).some((l) => r.doc.layers.find((x) => x.id === l.rule.source)?.rule !== undefined)
    )
      s.chains += 1;
    r.check(r.doc);
  }

  toString(): string {
    return `${this.label}(${this.detail})`;
  }
}

const cmd = <P>(label: string, arb: fc.Arbitrary<P>, make: (p: P) => Make) =>
  arb.map((p) => new EditCommand(label, make(p), JSON.stringify(p)));

const NAMES = [
  'A',
  'B',
  'X',
  'Q_1',
  "P'",
  'k',
  'ω',
  'A*',
  'Ma',
  'claim',
  '',
  'l2',
  'm',
  'Z',
  'C*',
  'E**',
];
const SUFFIXES = ['*', '**', '***', "'"];
const n = fc.nat({ max: 999 });

const mapShape: fc.Arbitrary<Shape> = shapeArb.filter((s) => s.k === 'map');

function defIn(doc: Document, s: Shape) {
  return resolve(doc, objectKinds(doc, REGISTRY), s);
}

/** The drag command: drag-through for a managed image, new coordinates for a free point. */
class DragCommand implements fc.Command<Model, Real> {
  constructor(
    readonly target: number,
    readonly x: number,
    readonly y: number,
  ) {}

  check(): boolean {
    return true;
  }

  run(m: Model, r: Real): void {
    const before = r.doc;
    // Two drags in three target a managed image (drag-through).
    const images = before.objects.filter((x) => x.managedBy !== undefined);
    const o =
      this.target % 3 !== 0 && images.length > 0
        ? at(images, this.target)
        : at(before.objects, this.target);
    let through: DocEdit | undefined;
    const make: Make = (doc) => {
      if (o === undefined) return undefined;
      const cursor = call('point', [lit(q(this.x)), lit(q(this.y))]);
      if (o.managedBy === undefined) return { kind: 'redefine', id: o.id, def: cursor };
      const c = evalContextFor(doc);
      if (!c.ok) return undefined;
      const d = dragThrough(
        doc,
        o.id,
        { x: this.x, y: this.y },
        evaluate(doc, REGISTRY, FloatField, c.ctx),
      );
      if (d.kind === 'not-draggable') {
        r.stats.notDraggable += 1;
        return undefined;
      }
      r.stats.dragsThrough += 1;
      through = d.edit;
      return d.edit;
    };
    new EditCommand('drag', make, '').run(m, r);
    if (o !== undefined && through !== undefined) this.atCursor(before, r, o.id, through);
  }

  /**
   * After a drag-through that moved a free point, the image is at the cursor, unless a map
   * of the chain changed value (the new free point changes the scale, and with it a
   * tolerance decision inside a map).
   */
  private atCursor(before: Document, r: Real, id: number, e: DocEdit): void {
    if (
      r.doc === before ||
      e.kind !== 'redefine' ||
      e.def.kind !== 'call' ||
      e.def.tool !== 'point'
    )
      return;
    const [c0, c1] = [evalContextFor(before), evalContextFor(r.doc)];
    if (!c0.ok || !c1.ok) return;
    const [v0, v1] = [
      evaluate(before, REGISTRY, FloatField, c0.ctx),
      evaluate(r.doc, REGISTRY, FloatField, c1.ctx),
    ];
    const maps = before.layers.flatMap((l) => (l.rule === undefined ? [] : [l.rule.transform.id]));
    const same = maps.every(
      (t) => JSON.stringify(v0.values.get(t)) === JSON.stringify(v1.values.get(t)),
    );
    const img = v1.values.get(id);
    if (!same || img?.kind !== 'point') return;
    const err = Math.hypot(img.x - this.x, img.y - this.y);
    if (err > 1e-6 * Math.max(1, c1.ctx.scale, Math.hypot(this.x, this.y)))
      throw new Error(`drag-through: the image is ${String(err)} from the cursor`);
    r.stats.dragsAtCursor += 1;
  }

  toString(): string {
    return `drag(${String(this.target)}, ${String(this.x)}, ${String(this.y)})`;
  }
}

/** Every command (commandArbs repeats some to weight them). */
export function commandArbs(): fc.Arbitrary<fc.Command<Model, Real>>[] {
  const all = edits();
  // Adds dominate (five times each) so documents grow; maps often get layers.
  const adds = all.slice(0, 2);
  const derived = all.slice(13, 14); // addDerived
  return [...all, ...adds, ...adds, ...adds, ...adds, ...derived, ...derived];
}

function edits(): fc.Arbitrary<fc.Command<Model, Real>>[] {
  return [
    cmd('add', fc.record({ s: shapeArb, l: fc.nat({ max: 9 }) }), ({ s, l }) => (doc) => {
      const src = at(rules(doc), l)?.rule.source;
      const layer =
        l < 5 ? 'main' : l < 8 && src !== undefined ? src : (at(doc.layers, l)?.id ?? 'main');
      return {
        kind: 'add',
        object: { name: `P${String(doc.nextId)}`, def: defIn(doc, s), layers: [layer] },
      };
    }),
    cmd('add', fc.record({ s: shapeArb }), ({ s }) => (doc) => ({
      kind: 'add',
      object: { name: `n${String(doc.nextId)}`, def: defIn(doc, s) },
    })),
    cmd('remove', n, (i) => (doc) => {
      const o = at(doc.objects, i);
      return o === undefined ? undefined : { kind: 'remove', id: o.id };
    }),
    cmd('rename', fc.record({ i: n, j: n }), ({ i, j }) => (doc) => {
      const o = at(doc.objects, i);
      const reserved = doc.objects.filter((x) => x.managedBy !== undefined).map((x) => x.name);
      const name =
        j % 3 === 0
          ? (at(reserved, j) ?? 'Z')
          : (at(NAMES, j) ?? 'Z') + String(j % 4 === 0 ? '' : j % 10);
      return o === undefined ? undefined : { kind: 'rename', id: o.id, name };
    }),
    cmd('redefine', fc.record({ i: n, s: shapeArb }), ({ i, s }) => (doc) => {
      const o = at(doc.objects, i);
      return o === undefined ? undefined : { kind: 'redefine', id: o.id, def: defIn(doc, s) };
    }),
    cmd('redefineT', fc.record({ i: n, s: mapShape }), ({ i, s }) => (doc) => {
      const l = at(rules(doc), i);
      return l === undefined
        ? undefined
        : { kind: 'redefine', id: l.rule.transform.id, def: defIn(doc, s) };
    }),
    cmd(
      'moveTLater',
      fc.record({ i: n, d: fc.integer({ min: 1, max: 12 }) }),
      ({ i, d }) =>
        (doc) => {
          const l = at(rules(doc), i);
          if (l === undefined) return undefined;
          const from = doc.objects.findIndex((o) => o.id === l.rule.transform.id);
          return {
            kind: 'move',
            id: l.rule.transform.id,
            index: Math.min(doc.objects.length - 1, from + d),
          };
        },
    ),
    cmd('move', fc.record({ i: n, j: n }), ({ i, j }) => (doc) => {
      const o = at(doc.objects, i);
      return o === undefined
        ? undefined
        : { kind: 'move', id: o.id, index: j % Math.max(1, doc.objects.length) };
    }),
    cmd('noimage', n, (i) => (doc) => {
      const o = at(doc.objects, i);
      return o === undefined
        ? undefined
        : { kind: 'style', id: o.id, style: { ...o.style, noimage: o.style.noimage !== true } };
    }),
    cmd('setLayers', fc.record({ i: n, mask: fc.nat({ max: 63 }) }), ({ i, mask }) => (doc) => {
      const o = at(doc.objects, i);
      const layers = doc.layers.filter((_l, k) => (mask >> k) % 2 === 1).map((l) => l.id);
      return o === undefined ? undefined : { kind: 'setLayers', id: o.id, layers };
    }),
    cmd('addLayer', n, (i) => () => ({ kind: 'addLayer', name: `layer${String(i % 7)}` })),
    cmd('updateLayer', fc.record({ i: n, v: fc.boolean() }), ({ i, v }) => (doc) => {
      const l = at(doc.layers, i);
      return l === undefined ? undefined : { kind: 'updateLayer', id: l.id, patch: { visible: v } };
    }),
    cmd('removeLayer', n, (i) => (doc) => {
      const l = at(doc.layers, i);
      return l === undefined ? undefined : { kind: 'removeLayer', id: l.id };
    }),
    cmd(
      'addDerived',
      fc.record({ t: n, s: n, x: n, m: fc.nat({ max: 15 }) }),
      ({ t, s, x, m }) =>
        (doc) => {
          const kinds = objectKinds(doc, REGISTRY);
          const maps = doc.objects.filter((o) => kinds.get(o.id)?.includes('transform') === true);
          const T = at(maps, t) ?? at(doc.objects, t);
          const exclude = doc.objects
            .filter((_o, k) => (m >> (k % 4)) % 2 === 1 && k % 5 === x % 5)
            .map((o) => o.id);
          const source = at(doc.layers, s)?.id ?? 'main';
          return T === undefined
            ? undefined
            : {
                kind: 'addDerivedLayer',
                spec: {
                  name: `d${String(x % 5)}`,
                  transform: T.id,
                  source,
                  suffix: SUFFIXES[x % SUFFIXES.length] ?? '*',
                  exclude,
                },
              };
        },
    ),
    cmd('updateRule', fc.record({ i: n, w: fc.nat({ max: 3 }), j: n }), ({ i, w, j }) => (doc) => {
      const l = at(rules(doc), i);
      if (l === undefined) return undefined;
      const kinds = objectKinds(doc, REGISTRY);
      const maps = doc.objects.filter((o) => kinds.get(o.id)?.includes('transform') === true);
      const patch =
        w === 0
          ? {
              transform:
                (at(maps, j) ?? l).id === l.id
                  ? l.rule.transform.id
                  : (at(maps, j)?.id ?? l.rule.transform.id),
            }
          : w === 1
            ? { source: at(doc.layers, j)?.id ?? 'main' }
            : w === 2
              ? { suffix: SUFFIXES[j % SUFFIXES.length] ?? '*' }
              : { exclude: doc.objects.filter((_o, k) => k % 3 === j % 3).map((o) => o.id) };
      return { kind: 'updateRule', layerId: l.id, patch };
    }),
    cmd('removeRule', n, (i) => (doc) => {
      const l = at(rules(doc), i);
      return l === undefined ? undefined : { kind: 'removeRule', layerId: l.id };
    }),
    cmd('view', fc.record({ w: fc.nat({ max: 2 }), j: n }), ({ w, j }) => (doc) => {
      const name = `v${String(j % 3)}`;
      if (w === 1) return { kind: 'applyView', name };
      if (w === 2) return { kind: 'removeView', name };
      const vis = Object.fromEntries(
        doc.layers.filter((_l, k) => (j >> k) % 2 === 1).map((l) => [l.id, (j >> 3) % 2 === 0]),
      );
      return { kind: 'addView', view: { name, layerVisibility: vis } };
    }),
    fc.record({ i: n, x: coord, y: coord }).map(({ i, x, y }) => new DragCommand(i, x, y)),
  ];
}
