import type { Origin } from '@geomira/editor/autosave';
import type { Revision, RecoveryObservation } from '@geomira/editor/persistence';

export type Producer = string | (() => string);
export interface Editing {
  readonly documentId: string;
  readonly sessionId: string;
  readonly baseId: string | null;
  readonly origin: Origin;
  readonly edited: boolean;
}
export interface Pending {
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
  readonly observation: RecoveryObservation;
}
