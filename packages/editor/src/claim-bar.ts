/**
 * The header's "Test a claim" box (ADR-0016, ADR-0051): its text is a claim of the language
 * (`claim` is written for the user), run as a command (command.ts: the same parser as the
 * text, one edit). This module holds the box's logic, so the web app only draws it: the
 * accepted forms (the notation table of packages/lang, and Geomdraw's short forms, ADR-0025),
 * completions of the word at the cursor, and the diagnostics of a text it could not read, with
 * columns in the box's own text.
 */
import { CLAIM_KINDS } from '@geomira/claims/kinds';
import { CLAIM_NOTATION } from '@geomira/lang/notation';
import { runCommand, type CommandResult, type Completion } from './command';
import type { EditorEnv, EditorState } from './state';

/** At most this many completions are offered. */
export const MAX_CLAIM_COMPLETIONS = 12;

/** One form the box reads, with the kind it makes. */
export interface ClaimForm {
  readonly form: string;
  readonly kind: string;
}

/**
 * Geomdraw's short forms (ADR-0025 decision 9), read as the kinds they name. A test parses
 * each one on a figure, so the list cannot drift from the parser.
 */
export const SHORT_CLAIM_FORMS: readonly ClaimForm[] = Object.freeze([
  { form: 'A, B, C collinear', kind: 'collinear' },
  { form: 'ABCD cyclic', kind: 'concyclic' },
  { form: 'AP, BQ, CR concurrent', kind: 'concurrent' },
  { form: 'AB ⟂ CD', kind: 'perpendicular' },
  { form: 'AB ∥ CD', kind: 'parallel' },
  { form: 'P on ω', kind: 'on' },
  { form: 'ω tangent γ', kind: 'tangent' },
]);

/** Every form the box reads: the short forms, then each kind's notation (one per form). */
export function claimForms(): ClaimForm[] {
  const notation = CLAIM_NOTATION.flatMap((n) => n.forms.map((form) => ({ form, kind: n.kind })));
  return [...SHORT_CLAIM_FORMS, ...notation];
}

/** Words that end a list of objects, and words between two objects (ADR-0025). */
const LIST_WORDS: readonly string[] = ['collinear', 'concurrent', 'concyclic', 'cyclic'];
const PAIR_WORDS: readonly string[] = ['perpendicular', 'parallel', 'on', 'tangent', '⟂', '∥'];

/** The command line of a box text and how many characters were put in front of it. */
export function claimLine(text: string): { readonly line: string; readonly offset: number } {
  const t = text.trimStart();
  const lead = text.length - t.length;
  return /^claim\b/u.test(t)
    ? { line: t, offset: 0 - lead }
    : { line: `claim ${t}`, offset: 'claim '.length - lead };
}

/**
 * Adds the box's claim (see the module comment). Degenerate: an empty text → an error with no
 * diagnostics. Diagnostics carry columns of the box's text (the added `claim ` taken off).
 */
export function runClaimText(state: EditorState, text: string, env: EditorEnv): CommandResult {
  if (text.trim() === '') return { kind: 'error', reason: 'type a claim', diagnostics: [] };
  const { line, offset } = claimLine(text);
  const r = runCommand(state, line, env);
  if (r.kind === 'edit') return r;
  const shift = (col: number) => Math.max(1, col - offset);
  const diagnostics = r.diagnostics.map((d) => ({
    ...d,
    column: shift(d.column),
    endColumn: Math.max(shift(d.column) + 1, shift(d.endColumn)),
  }));
  return { ...r, diagnostics };
}

/** The word before the cursor and where it starts. */
function wordAt(text: string, cursor: number): { word: string; start: number } {
  const before = text.slice(0, Math.max(0, Math.min(cursor, text.length)));
  const m = /[\\\p{L}_][\p{L}\p{N}_']*$/u.exec(before);
  return m === null ? { word: '', start: before.length } : { word: m[0], start: m.index };
}

function formsOf(kind: string): string {
  const n = CLAIM_NOTATION.find((x) => x.kind === kind);
  return n === undefined ? kind : n.forms.join(' · ');
}

function kindCompletions(): Completion[] {
  return CLAIM_KINDS.map((k) => ({
    label: k.name,
    insert: `${k.name}(`,
    detail: formsOf(k.name),
    kind: 'claim',
  }));
}

function wordCompletions(words: readonly string[], detail: string): Completion[] {
  return words.map((w) => ({ label: w, insert: `${w} `, detail, kind: 'keyword' }));
}

function objectCompletions(state: EditorState): Completion[] {
  return state.doc.objects.map((o) => ({
    label: o.name,
    insert: o.name,
    detail: 'object',
    kind: 'object',
  }));
}

/** The candidates at the word that starts at `start` (see claimCompletions). */
function candidates(state: EditorState, text: string, start: number): Completion[] {
  const head = text.slice(0, start);
  if (head.trim() === '') return [...kindCompletions(), ...objectCompletions(state)];
  // After objects and a space, outside any call: the words of the short forms.
  const outside = !head.includes('(') && /\s$/u.test(head);
  if (outside && head.includes(','))
    return wordCompletions(LIST_WORDS, 'after a list: A, B, C collinear');
  if (outside) return wordCompletions([...PAIR_WORDS, ...LIST_WORDS], 'between two objects');
  return objectCompletions(state);
}

/**
 * Completions of the word before `cursor` in the box's text (prefix matches, shortest first):
 * at the start the claim kinds (with their forms) and the objects; after objects and a space
 * the words of Geomdraw's forms (`collinear`, `concurrent`, `⟂`, …); elsewhere the objects.
 * Accepting one replaces that word (command.ts's acceptCompletion).
 */
export function claimCompletions(state: EditorState, text: string, cursor: number): Completion[] {
  const { word, start } = wordAt(text, cursor);
  const w = word.toLowerCase();
  const seen = new Set<string>();
  return candidates(state, text, start)
    .filter((c) => c.label.toLowerCase().startsWith(w) && c.label !== word)
    .filter((c) => {
      const key = `${c.kind}:${c.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.length - b.label.length || (a.label < b.label ? -1 : 1))
    .slice(0, MAX_CLAIM_COMPLETIONS);
}
