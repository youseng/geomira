/**
 * Run 16c audit (16b queue, ADR-0044): a refusal names every kind the pick accepts. A curve
 * pick and the glider tool take a conic too (ADR-0042), so their words say "line, circle or
 * conic"; and a conic picked there is taken, not refused.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { addedNames, click, defText, editorOf, env, idOf, useTool } from './helpers/editor';

const FIG = [
  'A = (2, 0)',
  'B = (0, 1)',
  'C = (-2, 0)',
  'D = (0, -1)',
  'E = (6/5, 4/5)',
  'k = conic(A, B, C, D, E)',
  'n = 2',
].join('\n');

describe('the words of a refused curve pick name the conic', () => {
  it('a curve pick refuses a number with "line, circle or conic", and takes the conic', () => {
    const t = useTool(editorOf(FIG), 'second_intersection');
    const u = toolInput(t, { kind: 'object', id: idOf(t, 'n') }, env);
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.reason).toBe('first curve: pick a line, circle or conic');
    expect(toolInput(t, { kind: 'object', id: idOf(t, 'k') }, env).ok).toBe(true);
  });

  it('the glider tool refuses empty space with "line, circle or conic", and glides on the conic', () => {
    const s = useTool(editorOf(FIG), 'glider');
    const r = toolInput(s, click(s, 6, 5), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('click a line, a circle or a conic');
    const on = toolInput(s, click(s, Math.SQRT2, Math.SQRT1_2), env);
    expect(on.ok).toBe(true);
    if (on.ok) {
      const [made] = addedNames(s, on.state);
      expect(made !== undefined && defText(on.state, made)).toMatch(/^on\(k, /u);
    }
  });
});
