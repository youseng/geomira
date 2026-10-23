/**
 * The editor's log of applied edits (the debug report's "last 50 edits", SPEC §12). The
 * report is for reproducing a figure's history, so DOCUMENT edits (objects, claims, text,
 * batches, drags, undo and redo) are what it must keep: the log holds at most LOG_LENGTH
 * entries, and when it is full the oldest UI edit (selection, hover, viewport, active layer,
 * tool, tool number) leaves first, so hover and viewport edits, which come at mouse rate,
 * never push a document edit out. Only when the log holds no UI edit does the oldest
 * document edit leave.
 */
import { LOG_LENGTH } from './state';

const UI_KINDS: readonly string[] = Object.freeze([
  'select',
  'hover',
  'viewport',
  'activeLayer',
  'tool',
  'toolValue',
]);

/** Whether a log entry is a UI edit (outside the document and its history). */
export function isUiEntry(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('kind' in e)) return false;
  return typeof e.kind === 'string' && UI_KINDS.includes(e.kind);
}

/** The log with `e` appended, trimmed to LOG_LENGTH (UI edits leave first, oldest first). */
export function appendLog(log: readonly unknown[], e: unknown): unknown[] {
  const out = [...log, e];
  while (out.length > LOG_LENGTH) {
    const i = out.findIndex(isUiEntry);
    out.splice(i >= 0 ? i : 0, 1);
  }
  return out;
}
