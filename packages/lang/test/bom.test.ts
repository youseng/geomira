/**
 * A leading UTF-8 byte order mark (bug-fix round, ADR-0028): editors on some systems write
 * U+FEFF at the start of a file. It is not part of the text: the first statement is read,
 * and a newer `@version` behind it is still refused.
 */
import { describe, expect, it } from 'vitest';
import { migrateText, readVersion } from '../src/migrate';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

const BOM = '﻿';

describe('a leading byte order mark', () => {
  it('does not drop the first statement', () => {
    const plain = parse('@version 1\nA = (0, 0)', registry);
    const marked = parse(`${BOM}@version 1\nA = (0, 0)`, registry);
    expect(marked.diagnostics).toEqual([]);
    expect(print(marked.doc)).toBe(print(plain.doc));
    const first = parse(`${BOM}A = (0, 0)\n@version 1`, registry);
    expect(first.doc.objects.map((o) => o.name)).toEqual(['A']);
    expect(first.diagnostics).toEqual([]);
  });

  it('a newer version behind it is still refused', () => {
    const r = parse(`${BOM}@version 2\nA = (0, 0)`, registry);
    expect(r.diagnostics.map((d) => [d.line, d.severity, d.message])).toEqual([
      [1, 'error', 'this file is version 2, newer than this program (version 1)'],
    ]);
    expect(readVersion(`${BOM}@version 2`)).toEqual({ version: 2, line: 1 });
    expect(migrateText(`${BOM}@version 2`).ok).toBe(false);
  });

  it('only at the very start: elsewhere it is an unexpected character', () => {
    const r = parse(`@version 1\nA = (0, 0)${BOM}`, registry);
    expect(r.diagnostics.map((d) => d.severity)).toEqual(['error']);
  });
});
