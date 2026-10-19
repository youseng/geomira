import { isLengthChecked } from './files';
import { violation, type SourceFile, type Violation } from './types';

export const MAX_LINES = 400;

/** Number of lines; a final newline does not start an extra line. */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

/** Rule (b): no source file (tests included) longer than MAX_LINES lines. */
export function checkFileLength(files: readonly SourceFile[]): Violation[] {
  const found: Violation[] = [];
  for (const file of files) {
    if (!isLengthChecked(file.path)) continue;
    const lines = countLines(file.text);
    if (lines > MAX_LINES) {
      found.push(
        violation(
          'file-length',
          file.path,
          0,
          `${String(lines)} lines (max ${String(MAX_LINES)}): split by responsibility`,
        ),
      );
    }
  }
  return found;
}
