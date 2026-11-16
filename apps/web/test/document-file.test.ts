import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { print } from '@geomira/lang/print';
import {
  readDocumentText,
  namedDocument,
  documentFileName,
  MAX_FILE_BYTES,
} from '../src/document-file';

const registry = createRegistry();
describe('portable document files', () => {
  it('refuses malformed, truncated and future files as a whole', () => {
    for (const text of ['A=(1,2)\nB=(', '@version 999\nA=(1,2)', 'A=circle('])
      expect(() => readDocumentText(text, registry)).toThrow();
  });
  it('refuses unreasonable input before parsing', () => {
    expect(() => readDocumentText('#'.repeat(MAX_FILE_BYTES + 1), registry)).toThrow(/large/u);
  });
  it('round trips full language data including Unicode and inert claims', () => {
    const text =
      '@title "測試"\n@author "Author"\n@viewport 2 3 40\nA=(0,0)\nB=(4,0)\nl=line(A,B)\nf=reflect(l)\n@layer image = image(f, main)\nclaim equal(A,A)\nassume greater(dist(A,B),0)\n';
    const doc = readDocumentText(text, registry);
    expect(print(readDocumentText(print(doc), registry))).toBe(print(doc));
    expect(doc.claims).toHaveLength(1);
    expect(doc.assumptions).toHaveLength(1);
  });
  it('names a duplicate without mutating the original and creates a safe filename', () => {
    const original = readDocumentText('A=(1,2)', registry);
    const named = namedDocument(original, '../測試 / figure');
    expect(original.meta.title).toBeUndefined();
    expect(documentFileName(named)).toBe('-測試-figure.geo');
    expect(() => namedDocument(original, ' ')).toThrow();
  });
});
