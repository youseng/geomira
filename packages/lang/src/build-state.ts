/**
 * The builder's working state for one parse (local to the call: no module state). The
 * document grows statement by statement through the kernel's helpers, so the invariants
 * hold at every step; derived layers are synchronised after every object (SPEC §8.2).
 */
import type { Document, Style } from '@geomira/kernel/document';
import { emptyDocument } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { ValueKind } from '@geomira/kernel/value';
import type { NameRef } from './ast';
import { newBook, type CommentBook } from './comments';
import type { Diagnostic, Span } from './diagnostic';

/** A derived layer whose rule becomes active once its transformation is defined. */
export interface PendingRule {
  readonly layerId: string;
  readonly layerName: string;
  readonly span: Span;
  readonly transform: NameRef;
  readonly sourceId: string;
  readonly suffix: string;
  readonly exclude: readonly NameRef[];
  state: 'waiting' | 'active' | 'failed';
}

/** Style statements waiting for their object (applied when it is created). */
export interface PendingStyle {
  style: Style;
  readonly spans: Span[];
  used: boolean;
}

export interface State {
  readonly registry: Registry;
  doc: Document;
  readonly diags: Diagnostic[];
  /** Object name → id (user objects and managed images). */
  readonly ids: Map<string, number>;
  /** Name → line of its definition (from the first pass). */
  readonly defLines: Map<string, number>;
  /** Names whose definition was not applied → that line. */
  readonly failed: Map<string, number>;
  /** Kernel selector-check kinds (staticKinds) and derived-layer kinds (exprKinds). */
  readonly staticKinds: Map<number, readonly ValueKind[] | undefined>;
  readonly kinds: Map<number, readonly ValueKind[] | undefined>;
  readonly styles: Map<string, PendingStyle>;
  /** Layer name → id. */
  readonly layerIds: Map<string, string>;
  readonly rules: PendingRule[];
  readonly book: CommentBook;
  /** The line being built (for "defined later" versus "refers to itself"). */
  line: number;
}

export function newState(registry: Registry): State {
  return {
    registry,
    doc: emptyDocument(),
    diags: [],
    ids: new Map(),
    defLines: new Map(),
    failed: new Map(),
    staticKinds: new Map(),
    kinds: new Map(),
    styles: new Map(),
    layerIds: new Map([['main', 'main']]),
    rules: [],
    book: newBook(),
    line: 0,
  };
}

/** The name of an object id (for messages and expression text). */
export function nameOf(st: State, id: number): string | undefined {
  return st.doc.objects.find((o) => o.id === id)?.name;
}

function refill<K, V>(m: Map<K, V>, from: ReadonlyMap<K, V>): void {
  m.clear();
  for (const [k, v] of from) m.set(k, v);
}

/**
 * A snapshot of what defining objects changes (the document, names, kinds, the states of
 * derived-layer rules, the use of waiting styles), and the function that restores it: a
 * statement that defines several objects is applied whole or not at all (ADR-0009 decision
 * 14). Diagnostics and failed names are kept.
 */
export function snapshot(st: State): () => void {
  const doc = st.doc;
  const ids = new Map(st.ids);
  const staticKinds = new Map(st.staticKinds);
  const kinds = new Map(st.kinds);
  const rules = st.rules.map((r) => r.state);
  const styles = new Map([...st.styles].map(([k, p]) => [k, { ...p, spans: [...p.spans] }]));
  return () => {
    st.doc = doc;
    refill(st.ids, ids);
    refill(st.staticKinds, staticKinds);
    refill(st.kinds, kinds);
    for (const [i, r] of st.rules.entries()) r.state = rules[i] ?? r.state;
    refill(st.styles, styles);
  };
}

/**
 * Runs `f`, which defines the objects `names` of line `line`; when it reports an error,
 * everything it defined is undone and the names that did not exist before are marked failed
 * (later uses then say which line to fix). Returns f's result, or undefined when undone.
 */
export function wholeLine<T>(
  st: State,
  names: readonly string[],
  line: number,
  f: () => T,
): T | undefined {
  const restore = snapshot(st);
  const existed = new Set(names.filter((n) => st.ids.has(n)));
  const n = st.diags.length;
  const r = f();
  if (!st.diags.slice(n).some((d) => d.severity === 'error')) return r;
  restore();
  for (const name of names) if (!existed.has(name)) st.failed.set(name, line);
  return undefined;
}
