/**
 * The canonical printer (SPEC §11.4, ADR-0009): `print(doc)` is the deterministic text of a
 * document, read back by parse to the same document up to ids (law P1). Files, share links,
 * autosaves and exports hold this text. The layout and the notations are print-document.ts's;
 * the short notation the text panel shows is print-short.ts's (ADR-0061).
 */
import type { Document } from '@geomira/kernel/document';
import { printIn } from './print-document';

/** The canonical text of a document (never throws; a document outside P1's domain still prints). */
export function print(given: Document): string {
  return printIn(given, {});
}
