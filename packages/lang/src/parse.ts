/**
 * `parse(text, registry)` (SPEC §11): total (never throws; per-line recovery), returning
 * the document of every line that is free of errors and the diagnostics of the others,
 * sorted by position. Old files are migrated first (migrate.ts).
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { buildDocument } from './build';
import type { Line } from './ast';
import type { Diagnostic } from './diagnostic';
import { MIGRATIONS, migrateText, type Migration } from './migrate';
import { parseLine } from './parse-line';

export interface ParseOptions {
  /** The migration chain (default: the language's MIGRATIONS). */
  readonly migrations?: readonly Migration[];
}

export interface ParseResult {
  readonly doc: Document;
  readonly diagnostics: readonly Diagnostic[];
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
  return a.line - b.line || a.column - b.column;
}

export function parse(text: string, registry: Registry, options: ParseOptions = {}): ParseResult {
  const m = migrateText(text, options.migrations ?? MIGRATIONS);
  const src = m.ok ? m.text : text.replace(/^\uFEFF/u, '');
  const diagnostics: Diagnostic[] = [];
  const lines: Line[] = src.split('\n').map((raw, i) => {
    const p = parseLine(raw.endsWith('\r') ? raw.slice(0, -1) : raw, i + 1);
    diagnostics.push(...p.diagnostics);
    return p.line;
  });
  const built = buildDocument(
    lines,
    registry,
    m.ok ? {} : { problem: { reason: m.reason, hint: m.hint } },
  );
  diagnostics.push(...built.diagnostics);
  return { doc: built.doc, diagnostics: diagnostics.sort(byPosition) };
}
