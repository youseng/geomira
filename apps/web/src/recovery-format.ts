/** Defensive format checks: never replace an unknown/damaged store with an empty one. */
import type { LegacyEntry, RecoveryState, Revision } from '@geomira/editor/persistence';

function isRevision(value: unknown): value is Revision {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'documentId' in value &&
    typeof value.documentId === 'string' &&
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'baseId' in value &&
    (value.baseId === null || typeof value.baseId === 'string') &&
    'text' in value &&
    typeof value.text === 'string' &&
    'savedAt' in value &&
    typeof value.savedAt === 'number' &&
    Number.isFinite(value.savedAt) &&
    'source' in value &&
    ['edit', 'restore', 'legacy-current', 'legacy-previous'].includes(String(value.source)) &&
    (!('restoredFrom' in value) || typeof value.restoredFrom === 'string') &&
    (!('replacesId' in value) || typeof value.replacesId === 'string')
  );
}

function isLegacy(value: unknown): value is LegacyEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    typeof value.key === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'valid' in value &&
    typeof value.valid === 'boolean'
  );
}

export function isRecoveryState(value: unknown): value is RecoveryState {
  if (typeof value !== 'object' || value === null) return false;
  if (!(
    'schema' in value &&
    value.schema === 2 &&
    'migrated' in value &&
    typeof value.migrated === 'boolean' &&
    'currentId' in value &&
    (value.currentId === null || typeof value.currentId === 'string') &&
    'revisions' in value &&
    Array.isArray(value.revisions) &&
    value.revisions.every(isRevision) &&
    'conflicts' in value &&
    Array.isArray(value.conflicts) &&
    value.conflicts.every((s: unknown) => typeof s === 'string') &&
    'legacy' in value &&
    Array.isArray(value.legacy) &&
    value.legacy.every(isLegacy)
  ))
    return false;
  const ids = value.revisions.map((r: Revision) => r.id);
  return (
    new Set(ids).size === ids.length &&
    (value.currentId === null || ids.includes(value.currentId)) &&
    value.conflicts.every((id: string) => ids.includes(id))
  );
}
