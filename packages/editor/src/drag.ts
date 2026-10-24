/**
 * Dragging (SPEC §8.4, §12). What can be dragged, and the definition a drag writes:
 *   - a free point `point(x, y)` (literal coordinates): the cursor's coordinates;
 *   - a glider `on(obj, …)` with literal parameters: the parameter of the point of obj
 *     nearest to the cursor (the kernel's dragParameter: line t, stereographic (u : v), or
 *     angle); a glider whose parameter is computed (on(l, s)) is not draggable;
 *   - a managed image X*: its free source, through the kernel's dragThrough (X := T⁻¹(cursor);
 *     not draggable when a map of the chain depends on X);
 *   - a text: its anchor when that is a reference to a draggable point, or a literal point.
 * During the drag coordinates are the exact values of the cursor's doubles; at drag end
 * they are rounded (rounding.ts) and kept only when the dragged object moves by at most
 * ROUNDING_PX on screen (checked by evaluation; otherwise the unrounded values stay, so
 * rounding never moves a point visibly).
 */
import type { DocObject, Document } from '@geomira/kernel/document';
import { findLayer, findObject } from '@geomira/kernel/document';
import { sourceOf } from '@geomira/kernel/derived';
import { dragThrough } from '@geomira/kernel/drag';
import { evaluate, type Evaluation } from '@geomira/kernel/evaluate';
import { call, lit, type CallExpr, type Expr } from '@geomira/kernel/expr';
import { dragParameter, type GliderForm } from '@geomira/kernel/glider';
import type { Value, Vec } from '@geomira/kernel/value';
import { isInexact } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { abs, compare, div, fromNumber, type Rational } from '@geomira/num/rational';
import { decimalText, gridExponent, parameterStep, roundTo, ROUNDING_PX } from './rounding';

/** The object a drag of `id` rewrites, or why `id` cannot be dragged. */
export function dragBase(doc: Document, id: number, values: Evaluation<number>): number | string {
  const o = findObject(doc, id);
  if (o === undefined) return `there is no object #${String(id)}`;
  if (o.managedBy !== undefined) {
    const at = positionOf(values.values.get(id));
    if (at === undefined) return `${o.name} is undefined`;
    const r = dragThrough(doc, id, at, values);
    return r.kind === 'edit' && r.edit.kind === 'redefine' ? r.edit.id : notDraggable(o, r);
  }
  if (isFreePoint(o.def) || isGlider(o.def) || isLiteralText(o.def)) return o.id;
  const anchor = o.def.kind === 'call' && o.def.tool === 'text' ? o.def.args[0] : undefined;
  if (anchor?.kind === 'ref') return dragBase(doc, anchor.id, values);
  if (isComputedGlider(o.def)) return computed(o.name);
  return `${o.name} is not draggable: only free points, gliders, their images and texts are`;
}

function notDraggable(o: DocObject, r: ReturnType<typeof dragThrough>): string {
  return r.kind === 'not-draggable' ? r.reason : `${o.name} cannot be dragged`;
}

/** The position of a point or a text (what a drag moves), else undefined. */
export function positionOf(v: Value<number> | undefined): Vec<number> | undefined {
  if (v?.kind === 'point') return { x: v.x, y: v.y };
  if (v?.kind === 'text') return v.at;
  return undefined;
}

function isLitPair(args: readonly Expr[]): boolean {
  return args.length === 2 && args.every((a) => a.kind === 'lit');
}

function isFreePoint(e: Expr): boolean {
  return e.kind === 'call' && e.tool === 'point' && e.selectors.length === 0 && isLitPair(e.args);
}

function isOn(e: Expr): e is CallExpr {
  return e.kind === 'call' && e.tool === 'on' && e.selectors.length === 0 && e.args.length >= 2;
}

/** A free glider: on(obj, …) with literal parameters only (SPEC §5, claims' free inputs). */
function isGlider(e: Expr): boolean {
  return isOn(e) && e.args.slice(1).every((a) => a.kind === 'lit');
}

/** on(obj, s), on(c, 2 * angle(…)): its parameter is not free, so a drag never rewrites it. */
function isComputedGlider(e: Expr): boolean {
  return isOn(e) && !isGlider(e);
}

function computed(name: string): string {
  return `${name} is not draggable: its parameter is computed`;
}

function isLiteralText(e: Expr): boolean {
  const a = e.kind === 'call' && e.tool === 'text' ? e.args[0] : undefined;
  return a !== undefined && isFreePoint(a);
}

function point(x: Rational, y: Rational, xt?: string, yt?: string): CallExpr {
  return call('point', [lit(x, xt), lit(y, yt)]);
}

/** The value of an argument expression of `base`, evaluated just before it. */
function argValue(doc: Document, base: DocObject, e: Expr, values: Evaluation<number>) {
  if (e.kind === 'ref') return values.values.get(e.id);
  const before = doc.objects.slice(
    0,
    doc.objects.findIndex((o) => o.id === base.id),
  );
  const tmp = { id: doc.nextId, name: 'tmp', def: e, style: {}, layers: base.layers };
  const ev = evaluate(
    { ...doc, objects: [...before, tmp] },
    values.registry,
    FloatField,
    values.ctx,
  );
  return ev.values.get(tmp.id);
}

/** The glider form of on(obj, …) with `n` parameters on a value. */
function formOf(obj: Value<number>, n: number): GliderForm | undefined {
  if (obj.kind === 'line') return 'line';
  if (obj.kind === 'circle') return n === 2 ? 'stereo' : 'angle';
  return undefined;
}

/**
 * The new definition of `base` when its dragged object is at `to` (world), or why not.
 * Exact cursor coordinates (fromNumber); a drag-through goes through the kernel.
 */
export function dragDefinition(
  doc: Document,
  id: number,
  base: number,
  to: Vec<number>,
  values: Evaluation<number>,
): Expr | string {
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y))
    return 'the cursor is not a finite position';
  const o = findObject(doc, id);
  const b = findObject(doc, base);
  if (o === undefined || b === undefined) return 'the dragged object is gone';
  if (o.managedBy !== undefined) {
    const r = dragThrough(doc, id, to, values);
    return r.kind === 'edit' && r.edit.kind === 'redefine' ? r.edit.def : notDraggable(o, r);
  }
  // A text at an object is where its anchor is: drag the anchor as the anchor itself would be
  // dragged (through T⁻¹ for an image; Run 10 audit: the image's source took the cursor).
  const anchor = o.def.kind === 'call' && o.def.tool === 'text' ? o.def.args[0] : undefined;
  if (anchor?.kind === 'ref') return dragDefinition(doc, anchor.id, base, to, values);
  const at = point(fromNumber(to.x), fromNumber(to.y));
  const d = b.def;
  if (d.kind !== 'call') return `${b.name} is not draggable`;
  if (isFreePoint(d)) return at;
  if (isLiteralText(d)) return call('text', [at, ...d.args.slice(1)]);
  if (isComputedGlider(d)) return computed(b.name);
  if (!isGlider(d)) return `${b.name} is not draggable`;
  const [objExpr, ...params] = d.args;
  const obj = objExpr === undefined ? undefined : argValue(doc, b, objExpr, values);
  const form = obj === undefined ? undefined : formOf(obj, params.length);
  if (obj === undefined || objExpr === undefined || form === undefined)
    return `the object ${b.name} glides on is undefined`;
  if (obj.kind !== 'line' && obj.kind !== 'circle') return `${b.name} glides on no curve`;
  const p = dragParameter(FloatField, obj, to, form, values.ctx);
  if (isInexact(p) || 'kind' in p) return p.reason;
  const q = (x: number) => lit(fromNumber(x));
  const args =
    p.form === 'line' ? [q(p.t)] : p.form === 'stereo' ? [q(p.u), q(p.v)] : [q(p.degrees)];
  return call('on', [objExpr, ...args]);
}

/** |a| of every map from an image down to its user source (the image's scale factor). */
export function chainScale(doc: Document, id: number, values: Evaluation<number>): number {
  let k = 1;
  let cur = findObject(doc, id);
  for (let guard = 0; cur?.managedBy !== undefined && guard < doc.objects.length; guard++) {
    const rule = findLayer(doc, cur.managedBy)?.rule;
    const t = rule === undefined ? undefined : values.values.get(rule.transform.id);
    if (t?.kind === 'transform') k *= Math.hypot(t.t.a.re, t.t.a.im);
    cur = findObject(doc, sourceOf(cur) ?? -1);
  }
  return Number.isFinite(k) && k > 0 ? k : 1;
}

/** A literal rounded to 10^e, printed as its decimal. */
function roundedLit(e: Expr, exp: number): Expr {
  if (e.kind !== 'lit') return e;
  const r = roundTo(e.value, exp);
  return lit(r, decimalText(r, exp));
}

/** The size that converts a glider parameter step into a length (|d| or r). */
function gliderSize(obj: Value<number> | undefined): number {
  if (obj?.kind === 'line') return Math.hypot(obj.d.x, obj.d.y);
  if (obj?.kind === 'circle') return Math.sqrt(obj.r2);
  return Number.NaN;
}

/** The definition of `base` with its free numbers rounded on the grid 10^e (see rounding.ts). */
export function roundedDefinition(
  doc: Document,
  base: DocObject,
  exp: number,
  values: Evaluation<number>,
): Expr {
  const d = base.def;
  if (d.kind !== 'call') return d;
  if (isFreePoint(d))
    return call(
      'point',
      d.args.map((a) => roundedLit(a, exp)),
    );
  if (isLiteralText(d)) {
    const [p, ...rest] = d.args;
    return p?.kind === 'call'
      ? call('text', [
          call(
            'point',
            p.args.map((a) => roundedLit(a, exp)),
          ),
          ...rest,
        ])
      : d;
  }
  if (!isGlider(d)) return d;
  const [objExpr, ...params] = d.args;
  const obj = objExpr === undefined ? undefined : argValue(doc, base, objExpr, values);
  const size = gliderSize(obj);
  if (objExpr === undefined || !(size > 0) || !Number.isFinite(size)) return d;
  if (params.length !== 2) {
    const form = obj?.kind === 'line' ? 'line' : 'angle';
    return call('on', [
      objExpr,
      ...params.map((a) => roundedLit(a, parameterStep(form, exp, size))),
    ]);
  }
  return call('on', [objExpr, ...stereoRounded(params, parameterStep('stereo', exp, size))]);
}

/** (u : v) as (1 : w) or (w : 1) with |w| ≤ 1, w rounded on 10^s (the ratio is what counts). */
function stereoRounded(params: readonly Expr[], s: number): Expr[] {
  const [u, v] = params;
  if (u?.kind !== 'lit' || v?.kind !== 'lit') return [...params];
  const [au, av] = [abs(u.value), abs(v.value)];
  if (au.num === 0n && av.num === 0n) return [...params];
  const one = lit(fromNumber(1));
  if (compare(au, av) >= 0) {
    const w = roundTo(div(v.value, u.value), s);
    return [one, lit(w, decimalText(w, s))];
  }
  const w = roundTo(div(u.value, v.value), s);
  return [lit(w, decimalText(w, s)), one];
}

/**
 * The grid exponent of a drag that ends at zoom `zoom`: SPEC §12's rule, with the zoom
 * multiplied by the image's scale factor when the dragged object is an image bigger than its
 * source (so the image, not only its source, moves by at most ROUNDING_PX).
 */
export function dragGrid(scale: number, zoom: number, chain: number): number {
  return gridExponent(scale, zoom * Math.max(1, chain));
}

/** Whether the dragged object moved by at most ROUNDING_PX on screen between two values. */
export function withinRounding(
  a: Value<number> | undefined,
  b: Value<number> | undefined,
  zoom: number,
): boolean {
  const [p, q] = [positionOf(a), positionOf(b)];
  if (p === undefined || q === undefined) return false;
  return Math.hypot(p.x - q.x, p.y - q.y) * zoom <= ROUNDING_PX;
}
