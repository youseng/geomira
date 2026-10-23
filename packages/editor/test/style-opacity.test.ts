/** ADR-0029: a style edit carries the object's opacity; the text can hold only [0, 1]. */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { edit, editorOf, env, idOf } from './helpers/editor';

describe('style edits with an opacity (ADR-0029)', () => {
  it('one history entry; the text shows the attribute', () => {
    let s = editorOf('A = (0, 0)\nB = (1, 0)\nl = line(A, B)');
    s = edit(s, { kind: 'style', id: idOf(s, 'l'), style: { color: 'red', opacity: 0.4 } });
    expect(s.history.past.map((h) => h.label)).toEqual(['style l']);
    expect(print(s.doc)).toContain('l = line(A, B) [color=red, opacity=0.4]');
    s = edit(s, { kind: 'style', id: idOf(s, 'l'), style: {} });
    expect(print(s.doc)).toContain('l = line(A, B)\n');
  });

  it('0 and 1 are accepted; NaN, infinities and numbers outside [0, 1] are refused', () => {
    const s = editorOf('A = (0, 0)');
    const id = idOf(s, 'A');
    for (const opacity of [0, 1, 0.5])
      expect(applyEdit(s, { kind: 'style', id, style: { opacity } }, env).ok).toBe(true);
    for (const opacity of [Number.NaN, Number.POSITIVE_INFINITY, -0.25, 1.5]) {
      const r = applyEdit(s, { kind: 'style', id, style: { opacity } }, env);
      expect(r.ok).toBe(false);
      expect(r.state).toBe(s);
      if (!r.ok) expect(r.reason).toBe('an opacity is a number in [0, 1]');
    }
  });
});
