import { describe, expect, it } from 'vitest';
import {
  crc32,
  pngChunk,
  pngChunks,
  pngFigureText,
  pngPlan,
  pngWithMetadata,
  PNG_RATIOS,
} from '../src/png';
import { utf8Decode, utf8Encode } from '../src/utf8';
import { frameOf } from './helpers/figure';

/** A 1×1 PNG (IHDR, IDAT of one grey pixel, IEND), built with the module's own chunks. */
function tinyPng(): Uint8Array {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = pngChunk('IHDR', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]));
  const idat = pngChunk(
    'IDAT',
    new Uint8Array([0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x80, 0x00, 0x81, 0x00, 0x81]),
  );
  const iend = pngChunk('IEND', new Uint8Array());
  return new Uint8Array([...sig, ...ihdr, ...idat, ...iend]);
}

describe('PNG', () => {
  it('crc32 is the PNG CRC (known value of "IEND")', () => {
    expect(crc32(new Uint8Array([73, 69, 78, 68]))).toBe(0xae426082);
  });

  it('the plan is the frame display list at the pixel ratio', () => {
    const f = frameOf('@version 1\nA = (0, 0)\nB = (4, 0)\n');
    const p = pngPlan(f, 3);
    expect(p).toEqual({
      display: f.display,
      pixelRatio: 3,
      width: 1920,
      height: 1440,
      drawn: f.display.items.map((i) => i.id),
    });
    expect(pngPlan(f, 7).pixelRatio).toBe(2);
    expect(PNG_RATIOS).toEqual([1, 2, 3]);
  });

  it('adds pHYs before IDAT and the figure text before IEND; reading back gives the text', () => {
    const text = '@version 1\nA = (0, 0) # ω ∠ é\n';
    const out = pngWithMetadata(tinyPng(), text, 192);
    const chunks = pngChunks(out) ?? [];
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'iTXt', 'IEND']);
    expect(chunks.every((c) => c.crcOk)).toBe(true);
    const phys = chunks[1]?.data ?? new Uint8Array();
    expect([...phys]).toEqual([0, 0, 0x1d, 0x87, 0, 0, 0x1d, 0x87, 1]);
    expect(pngFigureText(out)).toBe(text);
    // Again: replaced, not added twice.
    const again = pngWithMetadata(out, 'B', 96);
    expect((pngChunks(again) ?? []).map((c) => c.type)).toEqual([
      'IHDR',
      'pHYs',
      'IDAT',
      'iTXt',
      'IEND',
    ]);
    expect(pngFigureText(again)).toBe('B');
  });

  it('leaves anything that is not a whole PNG unchanged', () => {
    const junk = new Uint8Array([1, 2, 3]);
    expect(pngWithMetadata(junk, 'x', 96)).toBe(junk);
    expect(pngChunks(junk)).toBeUndefined();
    const cut = tinyPng().slice(0, 30);
    expect(pngChunks(cut)).toBeUndefined();
    expect(pngWithMetadata(cut, 'x', 96)).toBe(cut);
    expect(pngFigureText(tinyPng())).toBeUndefined();
  });
});

describe('UTF-8', () => {
  it('round-trips every kind of code point', () => {
    for (const s of ['', 'abc', 'é', 'ω∠≤', '😀', 'a\u0000b', '\u{10FFFF}'])
      expect(utf8Decode(utf8Encode(s))).toBe(s);
    expect([...utf8Encode('é')]).toEqual([0xc3, 0xa9]);
    expect([...utf8Encode('😀')]).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });

  it('a lone surrogate encodes as U+FFFD; malformed bytes decode as U+FFFD', () => {
    expect(utf8Decode(utf8Encode('\ud800'))).toBe('�');
    expect(utf8Decode(new Uint8Array([0xff, 0x41]))).toBe('�A');
    expect(utf8Decode(new Uint8Array([0xc3]))).toBe('�');
    expect(utf8Decode(new Uint8Array([0xc0, 0x80]))).toBe('��');
    expect(utf8Decode(new Uint8Array([0xe0, 0x80, 0x80]))).toBe('���');
    expect(utf8Decode(new Uint8Array([0xed, 0xa0, 0x80]))).toBe('���');
  });
});
