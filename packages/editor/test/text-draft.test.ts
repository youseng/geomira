/**
 * ADR-0047: the text panel's draft and what to do with it, pure (the timer and the field are
 * apps/web's). A pause applies a text without errors that is about the figure shown; a text
 * typed on an older figure (a drag, a tool, undo, a link opened meanwhile) is never applied by
 * the pause or by leaving the field, only by Apply text; applies within TEXT merge window
 * continue the typing session; the field keeps the text as typed until the session settles.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import {
  applied,
  atPause,
  canApply,
  draftOf,
  follow,
  hasEdits,
  isStale,
  onApplyNow,
  settled,
  typedInto,
  type DraftFacts,
} from '../src/text-draft';
import { docOf } from './helpers/editor';

const MERGE = 3000;
const D0 = docOf('A = (0, 0)\nB = (4, 0)');
const D1 = docOf('A = (0, 0)\nB = (5, 0)');
const P0 = print(D0);
const P1 = print(D1);

const facts = (doc = D0, extra: Partial<DraftFacts> = {}): DraftFacts => ({
  doc,
  errors: false,
  dragging: false,
  ...extra,
});

describe('the text draft (ADR-0047)', () => {
  it('a new draft is the printed figure, without edits, no session', () => {
    const d = draftOf(D0, P0);
    expect(d).toEqual({ text: P0, clean: P0, doc: D0, session: null });
    expect(hasEdits(d)).toBe(false);
    expect(atPause(d, facts(), 0, MERGE)).toEqual({ kind: 'none', why: 'no edits' });
    expect(canApply(d, false)).toBe(false);
  });

  it('a pause applies a text without errors as the start of a session', () => {
    const d = typedInto(draftOf(D0, P0), P1);
    expect(hasEdits(d)).toBe(true);
    expect(atPause(d, facts(), 1000, MERGE)).toEqual({ kind: 'apply', typing: 'start' });
    expect(canApply(d, false)).toBe(true);
  });

  it('a text with errors is not applied (its diagnostics stay); Apply is disabled', () => {
    const d = typedInto(draftOf(D0, P0), `${P0}M = midpoint(A, Q)\n`);
    expect(atPause(d, facts(D0, { errors: true }), 1000, MERGE)).toEqual({
      kind: 'none',
      why: 'errors',
    });
    expect(onApplyNow(d, facts(D0, { errors: true }), 1000, MERGE).kind).toBe('none');
    expect(canApply(d, true)).toBe(false);
  });

  it('a pending apply is dropped when the figure changed meanwhile (a drag, a tool, undo, a link)', () => {
    const d = typedInto(draftOf(D0, P0), P0.replace('A = (0, 0)', 'A = (1, 0)'));
    expect(atPause(d, facts(D1), 1000, MERGE)).toEqual({ kind: 'none', why: 'stale' });
    expect(isStale(d, D1)).toBe(true);
    // The draft is kept, not applied and not lost: Apply text (explicit) puts it in place.
    const kept = follow(d, D1, () => P1);
    expect(kept).toBe(d);
    expect(atPause(kept, facts(D1), 2000, MERGE)).toEqual({ kind: 'none', why: 'stale' });
    expect(onApplyNow(kept, facts(D1), 2000, MERGE)).toEqual({ kind: 'apply' });
  });

  it('nothing is applied while a drag is in progress', () => {
    const d = typedInto(draftOf(D0, P0), P1);
    expect(atPause(d, facts(D0, { dragging: true }), 1000, MERGE)).toEqual({
      kind: 'none',
      why: 'dragging',
    });
    expect(onApplyNow(d, facts(D0, { dragging: true }), 1000, MERGE).kind).toBe('none');
  });

  it('after an apply the field keeps the text as typed; the draft is about the new figure', () => {
    const typed = P0.replace('B = (4, 0)', 'B = (5,0)');
    const a = applied(typedInto(draftOf(D0, P0), typed), typed, D1, 1000);
    expect(a).toEqual({ text: typed, clean: typed, doc: D1, session: 1000 });
    expect(hasEdits(a)).toBe(false);
    // The figure it made is no change from elsewhere: the field is not rewritten.
    expect(follow(a, D1, () => P1)).toBe(a);
    // The session is open: Apply text settles it (enabled).
    expect(canApply(a, false)).toBe(true);
  });

  it('applies within the merge window continue the session; a longer pause starts another', () => {
    const a = applied(typedInto(draftOf(D0, P0), P1), P1, D1, 1000);
    const more = typedInto(a, `${P1}C = (1, 1)\n`);
    expect(atPause(more, facts(D1), 1000 + MERGE, MERGE)).toEqual({
      kind: 'apply',
      typing: 'continue',
    });
    expect(atPause(more, facts(D1), 1001 + MERGE, MERGE)).toEqual({
      kind: 'apply',
      typing: 'start',
    });
    expect(onApplyNow(more, facts(D1), 1500, MERGE)).toEqual({ kind: 'apply', typing: 'continue' });
  });

  it('settling (Apply text, Ctrl+Enter, leaving the field) shows the printed figure and ends the session', () => {
    const typed = P0.replace('B = (4, 0)', 'B = (5,0)');
    const a = applied(typedInto(draftOf(D0, P0), typed), typed, D1, 1000);
    const s = settled(a, D1, () => P1);
    expect(s).toEqual(draftOf(D1, P1));
    expect(canApply(s, false)).toBe(false);
  });

  it('settling keeps a text that was not applied (errors, or typed on an older figure)', () => {
    const bad = typedInto(applied(typedInto(draftOf(D0, P0), P1), P1, D1, 1000), `${P1}X =`);
    const s = settled(bad, D1, () => {
      throw new Error('printed');
    });
    expect(s).toEqual({ ...bad, session: null });
    const stale = typedInto(draftOf(D0, P0), `${P0}X = (1, 1)\n`);
    expect(settled(stale, D1, () => P1).text).toBe(stale.text);
  });

  it('a draft without edits of its own follows the figure (the session ends with it)', () => {
    const a = applied(typedInto(draftOf(D0, P0), P1), P1, D1, 1000);
    const D2 = docOf('A = (0, 0)');
    const f = follow(a, D2, () => print(D2));
    expect(f).toEqual(draftOf(D2, print(D2)));
    // The printed text is computed only when the draft follows.
    const same = draftOf(D0, P0);
    expect(
      follow(same, D0, () => {
        throw new Error('printed');
      }),
    ).toBe(same);
  });
});
