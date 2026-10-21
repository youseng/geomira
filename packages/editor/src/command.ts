/**
 * The command bar (SPEC §15): one line of the language, or a GUI tool. A statement is
 * applied as the document's text with the line appended (one `replaceText` edit, so it is
 * exactly what typing the line at the end of the text panel does: same parser, same ids
 * kept, one history entry); its diagnostics come back on line 1, the command's own line.
 * A tool's id or label (optionally after `tool`) switches the active tool.
 *
 * Completions come from the registry (the only enumeration of tools), the document's
 * object names, the statement keywords, the claim and assumption kinds of packages/claims
 * and the GUI tool table: data, never a hand-written list of tools.
 */
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import { ASSUMPTION_KINDS } from '@geomira/claims/hypotheses';
import type { Signature } from '@geomira/kernel/tool';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { print } from '@geomira/lang/print';
import { applyEdit } from './edit';
import type { EditResult } from './result';
import type { EditorEnv, EditorState } from './state';
import { TOOLS, type ToolUI } from './tools';

export type CommandResult =
  | { readonly kind: 'edit'; readonly result: Extract<EditResult, { ok: true }> }
  | {
      readonly kind: 'error';
      readonly reason: string;
      /** Diagnostics of the command, on line 1. */
      readonly diagnostics: readonly Diagnostic[];
    };

/** Statement keywords offered at the start of a line (SPEC §11.1). */
const KEYWORDS: readonly string[] = Object.freeze([
  'claim',
  'assume',
  'triangle',
  'style',
  'label',
  '@layer',
  '@view',
  '@viewport',
  '@title',
  '@author',
]);

/** At most this many completions are offered. */
export const MAX_COMPLETIONS = 12;

function guiTool(line: string): ToolUI | undefined {
  const t = line
    .replace(/^tool\s+/u, '')
    .trim()
    .toLowerCase();
  return TOOLS.find((x) => x.id === t || x.label.toLowerCase() === t);
}

/** Runs one command (see the module comment). Never throws. */
export function runCommand(state: EditorState, line: string, env: EditorEnv): CommandResult {
  const trimmed = line.trim();
  if (trimmed === '') return { kind: 'error', reason: 'type a statement', diagnostics: [] };
  const tool = guiTool(trimmed);
  if (tool !== undefined) {
    const r = applyEdit(state, { kind: 'tool', tool: tool.id }, env);
    return r.ok
      ? { kind: 'edit', result: r }
      : { kind: 'error', reason: r.reason, diagnostics: [] };
  }
  const printed = print(state.doc);
  const offset = printed.split('\n').length - 1;
  const r = applyEdit(state, { kind: 'replaceText', text: `${printed}${trimmed}\n` }, env);
  if (!r.ok) {
    const diagnostics = (r.diagnostics ?? []).map((d) => ({ ...d, line: d.line - offset }));
    return { kind: 'error', reason: r.reason, diagnostics };
  }
  if (r.state.doc === state.doc)
    return { kind: 'error', reason: 'the statement changes nothing', diagnostics: [] };
  return { kind: 'edit', result: r };
}

export interface Completion {
  readonly label: string;
  /** What replaces the word before the cursor. */
  readonly insert: string;
  readonly detail: string;
  readonly kind: 'tool' | 'object' | 'keyword' | 'claim' | 'assumption' | 'gui';
}

function signatureText(name: string, s: Signature): string {
  const params = [...s.params, ...(s.rest === undefined ? [] : [`${s.rest}…`])];
  return `${name}(${params.join(', ')})`;
}

/** The word being typed before the cursor and where it starts. */
function wordAt(text: string, cursor: number): { word: string; start: number } {
  const before = text.slice(0, Math.max(0, Math.min(cursor, text.length)));
  const m = /[@\\\p{L}_][\p{L}\p{N}_']*$/u.exec(before);
  return m === null ? { word: '', start: before.length } : { word: m[0], start: m.index };
}

function toolCompletions(env: EditorEnv): Completion[] {
  return env.registry.tools.map((t) => ({
    label: t.name,
    insert: `${t.name}(`,
    detail: t.signatures.map((s) => signatureText(t.name, s)).join(' | '),
    kind: 'tool',
  }));
}

function lineStart(state: EditorState, env: EditorEnv): Completion[] {
  const keywords: Completion[] = KEYWORDS.map((k) => ({
    label: k,
    insert: `${k} `,
    detail: 'statement',
    kind: 'keyword',
  }));
  const gui: Completion[] = TOOLS.map((t) => ({
    label: t.label,
    insert: t.id,
    detail: `tool (key ${t.key}): ${t.help}`,
    kind: 'gui',
  }));
  return [...keywords, ...gui, ...toolCompletions(env), ...objects(state)];
}

function objects(state: EditorState): Completion[] {
  return state.doc.objects.map((o) => ({
    label: o.name,
    insert: o.name,
    detail: 'object',
    kind: 'object',
  }));
}

/** The candidates for the position: after claim / assume, at the start, or in an expression. */
function candidates(state: EditorState, head: string, env: EditorEnv): Completion[] {
  if (/^\s*claim\s+[\p{L}_]*$/u.test(head))
    return CLAIM_KINDS.map((k) => ({
      label: k.name,
      insert: `${k.name}(`,
      detail: `claim ${k.name}(${[...k.params, ...(k.rest === undefined ? [] : [`${k.rest}…`])].join(', ')})`,
      kind: 'claim',
    }));
  if (/^\s*assume\s+[\p{L}_]*$/u.test(head))
    return ASSUMPTION_KINDS.map((k) => ({
      label: k,
      insert: `${k}(`,
      detail: `assume ${k}(…)`,
      kind: 'assumption',
    }));
  if (/^\s*[@\\\p{L}_][\p{L}\p{N}_']*$/u.test(head) || head.trim() === '')
    return lineStart(state, env);
  return [...toolCompletions(env), ...objects(state)];
}

/** Completions of the word before `cursor` in `text` (prefix matches, best first). */
export function completions(
  state: EditorState,
  text: string,
  cursor: number,
  env: EditorEnv,
): Completion[] {
  const { word, start } = wordAt(text, cursor);
  const head = text.slice(0, start + word.length);
  const w = word.toLowerCase();
  const seen = new Set<string>();
  return candidates(state, head, env)
    .filter((c) => c.label.toLowerCase().startsWith(w) && c.label !== word)
    .filter((c) => {
      const key = `${c.kind}:${c.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.length - b.label.length || (a.label < b.label ? -1 : 1))
    .slice(0, MAX_COMPLETIONS);
}

/** The text and cursor after accepting `c` for the word before `cursor`. */
export function acceptCompletion(
  text: string,
  cursor: number,
  c: Completion,
): { text: string; cursor: number } {
  const { word, start } = wordAt(text, cursor);
  const end = start + word.length;
  return {
    text: text.slice(0, start) + c.insert + text.slice(end),
    cursor: start + c.insert.length,
  };
}
