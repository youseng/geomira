/**
 * A share link whose payload was percent-encoded on the way (a chat or mail client writing
 * `+` as %2B and `$` as %24) still opens the same figure; a malformed escape is refused, as
 * any character outside the payload's alphabet is.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { decodeShare, encodeShare, SHARE_PREFIX } from '../src/share';
import { docOf, registry } from './helpers/editor';

function links(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 200 && out.length < 20; i++) {
    const doc = docOf(
      `A = (${String(i)}, 0)\nB = (4, ${String(i % 7)})\nC = (1, 3)\n` +
        'ω = circumcircle(A, B, C)\nO = circumcenter(A, B, C)\nH = orthocenter(A, B, C)',
    );
    const f = encodeShare(doc);
    if (/[$+]/u.test(f)) out.push(f);
  }
  return out;
}

const percent = (f: string) => SHARE_PREFIX + encodeURIComponent(f.slice(SHARE_PREFIX.length));

describe('percent-encoded share links', () => {
  it('a link with %2B and %24 opens the same text as the plain link', () => {
    const fs = links();
    expect(fs.length).toBeGreaterThan(0);
    for (const f of fs) {
      const plain = decodeShare(f, registry);
      const enc = percent(f);
      expect(enc).toMatch(/%2B|%24/u);
      const r = decodeShare(enc, registry);
      expect(r.ok).toBe(true);
      if (r.ok && plain.ok) {
        expect(r.text).toBe(plain.text);
        expect(print(r.doc)).toBe(print(plain.doc));
      }
    }
  });

  it('lowercase hex escapes are read too', () => {
    const [f] = links();
    if (f === undefined) throw new Error('no link with + or $');
    const enc = percent(f).replace(/%2B/gu, '%2b');
    expect(decodeShare(enc, registry).ok).toBe(true);
  });

  it('malformed escapes are refused', () => {
    const [f] = links();
    if (f === undefined) throw new Error('no link with + or $');
    for (const bad of [`${f}%`, `${f}%2`, `${f.slice(0, 10)}%ZZ${f.slice(10)}`, `${f}%E2%82`]) {
      const r = decodeShare(bad, registry);
      expect(r.ok, bad).toBe(false);
    }
  });

  it('an escape of a character outside the alphabet is refused', () => {
    const [f] = links();
    if (f === undefined) throw new Error('no link with + or $');
    expect(decodeShare(`${f.slice(0, 10)}%20${f.slice(10)}`, registry).ok).toBe(false);
  });
});
