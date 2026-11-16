/** Source helpers use the existing lexer, statement splitter and registry. */
import { lexLine } from '@geomira/lang/lexer';
import { splitStatements } from '@geomira/lang/statements';
import type { Registry } from '@geomira/kernel/registry';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { offsetOf } from './caret';

export interface SourcePart {
  readonly text: string;
  readonly kind: string;
}

export function highlightSource(text: string): readonly SourcePart[] {
  return text.split('\n').flatMap((line, index, lines) => {
    const result: SourcePart[] = [];
    let end = 0;
    const lexed = lexLine(line, index + 1);
    for (const token of lexed.tokens) {
      const start = token.column - 1;
      if (start > end) result.push({ text: line.slice(end, start), kind: 'plain' });
      end = token.endColumn - 1;
      result.push({ text: line.slice(start, end), kind: token.kind });
    }
    if (end < line.length)
      result.push({
        text: line.slice(end),
        kind: lexed.comment === undefined ? 'plain' : 'comment',
      });
    if (index < lines.length - 1) result.push({ text: '\n', kind: 'plain' });
    return result;
  });
}

/** Explicit conversion only: nested separators, quoted strings and comments stay intact. */
export function commandLines(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const parts = splitStatements(line);
      return parts.length < 2 ? line : parts.map((p) => p.text).join('\n');
    })
    .join('\n');
}

export function diagnosticRange(text: string, d: Diagnostic): readonly [number, number] {
  return [
    offsetOf(text, { line: d.line - 1, column: d.column - 1 }),
    offsetOf(text, { line: d.line - 1, column: d.endColumn - 1 }),
  ];
}

/** Innermost open call at the caret; signatures are always read from the tool registry. */
export function signatureAt(text: string, cursor: number, registry: Registry): string | null {
  const line = text.slice(0, cursor).split('\n').at(-1) ?? '';
  const tokens = lexLine(line, 1).tokens;
  const calls: (string | null)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token?.value === '(') {
      const name = tokens[i - 1]?.value;
      calls.push(name !== undefined && registry.get(name) !== undefined ? name : null);
    } else if (token?.value === ')') calls.pop();
  }
  const name = [...calls].reverse().find((x) => x !== null);
  if (name === undefined) return null;
  return (
    registry
      .get(name)
      ?.signatures.map(
        (s) =>
          `${name}(${[...s.params, ...(s.rest === undefined ? [] : [`${s.rest}…`])].join(', ')})`,
      )
      .join(' · ') ?? null
  );
}

/** The current physical source line and its offset, without changing surrounding text. */
export function lineAt(text: string, cursor: number) {
  const start = text.lastIndexOf('\n', cursor - 1) + 1;
  const end = text.indexOf('\n', cursor);
  return { start, text: text.slice(start, end < 0 ? text.length : end), cursor: cursor - start };
}
