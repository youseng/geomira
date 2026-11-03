/**
 * A text parsed once (ADR-0047). The text panel parses what is typed for its diagnostics
 * (`parseText`: a definition that repeats an earlier construction is a warning, ADR-0029, so
 * the text is still accepted) and hands that parse on to replaceText, which turns it into the
 * new state of the document with `rebase`: parseInto from a parse already made (law P3: the ids
 * of persisting names kept; parse-into.ts says how they are matched).
 */
import type { Document } from '@geomira/kernel/document';
import { MAIN_LAYER_ID } from '@geomira/kernel/document';
import { exprEquals, type Expr } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { parse, type ParseResult } from './parse';
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

function nextIdOf(old: Document, m: Matching): number {
  const nums = [
    ...m.obj.values(),
    ...m.cl.values(),
    ...m.as.values(),
    ...[...m.lay.values()].flatMap((l) => (l === MAIN_LAYER_ID ? [] : [Number(l.slice(1))])),
  ];
  return Math.max(old.nextId, ...nums.map((n) => n + 1));
}

/**
 * `parsed` (a parse of the new text) as the new state of `old`, ids of persisting names kept:
 * rebase(old, parse(text)) is parseInto(old, text). A parse that reports repeated
 * constructions as warnings gives the same document (the lines are kept).
 */
export function rebase(old: Document, parsed: ParseResult): ParseResult {
  const m = match(old, parsed.doc);
  const renamed = remapIds(parsed.doc, {
    object: (id) => m.obj.get(id) ?? id,
    layer: (id) => m.lay.get(id) ?? id,
    claim: (id) => m.cl.get(id) ?? id,
    assumption: (id) => m.as.get(id) ?? id,
  });
  return { doc: { ...renamed, nextId: nextIdOf(old, m) }, diagnostics: parsed.diagnostics };
}

/**
 * A text with its parse and the registry it was parsed with: replaceText uses the parse only
 * for this very text and registry.
 */
export interface ParsedText {
  readonly text: string;
  readonly registry: Registry;
  readonly result: ParseResult;
}

/** The text panel's parse (repeated constructions are warnings, ADR-0029). */
export function parseText(text: string, registry: Registry): ParsedText {
  return { text, registry, result: parse(text, registry, { sameConstruction: 'warning' }) };
}
