/**
 * ADR-0047: the text applies as you type. The text panel's automatic applies of one typing
 * session are ONE history entry (a coalescing replaceText, like a drag's moves): `typing:
 * 'start'` records the session's entry, `typing: 'continue'` amends it while it is still the
 * last action. Any other document edit, undo, redo or drag ends the session. The panel's parse
 * (lang's parseText) is reused for this very text and registry only.
 */
import { describe, expect, it } from 'vitest';
import { createRegistry } from '@geomira/kernel/registry';
import { parseText } from '@geomira/lang/parse-text';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { debugReport } from '../src/report';
import type { EditorState } from '../src/state';
import { edit, editorOf, env, idOf, registry, xyOf } from './helpers/editor';

const START = 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)';

/** The printed text with `from` replaced by `to`. */
function typed(s: EditorState, from: string, to: string): string {
  const t = print(s.doc);
  if (!t.includes(from)) throw new Error(`no ${from}`);
  return t.replace(from, to);
}

describe('a typing session is one history entry (ADR-0047)', () => {
  it('consecutive applies merge; one undo returns to the document before the session; redo works', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const s2 = edit(s1, {
      kind: 'replaceText',
      text: typed(s1, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    const s3 = edit(s2, {
      kind: 'replaceText',
      text: `${print(s2.doc)}M = midpoint(A, B)\n`,
      typing: 'continue',
    });
    expect(s3.history.past).toHaveLength(1);
    expect(s3.history.past[0]?.before).toBe(s0.doc);
    expect(s3.history.past[0]?.after).toBe(s3.doc);
    const u = edit(s3, { kind: 'undo' });
    expect(u.doc).toBe(s0.doc);
    const r = edit(u, { kind: 'redo' });
    expect(r.doc).toBe(s3.doc);
    expect(xyOf(r, 'C')).toEqual([2, 5]);
  });

  it('ids are kept across the session (parseInto)', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'B = (4, 0)', 'B = (5, 0)'),
      typing: 'start',
    });
    const s2 = edit(s1, {
      kind: 'replaceText',
      text: typed(s1, 'A = (0, 0)', 'A = (0, 1)'),
      typing: 'continue',
    });
    for (const n of ['A', 'B', 'C']) expect(idOf(s2, n)).toBe(idOf(s0, n));
  });

  it('a non-text edit in between ends the session', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const s2 = edit(s1, { kind: 'style', id: idOf(s1, 'A'), style: { color: 'red' } });
    const s3 = edit(s2, {
      kind: 'replaceText',
      text: typed(s2, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s3.history.past.map((e) => e.before)).toEqual([s0.doc, s1.doc, s2.doc]);
    expect(edit(s3, { kind: 'undo' }).doc).toBe(s2.doc);
  });

  it('a drag in between ends the session', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    let s = edit(s1, { kind: 'dragStart', id: idOf(s1, 'A') });
    s = edit(s, { kind: 'dragMove', to: { x: -1, y: 0 } });
    s = edit(s, { kind: 'dragEnd' });
    const s2 = s;
    const s3 = edit(s2, {
      kind: 'replaceText',
      text: typed(s2, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s3.history.past).toHaveLength(3);
    expect(edit(s3, { kind: 'undo' }).doc).toBe(s2.doc);
  });

  it('undo and redo in between end the session', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const u = edit(s1, { kind: 'undo' });
    const r = edit(u, { kind: 'redo' });
    expect(r.doc).toBe(s1.doc);
    const s2 = edit(r, {
      kind: 'replaceText',
      text: typed(r, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s2.history.past).toHaveLength(2);
    expect(edit(s2, { kind: 'undo' }).doc).toBe(s1.doc);
    const u2 = edit(s1, { kind: 'undo' });
    const s3 = edit(u2, {
      kind: 'replaceText',
      text: typed(u2, 'C = (1, 3)', 'C = (7, 3)'),
      typing: 'continue',
    });
    expect(s3.history.past).toHaveLength(1);
    expect(s3.history.future).toEqual([]);
    expect(edit(s3, { kind: 'undo' }).doc).toBe(s0.doc);
  });

  it("'start' always records a new entry; a plain replaceText (the command bar) too", () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const s2 = edit(s1, {
      kind: 'replaceText',
      text: typed(s1, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'start',
    });
    const s3 = edit(s2, { kind: 'replaceText', text: typed(s2, 'C = (2, 5)', 'C = (2, 6)') });
    const s4 = edit(s3, {
      kind: 'replaceText',
      text: typed(s3, 'C = (2, 6)', 'C = (2, 7)'),
      typing: 'continue',
    });
    expect(s4.history.past.map((e) => e.before)).toEqual([s0.doc, s1.doc, s2.doc, s3.doc]);
  });

  it("a 'start' that changes nothing still ends the previous session", () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const same = edit(s1, { kind: 'replaceText', text: print(s1.doc), typing: 'start' });
    expect(same.doc).toBe(s1.doc);
    const s2 = edit(same, {
      kind: 'replaceText',
      text: typed(same, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s2.history.past.map((e) => e.before)).toEqual([s0.doc, s1.doc]);
  });

  it('a text with errors or one that changes nothing keeps the session open', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const bad = applyEdit(
      s1,
      { kind: 'replaceText', text: `${print(s1.doc)}M = midpoint(A, Q)\n`, typing: 'continue' },
      env,
    );
    expect(bad.ok).toBe(false);
    expect(bad.state).toBe(s1);
    const same = edit(s1, { kind: 'replaceText', text: print(s1.doc), typing: 'continue' });
    expect(same.doc).toBe(s1.doc);
    const s2 = edit(same, {
      kind: 'replaceText',
      text: typed(same, 'C = (2, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s2.history.past).toHaveLength(1);
    expect(edit(s2, { kind: 'undo' }).doc).toBe(s0.doc);
  });

  it('typing back to the document before the session leaves no entry (no undo that changes nothing)', () => {
    const s0 = editorOf(START);
    const s1 = edit(s0, {
      kind: 'replaceText',
      text: typed(s0, 'C = (1, 3)', 'C = (2, 3)'),
      typing: 'start',
    });
    const back = edit(s1, { kind: 'replaceText', text: print(s0.doc), typing: 'continue' });
    expect(back.doc).toBe(s0.doc);
    expect(back.history.past).toEqual([]);
    expect(applyEdit(back, { kind: 'undo' }, env).ok).toBe(false);
    // The session ended with its entry: the next apply is an entry of its own.
    const s2 = edit(back, {
      kind: 'replaceText',
      text: typed(back, 'C = (1, 3)', 'C = (2, 5)'),
      typing: 'continue',
    });
    expect(s2.history.past.map((e) => e.before)).toEqual([s0.doc]);
  });

  it('typing during a drag is refused like any text', () => {
    const s0 = editorOf(START);
    const d = edit(s0, { kind: 'dragStart', id: idOf(s0, 'A') });
    const r = applyEdit(
      d,
      { kind: 'replaceText', text: typed(d, 'C = (1, 3)', 'C = (2, 3)'), typing: 'start' },
      env,
    );
    expect(r.ok).toBe(false);
    expect(r.state).toBe(d);
  });
});

describe("the text panel's parse is reused for its own text only (ADR-0047)", () => {
  it('with the parse of the same text: the very document parseInto gives', () => {
    const s0 = editorOf(START);
    const text = `${typed(s0, 'C = (1, 3)', 'C = (2, 3)')}l = line(A, B)\nm = line(B, A)\n`;
    const plain = edit(s0, { kind: 'replaceText', text });
    const reused = edit(s0, { kind: 'replaceText', text, parsed: parseText(text, registry) });
    expect(reused.doc).toEqual(plain.doc);
  });

  it('a parse of another text, or with another registry, is not used', () => {
    const s0 = editorOf(START);
    const text = typed(s0, 'C = (1, 3)', 'C = (2, 3)');
    const stale = parseText(typed(s0, 'C = (1, 3)', 'C = (9, 9)'), registry);
    expect(xyOf(edit(s0, { kind: 'replaceText', text, parsed: stale }), 'C')).toEqual([2, 3]);
    const foreign = parseText(text.replace('C = (2, 3)', 'C = (8, 8)'), createRegistry());
    const r = edit(s0, { kind: 'replaceText', text, parsed: { ...foreign, text } });
    expect(xyOf(r, 'C')).toEqual([2, 3]);
  });

  it('the debug log keeps the text, not the parse', () => {
    const s0 = editorOf(START);
    const text = typed(s0, 'C = (1, 3)', 'C = (2, 3)');
    const s1 = edit(s0, {
      kind: 'replaceText',
      text,
      parsed: parseText(text, registry),
      typing: 'start',
    });
    expect(s1.log).toEqual([{ kind: 'replaceText', text, typing: 'start' }]);
    expect(debugReport(s1, { appVersion: 'v', userAgent: 'ua' })).not.toContain('"parsed"');
  });
});
