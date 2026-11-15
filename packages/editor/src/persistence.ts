/** Pure revision/conflict/retention policy. The host MUST apply it in one transaction. */
export interface Revision {
  readonly id: string;
  readonly documentId: string;
  readonly sessionId: string;
  readonly baseId: string | null;
  readonly text: string;
  readonly savedAt: number;
  readonly source: 'edit' | 'restore' | 'legacy-current' | 'legacy-previous';
  readonly restoredFrom?: string;
  readonly replacesId?: string;
}

export interface LegacyEntry {
  readonly key: string;
  readonly text: string;
  readonly valid: boolean;
}

export interface RecoveryState {
  readonly schema: 2;
  readonly revisions: readonly Revision[];
  readonly currentId: string | null;
  readonly conflicts: readonly string[];
  readonly legacy: readonly LegacyEntry[];
  readonly migrated: boolean;
}

export const EMPTY_RECOVERY: RecoveryState = Object.freeze({
  schema: 2,
  revisions: [],
  currentId: null,
  conflicts: [],
  legacy: [],
  migrated: false,
});

export interface RetentionLimits {
  readonly revisions: number;
  readonly bytes: number;
  readonly history: number;
}

export const RETENTION: RetentionLimits = Object.freeze({
  revisions: 128,
  bytes: 8 * 1024 * 1024,
  history: 10,
});

/** Commit order, not wall-clock time, determines the head (clocks can go backwards). */
export function documentHead(state: RecoveryState, documentId: string): Revision | undefined {
  return [...state.revisions].reverse().find((r) => r.documentId === documentId);
}

/** Protected minima may exhaust capacity; refusing is safer than deleting another figure. */
export function retainRevisions(
  state: RecoveryState,
  limits: RetentionLimits = RETENTION,
): RecoveryState {
  const protectedIds = new Set(state.conflicts);
  const counts = new Map<string, number>();
  const keep = new Set<string>();
  if (state.currentId !== null) protectedIds.add(state.currentId);
  for (const r of [...state.revisions].reverse()) {
    const count = counts.get(r.documentId) ?? 0;
    if (count === 0) {
      protectedIds.add(r.id);
      if (r.replacesId !== undefined) protectedIds.add(r.replacesId);
    }
    if (count < limits.history) keep.add(r.id);
    counts.set(r.documentId, count + 1);
  }
  let revisions = state.revisions.filter((r) => keep.has(r.id) || protectedIds.has(r.id));
  const fits = () =>
    revisions.length <= limits.revisions &&
    JSON.stringify({ ...state, revisions }).length * 2 <= limits.bytes;
  while (!fits()) {
    const removable = revisions.find((r) => !protectedIds.has(r.id));
    if (removable === undefined)
      throw new Error('Recovery capacity is full. Download a backup and resolve conflicts.');
    revisions = revisions.filter((r) => r.id !== removable.id);
  }
  return { ...state, revisions };
}

/** A stale request creates a durable fork; it cannot overwrite either writer's contents. */
export function commitRevision(
  state: RecoveryState,
  revision: Revision,
  limits: RetentionLimits = RETENTION,
): RecoveryState {
  const existing = state.revisions.find((r) => r.id === revision.id);
  if (existing !== undefined) {
    if (JSON.stringify(existing) !== JSON.stringify(revision))
      throw new Error('Revision identity was reused.');
    return state;
  }
  const head = documentHead(state, revision.documentId);
  const stale = head !== undefined && head.id !== revision.baseId;
  const conflicts = new Set(state.conflicts);
  if (stale) {
    conflicts.add(head.id);
    conflicts.add(revision.id);
  }
  return retainRevisions(
    {
      ...state,
      revisions: [...state.revisions, revision],
      currentId: revision.id,
      conflicts: [...conflicts],
    },
    limits,
  );
}

/** Both the replaced figure and restored contents commit together or neither does. */
export function recoverRevision(
  state: RecoveryState,
  replacing: Revision,
  targetId: string,
  id: string,
  savedAt: number,
  resolve: boolean,
  limits: RetentionLimits = RETENTION,
): RecoveryState {
  const target = state.revisions.find((r) => r.id === targetId);
  if (target === undefined) throw new Error('This recovery version is no longer available.');
  const conflicts = resolve
    ? state.conflicts.filter(
        (key) => state.revisions.find((r) => r.id === key)?.documentId !== target.documentId,
      )
    : state.conflicts;
  const saved = commitRevision({ ...state, conflicts }, replacing, limits);
  const baseId = documentHead(saved, target.documentId)?.id ?? null;
  return commitRevision(
    saved,
    {
      ...target,
      id,
      sessionId: replacing.sessionId,
      baseId,
      savedAt,
      source: 'restore',
      restoredFrom: target.id,
      replacesId: replacing.id,
    },
    limits,
  );
}
