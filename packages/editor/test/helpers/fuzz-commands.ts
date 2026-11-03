/**
 * Commands of the editor-level model-based fuzzer (SPEC §17 L14; laws/fuzz.test.ts): every
 * edit type of applyEdit (document edits, claims, assumptions, the whole text, the
 * document's viewport, batches), undo/redo, UI edits (selection, hover, viewport, layer
 * switches, tools), whole drag gestures (free points, gliders, drag-through of images,
 * texts), tool inputs through the real scene, and GARBAGE: unknown ids, bad names and
 * values, out-of-order drag edits, broken text. Parameters are generated blind and
 * resolved against the current state when the command runs; refusals are part of the test.
 */
import fc from 'fast-check';
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import { ASSUMPTION_KINDS } from '@geomira/claims/hypotheses';
import type { Style } from '@geomira/kernel/document';
import { objectKinds } from '@geomira/kernel/derived';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { print } from '@geomira/lang/print';
import { fromNumber } from '@geomira/num/rational';
import { resolve, shapeArb, type Shape } from '../../../kernel/test/helpers/model-defs';
import type { Edit } from '../../src/edit';
import type { ToolInput } from '../../src/machine';
import type { EditorState } from '../../src/state';
import { TOOLS } from '../../src/tools';
import { claimToolKinds } from '../../src/machine';
import { hitAt, registry } from './editor';

/** What a command does to the state: edits through applyEdit, or inputs to the tool. */
export type Step =
  | { readonly kind: 'edit'; readonly edit: Edit }
  | { readonly kind: 'tool'; readonly input: ToolInput };

export type Make = (s: EditorState) => readonly Step[];

const n = fc.nat({ max: 999 });
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
  'lay',
];
const COLORS = ['red', 'Dark Red', '#00ff00', '', 'blue_2'];

function at<X>(xs: readonly X[], i: number): X | undefined {
  return xs[i % Math.max(1, xs.length)];
}

/** An object id of the state (or, one time in ten, an id that does not exist). */
function objectId(s: EditorState, i: number): number {
  return i % 10 === 9 ? 999_999 : (at(s.doc.objects, i)?.id ?? 999_999);
}

function layerId(s: EditorState, i: number): string {
  return i % 10 === 9 ? 'nope' : (at(s.doc.layers, i)?.id ?? 'main');
}

function def(s: EditorState, shape: Shape): Expr {
  return resolve(s.doc, objectKinds(s.doc, registry), shape);
}

const edit = (e: Edit): Step => ({ kind: 'edit', edit: e });

const styleArb: fc.Arbitrary<Style> = fc.record(
  {
    color: fc.constantFrom(...COLORS),
    width: fc.oneof(fc.double({ min: 0, max: 20, noNaN: true }), fc.constantFrom(Number.NaN, -1)),
    dash: fc.constantFrom('solid' as const, 'dashed' as const, 'dotted' as const),
    hidden: fc.boolean(),
    noimage: fc.boolean(),
    label: fc.constantFrom('', 'X_1', '\\omega', 'a "quoted" label'),
    z: fc.integer({ min: -3, max: 3 }),
    labelAngle: fc.double({ min: -720, max: 720, noNaN: true }),
    labelDist: fc.oneof(fc.double({ min: 0, max: 30, noNaN: true }), fc.constant(-2)),
    opacity: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(Number.NaN, 1.5)),
  },
  { requiredKeys: [] },
);

const viewportArb = fc.record({
  cx: fc.oneof(fc.double({ min: -50, max: 50, noNaN: true }), fc.constant(Number.NaN)),
  cy: fc.double({ min: -50, max: 50, noNaN: true }),
  zoom: fc.oneof(fc.double({ min: 0.5, max: 500, noNaN: true }), fc.constantFrom(0, -3, 1e300)),
});

/** Document edits of the kernel (each resolved against the current state). */
const docEdits: fc.Arbitrary<Make>[] = [
  fc.tuple(shapeArb, n, n).map(([shape, name, layer]) => (s) => [
    edit({
      kind: 'add',
      object: { name: at(NAMES, name) ?? 'A', def: def(s, shape), layers: [layerId(s, layer)] },
    }),
  ]),
  shapeArb.map((shape) => (s) => {
    // Points without a name clash: the generator's names collide often by design.
    const name = `P_${String(s.doc.nextId)}`;
    return [edit({ kind: 'add', object: { name, def: def(s, shape), layers: [s.activeLayer] } })];
  }),
  fc
    .tuple(n, n, n, n, fc.constantFrom('mark_angle', 'mark_right', 'mark_segment', 'text'))
    .map(([a, b, c, k, tool]) => (s) => {
      const pts = s.doc.objects.filter((o) => s.values.values.get(o.id)?.kind === 'point');
      const p = (i: number) => ref(at(pts, i)?.id ?? 999_999);
      const args: Expr[] =
        tool === 'text'
          ? [p(a), { kind: 'str', value: at(['M_a', '', 'Let \\omega be', '"x"'], k) ?? 'x' }]
          : tool === 'mark_segment'
            ? [p(a), p(b), lit(fromNumber((k % 4) + 0))]
            : [p(a), p(b), p(c)];
      return [
        edit({
          kind: 'add',
          object: { name: `mk_${String(s.doc.nextId)}`, def: call(tool, args) },
        }),
      ];
    }),
  n.map((i) => (s) => [edit({ kind: 'remove', id: objectId(s, i) })]),
  fc
    .tuple(n, n)
    .map(([i, k]) => (s) => [
      edit({ kind: 'rename', id: objectId(s, i), name: at(NAMES, k) ?? 'A' }),
    ]),
  fc
    .tuple(n, shapeArb)
    .map(([i, shape]) => (s) => [
      edit({ kind: 'redefine', id: objectId(s, i), def: def(s, shape) }),
    ]),
  fc
    .tuple(n, styleArb)
    .map(([i, style]) => (s) => [edit({ kind: 'style', id: objectId(s, i), style })]),
  fc
    .tuple(n, n, n)
    .map(([i, a, b]) => (s) => [
      edit({ kind: 'setLayers', id: objectId(s, i), layers: [layerId(s, a), layerId(s, b)] }),
    ]),
  fc
    .tuple(n, n)
    .map(([i, k]) => (s) => [edit({ kind: 'move', id: objectId(s, i), index: k % 12 })]),
  fc.tuple(n, fc.double({ min: -0.5, max: 1.5, noNaN: true })).map(([k, opacity]) => (s) => [
    edit({
      kind: 'addLayer',
      name: `${at(['lay', 'aux', 'Lay', ''], k) ?? 'lay'}${String(s.doc.nextId % 3)}`,
      options: { opacity },
    }),
  ]),
  fc
    .tuple(n, fc.boolean(), fc.boolean())
    .map(([i, visible, locked]) => (s) => [
      edit({ kind: 'updateLayer', id: layerId(s, i), patch: { visible, locked } }),
    ]),
  n.map((i) => (s) => [edit({ kind: 'removeLayer', id: layerId(s, i) })]),
  fc.tuple(n, n, n, fc.constantFrom('*', '**', "'")).map(([t, src, x, suffix]) => (s) => {
    const maps = s.doc.objects.filter((o) => s.values.values.get(o.id)?.kind === 'transform');
    const transform = at(maps, t)?.id ?? objectId(s, t);
    const exclude = x % 3 === 0 ? [objectId(s, x)] : [];
    const spec = {
      name: `img${String(s.doc.nextId)}`,
      transform,
      source: layerId(s, src),
      suffix,
      exclude,
    };
    return [edit({ kind: 'addDerivedLayer', spec })];
  }),
  fc.tuple(n, n).map(([l, t]) => (s) => {
    const ruled = s.doc.layers.filter((x) => x.rule !== undefined);
    const maps = s.doc.objects.filter((o) => s.values.values.get(o.id)?.kind === 'transform');
    const layer = at(ruled, l)?.id ?? 'main';
    return [
      edit({ kind: 'updateRule', layerId: layer, patch: { transform: at(maps, t)?.id ?? 1 } }),
    ];
  }),
  n.map((l) => (s) => [edit({ kind: 'removeRule', layerId: layerId(s, l) })]),
  fc.tuple(n, fc.boolean()).map(([l, vis]) => (s) => [
    edit({
      kind: 'addView',
      view: { name: `v${String(s.doc.nextId % 4)}`, layerVisibility: { [layerId(s, l)]: vis } },
    }),
  ]),
  n.map((k) => (s) => [
    edit({
      kind: k % 2 === 0 ? 'applyView' : 'removeView',
      name: at(s.doc.views, k)?.name ?? 'v0',
    }),
  ]),
];

/** Claims, assumptions, the text, the document's viewport, batches. */
const otherEdits: fc.Arbitrary<Make>[] = [
  fc
    .tuple(n, fc.array(n, { minLength: 1, maxLength: 5 }), fc.boolean())
    .map(([k, args, named]) => (s) => {
      const kind = at(CLAIM_KINDS, k)?.name ?? 'collinear';
      const refs = args.map((i) => ref(objectId(s, i)));
      const claim = named
        ? { kind, args: refs, name: `c${String(s.doc.nextId)}` }
        : { kind, args: refs };
      return [edit({ kind: 'addClaim', claim })];
    }),
  fc.tuple(n, fc.boolean()).map(([i, rename]) => (s) => {
    const id = at(s.doc.claims, i)?.id ?? 999_999;
    return [
      edit(
        rename
          ? { kind: 'renameClaim', id, name: `cl${String(i % 5)}` }
          : { kind: 'removeClaim', id },
      ),
    ];
  }),
  fc.tuple(n, fc.array(n, { minLength: 1, maxLength: 4 })).map(([k, args]) => (s) => [
    edit({
      kind: 'addAssumption',
      assumption: {
        kind: at([...ASSUMPTION_KINDS, 'equal'], k) ?? 'acute',
        args: args.map((i) => ref(objectId(s, i))),
      },
    }),
  ]),
  n.map((i) => (s) => [
    edit({ kind: 'removeAssumption', id: at(s.doc.assumptions, i)?.id ?? 999_999 }),
  ]),
  fc.tuple(n, n).map(([k, line]) => (s) => {
    const text = print(s.doc);
    const lines = text.split('\n');
    const variants = [
      text,
      lines.filter((_, i) => i !== 1 + (line % Math.max(1, lines.length - 1))).join('\n'),
      `${text}\nZ_${String(line % 7)} = (${String(line % 9)}, 1/3)`,
      `${text}\nbad line (`,
      text.replace(/\(([-0-9.]+),/u, '(7,'),
    ];
    return [edit({ kind: 'replaceText', text: at(variants, k) ?? text })];
  }),
  fc.option(viewportArb).map((v) => () => [edit({ kind: 'docViewport', viewport: v })]),
  fc.tuple(shapeArb, shapeArb, n).map(([a, b, i]) => (s) => [
    edit({
      kind: 'batch',
      label: 'batch',
      edits: [
        { kind: 'add', object: { name: `B_${String(s.doc.nextId)}`, def: def(s, a) } },
        { kind: 'add', object: { name: `b_${String(i)}`, def: def(s, b) } },
        { kind: 'remove', id: objectId(s, i) },
      ],
    }),
  ]),
  fc.constantFrom('undo' as const, 'redo' as const).map((k) => () => [edit({ kind: k })]),
  // Walks back and forth in history (the drag in progress, if any, ended first).
  fc
    .tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }))
    .map(([u, r]) => () => [
      edit({ kind: 'dragEnd' }),
      ...Array.from({ length: u }, () => edit({ kind: 'undo' })),
      ...Array.from({ length: r }, () => edit({ kind: 'redo' })),
    ]),
];

/** UI edits: selection, hover, viewport, layer switches, tools. */
const uiEdits: fc.Arbitrary<Make>[] = [
  fc
    .tuple(
      fc.array(n, { maxLength: 3 }),
      fc.constantFrom('replace' as const, 'add' as const, 'toggle' as const),
    )
    .map(([ids, mode]) => (s) => [
      edit({ kind: 'select', ids: ids.map((i) => objectId(s, i)), mode }),
    ]),
  n.map((i) => (s) => [edit({ kind: 'hover', id: i % 4 === 0 ? null : objectId(s, i) })]),
  viewportArb.map((viewport) => () => [edit({ kind: 'viewport', viewport })]),
  n.map((i) => (s) => [edit({ kind: 'activeLayer', id: layerId(s, i) })]),
  fc.tuple(n, n).map(([t, k]) => () => {
    const tool = at(TOOLS, t)?.id ?? 'move';
    return [edit({ kind: 'tool', tool, claimKind: at(claimToolKinds(), k) ?? 'collinear' })];
  }),
];

const coord = fc.double({ min: -8, max: 8, noNaN: true });

/** Drags: whole gestures on draggable-looking objects, and out-of-order drag edits. */
const drags: fc.Arbitrary<Make>[] = [
  fc
    .tuple(n, fc.array(fc.tuple(coord, coord), { minLength: 1, maxLength: 4 }), fc.nat({ max: 3 }))
    .map(([i, moves, end]) => (s) => {
      const id = objectId(s, i);
      const steps: Step[] = [edit({ kind: 'dragStart', id })];
      for (const [x, y] of moves) steps.push(edit({ kind: 'dragMove', to: { x, y } }));
      steps.push(edit(end === 0 ? { kind: 'dragCancel' } : { kind: 'dragEnd' }));
      return steps;
    }),
  fc
    .constantFrom<Edit>(
      { kind: 'dragMove', to: { x: 1, y: 1 } },
      { kind: 'dragEnd' },
      { kind: 'dragCancel' },
      { kind: 'dragMove', to: { x: Number.NaN, y: 0 } },
    )
    .map((e) => () => [edit(e)]),
  // A drag left open: the next commands meet a drag in progress.
  n.map((i) => (s) => [
    edit({ kind: 'dragStart', id: objectId(s, i) }),
    edit({ kind: 'dragMove', to: { x: 0.5, y: -0.25 } }),
  ]),
  // Label drags (ADR-0049): whole gestures, and a label move out of order.
  fc
    .tuple(
      n,
      fc.array(
        fc.tuple(
          fc.double({ min: -720, max: 720, noNaN: true }),
          fc.double({ min: -50, max: 300, noNaN: true }),
        ),
        { minLength: 1, maxLength: 3 },
      ),
      fc.nat({ max: 3 }),
    )
    .map(([i, moves, end]) => (s) => {
      const steps: Step[] = [edit({ kind: 'dragStart', id: objectId(s, i), part: 'label' })];
      for (const [angle, dist] of moves) steps.push(edit({ kind: 'dragLabel', angle, dist }));
      steps.push(edit(end === 0 ? { kind: 'dragCancel' } : { kind: 'dragEnd' }));
      return steps;
    }),
  fc.constant<Edit>({ kind: 'dragLabel', angle: 10, dist: 5 }).map((e) => () => [edit(e)]),
];

/** Tool inputs: clicks through the scene, panel picks, finish, cancel, text. */
const toolInputs: fc.Arbitrary<Make>[] = [
  fc
    .tuple(coord, coord)
    .map(([x, y]) => (s) => [
      { kind: 'tool', input: { kind: 'click', hit: hitAt(s, x, y), world: { x, y } } },
    ]),
  n.map((i) => (s) => [{ kind: 'tool', input: { kind: 'object', id: objectId(s, i) } }]),
  fc
    .constantFrom<ToolInput>({ kind: 'finish' }, { kind: 'cancel' }, { kind: 'text', value: 'M_a' })
    .map((input) => () => [{ kind: 'tool', input }]),
];

/** Every command maker, weighted: document edits most, garbage and UI less. */
export const MAKERS: fc.Arbitrary<{ label: string; make: Make }> = fc.oneof(
  ...docEdits.map((a, i) => ({
    weight: 3,
    arbitrary: a.map((make) => ({ label: `doc${String(i)}`, make })),
  })),
  ...otherEdits.map((a, i) => ({
    weight: 3,
    arbitrary: a.map((make) => ({ label: `other${String(i)}`, make })),
  })),
  ...uiEdits.map((a, i) => ({
    weight: 1,
    arbitrary: a.map((make) => ({ label: `ui${String(i)}`, make })),
  })),
  ...drags.map((a, i) => ({
    weight: 3,
    arbitrary: a.map((make) => ({ label: `drag${String(i)}`, make })),
  })),
  ...toolInputs.map((a, i) => ({
    weight: 3,
    arbitrary: a.map((make) => ({ label: `tool${String(i)}`, make })),
  })),
);
