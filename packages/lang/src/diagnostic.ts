/**
 * Diagnostics of the language (SPEC §11.3): every problem found while reading a text has a
 * line, a column range and a fix hint. Lines and columns are 1-based; columns count UTF-16
 * code units (what editors report); `endColumn` is exclusive.
 */

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  readonly line: number;
  readonly column: number;
  readonly endColumn: number;
  readonly severity: Severity;
  readonly message: string;
  /** What to write instead (never empty). */
  readonly hint: string;
}

/** A source range on one line. */
export interface Span {
  readonly line: number;
  readonly column: number;
  readonly endColumn: number;
}

export function error(span: Span, message: string, hint: string): Diagnostic {
  return { ...spanOf(span), severity: 'error', message, hint };
}

export function warning(span: Span, message: string, hint: string): Diagnostic {
  return { ...spanOf(span), severity: 'warning', message, hint };
}

function spanOf(s: Span): Span {
  return { line: s.line, column: s.column, endColumn: Math.max(s.endColumn, s.column + 1) };
}

/** The smallest span covering both. */
export function join(a: Span, b: Span): Span {
  return a.line === b.line
    ? {
        line: a.line,
        column: Math.min(a.column, b.column),
        endColumn: Math.max(a.endColumn, b.endColumn),
      }
    : a;
}

/** "line 3, column 5: message (hint: …)", for tests and logs. */
export function formatDiagnostic(d: Diagnostic): string {
  return `line ${String(d.line)}, column ${String(d.column)}: ${d.message} (hint: ${d.hint})`;
}

/** Whether any diagnostic is an error. */
export function hasErrors(ds: readonly Diagnostic[]): boolean {
  return ds.some((d) => d.severity === 'error');
}
