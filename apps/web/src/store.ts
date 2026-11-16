import { TextApplier } from './text-apply';
import { timeout } from './long-press';
import type { RecoveryObservation } from '@geomira/editor/persistence';
import { CLAIM_TESTING, CLAIMS_UNAVAILABLE } from './features';
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
import { runClaimText } from '@geomira/editor/claim-bar';
import { applyEdit, type Edit } from '@geomira/editor/edit';
import { toolInput, type ToolInput } from '@geomira/editor/machine';
import type { EditResult } from '@geomira/editor/result';
import { createEditor, type EditorEnv, type EditorState } from '@geomira/editor/state';
import { emptyDocument, type Document } from '@geomira/kernel/document';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parse } from '@geomira/lang/parse';
import { Autosave } from './persist';
import { print } from '@geomira/lang/print';
import type { RevisionStorage } from './revision-storage';

export interface Notice {
  readonly tone: 'refusal' | 'info' | 'error';
  readonly text: string;
  readonly diagnostics?: readonly Diagnostic[];
  /** Answered like a refusal by the next document edit or tool action (ADR-0029). */
  readonly transient?: boolean;
}

export interface Snapshot {
  readonly state: EditorState;
  readonly notice: Notice | null;
  /** Increases whenever a document is opened. */
  readonly openCount: number;
  /**
   * Increases whenever the view is to fit the figure: a document opened, or a sample figure
   * of a verdict shown (ADR-0028).
   */
  readonly fits: number;
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export class EditorStore {
  private snap: Snapshot;
  private readonly listeners = new Set<() => void>();
  readonly autosave: Autosave;
  readonly textDraft: TextApplier;

  constructor(
    readonly env: EditorEnv,
    private readonly onInternal: (message: string) => void,
    storage?: RevisionStorage,
  ) {
    this.autosave = new Autosave({
      registry: env.registry,
      ...(storage === undefined ? {} : { storage }),
    });
    this.snap = {
      state: createEditor(emptyDocument(), env),
      notice: null,
      openCount: 0,
      fits: 0,
    };
    this.textDraft = new TextApplier(this, timeout, () => performance.now());
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
    if (patch.state !== undefined) this.textDraft.follow(this.snap.state.doc);
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
    if (!CLAIM_TESTING && r.state.tool === 'claim') {
      this.setNotice({ tone: 'info', text: CLAIMS_UNAVAILABLE });
      return { ok: false, state: before, reason: CLAIMS_UNAVAILABLE };
    }
    this.noteEdit(r.state, before);
    // A refusal is answered by the next document edit or tool action, not by hover, viewport
    // or selection changes (ADR-0028); errors and information stay until dismissed.
    const s = r.state;
    const acted =
      s.doc !== before.doc || s.tool !== before.tool || s.toolState !== before.toolState;
    const old = this.snap.notice;
    const answered = acted && (old?.tone === 'refusal' || old?.transient === true);
    // A tool that reused an existing construction says so (ADR-0029).
    const notice: Notice | null =
      r.notice === undefined
        ? answered
          ? null
          : old
        : { tone: 'info', text: r.notice, transient: true };
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

  /** An editor action built of edits (the views actions of @geomira/editor/views). */
  run(action: (s: EditorState, env: EditorEnv) => EditResult): EditResult {
    return this.guarded(() => action(this.current(), this.env));
  }

  input(i: ToolInput): EditResult {
    return this.guarded(() => toolInput(this.current(), i, this.env));
  }

  /** Runs a command-bar line; its errors are returned (shown under the bar), not noticed. */
  command(line: string): CommandResult | undefined {
    const s = this.current();
    if (
      !CLAIM_TESTING &&
      /^(?:(?:tool\s+)?claim|test(?:\s+(?:local|global))?|find|hunt|discover|branchFix)$/iu.test(
        line.trim(),
      )
    )
      return { kind: 'error', reason: CLAIMS_UNAVAILABLE, diagnostics: [] };
    try {
      const r = runCommand(s, line, this.env);
      if (r.kind === 'edit') this.commit(r.result, s);
      return r;
    } catch (e) {
      this.onInternal(errorText(e));
      return undefined;
    }
  }

  /** Runs the claim box's text (ADR-0051); its errors are returned, with columns of the box. */
  claim(text: string): CommandResult | undefined {
    if (!CLAIM_TESTING) return { kind: 'error', reason: CLAIMS_UNAVAILABLE, diagnostics: [] };
    const s = this.current();
    try {
      const r = runClaimText(s, text, this.env);
      if (r.kind === 'edit') this.commit(r.result, s);
      return r;
    } catch (e) {
      this.onInternal(errorText(e));
      return undefined;
    }
  }

  open(doc: Document, origin: Origin, notice: Notice | null = null, preserveCurrent = true): void {
    // Capture committed edits even if React's debounce effect has not run yet.
    const before = this.current();
    if (
      preserveCurrent &&
      before.drag === null &&
      (this.snap.openCount > 0 || this.autosave.wasEdited())
    )
      this.autosave.schedule(() => {
        void this.autosave.save(() => print(before.doc));
      }, 0);
    void this.autosave.flush();
    this.autosave.opened(origin, print(doc));
    this.beforeDrag = null;
    const state = createEditor(doc, this.env);
    this.publish({
      state,
      notice,
      openCount: this.snap.openCount + 1,
      fits: this.snap.fits + 1,
    });
  }

  /** Capture the latest settled document before a deliberate retry or reload. */
  retrySaving(): Promise<boolean> {
    const state = this.current();
    if (state.drag !== null) return Promise.resolve(false);
    this.autosave.schedule(() => {
      void this.autosave.save(() => print(state.doc));
    }, 0);
    return this.autosave.retry();
  }

  /** Await a recoverable restore; an edit during its transaction must not be replaced. */
  async restoreRevision(
    id?: string,
    resolve = false,
    observation?: RecoveryObservation,
  ): Promise<boolean> {
    const before = this.current().doc;
    const text = await this.autosave.restore(print(before), id, resolve, observation);
    if (text === undefined) return false;
    if (this.current().doc !== before) {
      this.setNotice({
        tone: 'info',
        text: 'Recovery was saved, but the figure changed while restoring. Choose the recovery version again to open it.',
      });
      return false;
    }
    this.openText(text, 'autosave', false);
    return true;
  }

  /** Asks for the view to fit the figure once it is drawn (useFitOnOpen). */
  requestFit(): void {
    this.publish({ fits: this.snap.fits + 1 });
  }

  /** Opens a text (parse is total: lines with errors are left out and listed). */
  openText(text: string, origin: Origin, preserveCurrent = true): void {
    const r = parse(text, this.env.registry);
    const errors = r.diagnostics.filter((d) => d.severity === 'error');
    const notice: Notice | null =
      errors.length === 0
        ? null
        : { tone: 'error', text: 'Some lines had errors and were left out.', diagnostics: errors };
    this.open(r.doc, origin, notice, preserveCurrent);
  }
}

/** The store's snapshot in a component. */
export function useSnapshot(store: EditorStore): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
