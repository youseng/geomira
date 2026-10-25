import { describe, expect, it } from 'vitest';
import { shareUrl } from '../src/share-url';

/**
 * Run 12: the share link of a page opened from a file. The link was built from
 * `location.origin + location.pathname`; for file:// pages Firefox reports the origin as the
 * string "null", which gave `null/home/…/index.html#s=…`, a link that opens nothing.
 */
describe('shareUrl', () => {
  it('keeps a file:// address whole (the origin of a file page may be "null")', () => {
    expect(shareUrl('file:///home/u/geomira/index.html', '#s=AbC')).toBe(
      'file:///home/u/geomira/index.html#s=AbC',
    );
  });

  it('drops the query and an old hash, as the site link always did', () => {
    expect(shareUrl('https://example.org/geomira/?dev=1#s=old', '#s=new')).toBe(
      'https://example.org/geomira/#s=new',
    );
    expect(shareUrl('file:///C:/Users/u/geomira.html?x#y', '#s=Q')).toBe(
      'file:///C:/Users/u/geomira.html#s=Q',
    );
  });

  it('gives the same link as before on http(s) pages', () => {
    const href = 'http://localhost:4173/geomira/';
    const u = new URL(href);
    expect(shareUrl(href, '#s=Z')).toBe(`${u.origin}${u.pathname}#s=Z`);
  });
});
