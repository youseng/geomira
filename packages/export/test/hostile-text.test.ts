/**
 * Found in the Run 10 audit (exports with unusual names and labels):
 *   - the SVG passed C0 control characters, U+FFFE/U+FFFF and lone surrogates of a label or the
 *     title through, so the file was not well-formed XML (XML 1.0 forbids them);
 *   - an object named `invisible` was declared as an Asymptote variable, shadowing the pen the
 *     export's frame line `draw(box(…), invisible)` uses;
 *   - utf8Decode read the invalid lead bytes 0xF8–0xFF as the start of three-byte sequences.
 */
import { describe, expect, it } from 'vitest';
import { toAsymptote } from '../src/asy';
import { toSvg } from '../src/svg';
import { utf8Decode } from '../src/utf8';
import { frameOf, REGISTRY } from './helpers/figure';

/** XML 1.0's Char production. */
function xmlChars(s: string): boolean {
  for (const ch of s) {
    const x = ch.codePointAt(0) ?? 0;
    const ok =
      x === 0x9 ||
      x === 0xa ||
      x === 0xd ||
      (x >= 0x20 && x <= 0xd7ff) ||
      (x >= 0xe000 && x <= 0xfffd) ||
      (x >= 0x10000 && x <= 0x10ffff);
    if (!ok) return false;
  }
  return true;
}

describe('hostile text in exports', () => {
  it('the SVG is well-formed XML whatever a label or the title holds', () => {
    for (const bad of [
      '\\u{1}',
      '\\u{b}',
      '\\u{1f}',
      '\\u{fffe}',
      '\\u{ffff}',
      '\\u{d800}',
      '\\u{dfff}',
    ]) {
      const svg = toSvg(
        frameOf(`@version 1\n@title "t${bad}"\nA = (0, 0) [label="x${bad}y"]\nB = (1, 1)`),
      ).text;
      expect(xmlChars(svg), bad).toBe(true);
      expect(svg).toContain('x\u{fffd}y');
    }
    // Allowed characters are kept as they are.
    const ok = toSvg(frameOf('@version 1\nA = (0, 0) [label="x\\ty ω 😀"]\nB = (1, 1)')).text;
    expect(ok).toContain('x\ty ω 😀');
  });

  it('an object named invisible gets another Asymptote name; the pen keeps its meaning', () => {
    const asy = toAsymptote(
      frameOf('@version 1\nA = (0, 0)\nB = (3, 0)\ninvisible = circle(A, B)\n'),
      REGISTRY,
      'standalone',
    ).text;
    expect(asy).not.toMatch(/\binvisible =/u);
    expect(asy).toContain('invisible_ = ');
    expect(asy).toMatch(/draw\(box\([^;]*\), invisible\);/u);
  });

  it('utf8Decode turns every lead byte 0xF8–0xFF into U+FFFD', () => {
    for (let x = 0xf8; x <= 0xff; x++)
      expect(utf8Decode(new Uint8Array([x, 0xa0, 0x80])), x.toString(16)).toBe(
        '\u{fffd}\u{fffd}\u{fffd}',
      );
    expect(utf8Decode(new Uint8Array([0xf0, 0x9f, 0x98, 0x80]))).toBe('😀');
  });
});
