/**
 * UTF-8 for the PNG text chunk (the packages compile without DOM or Node types, so without
 * TextEncoder). Encoding is total (a lone surrogate becomes U+FFFD); decoding replaces every
 * malformed sequence by U+FFFD.
 */

/** The UTF-8 bytes of `s`. */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0) ?? 0xfffd;
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

/** The string of UTF-8 bytes (malformed sequences → U+FFFD). */
export function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length;) {
    const x = b[i] ?? 0;
    const n =
      x < 0x80 ? 0 : x >= 0xf0 && x < 0xf8 ? 3 : x >= 0xe0 ? 2 : x >= 0xc2 && x < 0xe0 ? 1 : -1;
    if (n < 0) {
      s += '�';
      i++;
      continue;
    }
    let c = n === 0 ? x : x & (0x3f >> n);
    let ok = true;
    for (let k = 1; k <= n; k++) {
      const y = b[i + k];
      if (y === undefined || (y & 0xc0) !== 0x80) ok = false;
      else c = (c << 6) | (y & 63);
    }
    const min = [0, 0x80, 0x800, 0x10000][n] ?? 0;
    if (!ok || c < min || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) {
      s += '�';
      i++;
      continue;
    }
    s += String.fromCodePoint(c);
    i += n + 1;
  }
  return s;
}
