/**
 * The PNG specification requires pHYs before the first IDAT (pre-beta review, ADR-0028). The
 * export wrote it after IDAT, so libpng-based readers (pdfTeX among them) ignored the dpi and
 * printed the image at the wrong size.
 */
import { describe, expect, it } from 'vitest';
import { pngChunk, pngChunks, pngFigureText, pngWithMetadata } from '../src/png';

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const IDAT = new Uint8Array([0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x80]);

function png(...chunks: Uint8Array[]): Uint8Array {
  return new Uint8Array([...SIG, ...chunks.flatMap((c) => [...c])]);
}

describe('PNG chunk order', () => {
  it('pHYs precedes the first IDAT; an old pHYs after IDAT is replaced, not kept', () => {
    const input = png(
      pngChunk('IHDR', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0])),
      pngChunk('IDAT', IDAT.slice(0, 4)),
      pngChunk('IDAT', IDAT.slice(4)),
      pngChunk('pHYs', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 1])),
      pngChunk('IEND', new Uint8Array()),
    );
    const out = pngWithMetadata(input, 'A', 96);
    expect((pngChunks(out) ?? []).map((c) => c.type)).toEqual([
      'IHDR',
      'pHYs',
      'IDAT',
      'IDAT',
      'iTXt',
      'IEND',
    ]);
    expect(pngFigureText(out)).toBe('A');
  });

  it('a PNG without IDAT is returned unchanged', () => {
    const input = png(
      pngChunk('IHDR', new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0])),
      pngChunk('IEND', new Uint8Array()),
    );
    expect(pngWithMetadata(input, 'A', 96)).toBe(input);
  });
});
