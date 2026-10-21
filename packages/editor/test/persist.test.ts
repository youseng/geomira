/**
 * Autosave policy (pure), share links (`#s=` + lz-string of the text; law L5: the round trip
 * gives the same document up to ids and image-run order; damaged links refused) and the
 * debug report (text, version, last 50 edits, user agent).
 */
import fc from 'fast-check';
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { sameUpToIds } from '@geomira/lang/canonical';
import { print } from '@geomira/lang/print';
import { docArb } from '../../lang/test/helpers/gen-doc';
import {
  EMPTY_SLOTS,
  afterEdit,
  openSession,
  restorePrevious,
  save,
  shouldSave,
} from '../src/autosave';
import { debugReport } from '../src/report';
import { decodeShare, encodeShare, SHARE_PREFIX } from '../src/share';
import { LOG_LENGTH } from '../src/state';
import { edit, editorOf, idOf, registry } from './helpers/editor';

const RUNS = process.env.NIGHTLY === '1' ? 1000 : 100;

describe('autosave policy', () => {
  it('a document opened from a link is not saved until its first edit', () => {
    let s = openSession('link');
    expect(shouldSave(s)).toBe(false);
    const kept = { current: 'my work', previous: null };
    expect(save(kept, s, 'linked figure').slots).toBe(kept);
    s = afterEdit(s);
    expect(shouldSave(s)).toBe(true);
    expect(save(kept, s, 'linked figure, edited').slots).toEqual({
      current: 'linked figure, edited',
      previous: 'my work',
    });
  });

  it('the first save of a session keeps the previous autosave; later saves overwrite current only', () => {
    const slots0 = { current: 'yesterday', previous: 'older' };
    const first = save(slots0, openSession('new'), 'today 1');
    expect(first.slots).toEqual({ current: 'today 1', previous: 'yesterday' });
    const second = save(first.slots, first.session, 'today 2');
    expect(second.slots).toEqual({ current: 'today 2', previous: 'yesterday' });
    // Reopening the autosave itself and saving it unchanged keeps the older previous.
    expect(save({ current: 'x', previous: 'p' }, openSession('autosave'), 'x').slots).toEqual({
      current: 'x',
      previous: 'p',
    });
    expect(save(EMPTY_SLOTS, openSession('file'), 'f').slots).toEqual({
      current: 'f',
      previous: null,
    });
  });

  it('restoring the previous figure swaps the slots (so it can be undone by restoring again)', () => {
    const r = restorePrevious({ current: 'b', previous: 'a' });
    expect(r).toEqual({ text: 'a', slots: { current: 'a', previous: 'b' } });
    expect(r === undefined ? undefined : restorePrevious(r.slots)?.text).toBe('b');
    expect(restorePrevious(EMPTY_SLOTS)).toBeUndefined();
  });
});

describe('share links (law L5)', () => {
  it('round trip: the same document up to ids and image-run order, for generated documents', () => {
    let n = 0;
    fc.assert(
      fc.property(docArb(registry), (doc) => {
        const link = encodeShare(doc);
        expect(link.startsWith(SHARE_PREFIX)).toBe(true);
        const r = decodeShare(link, registry);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.text).toBe(print(doc));
          expect(sameUpToIds(r.doc, doc)).toBe(true);
          n++;
        }
      }),
      { numRuns: RUNS, seed: 5 },
    );
    expect(n).toBe(RUNS);
  }, 120_000);

  it('refuses what is not a link, garbage, a damaged (cut) link, and a text with errors', () => {
    const doc = editorOf('A = (0, 0)\nB = (4, 0)\nM = midpoint(A, B)').doc;
    const link = encodeShare(doc);
    const reason = (f: string) => {
      const r = decodeShare(f, registry);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('#x=abc')).toBe('not a share link');
    for (const g of ['#s=', '#s=%%%', '#s=zz', '#s=A', '#s=ÿ'])
      expect(reason(g)).toBe('the link cannot be read');
    let cut = 0;
    for (let k = 1; k < link.length - SHARE_PREFIX.length; k++) {
      const r = reason(link.slice(0, link.length - k));
      expect(r).not.toBe('ok');
      if (r === 'the link is damaged (it may have been cut short)') cut++;
    }
    expect(cut).toBeGreaterThan(0);
    const broken = SHARE_PREFIX + LZString.compressToEncodedURIComponent('@version 1\nA = (0,');
    const r = decodeShare(broken, registry);
    expect(!r.ok && r.reason).toBe('the linked text has errors');
    expect(!r.ok && (r.diagnostics?.length ?? 0) > 0).toBe(true);
  });
});

describe('debug report', () => {
  it('holds the text, the app version, the last edits (at most 50) and the user agent', () => {
    let s = editorOf('A = (0, 0)\nB = (4, 0)');
    for (let i = 0; i < LOG_LENGTH + 5; i++)
      s = edit(s, { kind: 'style', id: idOf(s, 'A'), style: { z: i } });
    const r = debugReport(s, { appVersion: '0.8.0', userAgent: 'TestAgent/1.0' });
    expect(r).toContain('app version: 0.8.0');
    expect(r).toContain('user agent: TestAgent/1.0');
    expect(r).toContain(`edits (last ${String(LOG_LENGTH)}, oldest first):`);
    expect(r).toContain('"z":54');
    expect(r).not.toContain('"z":4}');
    expect(r.endsWith(print(s.doc))).toBe(true);
    const exact = edit(s, { kind: 'replaceText', text: 'A = (1/3, 0)' });
    expect(debugReport(exact, { appVersion: 'x', userAgent: 'y' })).toContain(
      '"text":"A = (1/3, 0)"',
    );
  });
});
