/**
 * ADR-0024 item 5: the typed number of a tool (rotate's angle, homothety's ratio, a radius)
 * "keeps the last number for the next use". A tool switch reset it to the tool's initial
 * text; each tool now gets back the number last typed for it (other tools keep theirs).
 */
import { describe, expect, it } from 'vitest';
import type { EditorState } from '../src/state';
import { click, defText, edit, editorOf, input, useTool } from './helpers/editor';

const FIG = 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)';

function typed(s: EditorState, value: string): EditorState {
  return edit(s, { kind: 'toolValue', value });
}

describe('a typed number survives tool switches', () => {
  it('rotate 90, then the line tool, then rotate again: 90', () => {
    let s = typed(useTool(editorOf(FIG), 'rotate'), '90');
    s = useTool(s, 'line');
    s = useTool(s, 'rotate');
    expect(s.toolState.value).toBe('90');
    s = input(s, click(s, 1, 3));
    s = input(s, click(s, 0, 0));
    expect(defText(s, 'D')).toBe('rotate(C, A, 90)');
  });

  it('each tool keeps its own number; an untyped tool starts at its initial text', () => {
    let s = typed(useTool(editorOf(FIG), 'rotate'), '45');
    s = typed(useTool(s, 'homothety'), '-1/2');
    s = useTool(s, 'circle_radius');
    expect(s.toolState.value).toBe('1');
    expect(useTool(s, 'rotate').toolState.value).toBe('45');
    expect(useTool(s, 'homothety').toolState.value).toBe('-1/2');
  });

  it('the kept number survives an undo that clears the picks', () => {
    let s = typed(useTool(editorOf(FIG), 'rotate'), '30');
    s = useTool(s, 'line');
    s = input(s, click(s, 2, 2));
    s = edit(s, { kind: 'undo' });
    expect(s.toolState.picks).toEqual([]);
    s = useTool(s, 'rotate');
    expect(s.toolState.value).toBe('30');
  });
});
