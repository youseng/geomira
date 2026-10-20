/**
 * File versions and migrations (SPEC §11.4): every printed file starts with `@version N`;
 * a file of an older version is migrated, text to text, one version at a time, before it
 * is parsed, so old files load forever. Migrations are data: `{ from, to, describe,
 * migrate }`, pure functions of the text; the framework rewrites the `@version` line after
 * each one. Version 1 is the first version, so the v1 chain is empty; tests supply chains
 * (the fixture test migrates a version-0 file).
 */
import { DOCUMENT_VERSION } from '@geomira/kernel/document';

export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly describe: string;
  migrate(text: string): string;
}

/** The migrations of the language, oldest first (none yet: version 1 is the first). */
export const MIGRATIONS: readonly Migration[] = Object.freeze([]);

const VERSION_LINE = /^[ \t]*@version[ \t]+([0-9]+)[ \t]*(?:#.*)?$/u;

/** The first `@version N` line: N and the 1-based line number. */
export function readVersion(
  text: string,
): { readonly version: number; readonly line: number } | undefined {
  const lines = text.split('\n');
  for (const [i, l] of lines.entries()) {
    const m = VERSION_LINE.exec(l.replace(/\r$/u, ''));
    const v = m === null ? NaN : Number(m[1]);
    if (Number.isSafeInteger(v)) return { version: v, line: i + 1 };
  }
  return undefined;
}

function setVersion(text: string, line: number, version: number): string {
  const lines = text.split('\n');
  lines[line - 1] = `@version ${String(version)}`;
  return lines.join('\n');
}

export type MigrationResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly from: number;
      readonly applied: readonly string[];
    }
  | { readonly ok: false; readonly reason: string; readonly hint: string; readonly line: number };

/**
 * Migrates `text` to version `target` with `migrations`. A file without `@version` is read
 * as `target`. Degenerate cases: a version above `target` (a newer file); a missing step
 * in the chain; a migration that does not move forward → not ok, with the line of
 * `@version`.
 */
export function migrateText(
  text: string,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = DOCUMENT_VERSION,
): MigrationResult {
  const found = readVersion(text);
  if (found === undefined) return { ok: true, text, from: target, applied: [] };
  if (found.version > target) {
    return {
      ok: false,
      reason: `this file is version ${String(found.version)}, newer than this program (version ${String(target)})`,
      hint: 'open it with a newer GEOMIRA',
      line: found.line,
    };
  }
  let v = found.version;
  let out = text;
  const applied: string[] = [];
  while (v < target) {
    const m = migrations.find((x) => x.from === v);
    if (m === undefined || m.to <= v) {
      return {
        ok: false,
        reason: `there is no migration from version ${String(v)}`,
        hint: `write @version ${String(target)} if the file is already current`,
        line: found.line,
      };
    }
    const next = m.migrate(out);
    const at = readVersion(next);
    if (at === undefined) {
      return {
        ok: false,
        reason: `the migration from version ${String(v)} lost the @version line`,
        hint: 'report this file',
        line: found.line,
      };
    }
    out = setVersion(next, at.line, m.to);
    applied.push(`${String(m.from)} → ${String(m.to)}: ${m.describe}`);
    v = m.to;
  }
  return { ok: true, text: out, from: found.version, applied };
}
