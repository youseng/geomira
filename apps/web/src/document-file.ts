/** Canonical portable document validation; no partial import is ever accepted. */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export function readDocumentText(text: string, registry: Registry): Document {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error('This file is too large. The .geo limit is 2 MiB.');
  const result = parse(text, registry, { sameConstruction: 'warning' });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    throw new Error(errors.map((d) => `Line ${String(d.line)}: ${d.message}`).join('\n'));
  return result.doc;
}
export async function readDocumentFile(file: File, registry: Registry): Promise<Document> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error('This file is too large. The .geo limit is 2 MiB.');
  return readDocumentText(await file.text(), registry);
}
export function documentFileName(doc: Document): string {
  const name = (doc.meta.title ?? 'Untitled').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80);
  return `${name || 'Untitled'}.geo`;
}
export function namedDocument(doc: Document, name: string): Document {
  const title = name.trim();
  if (title === '') throw new Error('Enter a document name.');
  if (title.length > 160) throw new Error('Use a name of at most 160 characters.');
  return { ...doc, meta: { ...doc.meta, title } };
}
