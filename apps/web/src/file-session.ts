/** Coordinates file actions without acknowledging downloads as durable local saves. */
import { emptyDocument, type Document } from '@geomira/kernel/document';
import { print } from '@geomira/lang/print';
import { readDocumentFile, namedDocument } from './document-file';
import {
  applyValidDraft,
  draftIssue,
  downloadFigure,
  replaceDocument,
  duplicateDocument,
} from './file-actions';
import type { EditorStore } from './store';

export type FileChoice = { kind: 'new' | 'open' | 'save-as' | 'save'; doc?: Document };
export interface FileState {
  readonly busy: boolean;
  readonly menu: boolean;
  readonly choice: FileChoice | null;
  readonly name: string;
  readonly error: string | null;
  readonly downloaded: string | null;
  readonly failedRecovery: boolean;
}
export class FileSession {
  private state: FileState = {
    busy: false,
    menu: false,
    choice: null,
    name: '',
    error: null,
    downloaded: null,
    failedRecovery: false,
  };
  private operation = 0;
  private release: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(readonly store: EditorStore) {}
  readonly snapshot = (): FileState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  patch(patch: Partial<FileState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  readonly finish = (): void => {
    if (this.state.busy) return;
    this.operation++;
    this.patch({ choice: null, menu: false, error: null, failedRecovery: false });
    this.release?.();
    this.release = null;
  };
  toggle(): void {
    if (this.state.busy) return;
    this.operation++;
    if (this.state.menu) {
      this.finish();
      return;
    }
    this.release = this.store.textDraft.hold();
    this.patch({ menu: true });
  }
  start(choice: FileChoice): void {
    if (this.state.busy) return;
    this.operation++;
    this.patch({
      choice,
      menu: false,
      error: null,
      failedRecovery: false,
      name:
        choice.kind === 'new'
          ? 'Untitled'
          : `${this.store.current().doc.meta.title ?? 'Untitled'} copy`,
    });
  }
  async read(file: File): Promise<void> {
    if (this.state.busy) return;
    const operation = ++this.operation;
    try {
      const doc = await readDocumentFile(file, this.store.env.registry);
      if (operation === this.operation) this.start({ kind: 'open', doc });
    } catch (e) {
      if (operation !== this.operation) return;
      this.start({ kind: 'open' });
      this.patch({ error: String(e) });
    }
  }
  save(): void {
    if (this.state.busy) return;
    try {
      applyValidDraft(this.store);
      if (this.backup()) this.finish();
      else this.patch({ choice: { kind: 'save' }, menu: false });
    } catch (e) {
      this.start({ kind: 'save' });
      this.patch({ error: String(e) });
    }
  }
  backup(): boolean {
    try {
      this.patch({ downloaded: downloadFigure(this.store) });
      return true;
    } catch (e) {
      this.patch({ error: String(e) });
      return false;
    }
  }
  async confirm(discard = false): Promise<void> {
    const choice = this.state.choice;
    if (choice === null || this.state.busy) return;
    const operation = this.operation;
    const active = () => this.state.choice === choice && operation === this.operation;
    try {
      if (choice.kind === 'save') {
        if (this.backup()) this.finish();
        return;
      }
      this.patch({ busy: true });
      if (choice.kind === 'save-as') namedDocument(this.store.current().doc, this.state.name);
      if (choice.kind === 'save-as' && draftIssue(this.store) === null) applyValidDraft(this.store);
      const ok =
        choice.kind === 'save-as'
          ? await duplicateDocument(this.store, this.state.name, discard, active)
          : await replaceDocument(
              this.store,
              choice.kind === 'open' && choice.doc !== undefined
                ? choice.doc
                : namedDocument(emptyDocument(), this.state.name),
              discard,
              active,
            );
      if (!active()) return;
      if (!ok) {
        this.patch({ busy: false, failedRecovery: true });
        return;
      }
      this.patch({
        busy: false,
        downloaded: choice.kind === 'save-as' ? print(this.store.current().doc) : null,
      });
      this.finish();
    } catch (e) {
      this.patch({ busy: false, error: String(e) });
    } finally {
      this.patch({ busy: false });
    }
  }
  dispose(): void {
    this.operation++;
    this.release?.();
  }
}
