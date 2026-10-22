/**
 * Found in the Run 10 audit (ADR-0018), share links (SPEC §12, ADR-0012 decision 17: decoding
 * is total and verified):
 *   - a link of 435 characters nesting `sqrt(` 1500 deep made decodeShare THROW (the parser
 *     overflowed the stack; see packages/lang/test/nesting.test.ts);
 *   - a link of 4,314 characters decompressing to 3,000,000 characters froze decodeShare (the
 *     page's startup) for 6 s, one of 15,523 characters for 145 s: the verifying re-compression
 *     is super-linear and nothing bounded the sizes;
 *   - a one-character change of a link often decoded to ANOTHER valid figure (a moved point, a
 *     renamed one): the re-encoding check only catches cuts.
 * Links now carry a checksum of their text (four characters of the payload's own alphabet,
 * first, so a cut link is never a valid shorter one), payloads and texts have size limits, and
 * links without a checksum (written before) still open.
 */
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { decodeShare, encodeShare, SHARE_PREFIX } from '../src/share';
import { editorOf, registry } from './helpers/editor';

const reason = (f: string) => {
  const r = decodeShare(f, registry);
  return r.ok ? `ok ${r.text}` : r.reason;
};

const TEXT = 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nM = midpoint(A, B)\nw = circle(A, B, C)';

describe('share links: checksum, sizes, nesting (ADR-0018)', () => {
  it('a link of nested calls is refused with the text’s errors, never thrown', () => {
    const text = `@version 1\nk = ${'sqrt('.repeat(1500)}1${')'.repeat(1500)}\n`;
    const link = SHARE_PREFIX + LZString.compressToEncodedURIComponent(text);
    expect(link.length).toBeLessThan(600);
    expect(() => decodeShare(link, registry)).not.toThrow();
    expect(reason(link)).toBe('the linked text has errors');
  });

  it('a short link that decompresses to a huge text is refused at once', () => {
    for (const n of [150_000, 1_000_000]) {
      const link =
        SHARE_PREFIX + LZString.compressToEncodedURIComponent(`@version 1\n# ${'a'.repeat(n)}\n`);
      const t0 = performance.now();
      const r = reason(link);
      expect(performance.now() - t0).toBeLessThan(1500);
      expect(r).toMatch(/^the link(’s text)? is too (long|large)/u);
    }
  });

  it('a payload longer than the limit is refused before it is decompressed', () => {
    expect(reason(SHARE_PREFIX + 'A'.repeat(200_000))).toMatch(/^the link is too long/u);
  });

  it('every one-character change of a link is refused (no other figure opens)', () => {
    const doc = editorOf(TEXT).doc;
    const link = encodeShare(doc);
    expect(link).toMatch(/^#s=[A-Za-z0-9+\-$]+$/u);
    expect(reason(link)).toBe(`ok ${print(doc)}`);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
    const opened: string[] = [];
    for (let k = SHARE_PREFIX.length; k < link.length; k++)
      for (const ch of alphabet) {
        if (ch === link[k]) continue;
        const r = reason(link.slice(0, k) + ch + link.slice(k + 1));
        if (r.startsWith('ok ')) opened.push(`${String(k)} ${ch}`);
      }
    expect(opened).toEqual([]);
  });

  it('a link written before (no checksum) still opens; its cut forms are refused', () => {
    const doc = editorOf(TEXT).doc;
    const old = SHARE_PREFIX + LZString.compressToEncodedURIComponent(print(doc));
    expect(reason(old)).toBe(`ok ${print(doc)}`);
    for (let k = 1; k < old.length - SHARE_PREFIX.length; k++)
      expect(reason(old.slice(0, old.length - k))).not.toMatch(/^ok /u);
  });
});
