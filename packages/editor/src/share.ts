/**
 * Share links (SPEC §12): `#s=` + lz-string(text), the text being the document as the
 * language prints it (so a link reproduces the same figure, law L5). Decoding is total: a
 * missing or malformed fragment, a payload lz-string cannot read (it may throw on garbage),
 * a damaged payload (re-encoding the decoded text must give the payload back, so a truncated
 * link that still decodes to some text is refused instead of opening a different figure),
 * and a text with errors all give a refusal with the reason.
 */
import type { Document } from '@geomira/kernel/document';
import type { Registry } from '@geomira/kernel/registry';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import LZString from 'lz-string';

export const SHARE_PREFIX = '#s=';

/** The fragment of a share link to `doc`. */
export function encodeShare(doc: Document): string {
  return SHARE_PREFIX + LZString.compressToEncodedURIComponent(print(doc));
}

export type Shared =
  | { readonly ok: true; readonly text: string; readonly doc: Document }
  | { readonly ok: false; readonly reason: string; readonly diagnostics?: readonly Diagnostic[] };

/** The payload's text, or undefined when lz-string cannot read it (never throws). */
function decompress(payload: string): string | undefined {
  if (!/^[A-Za-z0-9+\-$]*$/u.test(payload)) return undefined;
  let text: string | null;
  try {
    // lz-string throws on some malformed input (third-party code): the only guarded call.
    // Its typings say string; it returns null (or '') for some payloads, checked below.
    text = LZString.decompressFromEncodedURIComponent(payload);
  } catch {
    return undefined;
  }
  return typeof text === 'string' && text !== '' ? text : undefined;
}

/** The document of a link fragment ("#s=…"), or why there is none. */
export function decodeShare(fragment: string, registry: Registry): Shared {
  if (!fragment.startsWith(SHARE_PREFIX)) return { ok: false, reason: 'not a share link' };
  const payload = fragment.slice(SHARE_PREFIX.length);
  const text = decompress(payload);
  if (text === undefined) return { ok: false, reason: 'the link cannot be read' };
  if (LZString.compressToEncodedURIComponent(text) !== payload)
    return { ok: false, reason: 'the link is damaged (it may have been cut short)' };
  const r = parse(text, registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0)
    return { ok: false, reason: 'the linked text has errors', diagnostics: errors };
  return { ok: true, text, doc: r.doc };
}
