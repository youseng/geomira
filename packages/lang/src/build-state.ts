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
