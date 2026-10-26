/**
 * ADR-0034's GUI tools, as data: Feet inversion (`o`) and √(bc/2) inversion (`,`) build
 * feet_inversion(A, B, C) and sqrt_bc2(A, B, C) alone, named as transformations, in the
 * Transform group right after √(bc) inversion; every key is still bound once.
 */
import { describe, expect, it } from 'vitest';
import { KEYMAP } from '../src/keymap';
import type { ToolInput } from '../src/machine';
import { TOOL_GROUPS } from '../src/tool-groups';
import type { EditorState } from '../src/state';
import { addedNames, defText, editorOf, idOf, input, useTool, valueOf } from './helpers/editor';

const FIG = ['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n');
const pick = (s: EditorState, name: string): ToolInput => ({ kind: 'object', id: idOf(s, name) });

describe('the Feet inversion and √(bc/2) inversion tools', () => {
  it('build feet_inversion(A, B, C) and sqrt_bc2(A, B, C), a transformation', () => {
    for (const [tool, def] of [
      ['feet_inversion', 'feet_inversion(A, B, C)'],
      ['sqrt_bc2', 'sqrt_bc2(A, B, C)'],
    ] as const) {
      let s = useTool(editorOf(FIG), tool);
      const before = s;
      for (const n of ['A', 'B', 'C']) s = input(s, pick(s, n));
      expect(addedNames(before, s), tool).toEqual(['f']);
      expect(defText(s, 'f'), tool).toBe(def);
      expect(valueOf(s, 'f').kind).toBe('transform');
    }
  });

  it('sit right after √(bc) inversion in the Transform group, on o and ",", bound once', () => {
    const group = TOOL_GROUPS.find((g) => g.id === 'transform')?.tools.map((t) => t.id) ?? [];
    const i = group.indexOf('sqrt_bc');
    expect(group.slice(i, i + 3)).toEqual(['sqrt_bc', 'sqrt_bc2', 'feet_inversion']);
    for (const [key, tool] of [
      [',', 'sqrt_bc2'],
      ['o', 'feet_inversion'],
    ] as const) {
      const bound = KEYMAP.filter((k) => k.key === key);
      expect(bound).toHaveLength(1);
      expect(bound[0]?.action).toEqual({ kind: 'tool', tool });
    }
    const keys = KEYMAP.map(
      (k) => `${k.ctrl === true ? 'C-' : ''}${k.shift === true ? 'S-' : ''}${k.key}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
