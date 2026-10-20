/**
 * The printer (SPEC §11.4, ADR-0009): deterministic text of a document, read back by
 * parse to the same document up to ids (law P1). Layout: header comments, `@version`,
 * title and author, layers, views, viewport, the objects in construction order (managed
 * images appear only as `style X*` lines when they carry a style or a comment), the
 * assumptions, the claims, end comments. Every statement is preceded by its comment lines
 * and followed by its inline comment.
 */
import {
  MAIN_LAYER_ID,
  type Comment,
  type CommentAnchor,
  type Document,
  type Layer,
  type Style,
  type View,
} from '@geomira/kernel/document';
import { DOCUMENT_VERSION } from '@geomira/kernel/document';
import { anchorKey } from './comments';
import { formatFloat, quote } from './lex-literals';
import { printExpr, type Names } from './print-expr';
import { printClaimBody, printConditionBody } from './print-notation';

interface Out {
  readonly lines: string[];
  readonly comments: Map<string, Comment>;
}

function emit(out: Out, anchor: CommentAnchor | undefined, text: string): void {
  const c = anchor === undefined ? undefined : out.comments.get(anchorKey(anchor));
  if (anchor !== undefined) out.comments.delete(anchorKey(anchor));
  for (const l of c?.lines ?? []) out.lines.push(...l.split('\n').map((x) => `#${x}`));
  out.lines.push(c?.inline === undefined ? text : `${text}  #${c.inline.replace(/\n/gu, ' ')}`);
}

function emitComments(out: Out, anchor: CommentAnchor): void {
  const c = out.comments.get(anchorKey(anchor));
  out.comments.delete(anchorKey(anchor));
  for (const l of [...(c?.lines ?? []), ...(c?.inline === undefined ? [] : [c.inline])])
    out.lines.push(...l.split('\n').map((x) => `#${x}`));
}

/** A word when it lexes as one lowercase name with the same value, else a quoted string. */
function wordOrString(s: string): string {
  return /^[a-z][a-z0-9_]*$/u.test(s) ? s : quote(s);
}

function group(items: readonly string[]): string {
  return items.length === 0 ? '' : ` [${items.join(', ')}]`;
}

function styleItems(s: Style): string[] {
  const out: string[] = [];
  if (s.color !== undefined) out.push(`color=${wordOrString(s.color)}`);
  if (s.width !== undefined) out.push(`width=${formatFloat(s.width)}`);
  if (s.dash !== undefined) out.push(`dash=${s.dash}`);
  if (s.hidden !== undefined) out.push(s.hidden ? 'hidden' : 'hidden=false');
  if (s.noimage !== undefined) out.push(s.noimage ? 'noimage' : 'noimage=false');
  if (s.label !== undefined) out.push(`label=${quote(s.label)}`);
  if (s.z !== undefined) out.push(`z=${formatFloat(s.z)}`);
  if (s.labelAngle !== undefined) out.push(`label_angle=${formatFloat(s.labelAngle)}`);
  if (s.labelDist !== undefined) out.push(`label_dist=${formatFloat(s.labelDist)}`);
  return out;
}

function layerName(doc: Document, id: string): string {
  return doc.layers.find((l) => l.id === id)?.name ?? id;
}

function layerLine(doc: Document, l: Layer, order: number, names: Names): string | undefined {
  const items: string[] = [];
  const isMain = l.id === MAIN_LAYER_ID;
  if (isMain && l.name !== 'main') items.push('main');
  if (!l.visible) items.push('visible=false');
  if (l.locked) items.push('locked');
  if (l.opacity !== 1) items.push(`opacity=${formatFloat(l.opacity)}`);
  if (l.order !== order) items.push(`order=${formatFloat(l.order)}`);
  const r = l.rule;
  if (r === undefined) return `@layer ${l.name}${group(items)}`;
  if (r.suffix !== '*') items.push(`suffix=${r.suffix}`);
  const ex = r.exclude.map((id) => names(id) ?? `#${String(id)}`);
  const tail = ex.length === 0 ? '' : ` [exclude=${ex.join(',')}]`;
  return `@layer ${l.name} = image(${names(r.transform.id) ?? '?'}, ${layerName(doc, r.source)})${group(items)}${tail}`;
}

function layers(out: Out, doc: Document, names: Names): void {
  let top = -Infinity;
  for (const l of doc.layers) {
    const isMain = l.id === MAIN_LAYER_ID;
    const order = isMain ? 0 : top + 1;
    top = Math.max(top, l.order);
    const text = layerLine(doc, l, order, names);
    const plainMain =
      isMain && text === '@layer main' && !out.comments.has(anchorKey({ kind: 'layer', id: l.id }));
    if (text !== undefined && !plainMain) emit(out, { kind: 'layer', id: l.id }, text);
  }
}

function viewLine(doc: Document, v: View): string {
  const ls = doc.layers
    .filter((l) => v.layerVisibility[l.id] !== undefined)
    .map((l) => `${v.layerVisibility[l.id] === true ? '' : '-'}${l.name}`);
  const vp = v.viewport;
  const items = [
    ...(ls.length === 0 ? [] : [`[layers=${ls.join(',')}]`]),
    ...(vp === undefined
      ? []
      : [`[viewport=${[vp.cx, vp.cy, vp.zoom].map(formatFloat).join(',')}]`]),
  ];
  return `@view ${v.name}${items.map((x) => ` ${x}`).join('')}`;
}

function objects(out: Out, doc: Document, names: Names): void {
  for (const o of doc.objects) {
    const anchor: CommentAnchor = { kind: 'object', id: o.id };
    if (o.managedBy !== undefined) {
      const items = styleItems(o.style);
      if (items.length > 0 || out.comments.has(anchorKey(anchor)))
        emit(out, anchor, `style ${o.name}${group(items)}`);
      continue;
    }
    const ls =
      o.layers.length === 1 && o.layers[0] === MAIN_LAYER_ID
        ? []
        : [`layers=${o.layers.map((id) => layerName(doc, id)).join(',')}`];
    emit(
      out,
      anchor,
      `${o.name} = ${printExpr(o.def, names)}${group([...styleItems(o.style), ...ls])}`,
    );
  }
}

/** The text of a document (never throws; a document outside P1's domain still prints). */
export function print(doc: Document): string {
  const byId = new Map(doc.objects.map((o) => [o.id, o.name]));
  const names: Names = (id) => byId.get(id);
  const out: Out = {
    lines: [],
    comments: new Map((doc.meta.comments ?? []).map((c) => [anchorKey(c.anchor), c])),
  };
  emit(out, { kind: 'header' }, `@version ${String(DOCUMENT_VERSION)}`);
  if (doc.meta.title !== undefined) emit(out, { kind: 'title' }, `@title ${quote(doc.meta.title)}`);
  if (doc.meta.author !== undefined)
    emit(out, { kind: 'author' }, `@author ${quote(doc.meta.author)}`);
  layers(out, doc, names);
  for (const v of doc.views) emit(out, { kind: 'view', name: v.name }, viewLine(doc, v));
  const vp = doc.viewport;
  if (vp !== null)
    emit(
      out,
      { kind: 'viewport' },
      `@viewport ${[vp.cx, vp.cy, vp.zoom].map(formatFloat).join(' ')}`,
    );
  objects(out, doc, names);
  for (const a of doc.assumptions)
    emit(
      out,
      { kind: 'assumption', id: a.id },
      `assume ${printConditionBody(a.kind, a.args, names)}`,
    );
  for (const c of doc.claims) {
    const attrs = c.name === undefined ? '' : ` [name=${c.name}]`;
    emit(
      out,
      { kind: 'claim', id: c.id },
      `claim ${printClaimBody(c.kind, c.args, names)}${attrs}`,
    );
  }
  for (const c of [...out.comments.values()])
    if (c.anchor.kind !== 'end') emitComments(out, c.anchor);
  emitComments(out, { kind: 'end' });
  return `${out.lines.join('\n')}\n`;
}
