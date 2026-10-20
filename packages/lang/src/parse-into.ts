/**
 * `parseInto(doc, text, registry)` (SPEC §11.3, law P3): parses `text` as the new state of
 * `doc`, keeping the ids of persisting names and their styles. An object keeps its id when
 * the new text has an object of the same name (and both are user objects, or both images);
 * a layer when the name persists; a named claim when its name persists, an unnamed claim
 * or an assumption when an identical one (same kind, same arguments) persists. New things
 * get fresh ids above the old nextId, so ids are never reused. An object whose style the
 * text does not state at all (no attributes, no `style` or `label` line) keeps its old
 * style, except an old [noimage] that would change the derived layers (the text's images
 * stay). Total, like parse.
 */
import type { Document, Style } from '@geomira/kernel/document';
import { MAIN_LAYER_ID } from '@geomira/kernel/document';
import { syncDerived } from '@geomira/kernel/derived';
import { exprEquals, type Expr } from '@geomira/kernel/expr';
import { checkInvariants } from '@geomira/kernel/invariants';
import type { Registry } from '@geomira/kernel/registry';
import { parseDetailed, type ParseOptions, type ParseResult } from './parse';
import { mapExpr, remapIds } from './remap';

interface Matching {
  readonly obj: Map<number, number>;
  readonly lay: Map<string, string>;
  readonly cl: Map<number, number>;
  readonly as: Map<number, number>;
}

function match(old: Document, neu: Document): Matching {
  let fresh = old.nextId;
  const obj = new Map<number, number>();
  for (const o of neu.objects) {
    const p = old.objects.find(
      (x) => x.name === o.name && (x.managedBy === undefined) === (o.managedBy === undefined),
    );
    obj.set(o.id, p?.id ?? fresh++);
  }
  const lay = new Map<string, string>();
  for (const l of neu.layers) {
    const p =
      l.id === MAIN_LAYER_ID
        ? old.layers.find((x) => x.id === MAIN_LAYER_ID)
        : old.layers.find((x) => x.name === l.name && x.id !== MAIN_LAYER_ID);
    lay.set(l.id, p?.id ?? `L${String(fresh++)}`);
  }
  const f = (id: number): number => obj.get(id) ?? id;
  const used = new Set<number>();
  const cl = new Map<number, number>();
  for (const c of neu.claims) {
    const args = c.args.map((a) => mapExpr(a, f));
    const p = old.claims.find(
      (x) =>
        !used.has(x.id) &&
        (c.name !== undefined
          ? x.name === c.name
          : x.name === undefined && x.kind === c.kind && sameArgs(x.args, args)),
    );
    if (p !== undefined) used.add(p.id);
    cl.set(c.id, p?.id ?? fresh++);
  }
  const as = new Map<number, number>();
  for (const a of neu.assumptions) {
    const args = a.args.map((x) => mapExpr(x, f));
    const p = old.assumptions.find(
      (x) => !used.has(x.id) && x.kind === a.kind && sameArgs(x.args, args),
    );
    if (p !== undefined) used.add(p.id);
    as.set(a.id, p?.id ?? fresh++);
  }
  return { obj, lay, cl, as };
}

function sameArgs(a: readonly Expr[], b: readonly Expr[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      return y !== undefined && exprEquals(x, y);
    })
  );
}

function withoutNoimage(s: Style): Style {
  return {
    ...(s.color === undefined ? {} : { color: s.color }),
    ...(s.width === undefined ? {} : { width: s.width }),
    ...(s.dash === undefined ? {} : { dash: s.dash }),
    ...(s.hidden === undefined ? {} : { hidden: s.hidden }),
    ...(s.label === undefined ? {} : { label: s.label }),
  };
}

/** Old styles for objects whose style the text does not state. */
function keepStyles(
  old: Document,
  doc: Document,
  styled: ReadonlySet<string>,
  withImaging: boolean,
): Document {
  const objects = doc.objects.map((o) => {
    const p = old.objects.find((x) => x.id === o.id);
    if (p === undefined || styled.has(o.name)) return o;
    if (withImaging) return { ...o, style: p.style };
    const rest = withoutNoimage(p.style);
    return {
      ...o,
      style: o.style.noimage === undefined ? rest : { ...rest, noimage: o.style.noimage },
    };
  });
  return { ...doc, objects };
}

function nextIdOf(old: Document, m: Matching): number {
  const nums = [
    ...m.obj.values(),
    ...m.cl.values(),
    ...m.as.values(),
    ...[...m.lay.values()].flatMap((l) => (l === MAIN_LAYER_ID ? [] : [Number(l.slice(1))])),
  ];
  return Math.max(old.nextId, ...nums.map((n) => n + 1));
}

export function parseInto(
  old: Document,
  text: string,
  registry: Registry,
  options: ParseOptions = {},
): ParseResult {
  const p = parseDetailed(text, registry, options);
  const m = match(old, p.doc);
  const renamed = remapIds(p.doc, {
    object: (id) => m.obj.get(id) ?? id,
    layer: (id) => m.lay.get(id) ?? id,
    claim: (id) => m.cl.get(id) ?? id,
    assumption: (id) => m.as.get(id) ?? id,
  });
  const base = { ...renamed, nextId: nextIdOf(old, m) };
  const full = keepStyles(old, base, p.styled, true);
  const synced = syncDerived(full, registry);
  const ok =
    synced.ok &&
    synced.removed.objects.length === 0 &&
    synced.added.length === 0 &&
    checkInvariants(synced.doc).length === 0;
  const doc = ok ? synced.doc : keepStyles(old, base, p.styled, false);
  return { doc, diagnostics: p.diagnostics };
}
