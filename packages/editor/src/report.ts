/**
 * The debug report (SPEC §12): the document's text, the app version, the last edits (the
 * editor's log, at most LOG_LENGTH = 50) and the user agent, as one plain-text report a
 * user can paste into a bug report. Pure: the app passes its version and the user agent.
 * Edits are written as JSON (bigints as decimal strings, so exact literals survive).
 */
import { print } from '@geomira/lang/print';
import type { EditorState } from './state';

export interface ReportInfo {
  readonly appVersion: string;
  readonly userAgent: string;
}

function json(x: unknown): string {
  return JSON.stringify(x, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
}

export function debugReport(state: EditorState, info: ReportInfo): string {
  return [
    '# GEOMIRA debug report',
    `app version: ${info.appVersion}`,
    `user agent: ${info.userAgent}`,
    `edits (last ${String(state.log.length)}, oldest first):`,
    ...state.log.map((e, i) => `${String(i + 1)}. ${json(e)}`),
    'text:',
    print(state.doc),
  ].join('\n');
}
