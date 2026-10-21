/**
 * PNG export (SPEC §14 "PNG (via scene)"): the raster is the export frame's display list,
 * the very list the canvas draws, drawn by the app's canvas renderer at `pixelRatio` device
 * pixels per CSS pixel (apps/web; a raster needs a font renderer, which a pure package has
 * not). This module plans it and finishes the file: `pngWithMetadata` adds a pHYs chunk
 * (96 × pixelRatio dots per inch, so the image prints at the screen's size) and an iTXt
 * chunk `GEOMIRA` with the figure's text (so the file reproduces the figure), before IEND.
 */
import type { DisplayList } from '@geomira/scene/display';
import type { ExportFrame } from './frame';
import { utf8Decode, utf8Encode } from './utf8';

/** The pixel ratios offered (1×, 2×, 3×); 2 is the default. */
export const PNG_RATIOS: readonly number[] = Object.freeze([1, 2, 3]);

export interface PngPlan {
  readonly display: DisplayList;
  readonly pixelRatio: number;
  /** Device pixels. */
  readonly width: number;
  readonly height: number;
  /** Ids of the objects drawn, back to front. */
  readonly drawn: readonly number[];
}

/** The plan of a PNG of the frame. Degenerate: a ratio outside PNG_RATIOS → 2. */
export function pngPlan(f: ExportFrame, pixelRatio = 2): PngPlan {
  const r = PNG_RATIOS.includes(pixelRatio) ? pixelRatio : 2;
  return {
    display: f.display,
    pixelRatio: r,
    width: Math.round(f.view.size.width * r),
    height: Math.round(f.view.size.height * r),
    drawn: f.display.items.map((i) => i.id),
  };
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function crcTable(): readonly number[] {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return Object.freeze(t);
}

const CRC_TABLE = crcTable();

/** CRC-32 of the PNG specification (ISO 3309), over `bytes`. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(x: number): number[] {
  return [(x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff];
}

/** A chunk: length, type, data, CRC of type and data. */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = new Uint8Array([...utf8Encode(type), ...data]);
  return new Uint8Array([...u32(data.length), ...typed, ...u32(crc32(typed))]);
}

export interface PngChunkInfo {
  readonly type: string;
  readonly data: Uint8Array;
  readonly crcOk: boolean;
}

/** The chunks of a PNG file, or undefined when it is not one (signature, lengths). */
export function pngChunks(png: Uint8Array): PngChunkInfo[] | undefined {
  if (png.length < 8 || SIGNATURE.some((b, i) => png[i] !== b)) return undefined;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: PngChunkInfo[] = [];
  for (let at = 8; at < png.length;) {
    if (at + 12 > png.length) return undefined;
    const len = view.getUint32(at);
    if (at + 12 + len > png.length) return undefined;
    const typed = png.subarray(at + 4, at + 8 + len);
    const type = utf8Decode(typed.subarray(0, 4));
    out.push({
      type,
      data: typed.subarray(4),
      crcOk: crc32(typed) === view.getUint32(at + 8 + len),
    });
    at += 12 + len;
  }
  return out;
}

/**
 * The PNG with a pHYs chunk (dpi) and an iTXt chunk `GEOMIRA` holding `text` (UTF-8,
 * uncompressed) inserted before IEND, replacing earlier ones. Degenerate: input that is not
 * a PNG with an IEND chunk is returned unchanged.
 */
export function pngWithMetadata(png: Uint8Array, text: string, dpi: number): Uint8Array {
  const chunks = pngChunks(png);
  if (chunks === undefined || chunks[chunks.length - 1]?.type !== 'IEND') return png;
  const ppm = Math.round(dpi / 0.0254);
  const phys = pngChunk('pHYs', new Uint8Array([...u32(ppm), ...u32(ppm), 1]));
  const itxt = pngChunk(
    'iTXt',
    new Uint8Array([...utf8Encode('GEOMIRA'), 0, 0, 0, 0, 0, ...utf8Encode(text)]),
  );
  const kept = chunks.filter(
    (c) => c.type !== 'IEND' && c.type !== 'pHYs' && !(c.type === 'iTXt' && isGeomira(c.data)),
  );
  const parts = [
    new Uint8Array(SIGNATURE),
    ...kept.map((c) => pngChunk(c.type, c.data)),
    phys,
    itxt,
    pngChunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function isGeomira(data: Uint8Array): boolean {
  return utf8Decode(data.subarray(0, 8)) === 'GEOMIRA\0';
}

/** The figure text of a PNG written by pngWithMetadata, or undefined. */
export function pngFigureText(png: Uint8Array): string | undefined {
  const c = pngChunks(png)?.find((x) => x.type === 'iTXt' && isGeomira(x.data));
  return c === undefined ? undefined : utf8Decode(c.data.subarray(12));
}
