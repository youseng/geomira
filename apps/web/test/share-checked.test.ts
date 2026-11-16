import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import {
  encodeShare,
  encodeShareChecked,
  decodeShare,
  SHARE_LIMITS,
  SHARE_PREFIX,
} from '@geomira/editor/share';
import { shareUrl } from '../src/share-url';
import { SITE_URL } from '../src/build-info';

const registry = createRegistry();
describe('checked public sharing', () => {
  it('refuses the 500-circle payload its own decoder cannot accept', () => {
    const text = Array.from(
      { length: 500 },
      (_, i) =>
        `w_${String(i)} = circle((${String(Math.sin(i) * 4)}, ${String(Math.cos(i) * 4)}), ${String(1 + Math.sin(i * 2) ** 2)})`,
    ).join('\n');
    expect(encodeShareChecked(parse(text, registry).doc)).toMatchObject({ ok: false });
  });
  it('refuses even highly compressed text beyond the text limit', () => {
    const doc = parse(`#${'a'.repeat(SHARE_LIMITS.text)}\nA=(0,0)`, registry).doc;
    expect(encodeShareChecked(doc)).toMatchObject({ ok: false });
  });
  it('accepts the exact text boundary and refuses the next character', () => {
    const base = print(parse('#x\nA=(0,0)', registry).doc).length;
    for (const delta of [-1, 0, 1]) {
      const doc = parse(
        `#${'x'.repeat(SHARE_LIMITS.text - base + 1 + delta)}\nA=(0,0)`,
        registry,
      ).doc;
      expect(print(doc)).toHaveLength(SHARE_LIMITS.text + delta);
      const offer = encodeShareChecked(doc);
      expect(offer.ok).toBe(delta <= 0);
      if (offer.ok) expect(decodeShare(offer.fragment, registry).ok).toBe(true);
    }
  });
  it('every offered fragment decodes to the complete canonical document', () => {
    for (const text of ['A=(1,2)', '@title "測試"\nA=(1,2)\nclaim equal(A,A)']) {
      const doc = parse(text, registry).doc;
      const encoded = encodeShareChecked(doc);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) throw new Error(encoded.reason);
      const decoded = decodeShare(encoded.fragment, registry);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) throw new Error(decoded.reason);
      expect(decoded.text).toBe(print(doc));
    }
  });
  it('offers only decodable documents on both sides of the payload boundary', () => {
    let seed = 42;
    const comment = Array.from({ length: 30_000 }, () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return String.fromCharCode(33 + ((seed >>> 0) % 90));
    }).join('');
    const document = (n: number) => parse(`#${comment.slice(0, n)}\nA=(0,0)`, registry).doc;
    let lower = 1;
    let upper = comment.length;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (encodeShare(document(middle)).length - SHARE_PREFIX.length <= SHARE_LIMITS.payload)
        lower = middle;
      else upper = middle;
    }
    for (const count of [lower, upper]) {
      const doc = document(count);
      const rawSize = encodeShare(doc).length - SHARE_PREFIX.length;
      const offer = encodeShareChecked(doc);
      expect(offer.ok).toBe(rawSize <= SHARE_LIMITS.payload);
      expect(Math.abs(rawSize - SHARE_LIMITS.payload)).toBeLessThan(100);
      if (offer.ok) expect(decodeShare(offer.fragment, registry).ok).toBe(true);
    }
  });
  it('offline links use the canonical site without sender directories', () => {
    expect(shareUrl('file:///private/sender/figure.html?dev=1#old', '#s=X')).toBe(
      `${SITE_URL}#s=X`,
    );
  });
});
