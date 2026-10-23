/**
 * Comments ending in carriage returns (bug-fix round, ADR-0028): `#abc\r\r` (a CRLF file
 * with a stray CR) printed `#abc\r`, which read back as `abc`, so print∘parse was not
 * idempotent (P2). Trailing CRs are not part of a comment, in the text or in a document.
 */
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

function idempotent(text: string): string {
  const once = print(parse(text, registry).doc);
  expect(print(parse(once, registry).doc)).toBe(once);
  return once;
}

describe('comments with trailing carriage returns', () => {
  it('P2 holds for comment lines and inline comments', () => {
    expect(idempotent('@version 1\n#abc\r\r\nA = (0, 0)')).toBe('@version 1\n#abc\nA = (0, 0)\n');
    expect(idempotent('@version 1\nA = (0, 0) #abc\r\r\r')).toBe('@version 1\nA = (0, 0)  #abc\n');
    expect(idempotent('@version 1\r\n# a\rb\r\nA = (0, 0)\r\n')).toBe(
      '@version 1\n# a\rb\nA = (0, 0)\n',
    );
  });

  it('the printer drops trailing CRs of a document comment', () => {
    const doc = parse('@version 1\nA = (0, 0)', registry).doc;
    const id = doc.objects[0]?.id ?? -1;
    const withCr: Document = {
      ...doc,
      meta: {
        ...doc.meta,
        comments: [{ anchor: { kind: 'object', id }, lines: ['x\r'], inline: 'y\r' }],
      },
    };
    const text = print(withCr);
    expect(text).toBe('@version 1\n#x\nA = (0, 0)  #y\n');
    expect(print(parse(text, registry).doc)).toBe(text);
  });
});
