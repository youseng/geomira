/**
 * Review of the new GUI tools before merge (ADR-0024): the spiral similarity about a point
 * (A its own image, picked twice) and the words of a refused pick.
 */
import { describe, expect, it } from 'vitest';
import { toolInput } from '../src/machine';
import { click, defText, editorOf, env, input, useTool, xyOf } from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n');

describe('the new tools, reviewed', () => {
  it('spiral about A taking B to C: A picked twice; the image of C is C²/B, exactly', () => {
    let s = useTool(editorOf(FIG), 'spiral');
    for (const [x, y] of [
      [1, 3],
      [0, 0],
      [4, 0],
      [0, 0],
      [1, 3],
    ] as const)
      s = input(s, click(s, x, y));
    expect(defText(s, 'D')).toBe('spiral(C, A, B, A, C)');
    // z ↦ z·c/b with b = 4, c = 1 + 3i: (1 + 3i)²/4 = (−8 + 6i)/4.
    const [x, y] = xyOf(s, 'D');
    expect(x).toBeCloseTo(-2, 12);
    expect(y).toBeCloseTo(1.5, 12);
  });

  it('a refused pick names what to click, not an internal kind', () => {
    const s = useTool(editorOf(FIG), 'rotate');
    const r = toolInput(s, click(s, 6, 6), env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('object to rotate: click a point, line, circle or polygon');
    const t = useTool(editorOf(`${FIG}\nk = 2`), 'second_intersection');
    const u = toolInput(
      t,
      { kind: 'object', id: t.doc.objects.find((o) => o.name === 'k')?.id ?? -1 },
      env,
    );
    expect(u.ok).toBe(false);
    if (!u.ok) expect(u.reason).toBe('first curve: pick a line or circle');
  });
});
