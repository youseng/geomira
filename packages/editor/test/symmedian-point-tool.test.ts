/**
 * The maintainer's request after Run 13 (ADR-0033): a Symmedian point GUI tool next to
 * Symmedian (in the Lines group, right after it), on a free Shift letter (⇧D), building
 * K = symmedian_point(A, B, C).
 */
import { describe, expect, it } from 'vitest';
import { KEYMAP } from '../src/keymap';
import type { ToolInput } from '../src/machine';
import { TOOL_GROUPS } from '../src/tool-groups';
import type { EditorState } from '../src/state';
import { defText, editorOf, idOf, input, useTool, valueOf } from './helpers/editor';

const pick = (s: EditorState, name: string): ToolInput => ({ kind: 'object', id: idOf(s, name) });

describe('the Symmedian point tool', () => {
  it('builds symmedian_point(A, B, C), a point', () => {
    let s = useTool(
      editorOf(['A = (0, 0)', 'B = (4, 0)', 'C = (1, 3)'].join('\n')),
      'symmedian_point',
    );
    for (const n of ['A', 'B', 'C']) s = input(s, pick(s, n));
    expect(defText(s, 'D')).toBe('symmedian_point(A, B, C)');
    expect(valueOf(s, 'D').kind).toBe('point');
  });

  it('sits right after Symmedian in the Lines group, on ⇧D, bound once', () => {
    const lines = TOOL_GROUPS.find((g) => g.id === 'lines')?.tools.map((t) => t.id) ?? [];
    expect(lines[lines.indexOf('symmedian') + 1]).toBe('symmedian_point');
    expect(KEYMAP.filter((k) => k.key === 'D')).toHaveLength(1);
    const keys = KEYMAP.map((k) => `${k.ctrl === true ? 'C-' : ''}${k.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
