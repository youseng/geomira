/**
 * Storage for the autosave policy (SPEC §12): the policy itself is packages/editor's
 * (autosave.ts, restore.ts: pure functions); this class only reads and writes the two slots
 * in localStorage and keeps the session. Storage can be unavailable (private modes, quota,
 * blocked site data, where even reading `localStorage` throws): reads then give empty slots
 * and writes are dropped, never an error in the page.
 */
import {
  afterEdit,
  EMPTY_SLOTS,
  openSession,
  save,
  shouldSave,
  type AutosaveSlots,
  type Origin,
  type Session,
} from '@geomira/editor/autosave';
import { restoreOffer, restoredSession } from '@geomira/editor/restore';

const KEYS = { current: 'geomira.autosave.current', previous: 'geomira.autosave.previous' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable or full: the figure stays in the page; nothing else to do.
  }
}

/** Whether storage exists at all. Reading `localStorage` itself throws when it is blocked. */
function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readSlots(): AutosaveSlots {
  if (!hasStorage()) return EMPTY_SLOTS;
  return { current: read(KEYS.current), previous: read(KEYS.previous) };
}

function writeSlots(s: AutosaveSlots): void {
  write(KEYS.current, s.current);
  write(KEYS.previous, s.previous);
}

export class Autosave {
  private session: Session = openSession('new');
  /** The save waiting for its timer (useAutosave schedules it after each change). */
  private pending: {
    readonly task: () => void;
    readonly timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private readonly listeners = new Set<() => void>();
  private version = 0;

  /**
   * Subscribers are told when the slots are written (the header's "Restore previous figure"
   * depends on them, and a save writes them after the render: ADR-0028).
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Changes whenever this object writes the slots. */
  readonly getVersion = (): number => this.version;

  private write(slots: AutosaveSlots): void {
    writeSlots(slots);
    this.version++;
    for (const l of this.listeners) l();
  }

  /** Runs `task` (a save) after `ms`, replacing the save pending before it. */
  schedule(task: () => void, ms: number): void {
    if (this.pending !== null) clearTimeout(this.pending.timer);
    const timer = setTimeout(() => {
      this.flush();
    }, ms);
    this.pending = { task, timer };
  }

  /**
   * Runs the pending save now, if any: before another figure opens or a restore reads the
   * slots, and when the page hides, so the last edit is never lost (ADR-0028).
   */
  flush(): void {
    const p = this.pending;
    if (p === null) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.task();
  }

  /** A document was opened (startup, example, file, link). */
  opened(origin: Origin): void {
    this.session = openSession(origin);
  }

  /** The open document was edited. */
  edited(): void {
    this.session = afterEdit(this.session);
  }

  origin(): Origin {
    return this.session.origin;
  }

  wasEdited(): boolean {
    return this.session.edited;
  }

  /** Saves `text` if the policy says so. */
  save(text: string): void {
    const before = readSlots();
    const r = save(before, this.session, text);
    const changed = r.slots.current !== before.current || r.slots.previous !== before.previous;
    if (shouldSave(this.session) && changed) this.write(r.slots);
    this.session = r.session;
  }

  /** Whether "Restore previous figure" has something to open. */
  canRestore(openText: string): boolean {
    return restoreOffer(readSlots(), this.session, openText) !== undefined;
  }

  /** Performs "Restore previous figure" on the slots: the text to open, or undefined. */
  restore(openText: string): string | undefined {
    this.flush();
    const offer = restoreOffer(readSlots(), this.session, openText);
    if (offer === undefined) return undefined;
    this.write(offer.slots);
    return offer.text;
  }

  /** The restored text was opened: its session has saved its slot already. */
  restored(): void {
    this.session = restoredSession();
  }
}
