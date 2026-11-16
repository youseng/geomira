import { commitRevision, type LegacyEntry, type RecoveryState } from '@geomira/editor/persistence';
import type { Registry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';

export const LEGACY_KEYS = ['geomira.autosave.previous', 'geomira.autosave.current'] as const;

/** Never accept a partial parse as a saved or migrated document. */
export function validatedText(text: string, registry: Registry): string {
  const parsed = parse(text, registry);
  if (parsed.diagnostics.some((d) => d.severity === 'error'))
    throw new Error(
      'The figure contains invalid text; it has not been saved. Download the original for recovery.',
    );
  return print(parsed.doc);
}

export function readLegacy(registry: Registry): readonly LegacyEntry[] {
  const entries: LegacyEntry[] = [];
  for (const key of LEGACY_KEYS) {
    const text = localStorage.getItem(key);
    if (text === null) continue;
    let valid = true;
    try {
      validatedText(text, registry);
    } catch {
      valid = false;
    }
    entries.push({ key, text, valid });
  }
  return entries;
}

export function legacyStartup(entries: readonly LegacyEntry[], registry: Registry): string | null {
  const entry = [...entries].reverse().find((r) => r.valid);
  return entry === undefined ? null : validatedText(entry.text, registry);
}

export function migrateLegacy(
  state: RecoveryState,
  entries: readonly LegacyEntry[],
  registry: Registry,
  id: () => string,
  savedAt: number,
): RecoveryState {
  if (state.migrated) return state;
  let next = state;
  for (const entry of entries) {
    if (!entry.valid) continue;
    const source = entry.key.endsWith('current') ? 'legacy-current' : 'legacy-previous';
    next = commitRevision(next, {
      id: id(),
      documentId: id(),
      sessionId: 'legacy-migration',
      baseId: null,
      savedAt,
      source,
      text: validatedText(entry.text, registry),
    });
  }
  // Include raw originals in the same capacity check/commit as their validated versions.
  return commitMigration({ ...next, legacy: entries, migrated: true });
}

import { retainRevisions as commitMigration } from '@geomira/editor/persistence';

/** Remove only unchanged originals, and only AFTER the new transaction completes. */
export function cleanLegacy(entries: readonly LegacyEntry[]): void {
  for (const entry of entries)
    if (localStorage.getItem(entry.key) === entry.text) localStorage.removeItem(entry.key);
}
