/**
 * The document generator of laws P1–P3 (fast-check over the registry): a list of steps,
 * each with its own seeded choices, applied through the kernel's applyDocEdit so every
 * document is valid and its derived layers are in sync. Steps add free points, random
 * tool calls (nesting, selectors), styles of every field, plain and derived layers (suffix,
 * exclude, chains), objects in several layers, views, claims of every kind, assumptions
 * of every kind, comments on every kind of anchor, title, author and viewport.
 */
import fc from 'fast-check';
import type { Comment, CommentAnchor, Document, Style } from '@geomira/kernel/document';
import { emptyDocument, MAIN_LAYER_ID } from '@geomira/kernel/document';
import { applyDocEdit, type DocEdit } from '@geomira/kernel/doc-edit';
import { call, type Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import type { ClaimParam } from '@geomira/claims/kind';
import { createRng, type Rng } from '@geomira/num/rng';
import { chance, double, freshName, literal, pick, text } from './gen-atoms';
import { anyExpr, exprCtx, randomCall, type ExprCtx } from './gen-expr';

export type Step = readonly [number, number];

export const stepsArb: fc.Arbitrary<readonly Step[]> = fc.array(
  fc.tuple(fc.nat({ max: 99 }), fc.nat()),
  {
    minLength: 1,
    maxLength: 60,
    size: 'large',
  },
);

function taken(doc: Document): (n: string) => boolean {
  return (n) => doc.objects.some((o) => o.name === n) || doc.claims.some((c) => c.name === n);
}

function edit(doc: Document, registry: Registry, e: DocEdit): Document {
  const r = applyDocEdit(doc, registry, e);
  return r.ok ? r.doc : doc;
}

function addObj(c: ExprCtx, def: Expr | undefined, point: boolean): Document {
  if (def === undefined) return c.doc;
  const name = freshName(c.rng, taken(c.doc), point);
  const user = c.doc.layers.filter((l) => l.id !== MAIN_LAYER_ID);
  const layers = user.length > 0 && chance(c.rng, 0.2) ? [pick(c.rng, user).id] : undefined;
  const object = layers === undefined ? { name, def } : { name, def, layers };
  return edit(c.doc, c.registry, { kind: 'add', object });
}

function randomStyle(rng: Rng): Style {
  let s: Style = {};
  if (chance(rng, 0.4))
    s = { ...s, color: pick(rng, ['red', 'blue_2', '#ff0000', 'Dark Red', text(rng, true)]) };
  if (chance(rng, 0.3)) s = { ...s, width: double(rng, 0, 10) };
  if (chance(rng, 0.3)) s = { ...s, dash: pick(rng, ['solid', 'dashed', 'dotted'] as const) };
  if (chance(rng, 0.3)) s = { ...s, hidden: chance(rng, 0.5) };
  if (chance(rng, 0.2)) s = { ...s, noimage: chance(rng, 0.5) };
  if (chance(rng, 0.3)) s = { ...s, label: text(rng, true) };
  // ADR-0010 (Run 7): the scene's style fields.
  if (chance(rng, 0.2)) s = { ...s, z: double(rng, -5, 5) };
  if (chance(rng, 0.2)) s = { ...s, labelAngle: double(rng, -360, 360) };
  if (chance(rng, 0.2)) s = { ...s, labelDist: double(rng, 0, 40) };
  // ADR-0029: the object's own opacity.
  if (chance(rng, 0.2)) s = { ...s, opacity: chance(rng, 0.2) ? 1 : double(rng, 0, 1) };
  return s;
}

function layerStep(c: ExprCtx): Document {
  const rng = c.rng;
  const name = freshName(rng, (n) => c.doc.layers.some((l) => l.name === n), chance(rng, 0.1));
  const options = {
    visible: chance(rng, 0.7),
    locked: chance(rng, 0.3),
    opacity: chance(rng, 0.5) ? 1 : double(rng, 0, 1),
  };
  const ts = c.doc.objects.filter(
    (o) => c.kinds.get(o.id)?.every((k) => k === 'transform') === true,
  );
  if (ts.length === 0 || chance(rng, 0.4))
    return edit(c.doc, c.registry, { kind: 'addLayer', name, options });
  const source = pick(rng, c.doc.layers).id;
  const exclude = c.doc.objects
    .filter((o) => o.layers.includes(source) && chance(rng, 0.15))
    .map((o) => o.id);
  const spec = {
    name,
    transform: pick(rng, ts).id,
    source,
    suffix: chance(rng, 0.8) ? '*' : '**',
    exclude,
    options,
  };
  return edit(c.doc, c.registry, { kind: 'addDerivedLayer', spec });
}

function viewStep(c: ExprCtx): Document {
  const rng = c.rng;
  const name = freshName(rng, (n) => c.doc.views.some((v) => v.name === n), false);
  const vis = Object.fromEntries(
    c.doc.layers.filter(() => chance(rng, 0.5)).map((l) => [l.id, chance(rng, 0.5)]),
  );
  const viewport = {
    cx: double(rng, -1e6, 1e6),
    cy: double(rng, -100, 100),
    zoom: double(rng, 1e-3, 1e3),
  };
  const view = chance(rng, 0.5)
    ? { name, layerVisibility: vis, viewport }
    : { name, layerVisibility: vis };
  return edit(c.doc, c.registry, { kind: 'addView', view });
}

function claimArg(c: ExprCtx, p: ClaimParam): Expr | undefined {
  switch (p) {
    case 'point':
      return anyExpr(c, 'point', 1);
    case 'line':
      return anyExpr(c, 'linear', 1);
    case 'circle':
      return anyExpr(c, 'round', 1);
    case 'curve':
      return anyExpr(c, 'curve', 1);
    case 'integer':
      return literal(c.rng, { integer: true });
    case 'number':
      return literal(c.rng, { positive: chance(c.rng, 0.7) });
    default:
      return undefined;
  }
}

function claimStep(c: ExprCtx): Document {
  const k = pick(c.rng, CLAIM_KINDS);
  const params = [
    ...k.params,
    ...(k.rest === undefined
      ? []
      : Array.from({ length: c.rng.nextInt(2) }, () => k.rest ?? 'point')),
  ];
  const args = params.map((p) => claimArg(c, p));
  if (args.some((a) => a === undefined)) return c.doc;
  const id = c.doc.nextId;
  const base = { id, kind: k.name, args: args.filter((a): a is Expr => a !== undefined) };
  const claim = chance(c.rng, 0.3)
    ? { ...base, name: freshName(c.rng, taken(c.doc), false) }
    : base;
  return { ...c.doc, nextId: id + 1, claims: [...c.doc.claims, claim] };
}

function measure(c: ExprCtx, angle: boolean): Expr | undefined {
  const [p, q, r] = [anyExpr(c, 'point', 1), anyExpr(c, 'point', 1), anyExpr(c, 'point', 1)];
  if (p === undefined || q === undefined || r === undefined) return undefined;
  return angle ? call('angle', [p, q, r]) : call('dist', [p, q]);
}

function assumptionArgs(c: ExprCtx, kind: string): (Expr | undefined)[] {
  const pts = (n: number): (Expr | undefined)[] =>
    Array.from({ length: n }, () => anyExpr(c, 'point', 1));
  switch (kind) {
    case 'acute':
    case 'scalene':
      return pts(3);
    case 'convex':
      return pts(3 + c.rng.nextInt(2));
    case 'inside':
      return [anyExpr(c, 'point', 1), anyExpr(c, 'polygon', 0)];
    case 'in_order':
      return [...pts(2 + c.rng.nextInt(2)), anyExpr(c, 'curve', 1)];
    default: {
      const angle = chance(c.rng, 0.5);
      const lit = chance(c.rng, 0.3);
      return [measure(c, angle), lit ? literal(c.rng) : measure(c, angle)];
    }
  }
}

function assumeStep(c: ExprCtx): Document {
  const kind = pick(c.rng, [
    'acute',
    'scalene',
    'convex',
    'inside',
    'in_order',
    'less',
    'greater',
    'not_equal',
  ]);
  const args = assumptionArgs(c, kind);
  if (args.some((a) => a === undefined)) return c.doc;
  const id = c.doc.nextId;
  const a = { id, kind, args: args.filter((x): x is Expr => x !== undefined) };
  return { ...c.doc, nextId: id + 1, assumptions: [...c.doc.assumptions, a] };
}

function anchors(doc: Document): CommentAnchor[] {
  return [
    { kind: 'header' },
    { kind: 'end' },
    ...doc.objects.map((o) => ({ kind: 'object' as const, id: o.id })),
    ...doc.claims.map((x) => ({ kind: 'claim' as const, id: x.id })),
    ...doc.assumptions.map((x) => ({ kind: 'assumption' as const, id: x.id })),
    ...doc.layers.map((l) => ({ kind: 'layer' as const, id: l.id })),
    ...doc.views.map((v) => ({ kind: 'view' as const, name: v.name })),
    ...(doc.meta.title === undefined ? [] : [{ kind: 'title' as const }]),
    ...(doc.meta.author === undefined ? [] : [{ kind: 'author' as const }]),
    ...(doc.viewport === null ? [] : [{ kind: 'viewport' as const }]),
  ];
}

function withComments(doc: Document, rng: Rng): Document {
  const seen = new Set<string>();
  const comments: Comment[] = [];
  for (const a of anchors(doc)) {
    const key = JSON.stringify(a);
    if (seen.has(key) || !chance(rng, 0.25)) continue;
    seen.add(key);
    const lines = Array.from({ length: rng.nextInt(3) }, () => text(rng, true));
    const inline = a.kind !== 'end' && chance(rng, 0.4) ? text(rng, true) : undefined;
    if (lines.length === 0 && inline === undefined) continue;
    comments.push(inline === undefined ? { anchor: a, lines } : { anchor: a, lines, inline });
  }
  return comments.length === 0 ? doc : { ...doc, meta: { ...doc.meta, comments } };
}

function step(doc: Document, registry: Registry, [op, seed]: Step): Document {
  const c = exprCtx(doc, registry, createRng(seed));
  if (op < 25) return addObj(c, call('point', [literal(c.rng), literal(c.rng)]), true);
  if (op < 60) {
    const cap = pick(c.rng, [
      'point',
      'point',
      'linear',
      'round',
      'curve',
      'number',
      'transform',
      'polygon',
      'annotation',
    ] as const);
    return addObj(c, randomCall(c, cap, 0), cap === 'point');
  }
  if (op < 66) {
    const o = doc.objects.length === 0 ? undefined : pick(c.rng, doc.objects);
    return o === undefined
      ? doc
      : edit(doc, registry, { kind: 'style', id: o.id, style: randomStyle(c.rng) });
  }
  if (op < 72) return layerStep(c);
  if (op < 75) {
    const o = doc.objects.filter((x) => x.managedBy === undefined);
    const ls = doc.layers.filter(() => chance(c.rng, 0.5)).map((l) => l.id);
    return o.length === 0 || ls.length === 0
      ? doc
      : edit(doc, registry, { kind: 'setLayers', id: pick(c.rng, o).id, layers: ls });
  }
  if (op < 78) return viewStep(c);
  if (op < 88) return claimStep(c);
  return assumeStep(c);
}

/** The document of a list of steps (deterministic). */
export function buildDoc(steps: readonly Step[], registry: Registry): Document {
  let doc = emptyDocument();
  for (const s of steps) doc = step(doc, registry, s);
  const rng = createRng(steps.reduce((h, [a, b]) => (h * 31 + a + b) % 2 ** 31, 7));
  if (chance(rng, 0.3)) doc = { ...doc, meta: { ...doc.meta, title: text(rng, true) } };
  if (chance(rng, 0.2)) doc = { ...doc, meta: { ...doc.meta, author: text(rng, false) } };
  if (chance(rng, 0.3))
    doc = {
      ...doc,
      viewport: {
        cx: double(rng, -10, 10),
        cy: double(rng, -1e9, 1e9),
        zoom: double(rng, 1e-6, 1e6),
      },
    };
  return withComments(doc, rng);
}

export function docArb(registry: Registry): fc.Arbitrary<Document> {
  return stepsArb.map((s) => buildDoc(s, registry));
}
