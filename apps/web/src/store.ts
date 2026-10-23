/**
 * The page's editor: one packages/editor EditorState, changed ONLY through applyEdit,
 * toolInput and runCommand (note A of Run 8b: the UI is a thin layer; no geometry,
 * selector, verdict or autosave logic here). An external store (useSyncExternalStore): the
 * latest state is available between renders, so pointer handlers build on it. A refusal is
 * shown as a notice; an exception (a bug) is reported as an internal error with the debug
 * report at hand (note D).
 */
import { useSyncExternalStore } from 'react';
import type { Origin } from '@geomira/editor/autosave';
import { runCommand, type CommandResult } from '@geomira/editor/command';
import { applyEdit, type Edit } from '@geomira/editor/edit';
import { toolInput, type ToolInput } from '@geomira/editor/machine';
import type { EditResult } from '@geomira/editor/result';
import { createEditor, type EditorEnv, type EditorState } from '@geomira/editor/state';
import { emptyDocument, type Document } from '@geomira/kernel/document';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parse } from '@geomira/lang/parse';
import { Autosave } from './persist';

export interface Notice {
  readonly tone: 'refusal' | 'info' | 'error';
  readonly text: string;
  readonly diagnostics?: readonly Diagnostic[];
}

export interface Snapshot {
  readonly state: EditorState;
  readonly notice: Notice | null;
  /** Increases whenever a document is opened: the view is fitted again. */
  readonly openCount: number;
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export class EditorStore {
  private snap: Snapshot;
  private readonly listeners = new Set<() => void>();
  readonly autosave = new Autosave();

  constructor(
    readonly env: EditorEnv,
    private readonly onInternal: (message: string) => void,
  ) {
    this.snap = { state: createEditor(emptyDocument(), env), notice: null, openCount: 0 };
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): Snapshot => this.snap;

  current(): EditorState {
    return this.snap.state;
  }

  private publish(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  setNotice(notice: Notice | null): void {
    if (notice !== this.snap.notice) this.publish({ notice });
  }

  /** The document when the current drag started (a drag is one edit, or none if canceled). */
  private beforeDrag: EditorState['doc'] | null = null;

  /**
   * Marks the session edited (autosave, share links) when a document change is committed: an
   * edit, or a drag at its end if it moved anything. A canceled drag restores the document and
   * is no edit (Run 10 audit: each dragMove marked a link session edited, so a canceled drag
   * saved the link and removed its hash).
   */
  private noteEdit(after: EditorState, before: EditorState): void {
    if (after.drag !== null) {
      if (before.drag === null) this.beforeDrag = before.doc;
      return;
    }
    const from = this.beforeDrag ?? before.doc;
    this.beforeDrag = null;
    if (after.doc !== from) this.autosave.edited();
  }

  private commit(r: EditResult, before: EditorState): EditResult {
    if (!r.ok) {
      const d = r.diagnostics === undefined ? {} : { diagnostics: r.diagnostics };
      this.setNotice({ tone: 'refusal', text: r.reason, ...d });
      return r;
    }
    this.noteEdit(r.state, before);
    // A refusal is answered by the next success; errors and information stay until dismissed.
    const notice = this.snap.notice?.tone === 'refusal' ? null : this.snap.notice;
    this.publish({ state: r.state, notice });
    return r;
  }

  private guarded(f: () => EditResult): EditResult {
    const s = this.current();
    try {
      return this.commit(f(), s);
    } catch (e) {
      this.onInternal(errorText(e));
      return { ok: false, state: s, reason: 'internal error' };
    }
  }

  apply(e: Edit): EditResult {
    return this.guarded(() => applyEdit(this.current(), e, this.env));
  }

  input(i: ToolInput): EditResult {
    return this.guarded(() => toolInput(this.current(), i, this.env));
  }

  /** Runs a command-bar line; its errors are returned (shown under the bar), not noticed. */
  command(line: string): CommandResult | undefined {
    const s = this.current();
    try {
      const r = runCommand(s, line, this.env);
      if (r.kind === 'edit') this.commit(r.result, s);
      return r;
    } catch (e) {
      this.onInternal(errorText(e));
      return undefined;
    }
  }

  open(doc: Document, origin: Origin, notice: Notice | null = null): void {
    // The figure being left saves its last edit first (its save may still be pending).
    this.autosave.flush();
    this.autosave.opened(origin);
    this.beforeDrag = null;
    const state = createEditor(doc, this.env);
    this.publish({ state, notice, openCount: this.snap.openCount + 1 });
  }

  /** Opens a text (parse is total: lines with errors are left out and listed). */
  openText(text: string, origin: Origin): void {
    const r = parse(text, this.env.registry);
    const errors = r.diagnostics.filter((d) => d.severity === 'error');
    const notice: Notice | null =
      errors.length === 0
        ? null
        : { tone: 'error', text: 'Some lines had errors and were left out.', diagnostics: errors };
    this.open(r.doc, origin, notice);
  }
}

/** The store's snapshot in a component. */
export function useSnapshot(store: EditorStore): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
