/**
 * Objects (SPEC §5, §8.2): each definition is added through the kernel's addObject (names,
 * layers, references checked there); rules whose transformation it is become active; the
 * derived layers are synchronised (images created right after the later of their source
 * and transformation, ADR-0007), and styles waiting for new images are applied. A failure
 * leaves the document as it was before the statement.
 */
import { ref, type Expr } from '@geomira/kernel/expr';
import type { Document, LayerRule, Style } from '@geomira/kernel/document';
import { exprKinds, syncDerived } from '@geomira/kernel/derived';
import { ruleProblem } from '@geomira/kernel/derived-edit';
import { reservedName } from '@geomira/kernel/doc-edit';
import { addObject } from '@geomira/kernel/edit';
import { staticKinds } from '@geomira/kernel/selector-check';
import { error, type Span } from './diagnostic';
import type { PendingRule, State } from './build-state';

export interface NewDef {
  readonly name: string;
  readonly span: Span;
  readonly def: Expr;
  readonly style: Style;
  readonly layers: readonly string[];
}

function register(st: State, ids: readonly number[]): void {
  for (const id of ids) {
    const o = st.doc.objects.find((x) => x.id === id);
    if (o === undefined) continue;
    st.ids.set(o.name, o.id);
    st.staticKinds.set(
      o.id,
      staticKinds(o.def, (r) => st.staticKinds.get(r), st.registry),
    );
    st.kinds.set(o.id, exprKinds(o.def, st.kinds, st.registry));
  }
}

/** Forgets names of objects that are gone (images removed by a sync). */
function prune(st: State): void {
  const live = new Set(st.doc.objects.map((o) => o.id));
  for (const [name, id] of [...st.ids]) if (!live.has(id)) st.ids.delete(name);
}

/** The ids, in list order, of the excluded names that exist. */
function excludeIds(st: State, r: PendingRule): number[] {
  return r.exclude.flatMap((n) => {
    const id = st.ids.get(n.name);
    return id === undefined ? [] : [id];
  });
}

function withRules(doc: Document, rules: ReadonlyMap<string, LayerRule>): Document {
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      const r = rules.get(l.id);
      return r === undefined ? l : { ...l, rule: r };
    }),
  };
}

/** The active rules with their exclusion lists brought up to date. */
function currentRules(st: State): Map<string, LayerRule> {
  const out = new Map<string, LayerRule>();
  for (const r of st.rules) {
    const t = st.ids.get(r.transform.name);
    if (r.state !== 'active' || t === undefined) continue;
    out.set(r.layerId, {
      transform: ref(t),
      source: r.sourceId,
      suffix: r.suffix,
      exclude: excludeIds(st, r),
    });
  }
  return out;
}

/** Applies waiting styles to new objects; whether one of them changes imaging. */
function applyStyles(st: State, ids: readonly number[]): boolean {
  let imaging = false;
  for (const id of ids) {
    const o = st.doc.objects.find((x) => x.id === id);
    const p = o === undefined ? undefined : st.styles.get(o.name);
    if (o === undefined || p === undefined) continue;
    p.used = true;
    st.styled.add(o.name);
    imaging ||= p.style.noimage !== undefined;
    const style = { ...o.style, ...p.style };
    st.doc = { ...st.doc, objects: st.doc.objects.map((x) => (x.id === id ? { ...x, style } : x)) };
  }
  return imaging;
}

/**
 * Synchronises the derived layers until nothing changes (new images may be excluded or
 * styled [noimage], which removes their own images). Returns an error message or undefined.
 */
export function sync(st: State): string | undefined {
  for (let round = 0; round <= st.doc.objects.length + st.rules.length + 1; round++) {
    const r = syncDerived(withRules(st.doc, currentRules(st)), st.registry);
    if (!r.ok) return r.error;
    st.doc = r.doc;
    prune(st);
    register(st, r.added);
    const restyled = applyStyles(st, r.added);
    const excluded = r.added.some((id) =>
      st.rules.some((x) => x.exclude.some((n) => st.ids.get(n.name) === id)),
    );
    if (!restyled && !excluded) return undefined;
  }
  return 'the derived layers do not settle';
}

/** Activates the rules whose transformation is `name` (problems are reported on the layer line). */
function activate(st: State, name: string): void {
  for (const r of st.rules) {
    if (r.state !== 'waiting' || r.transform.name !== name) continue;
    const t = st.ids.get(name);
    if (t === undefined) continue;
    const rule: LayerRule = {
      transform: ref(t),
      source: r.sourceId,
      suffix: r.suffix,
      exclude: excludeIds(st, r),
    };
    const problem = ruleProblem(st.doc, st.registry, r.layerId, rule);
    if (problem !== undefined) {
      r.state = 'failed';
      st.diags.push(error(r.span, `layer ${r.layerName}: ${problem}`, 'fix the layer line'));
      continue;
    }
    const saved = { doc: st.doc, ids: new Map(st.ids) };
    r.state = 'active';
    const why = sync(st);
    if (why === undefined) continue;
    r.state = 'failed';
    st.doc = saved.doc;
    st.ids.clear();
    for (const [k, v] of saved.ids) st.ids.set(k, v);
    st.diags.push(
      error(
        r.span,
        `layer ${r.layerName}: ${why}`,
        'change the suffix or exclude the clashing object',
      ),
    );
  }
}

/** Adds one object; returns its id, or undefined (reported). */
export function addDefinition(st: State, d: NewDef): number | undefined {
  const reserved = reservedName(st.doc, d.name);
  if (reserved !== undefined) {
    st.diags.push(
      error(d.span, reserved, 'choose another name: names ending in * belong to images'),
    );
    return undefined;
  }
  const r = addObject(st.doc, { name: d.name, def: d.def, style: d.style, layers: d.layers });
  if (!r.ok) {
    st.diags.push(error(d.span, r.error, 'choose another name'));
    return undefined;
  }
  const saved = { doc: st.doc, ids: new Map(st.ids) };
  st.doc = r.doc;
  register(st, [r.id]);
  if (st.rules.some((x) => x.state === 'active')) {
    const why = sync(st);
    if (why !== undefined) {
      st.doc = saved.doc;
      st.ids.clear();
      for (const [k, v] of saved.ids) st.ids.set(k, v);
      st.diags.push(error(d.span, why, 'rename the object, or exclude it from the derived layer'));
      return undefined;
    }
  }
  activate(st, d.name);
  return r.id;
}
