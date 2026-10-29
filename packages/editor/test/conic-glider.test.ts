/**
 * Gliders on a conic in the editor (Run 16b, ADR-0042): the glider tool makes on(k, u, v) where
 * the conic is clicked; a drag moves it along the conic (u : v) through the kernel's nearest
 * point, rounded at the end; Randomize redraws it and the conic stays defined; the point tool
 * snaps to a conic too. A conic without a known point has no glider.
 */
import { describe, expect, it } from 'vitest';
import { coeffsOf, qValue } from '@geomira/kernel/conic';
import { FloatField } from '@geomira/num/float-field';
import { applyEdit } from '../src/edit';
import { toolInput } from '../src/machine';
import { randomizeEdit } from '../src/randomize';
import type { EditorState } from '../src/state';
import {
  addedNames,
  click,
  defText,
  edit,
  editorOf,
  env,
  idOf,
  input,
  ok,
  useTool,
  valueOf,
  xyOf,
} from './helpers/editor';

/** k = the hyperbola xy = 1 through five points. */
const FIG = [
  'A = (1, 1)',
  'B = (2, 1/2)',
  'C = (-1, -1)',
  'D = (4, 1/4)',
  'E = (1/2, 2)',
  'k = conic(A, B, C, D, E)',
].join('\n');

/** |Q(X)| of the named point on the named conic (0 on it, up to rounding). */
function offConic(s: EditorState, x: string, k: string): number {
  const K = valueOf(s, k);
  if (K.kind !== 'conic') throw new Error(K.kind);
  const [px, py] = xyOf(s, x);
  return Math.abs(qValue(FloatField, coeffsOf(K), { x: px, y: py }));
}

describe('gliders on a conic', () => {
  it('the glider tool makes on(k, u, v) on the conic where it is clicked', () => {
    const s0 = useTool(editorOf(FIG), 'glider');
    const s1 = input(s0, click(s0, 0.8, 1.25));
    expect(addedNames(s0, s1)).toEqual(['F']);
    expect(defText(s1, 'F')).toMatch(/^on\(k, \S+, \S+\)$/u);
    expect(offConic(s1, 'F', 'k')).toBeLessThan(1e-9);
    const [x, y] = xyOf(s1, 'F');
    expect(Math.hypot(x - 0.8, y - 1.25)).toBeLessThan(0.05);
  });

  it('the point tool snaps to a conic', () => {
    const s0 = useTool(editorOf(FIG), 'point');
    const s1 = input(s0, click(s0, 3, 1 / 3));
    expect(defText(s1, 'F')).toMatch(/^on\(k, /u);
    expect(offConic(s1, 'F', 'k')).toBeLessThan(1e-9);
  });

  it('a drag moves it along the conic, onto the other branch too', () => {
    let s = editorOf(`${FIG}\nP = on(k, 2, 1)`);
    s = edit(s, { kind: 'dragStart', id: idOf(s, 'P') });
    s = edit(s, { kind: 'dragMove', to: { x: 3, y: 0.4 } });
    s = edit(s, { kind: 'dragEnd' });
    expect(defText(s, 'P')).toMatch(/^on\(k, /u);
    expect(offConic(s, 'P', 'k')).toBeLessThan(1e-9);
    expect(xyOf(s, 'P')[0]).toBeGreaterThan(2);
    let t = edit(s, { kind: 'dragStart', id: idOf(s, 'P') });
    t = edit(t, { kind: 'dragMove', to: { x: -2, y: -0.6 } });
    t = edit(t, { kind: 'dragEnd' });
    expect(xyOf(t, 'P')[0]).toBeLessThan(-1);
    expect(offConic(t, 'P', 'k')).toBeLessThan(1e-9);
  });

  it('Randomize redraws a conic glider; the conic and the glider stay defined', () => {
    const s0 = editorOf(`${FIG}\nP = on(k, 2, 1)`);
    for (const seed of [1, 2, 3]) {
      const r = randomizeEdit(s0, env, 'any', seed);
      if (r.kind !== 'edit') throw new Error(r.reason);
      const s1 = ok(applyEdit(s0, r.edit, env));
      expect(valueOf(s1, 'k').kind).toBe('conic');
      expect(valueOf(s1, 'P').kind).toBe('point');
      expect(offConic(s1, 'P', 'k')).toBeLessThan(1e-6);
    }
  });

  it('a conic without a known point has no glider', () => {
    const text = [
      'O = (0, 0)',
      'w = circle(O, 2)',
      'f = send_to_infinity(line((2, 0), (2, 1)))',
      'k = apply(f, w)',
    ].join('\n');
    const s0 = editorOf(text);
    expect(valueOf(s0, 'k').kind).toBe('conic');
    const K = valueOf(s0, 'k');
    expect(K.kind === 'conic' && K.anchor).toBeUndefined();
    const [x, y] = xyOf(editorOf(`${text}\nX = apply(f, (0, 2))`), 'X');
    const s1 = useTool(s0, 'glider');
    const r = toolInput(s1, click(s1, x, y), env);
    expect(r.ok ? 'made' : r.reason).toBe('the conic has no known point to glide from');
  });
});
