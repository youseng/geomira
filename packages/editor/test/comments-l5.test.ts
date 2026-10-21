/**
 * Found in the Run 10 audit (law L5: every editor state is its own text): removing an object
 * that carried a comment left the comment anchored to the removed id. The printer writes it at
 * the end and parsing reads it back as an end comment, so the document did not equal its own
 * text (and re-applying the shown text added a history entry that changed nothing visible);
 * a removed view's comment even came back on a new view of the same name. Comments whose
 * anchor is gone now join the end comment, exactly as the text shows them.
 */
import { describe, expect, it } from 'vitest';
import { sameUpToIds } from '@geomira/lang/canonical';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { applyEdit, type Edit } from '../src/edit';
import type { EditorState } from '../src/state';
import { editorOf, env, idOf, registry } from './helpers/editor';

function ok(s: EditorState, e: Edit): EditorState {
  const r = applyEdit(s, e, env);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

function isItsText(s: EditorState): void {
  const back = parse(print(s.doc), registry);
  expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(sameUpToIds(back.doc, s.doc)).toBe(true);
  // Re-applying the text shown is no change (no history entry).
  const r = applyEdit(s, { kind: 'replaceText', text: print(s.doc) }, env);
  expect(r.ok ? r.state.history.past.length : s.history.past.length).toBe(s.history.past.length);
}

const TEXT = [
  '# head',
  '@layer aux',
  'A = (0, 0)',
  'B = (4, 0)',
  '# the apex',
  'C = (1, 3)  # inline',
  'D = (2, 2)',
  '# about the claim',
  'claim collinear(A, B, D)',
  '# trailing',
].join('\n');

describe('comments whose anchor is removed (L5)', () => {
  it('removing a commented object, then a commented claim: each document is its own text', () => {
    let s = editorOf(TEXT);
    const before = print(s.doc);
    s = ok(s, { kind: 'remove', id: idOf(s, 'C') });
    isItsText(s);
    // C's line is gone and its comments come before the trailing one, as the text shows them.
    expect(print(s.doc)).toContain('# the apex\n# inline\n# trailing\n');
    expect(print(s.doc)).not.toContain('C = (1, 3)');
    expect(before).toContain('# the apex\nC = (1, 3)  # inline\n');
    s = ok(s, { kind: 'removeClaim', id: s.doc.claims[0]?.id ?? -1 });
    isItsText(s);
  });

  it('a removed view’s comment stays at the end; a new view of that name has none', () => {
    let s = editorOf('A = (0, 0)\n@layer aux\n# my view\n@view v [layers=aux]');
    s = ok(s, { kind: 'removeView', name: 'v' });
    isItsText(s);
    s = ok(s, { kind: 'addView', view: { name: 'v', layerVisibility: {} } });
    isItsText(s);
    expect(print(s.doc)).not.toMatch(/# my view\n@view v/u);
  });
});
