/** Web persistence coordinator. Policy is pure; durability is a completed IDB transaction. */
import { openSession, shouldSave, type Origin } from '@geomira/editor/autosave';
import {
  commitRevision,
  EMPTY_RECOVERY,
  recoverRevision,
  type LegacyEntry,
  type RecoveryState,
  type Revision,
} from '@geomira/editor/persistence';
import { createRegistry, type Registry } from '@geomira/kernel/registry';
import { BrowserRevisions, type RevisionStorage } from './revision-storage';
import {
  cleanLegacy,
  legacyStartup,
  migrateLegacy,
  readLegacy,
  validatedText,
} from './legacy-recovery';

type Producer = string | (() => string);
interface Editing {
  readonly documentId: string;
  readonly sessionId: string;
  readonly baseId: string | null;
  readonly origin: Origin;
  readonly edited: boolean;
}
interface Pending {
  readonly editing: Editing;
  readonly id: string;
  readonly savedAt: number;
  readonly producer: Producer;
  text: string | null;
  error: string | null;
}
export interface SaveStatus {
  readonly phase: 'saving' | 'saved' | 'not-saved' | 'conflict' | 'browsing';
  readonly message: string | null;
  readonly dirty: boolean;
  readonly documentId: string;
  readonly sessionId: string;
  readonly revisionId: string | null;
  readonly pendingCount: number;
}
export interface RecoveryEntry extends Revision {
  readonly pending: boolean;
  readonly conflict: boolean;
}

const id = () => crypto.randomUUID();
const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export class Autosave {
  private state: RecoveryState = EMPTY_RECOVERY;
  private editing: Editing = {
    documentId: id(),
    sessionId: id(),
    baseId: null,
    origin: 'new',
    edited: false,
  };
  private readonly storage: RevisionStorage;
  private readonly registry: Registry;
  private readonly listeners = new Set<() => void>();
  private readonly pendingSaves = new Map<string, Pending>();
  private readonly bases = new Map<string, string>();
  private scheduled: { task: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<string | null> | null = null;
  private initialized = false;
  private startupError: string | null = null;
  private legacy: readonly LegacyEntry[] = [];
  private dirty = false;
  private lastProducer: Producer | null = null;
  private version = 0;

  constructor(options: { storage?: RevisionStorage; registry?: Registry } = {}) {
    this.storage = options.storage ?? new BrowserRevisions();
    this.registry = options.registry ?? createRegistry();
  }
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getVersion = (): number => this.version;
  private publish(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  /** Valid legacy text is returned even if the migration transaction fails. */
  initialize(): Promise<string | null> {
    this.ready ??= this.load();
    return this.ready;
  }
  private async load(): Promise<string | null> {
    try {
      this.state = await this.storage.read();
      if (!this.state.migrated) {
        this.legacy = readLegacy(this.registry);
        this.state = await this.storage.update((s) =>
          migrateLegacy(s, this.legacy, this.registry, id, Date.now()),
        );
        try {
          cleanLegacy(this.legacy);
        } catch {
          /* Originals can safely remain beside the committed store. */
        }
      }
      this.legacy = this.state.legacy;
      this.initialized = true;
      this.startupError = null;
    } catch (e) {
      this.startupError = errorText(e);
      try {
        this.legacy = readLegacy(this.registry);
      } catch {
        /* A denied legacy getter must not blank the editor. */
      }
    }
    this.publish();
    return (
      this.state.revisions.find((r) => r.id === this.state.currentId)?.text ??
      legacyStartup(this.legacy, this.registry)
    );
  }

  opened(origin: Origin, text: string | null = null): void {
    const revision =
      origin === 'autosave'
        ? [...this.state.revisions].reverse().find((r) => r.text === text)
        : undefined;
    this.editing = {
      documentId: revision?.documentId ?? id(),
      sessionId: id(),
      baseId: revision?.id ?? null,
      origin,
      edited: false,
    };
    this.dirty = false;
    this.lastProducer = text;
    this.publish();
  }
  edited(): void {
    this.editing = { ...this.editing, edited: true };
    this.dirty = true;
    this.publish();
  }
  origin(): Origin {
    return this.editing.origin;
  }
  wasEdited(): boolean {
    return this.editing.edited;
  }

  getStatus(): SaveStatus {
    const error =
      [...this.pendingSaves.values()].find((p) => p.error !== null)?.error ?? this.startupError;
    const baseId = this.bases.get(this.editing.sessionId) ?? this.editing.baseId;
    const conflict = this.state.revisions.some(
      (r) => r.documentId === this.editing.documentId && this.state.conflicts.includes(r.id),
    );
    const browsing = !shouldSave({
      ...openSession(this.editing.origin),
      edited: this.editing.edited,
    });
    const phase =
      error !== null
        ? 'not-saved'
        : this.pendingSaves.size > 0 || this.dirty
          ? 'saving'
          : conflict
            ? 'conflict'
            : browsing
              ? 'browsing'
              : baseId !== null
                ? 'saved'
                : 'not-saved';
    const malformed = this.legacy.some((r) => !r.valid);
    return {
      phase,
      message:
        error ??
        (malformed
          ? 'Some legacy text is invalid. Its original is available in Recovery versions.'
          : null),
      dirty: this.dirty || this.pendingSaves.has(this.editing.sessionId),
      documentId: this.editing.documentId,
      sessionId: this.editing.sessionId,
      revisionId: baseId,
      pendingCount: this.pendingSaves.size,
    };
  }

  schedule(task: () => void, ms: number): void {
    if (this.scheduled !== null) clearTimeout(this.scheduled.timer);
    this.scheduled = {
      task,
      timer: setTimeout(() => {
        void this.flush();
      }, ms),
    };
  }
  /** Starts pending work now; callers that can wait MUST await the returned durability result. */
  async flush(): Promise<boolean> {
    const scheduled = this.scheduled;
    if (scheduled !== null) {
      clearTimeout(scheduled.timer);
      this.scheduled = null;
      scheduled.task();
    }
    await this.queue;
    return this.startupError === null && this.pendingSaves.size === 0 && !this.dirty;
  }

  save(producer: Producer): Promise<boolean> {
    this.lastProducer = producer;
    if (!shouldSave({ ...openSession(this.editing.origin), edited: this.editing.edited }))
      return Promise.resolve(true);
    const pending: Pending = {
      editing: this.editing,
      id: id(),
      savedAt: Date.now(),
      producer,
      text: typeof producer === 'string' ? producer : null,
      error: this.pendingSaves.get(this.editing.sessionId)?.error ?? null,
    };
    this.pendingSaves.set(pending.editing.sessionId, pending);
    this.publish();
    return this.enqueue(() => this.persist(pending));
  }
  private enqueue(action: () => Promise<boolean>): Promise<boolean> {
    const operation = this.queue.then(action);
    this.queue = operation.catch(() => false);
    return operation;
  }
  private revision(p: Pending): Revision {
    return {
      id: p.id,
      documentId: p.editing.documentId,
      sessionId: p.editing.sessionId,
      baseId: this.bases.get(p.editing.sessionId) ?? p.editing.baseId,
      text: p.text ?? '',
      savedAt: p.savedAt,
      source: 'edit',
    };
  }
  private async persist(p: Pending): Promise<boolean> {
    try {
      await this.initialize();
      if (!this.initialized) throw new Error(this.startupError ?? 'Storage unavailable');
      p.text = validatedText(
        typeof p.producer === 'string' ? p.producer : p.producer(),
        this.registry,
      );
      const revision = this.revision(p);
      this.state = await this.storage.update((s) => {
        const base = s.revisions.find((r) => r.id === revision.baseId);
        return base?.text === p.text ? s : commitRevision(s, revision);
      });
      if (this.state.revisions.some((r) => r.id === p.id))
        this.bases.set(p.editing.sessionId, p.id);
      this.startupError = null;
      if (this.pendingSaves.get(p.editing.sessionId) === p)
        this.pendingSaves.delete(p.editing.sessionId);
      if (this.editing === p.editing && !this.pendingSaves.has(p.editing.sessionId))
        this.dirty = false;
      this.publish();
      return true;
    } catch (e) {
      p.error = errorText(e);
      this.publish();
      return false;
    }
  }

  async retry(): Promise<boolean> {
    await this.flush();
    if (!this.initialized) {
      this.ready = null;
      await this.initialize();
    }
    if (
      this.initialized &&
      this.startupError !== null &&
      !this.dirty &&
      this.pendingSaves.size === 0 &&
      this.lastProducer !== null
    )
      await this.save(this.lastProducer);
    for (const pending of [...this.pendingSaves.values()])
      await this.enqueue(() => this.persist(pending));
    return (
      this.initialized && this.startupError === null && this.pendingSaves.size === 0 && !this.dirty
    );
  }

  entries(): readonly RecoveryEntry[] {
    const durable = this.state.revisions.map((r) => ({
      ...r,
      pending: false,
      conflict: this.state.conflicts.includes(r.id),
    }));
    const pending = [...this.pendingSaves.values()]
      .filter((p) => p.text !== null)
      .map((p) => ({
        ...this.revision(p),
        id: `pending:${p.editing.sessionId}`,
        pending: true,
        conflict: false,
      }));
    return [...durable, ...pending].reverse();
  }
  legacyEntries(): readonly LegacyEntry[] {
    return this.legacy;
  }
  canRestore(openText: string): boolean {
    return this.entries().some((r) => r.text !== openText);
  }

  /** Preserve the replaced document and target contents together. No editor change on failure. */
  async restore(openText: string, targetId?: string, resolve = false): Promise<string | undefined> {
    const editing = this.editing;
    await this.flush();
    const target = this.entries().find((r) =>
      targetId === undefined ? r.text !== openText : r.id === targetId,
    );
    if (target === undefined) return undefined;
    if (target.pending) {
      // Keep the figure being replaced in memory even when storage is still unavailable.
      const p: Pending = {
        editing,
        id: id(),
        savedAt: Date.now(),
        producer: openText,
        text: openText,
        error: 'This recovery version is only in memory. Retry saving or download a backup.',
      };
      this.pendingSaves.set(editing.sessionId, p);
      this.publish();
      return target.text;
    }
    try {
      const replacing: Revision = {
        id: id(),
        documentId: editing.documentId,
        sessionId: editing.sessionId,
        baseId: this.bases.get(editing.sessionId) ?? editing.baseId,
        text: validatedText(openText, this.registry),
        savedAt: Date.now(),
        source: 'edit',
      };
      const restoredId = id();
      this.state = await this.storage.update((s) =>
        recoverRevision(s, replacing, target.id, restoredId, Date.now(), resolve),
      );
      this.publish();
      return target.text;
    } catch (e) {
      this.startupError = errorText(e);
      this.publish();
      return undefined;
    }
  }
  /** Compatibility notification; opened('autosave', text) adopts the new revision identity. */
  restored(): void {
    this.publish();
  }

  async refresh(): Promise<void> {
    if (!this.initialized) return;
    try {
      this.state = await this.storage.read();
      this.publish();
    } catch (e) {
      this.startupError = errorText(e);
      this.publish();
    }
  }
}
