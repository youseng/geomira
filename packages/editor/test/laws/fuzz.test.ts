/**
 * Law L14: editor-level model-based fuzzing (fc.commands) over every edit type, undo/redo,
 * replaceText, layer switches, drags (drag-through of images included), tool inputs and
 * garbage (helpers/fuzz-commands.ts), ≥ 500 runs per CI and 20,000 with NIGHTLY=1. After
 * EVERY step:
 *   L1  every value is total and finite, and the editor's incremental values equal a full
 *       evaluation of its document;
 *   L5  the document survives the text and the share link: print → parse gives it back up
 *       to ids and image-run order (the canonical comparison of lang), and the share link
 *       decodes to the very same text;
 *   L6  undo/redo restore documents EXACTLY: the model's stack of documents (kept apart
 *       from the editor's history) agrees with every undo and redo, by identity, and an
 *       undo then redo of the current state returns its document;
 *   L7  invariants I1–I8 hold;
 *   L13 derived layers are in sync.
 * applyEdit and toolInput never throw; a refusal returns the very same state.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { syncProblems } from '@geomira/kernel/derived';
import { checkInvariants } from '@geomira/kernel/invariants';
import { numbersOf } from '@geomira/kernel/value';
import { sameUpToIds } from '@geomira/lang/canonical';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit, type EditResult } from '../../src/edit';
import { toolInput } from '../../src/machine';
import { decodeShare, encodeShare } from '../../src/share';
import { createEditor, evaluationOf, type EditorState } from '../../src/state';
import { MAKERS, type Make } from '../helpers/fuzz-commands';
import { docOf, env, registry } from '../helpers/editor';

const RUNS = process.env.NIGHTLY === '1' ? 20_000 : 500;
const SEED = 20261021;

const START = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'l = line(A, B)',
  'c = circle(A, C)',
  'P = on(l, 1/3)',
  'Q = on(c, 2, 1)',
  'T = reflect(line(A, C))',
  '@layer mirror = image(T, main)',
  't = text(C, "C\'s text")',
].join('\n');

interface Model {
  /** The documents before each committed action (the editor's undo stack, by identity). */
  past: Document[];
  future: Document[];
}

interface Stats {
  steps: number;
  applied: Record<string, number>;
  refused: Record<string, number>;
  maxObjects: number;
  undo: number;
  redo: number;
  dragsThrough: number;
}

interface Real {
  s: EditorState;
  readonly stats: Stats;
}

/** L1, L5, L7, L13 on a state. */
function laws(s: EditorState): void {
  expect(checkInvariants(s.doc)).toEqual([]);
  expect(syncProblems(s.doc, registry)).toEqual([]);
  for (const v of s.values.values.values())
    for (const x of numbersOf(v)) expect(Number.isFinite(x)).toBe(true);
  expect(s.values.values).toEqual(evaluationOf(s.doc, env).values);
  const text = print(s.doc);
  const back = parse(text, registry);
  const errors = back.diagnostics.filter((d) => d.severity === 'error');
  expect(
    errors.map((d) => `${String(d.line)}: ${d.message}`),
    text,
  ).toEqual([]);
  expect(sameUpToIds(back.doc, s.doc), text).toBe(true);
  const shared = decodeShare(encodeShare(s.doc), registry);
  expect(shared.ok && shared.text === text).toBe(true);
}

/** L6 on the model: the history's step against the model's stacks. */
function history(m: Model, before: EditorState, r: EditResult, kind: string): void {
  if (!r.ok) {
    expect(r.state).toBe(before);
    return;
  }
  const after = r.state;
  if (kind === 'undo') {
    expect(after.doc).toBe(m.past.pop());
    m.future.push(before.doc);
  } else if (kind === 'redo') {
    expect(after.doc).toBe(m.future.pop());
    m.past.push(before.doc);
  } else if (after.history.past.length > before.history.past.length) {
    // A new entry: a committed action, or the first move of a drag (its document before).
    const entry = after.history.past[after.history.past.length - 1];
    m.past.push(kind === 'dragMove' ? (before.drag?.before ?? before.doc) : before.doc);
    expect(entry?.before).toBe(m.past[m.past.length - 1]);
    m.future = [];
  } else if (kind === 'dragCancel' && after.history.past.length < before.history.past.length) {
    m.past.pop();
  }
  expect(after.history.past.length).toBe(m.past.length);
  expect(after.history.future.length).toBe(m.future.length);
}

/** Undo then redo of a state returns its document exactly (when there is something to undo). */
function undoRedo(s: EditorState): void {
  if (s.drag !== null || s.history.past.length === 0) return;
  const u = applyEdit(s, { kind: 'undo' }, env);
  expect(u.ok).toBe(true);
  if (!u.ok) return;
  expect(u.state.doc).toBe(s.history.past[s.history.past.length - 1]?.before);
  const r = applyEdit(u.state, { kind: 'redo' }, env);
  expect(r.ok && r.state.doc).toBe(s.doc);
}

class Command implements fc.Command<Model, Real> {
  constructor(
    readonly label: string,
    readonly make: Make,
  ) {}

  check(): boolean {
    return true;
  }

  run(m: Model, r: Real): void {
    for (const step of this.make(r.s)) {
      const before = r.s;
      const res =
        step.kind === 'edit'
          ? applyEdit(before, step.edit, env)
          : toolInput(before, step.input, env);
      const kind = step.kind === 'edit' ? step.edit.kind : `tool:${step.input.kind}`;
      if (step.kind === 'edit') history(m, before, res, kind);
      else if (res.ok) {
        // A tool input commits its edits through applyEdit: the model follows the history.
        const added = res.state.history.past.length - before.history.past.length;
        for (let i = 0; i < added; i++) {
          const e = res.state.history.past[before.history.past.length + i];
          if (e !== undefined) m.past.push(e.before);
        }
        if (added > 0) m.future = [];
      } else expect(res.state).toBe(before);
      const tally = res.ok ? r.stats.applied : r.stats.refused;
      tally[kind] = (tally[kind] ?? 0) + 1;
      if (res.ok && kind === 'undo') r.stats.undo++;
      if (res.ok && kind === 'redo') r.stats.redo++;
      if (res.ok && kind === 'dragMove' && r.s.drag !== null && r.s.drag.id !== r.s.drag.base)
        r.stats.dragsThrough++;
      r.s = res.state;
      r.stats.steps++;
      r.stats.maxObjects = Math.max(r.stats.maxObjects, r.s.doc.objects.length);
      laws(r.s);
      undoRedo(r.s);
    }
  }

  toString(): string {
    return this.label;
  }
}

describe(`L14: editor-level model-based fuzzing (${String(RUNS)} runs, fc.commands)`, () => {
  it('every edit type, undo/redo, replaceText, layer switches, drags, tools, garbage: L1, L5, L6, L7, L13 after each step', () => {
    const stats: Stats = {
      steps: 0,
      applied: {},
      refused: {},
      maxObjects: 0,
      undo: 0,
      redo: 0,
      dragsThrough: 0,
    };
    const start = createEditor(docOf(START), env);
    const commands = MAKERS.map(({ label, make }) => new Command(label, make));
    fc.assert(
      fc.property(fc.commands([commands], { maxCommands: 25, size: 'max' }), (cmds) => {
        const setup = () => ({
          model: { past: [], future: [] } as Model,
          real: { s: start, stats } as Real,
        });
        fc.modelRun(setup, cmds);
      }),
      { seed: SEED, numRuns: RUNS, endOnFailure: true },
    );
    console.warn(`L14 editor fuzz: ${String(RUNS)} runs; ${JSON.stringify(stats)}`);
    const applied = (k: string) => stats.applied[k] ?? 0;
    for (const k of [
      'add',
      'remove',
      'rename',
      'redefine',
      'style',
      'addLayer',
      'addDerivedLayer',
      'addClaim',
      'addAssumption',
      'replaceText',
      'batch',
      'dragMove',
      'dragEnd',
      'undo',
      'redo',
      'activeLayer',
      'tool:click',
    ])
      expect(applied(k), k).toBeGreaterThan(0);
    for (const k of ['dragMove', 'remove', 'replaceText', 'addClaim', 'tool:click'])
      expect(stats.refused[k] ?? 0, k).toBeGreaterThan(0);
    expect(stats.dragsThrough).toBeGreaterThan(0);
    expect(stats.redo).toBeGreaterThanOrEqual(RUNS / 10);
  }, 3_600_000);
});
