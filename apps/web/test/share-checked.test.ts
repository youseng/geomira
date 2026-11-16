import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { encodeShareChecked, decodeShare, SHARE_LIMITS } from '@geomira/editor/share';
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
  it('offline links use the canonical site without sender directories', () => {
    expect(shareUrl('file:///private/sender/figure.html?dev=1#old', '#s=X')).toBe(
      `${SITE_URL}#s=X`,
    );
  });
});
