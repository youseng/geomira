/**
 * `parse(text, registry)` (SPEC §11): total (never throws; per-line recovery), returning
 * the document of every line that is free of errors and the diagnostics of the others,
 * sorted by position. Old files are migrated first (migrate.ts).
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { buildDocument } from './build';
import type { Line } from './ast';
import type { Diagnostic, Severity } from './diagnostic';
import { MIGRATIONS, migrateText, type Migration } from './migrate';
import { parseLine } from './parse-line';

export interface ParseOptions {
  /** The migration chain (default: the language's MIGRATIONS). */
  readonly migrations?: readonly Migration[];
  /**
   * How a definition that is the same construction as an earlier object (line(B, A) after
   * l = line(A, B); ADR-0029) is reported: 'error' (its line is not applied), 'warning', or,
   * when absent, not at all. The default is absent because the kernel accepts such documents
   * and every document it accepts must read back without diagnostics (laws P1, P3).
   */
  readonly sameConstruction?: Severity;
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
  const same =
    options.sameConstruction === undefined ? {} : { sameConstruction: options.sameConstruction };
  const built = buildDocument(
    lines,
    registry,
    m.ok ? same : { ...same, problem: { reason: m.reason, hint: m.hint } },
  );
  diagnostics.push(...built.diagnostics);
  return { doc: built.doc, diagnostics: diagnostics.sort(byPosition) };
}
