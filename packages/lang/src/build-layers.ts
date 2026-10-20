/**
 * The first pass over directives (ADR-0009): layers (the main layer's options, plain
 * layers, derived layers whose rules wait for their transformation), views, the viewport,
 * title and author. Layers exist before any object, so `@layer` lines may sit anywhere and
 * name objects defined later (transformations and excluded objects).
 */
import type { CommentAnchor, Layer, View } from '@geomira/kernel/document';
import { MAIN_LAYER_ID } from '@geomira/kernel/document';
import { isImageSuffix, nameProblem } from '@geomira/kernel/names';
import { addView } from '@geomira/kernel/views';
import type { Attr, Line, Statement } from './ast';
import { boolAttr, byKey, namesAttr, numberAttr, type Checked } from './attr-values';
import { error } from './diagnostic';
import { floatLiteral } from './lex-literals';
import type { State } from './build-state';

type LayerStmt = Extract<Statement, { kind: 'layer' }>;
type ViewStmt = Extract<Statement, { kind: 'view' }>;

const PLAIN_KEYS = ['visible', 'locked', 'opacity', 'order', 'main'];
const DERIVED_KEYS = [...PLAIN_KEYS, 'suffix', 'exclude'];

function report(st: State): Checked {
  return { diags: st.diags };
}

/** Options of a layer line, applied on top of `base`. */
function options(st: State, m: ReadonlyMap<string, Attr>, base: Layer): Layer {
  let l = base;
  const out = report(st);
  const vis = m.get('visible');
  const lock = m.get('locked');
  const op = m.get('opacity');
  const ord = m.get('order');
  const v = vis === undefined ? undefined : boolAttr(vis, out);
  if (v !== undefined) l = { ...l, visible: v };
  const k = lock === undefined ? undefined : boolAttr(lock, out);
  if (k !== undefined) l = { ...l, locked: k };
  const o = op === undefined ? undefined : numberAttr(op, 0, 1, out);
  if (o !== undefined) l = { ...l, opacity: o };
  const r =
    ord === undefined ? undefined : numberAttr(ord, -Number.MAX_VALUE, Number.MAX_VALUE, out);
  if (r !== undefined) l = { ...l, order: r };
  return l;
}

function nameTaken(st: State, s: LayerStmt): string | undefined {
  return (
    nameProblem(s.target.name) ??
    (st.layerIds.has(s.target.name) ? `the layer name ${s.target.name} is already used` : undefined)
  );
}

/** The main layer's line: its name and options. */
function mainLine(
  st: State,
  s: LayerStmt,
  m: ReadonlyMap<string, Attr>,
): CommentAnchor | undefined {
  if (s.image !== undefined) {
    st.diags.push(
      error(
        s.target.span,
        'the main layer cannot be a derived layer',
        'declare another layer: @layer inv = image(T, main)',
      ),
    );
    return undefined;
  }
  const main = st.doc.layers.find((l) => l.id === MAIN_LAYER_ID);
  if (main === undefined) return undefined;
  const renamed = s.target.name !== main.name;
  const problem = renamed ? nameTaken(st, s) : undefined;
  if (problem !== undefined) {
    st.diags.push(error(s.target.span, problem, 'choose another layer name'));
    return undefined;
  }
  const n = st.diags.length;
  const next = options(st, m, { ...main, name: s.target.name });
  if (st.diags.length > n) return undefined;
  st.doc = { ...st.doc, layers: st.doc.layers.map((l) => (l.id === MAIN_LAYER_ID ? next : l)) };
  if (renamed) {
    st.layerIds.delete(main.name);
    st.layerIds.set(s.target.name, MAIN_LAYER_ID);
  }
  return { kind: 'layer', id: MAIN_LAYER_ID };
}

/** A plain or derived layer line (a rule waits for its transformation). */
function layerLine(
  st: State,
  s: LayerStmt,
  m: ReadonlyMap<string, Attr>,
): CommentAnchor | undefined {
  const problem = nameTaken(st, s);
  if (problem !== undefined) {
    st.diags.push(error(s.target.span, problem, 'choose another layer name'));
    return undefined;
  }
  const id = `L${String(st.doc.nextId)}`;
  const order = Math.max(...st.doc.layers.map((l) => l.order)) + 1;
  const base: Layer = { id, name: s.target.name, visible: true, locked: false, opacity: 1, order };
  const n = st.diags.length;
  const layer = options(st, m, base);
  if (st.diags.length > n) return undefined;
  st.doc = { ...st.doc, nextId: st.doc.nextId + 1, layers: [...st.doc.layers, layer] };
  st.layerIds.set(s.target.name, id);
  return { kind: 'layer', id };
}

/** Rules of derived layers, once every layer exists (sources may come later in the text). */
function rule(st: State, s: LayerStmt, m: ReadonlyMap<string, Attr>): void {
  const id = st.layerIds.get(s.target.name);
  if (s.image === undefined || id === undefined) return;
  const source = st.layerIds.get(s.image.source.name);
  if (source === undefined || source === id) {
    const why =
      source === id
        ? 'a derived layer cannot image itself'
        : `there is no layer "${s.image.source.name}"`;
    st.diags.push(error(s.image.source.span, why, 'name a declared layer, e.g. main'));
    return;
  }
  const suf = m.get('suffix');
  const sv = suf?.values?.[0];
  if (
    suf !== undefined &&
    (suf.values?.length !== 1 || sv?.kind !== 'stars' || !isImageSuffix(sv.text))
  ) {
    st.diags.push(
      error(suf.span, 'the suffix is one or more *', 'write [suffix=*] or [suffix=**]'),
    );
    return;
  }
  const ex = m.get('exclude');
  const exclude = (ex === undefined ? [] : namesAttr(ex, false, report(st))).map((v) => ({
    name: v.text,
    span: v.span,
  }));
  st.rules.push({
    layerId: id,
    layerName: s.target.name,
    span: s.target.span,
    transform: s.image.transform,
    sourceId: source,
    suffix: sv?.text ?? '*',
    exclude,
    state: 'waiting',
  });
}

function viewLine(st: State, s: ViewStmt): CommentAnchor | undefined {
  const n = st.diags.length;
  const m = byKey(s.attrs, ['layers', 'viewport'], 'a view', report(st));
  const vis: Record<string, boolean> = {};
  const ls = m.get('layers');
  for (const v of ls === undefined ? [] : namesAttr(ls, true, report(st))) {
    const id = st.layerIds.get(v.text);
    if (id === undefined)
      st.diags.push(error(v.span, `there is no layer "${v.text}"`, 'name a declared layer'));
    else vis[id] = !v.minus;
  }
  const vp = m.get('viewport');
  const xs = (vp?.values ?? []).map((v) =>
    v.kind === 'number' ? floatLiteral(v.text) : undefined,
  );
  const [cx, cy, zoom] = xs;
  if (
    vp !== undefined &&
    (xs.length !== 3 || cx === undefined || cy === undefined || zoom === undefined)
  ) {
    st.diags.push(
      error(
        vp.span,
        'viewport takes three numbers: centre x, centre y, zoom',
        'write viewport=0,0,50',
      ),
    );
    return undefined;
  }
  const view: View =
    cx === undefined || cy === undefined || zoom === undefined
      ? { name: s.target.name, layerVisibility: vis }
      : { name: s.target.name, layerVisibility: vis, viewport: { cx, cy, zoom } };
  if (st.diags.length > n) return undefined;
  const r = addView(st.doc, view);
  if (!r.ok) {
    st.diags.push(error(s.target.span, r.error, 'fix the view'));
    return undefined;
  }
  st.doc = r.doc;
  return { kind: 'view', name: s.target.name };
}

/** Layers first (in text order), then rules and views. Returns the anchor of each line. */
export function directives(st: State, lines: readonly Line[]): Map<number, CommentAnchor> {
  const anchors = new Map<number, CommentAnchor>();
  const layerLines = lines.flatMap((l) =>
    l.statement?.kind === 'layer' ? [{ line: l.line, s: l.statement }] : [],
  );
  const flagged = layerLines.some(({ s }) => s.attrs.some((a) => a.key === 'main'));
  let mainSeen = false;
  const made: { s: LayerStmt; m: Map<string, Attr> }[] = [];
  for (const { line, s } of layerLines) {
    const n = st.diags.length;
    const m = byKey(
      s.attrs,
      s.image === undefined ? PLAIN_KEYS : DERIVED_KEYS,
      'a layer',
      report(st),
    );
    const isMain = flagged ? m.has('main') : s.target.name === 'main';
    if (isMain && mainSeen) {
      st.diags.push(
        error(s.target.span, 'the main layer is declared twice', 'keep one main layer line'),
      );
      continue;
    }
    mainSeen ||= isMain;
    const a = st.diags.length > n ? undefined : isMain ? mainLine(st, s, m) : layerLine(st, s, m);
    if (a === undefined) continue;
    anchors.set(line, a);
    made.push({ s, m });
  }
  for (const { s, m } of made) rule(st, s, m);
  for (const l of lines) {
    if (l.statement?.kind !== 'view') continue;
    const a = viewLine(st, l.statement);
    if (a !== undefined) anchors.set(l.line, a);
  }
  return anchors;
}
