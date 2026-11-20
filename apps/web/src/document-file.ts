/** Validate a portable document in full before opening it. */
import { type PortableDocument, parsePortable } from '@geomira/lang/portable';
import type { Registry } from '@geomira/kernel/registry';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export function readDocumentText(text: string, registry: Registry): PortableDocument {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error('This file is too large. The .geo limit is 2 MiB.');
  const result = parsePortable(text, registry, { sameConstruction: 'warning' });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    throw new Error(errors.map((d) => `Line ${String(d.line)}: ${d.message}`).join('\n'));
  return result.doc;
}
export async function readDocumentFile(file: File, registry: Registry): Promise<PortableDocument> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error('This file is too large. The .geo limit is 2 MiB.');
  return readDocumentText(await file.text(), registry);
}
export function documentFileName(doc: PortableDocument): string {
  const name = (doc.meta.title ?? 'Untitled').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80);
  return `${name || 'Untitled'}.geo`;
}
export function namedDocument(doc: PortableDocument, name: string): PortableDocument {
  const title = name.trim();
  if (title === '') throw new Error('Enter a document name.');
  if (title.length > 160) throw new Error('Use a name of at most 160 characters.');
  return { ...doc, meta: { ...doc.meta, title } };
}
