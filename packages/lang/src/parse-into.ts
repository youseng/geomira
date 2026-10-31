/**
 * `parseInto(doc, text, registry)` (SPEC §11.3, law P3): parses `text` as the new state of
 * `doc` and keeps the ids of persisting names. The text is the entire state: everything
 * else, styles included, is exactly what the text says (a style line that is gone means the
 * default style; an unchanged style line gives the unchanged style). An object keeps its id
 * when the new text has an object of the same name (both user objects, or both images); a
 * layer when its name persists; a named claim when its name persists, an unnamed claim or
 * an assumption when an identical one (same kind, same arguments) persists. New things get
 * fresh ids above the old nextId, so ids are never reused. Total, like parse; the result
 * differs from parse(text) only in its ids.
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { parse, type ParseOptions, type ParseResult } from './parse';
import { rebase } from './parse-text';

export function parseInto(
  old: Document,
  text: string,
  registry: Registry,
  options: ParseOptions = {},
): ParseResult {
  return rebase(old, parse(text, registry, options));
}
