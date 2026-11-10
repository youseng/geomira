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
import { sortImageRuns } from './canonical';
import { anchorKey } from './comments';
import { formatFloat, quote } from './lex-literals';
import { printExpr, type CallHook, type Names } from './print-expr';
import { printClaimBody, printConditionBody, type KindCall } from './print-notation';

/**
 * How definitions, claims and assumptions are written: the canonical notation (nothing set), or
 * the short one (print-short.ts). `pair` writes the objects at `index` and `index + 1` as ONE
 * statement (`X, Y = call(…)`, without attributes) or returns undefined.
 */
export interface Notation {
  /** The call hook for expressions whose references are named by `names`. */
  readonly call?: (names: Names) => CallHook;
  readonly kindCall?: KindCall;
  readonly pair?: (doc: Document, index: number, names: Names) => string | undefined;
}

interface Out {
  readonly lines: string[];
  readonly comments: Map<string, Comment>;
}

/** Comment lines as `#…` lines: line breaks split them, trailing CRs are dropped (P2). */
function commentLines(l: string): string[] {
  return l.split('\n').map((x) => `#${x.replace(/\r+$/u, '')}`);
}

function emit(out: Out, anchor: CommentAnchor | undefined, text: string): void {
  const c = anchor === undefined ? undefined : out.comments.get(anchorKey(anchor));
  if (anchor !== undefined) out.comments.delete(anchorKey(anchor));
  for (const l of c?.lines ?? []) out.lines.push(...commentLines(l));
  const inline = c?.inline?.replace(/\n/gu, ' ').replace(/\r+$/u, '');
  out.lines.push(inline === undefined ? text : `${text}  #${inline}`);
}

function emitComments(out: Out, anchor: CommentAnchor): void {
  const c = out.comments.get(anchorKey(anchor));
  out.comments.delete(anchorKey(anchor));
  for (const l of [...(c?.lines ?? []), ...(c?.inline === undefined ? [] : [c.inline])])
    out.lines.push(...commentLines(l));
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
  if (s.opacity !== undefined) out.push(`opacity=${formatFloat(s.opacity)}`);
  if (s.hidden !== undefined) out.push(s.hidden ? 'hidden' : 'hidden=false');
  if (s.noimage !== undefined) out.push(s.noimage ? 'noimage' : 'noimage=false');
  if (s.label !== undefined) out.push(`label=${quote(s.label)}`);
  if (s.z !== undefined) out.push(`z=${formatFloat(s.z)}`);
  if (s.labelAngle !== undefined) out.push(`label_angle=${formatFloat(s.labelAngle)}`);
  if (s.labelDist !== undefined) out.push(`label_dist=${formatFloat(s.labelDist)}`);
  if (s.show !== undefined) out.push(s.show ? 'show' : 'show=false');
  if (s.digits !== undefined) out.push(`digits=${formatFloat(s.digits)}`);
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

/** The attribute group of an unmanaged object: its style, then its layers when not just main. */
function attrsOf(doc: Document, o: Document['objects'][number]): string {
  const ls =
    o.layers.length === 1 && o.layers[0] === MAIN_LAYER_ID
      ? []
      : [`layers=${o.layers.map((id) => layerName(doc, id)).join(',')}`];
  return group([...styleItems(o.style), ...ls]);
}

/**
 * The objects at `i` and `i + 1` as one statement of the notation, when they are written the
 * same way (same attributes) and the second carries no comment; else undefined.
 */
function pairLine(
  out: Out,
  doc: Document,
  i: number,
  names: Names,
  n: Notation,
): string | undefined {
  const [a, b] = [doc.objects[i], doc.objects[i + 1]];
  if (n.pair === undefined || a === undefined || b === undefined) return undefined;
  if (a.managedBy !== undefined || b.managedBy !== undefined) return undefined;
  if (out.comments.has(anchorKey({ kind: 'object', id: b.id }))) return undefined;
  const attrs = attrsOf(doc, a);
  if (attrs !== attrsOf(doc, b)) return undefined;
  const text = n.pair(doc, i, names);
  return text === undefined ? undefined : `${text}${attrs}`;
}

function objects(out: Out, doc: Document, names: Names, n: Notation): void {
  for (let i = 0; i < doc.objects.length; i++) {
    const o = doc.objects[i];
    if (o === undefined) continue;
    const anchor: CommentAnchor = { kind: 'object', id: o.id };
    if (o.managedBy !== undefined) {
      const items = styleItems(o.style);
      if (items.length > 0 || out.comments.has(anchorKey(anchor)))
        emit(out, anchor, `style ${o.name}${group(items)}`);
      continue;
    }
    const pair = pairLine(out, doc, i, names, n);
    if (pair !== undefined) {
      emit(out, anchor, pair);
      i++;
      continue;
    }
    emit(out, anchor, `${o.name} = ${printExpr(o.def, names, n.call?.(names))}${attrsOf(doc, o)}`);
  }
}
/**
 * The text of a document (never throws; a document outside P1's domain still prints). Runs
 * of adjacent images are printed in their canonical order (sortImageRuns), so the text does
 * not depend on where edits left an image inside its run (ADR-0009 decision 20): images
 * appear only through their `style X*` lines and comments, whose order would otherwise
 * follow the edit history and break print∘parse∘print = print.
 *
 * `n` is the notation: {} for the canonical one (print.ts), print-short.ts's for the short one.
 */
export function printIn(given: Document, n: Notation): string {
  const doc = sortImageRuns(given);
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
  objects(out, doc, names, n);
  for (const a of doc.assumptions)
    emit(
      out,
      { kind: 'assumption', id: a.id },
      `assume ${printConditionBody(a.kind, a.args, names, n.kindCall)}`,
    );
  for (const c of doc.claims) {
    const attrs = c.name === undefined ? '' : ` [name=${c.name}]`;
    emit(
      out,
      { kind: 'claim', id: c.id },
      `claim ${printClaimBody(c.kind, c.args, names, n.kindCall)}${attrs}`,
    );
  }
  for (const c of [...out.comments.values()])
    if (c.anchor.kind !== 'end') emitComments(out, c.anchor);
  emitComments(out, { kind: 'end' });
  return `${out.lines.join('\n')}\n`;
}
