/**
 * Several statements on one line, separated by `;` (ADR-0061): `triangle ABC; O =
 * circumcenter(ABC); D = foot(A, BC)`. The text format keeps one statement per line (comments,
 * diagnostics and the panels count lines), so this is not part of the grammar of a file: the
 * command bar splits what was typed with it and appends one line per statement.
 *
 * A `;` separates statements only outside parentheses and brackets (`harmonic(A, B; C, D)`
 * keeps its own, ADR-0040), outside strings, and before a `#` comment, which runs to the end
 * of the line and stays with the last statement.
 */

/** One statement of a line: its text without the blanks around it, and where it starts. */
export interface StatementPiece {
  readonly text: string;
  /** 0-based index of the statement's first character in the line. */
  readonly start: number;
}

/** The index after the string that opens at `i` (a `"`), or the end of the line. */
function skipString(src: string, i: number): number {
  let k = i + 1;
  while (k < src.length && src[k] !== '"') k += src[k] === '\\' ? 2 : 1;
  return Math.min(k + 1, src.length);
}

/** The indices of the `;` that separate statements. */
function separators(src: string): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') i = skipString(src, i) - 1;
    else if (ch === '#') break;
    else if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) out.push(i);
  }
  return out;
}

/**
 * The statements of one line, in order. Degenerate cases: no `;` → the line as one statement;
 * an empty statement (`a;; b`, a trailing `;`) is left out; a blank line → none.
 */
export function splitStatements(line: string): StatementPiece[] {
  const cuts = [-1, ...separators(line), line.length];
  const out: StatementPiece[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const from = (cuts[k] ?? -1) + 1;
    const raw = line.slice(from, cuts[k + 1]);
    const text = raw.trim();
    if (text !== '') out.push({ text, start: from + raw.indexOf(text) });
  }
  return out;
}
