/**
 * Share links (SPEC §12): `#s=` + a checksum of the text (four characters of lz-string's URL
 * alphabet, ADR-0018) + lz-string(text), the text being the document as the language prints
 * it (so a link reproduces the same figure, law L5). Decoding is total and bounded: a missing
 * or malformed fragment, a payload longer than MAX_PAYLOAD (refused before decompressing:
 * lz-string's output can grow with the square of its input), a payload lz-string cannot read
 * (it may throw on garbage), a text longer than MAX_TEXT, a checksum that does not match (a
 * changed character), and a text with errors all give a refusal with the reason. A link
 * without a checksum (written before ADR-0018) is still read: re-encoding its text must give
 * its payload back, so a cut link that still decodes to some text is refused instead of
 * opening a different figure. A payload's %XX escapes (a client may write `+` as %2B) are
 * decoded first, one byte each; a malformed escape is refused.
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import LZString from 'lz-string';
import { decompressBounded } from './lz-bounded';

export const SHARE_PREFIX = '#s=';

/** lz-string's URL-safe alphabet (compressToEncodedURIComponent). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$';
const CHECK_LENGTH = 4;
/** The longest payload decoded (a figure of 500 objects needs about 6,000 characters). */
const MAX_PAYLOAD = 20_000;
/** The longest text read from a link (about 3,000 objects; SPEC §17 budgets 500). */
const MAX_TEXT = 100_000;

/** 24 bits of FNV-1a of `text` as four characters of ALPHABET. */
function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  let out = '';
  for (let k = 0; k < CHECK_LENGTH; k++, h >>>= 6) out += ALPHABET.charAt(h & 63);
  return out;
}

/** The fragment of a share link to `doc`. */
export function encodeShare(doc: Document): string {
  const text = print(doc);
  return SHARE_PREFIX + checksum(text) + LZString.compressToEncodedURIComponent(text);
}

export type Shared =
  | { readonly ok: true; readonly text: string; readonly doc: Document }
  | { readonly ok: false; readonly reason: string; readonly diagnostics?: readonly Diagnostic[] };

/** A payload's text, bounded by MAX_TEXT (lz-bounded.ts) and canonical, or why not. */
function canonicalText(payload: string): string | { readonly reason: string } {
  const read = decompressBounded(payload, MAX_TEXT);
  if ('problem' in read && read.problem === 'too large')
    return { reason: `the link’s text is too large (more than ${String(MAX_TEXT)} characters)` };
  const text = 'text' in read ? read.text : '';
  if (text === '') return { reason: 'the link cannot be read' };
  // Re-encoding must give the payload back: a cut payload can still decode to a text.
  return LZString.compressToEncodedURIComponent(text) === payload
    ? text
    : { reason: 'the link is damaged (it may have been cut short)' };
}

/**
 * The text of a link's payload. When the payload after its first four characters is a
 * canonical encoding, the link has a checksum (ADR-0018), which must match; otherwise it is a
 * link written before ADR-0018, read whole.
 */
function readPayload(payload: string): { readonly text: string } | { readonly reason: string } {
  if (payload.length > MAX_PAYLOAD)
    return { reason: `the link is too long (more than ${String(MAX_PAYLOAD)} characters)` };
  const checked = canonicalText(payload.slice(CHECK_LENGTH));
  if (typeof checked === 'string')
    return checksum(checked) === payload.slice(0, CHECK_LENGTH)
      ? { text: checked }
      : { reason: 'the link is damaged (a character was changed)' };
  const old = canonicalText(payload);
  if (typeof old === 'string') return { text: old };
  // The reason of the form the payload is closest to: with a checksum unless unreadable so.
  return checked.reason === 'the link cannot be read' ? old : checked;
}

/**
 * The payload with its %XX escapes decoded (a chat or mail client may write `+` as %2B and `$`
 * as %24), one byte each, or undefined when an escape is malformed (a `%` not followed by two
 * hex digits). A decoded character outside the payload's alphabet is refused by the decoder.
 */
function unescaped(payload: string): string | undefined {
  if (/%(?![0-9A-Fa-f]{2})/u.test(payload)) return undefined;
  // One pass: a decoded `%` (from %25) is never read as an escape again.
  return payload.replace(/%([0-9A-Fa-f]{2})/gu, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

/** The document of a link fragment ("#s=…"), or why there is none. */
export function decodeShare(fragment: string, registry: Registry): Shared {
  if (!fragment.startsWith(SHARE_PREFIX)) return { ok: false, reason: 'not a share link' };
  const payload = unescaped(fragment.slice(SHARE_PREFIX.length));
  if (payload === undefined) return { ok: false, reason: 'the link cannot be read' };
  const read = readPayload(payload);
  if ('reason' in read) return { ok: false, reason: read.reason };
  const text = read.text;
  const r = parse(text, registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    return { ok: false, reason: 'the linked text has errors', diagnostics: errors };
  return { ok: true, text, doc: r.doc };
}
