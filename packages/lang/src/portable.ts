/** Version 2 wraps the version 1 construction and one lossless JSON string. Construction
 * commands and their history operate only on the geometry projection. */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { error, type Diagnostic } from './diagnostic';
import { readVersion } from './migrate';
import { parse, type ParseOptions } from './parse';
import { print } from './print';

export interface PortableDocument extends Document {
  readonly writeUp?: string;
}

export function printPortable(doc: PortableDocument): string {
  const text = print(doc);
  if (!doc.writeUp) return text;
  return text.replace(
    /(^|\n)@version 1([^\n]*)/u,
    (_line, beginning: string, suffix: string) =>
      `${beginning}@version 2${suffix}\n@writeup ${JSON.stringify(doc.writeUp)}`,
  );
}

export function parsePortable(
  text: string,
  registry: Registry,
  options?: ParseOptions,
): {
  readonly doc: PortableDocument;
  readonly diagnostics: readonly Diagnostic[];
} {
  const header = readVersion(text);
  if (header?.version !== 2) return parse(text, registry, options);
  const lines = text.replace(/^\uFEFF/u, '').split('\n');
  const diagnostics: Diagnostic[] = [];
  let source: string | undefined;
  let seen = false;
  function reject(line: number, message: string): void {
    diagnostics.push(
      error(
        { line, column: 1, endColumn: 9 },
        message,
        'Use one @writeup followed by a JSON string.',
      ),
    );
  }
  for (const [i, raw] of lines.entries()) {
    if (i === header.line - 1) lines[i] = raw.replace(/@version[ \t]+[0-9]+/u, '@version 1');
    if (!/^[ \t]*@writeup\b/u.test(raw)) continue;
    lines[i] = '';
    if (seen) reject(i + 1, 'Duplicate @writeup');
    seen = true;
    try {
      const value: unknown = JSON.parse(raw.replace(/^[ \t]*@writeup[ \t]*/u, ''));
      if (typeof value === 'string') source = value;
      else reject(i + 1, 'Expected write-up text');
    } catch {
      reject(i + 1, 'Invalid write-up string');
    }
  }
  if (!seen) reject(header.line, 'Version 2 requires a write-up field');
  const result = parse(lines.join('\n'), registry, options);
  return {
    doc: { ...result.doc, writeUp: source ?? '' },
    diagnostics: [...diagnostics, ...result.diagnostics],
  };
}
