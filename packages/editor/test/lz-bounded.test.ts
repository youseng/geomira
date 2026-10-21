/**
 * The bounded lz-string decoder (ADR-0018): the same text as lz-string 1.5.0 for every
 * payload lz-string writes, and each degenerate case of its doc comment.
 */
import fc from 'fast-check';
import LZString from 'lz-string';
import { describe, expect, it } from 'vitest';
import { decompressBounded } from '../src/lz-bounded';

const RUNS = process.env.NIGHTLY === '1' ? 5000 : 500;

describe('decompressBounded', () => {
  it('gives lz-string’s text for every payload lz-string writes (any Unicode text)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', minLength: 1, maxLength: 400 }), (text) => {
        const payload = LZString.compressToEncodedURIComponent(text);
        expect(decompressBounded(payload, Infinity)).toEqual({ text });
        expect(decompressBounded(payload, Infinity)).toEqual({
          text: LZString.decompressFromEncodedURIComponent(payload),
        });
      }),
      { numRuns: RUNS, seed: 10 },
    );
  });

  it('long repetitive texts (dictionary growth past several code widths)', () => {
    for (const text of ['a'.repeat(100_000), 'A = (0, 0)\n'.repeat(5000), '∡ω'.repeat(3000)])
      expect(decompressBounded(LZString.compressToEncodedURIComponent(text), Infinity)).toEqual({
        text,
      });
  });

  it('degenerate: a text longer than max → too large (at max it is the text)', () => {
    const text = 'abc'.repeat(1000);
    const payload = LZString.compressToEncodedURIComponent(text);
    expect(decompressBounded(payload, text.length)).toEqual({ text });
    expect(decompressBounded(payload, text.length - 1)).toEqual({ problem: 'too large' });
  });

  it('degenerate: characters outside the alphabet, an empty input, a cut stream → unreadable', () => {
    expect(decompressBounded('', 100)).toEqual({ problem: 'unreadable' });
    expect(decompressBounded('AB%C', 100)).toEqual({ problem: 'unreadable' });
    expect(decompressBounded('AB C', 100)).toEqual({ problem: 'unreadable' });
    const payload = LZString.compressToEncodedURIComponent(
      'A = (0, 0)\nB = (4, 0)\nM = midpoint(A, B)',
    );
    let unreadable = 0;
    for (let k = 1; k < payload.length; k++) {
      const r = decompressBounded(payload.slice(0, payload.length - k), 1000);
      // A cut stream is unreadable, or (when its last character only held padding) the text.
      if ('problem' in r) {
        expect(r.problem).toBe('unreadable');
        unreadable++;
      }
    }
    expect(unreadable).toBeGreaterThan(payload.length / 2);
  });

  it('degenerate: an unknown dictionary code → unreadable; the empty stream → empty text', () => {
    // The first code 3 (bits 11) is not a literal: unreadable.
    expect(decompressBounded('w', 100)).toEqual({ problem: 'unreadable' });
    // The first code 2 is the end mark: the empty text, as lz-string returns for it.
    expect(decompressBounded(LZString.compressToEncodedURIComponent(''), 100)).toEqual({
      text: '',
    });
  });
});
