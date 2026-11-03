/**
 * A caret position as a line and a column, so it survives a text that is printed again
 * (ADR-0047: Ctrl+Enter shows the printed figure while the field has the focus; the printing
 * may change spaces within a line, rarely the lines themselves).
 */
export interface LineColumn {
  /** 0-based line. */
  readonly line: number;
  /** 0-based column (UTF-16 units, as the field counts). */
  readonly column: number;
  /** At the end of its line: stays at the end of the line printed again. */
  readonly atEnd?: boolean;
}

/** The line and column of `offset` in `text` (offsets beyond the text are its end). */
export function lineColumnOf(text: string, offset: number): LineColumn {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split('\n');
  const line = lines.length - 1;
  const column = (lines[line] ?? '').length;
  const atEnd = column === (text.split('\n')[line] ?? '').length;
  return atEnd ? { line, column, atEnd } : { line, column };
}

/**
 * The offset in `text` of a line and column, clamped: a line beyond the last is the last, a
 * column beyond its line's end is that end; a caret that was at the end of its line is at the
 * end of that line.
 */
export function offsetOf(text: string, at: LineColumn): number {
  const lines = text.split('\n');
  const line = Math.min(Math.max(0, at.line), lines.length - 1);
  let offset = 0;
  for (let i = 0; i < line; i++) offset += (lines[i] ?? '').length + 1;
  const length = (lines[line] ?? '').length;
  return offset + (at.atEnd === true ? length : Math.min(Math.max(0, at.column), length));
}
