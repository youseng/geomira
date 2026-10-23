/**
 * The command bar offers `@viewport` and `@title` as completions; typed when the document has
 * one already, the new directive REPLACES it (in its place: one replaceText edit, one
 * history entry) instead of being refused as a duplicate.
 */
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { runCommand } from '../src/command';
import { editorOf, env } from './helpers/editor';

const FIG = '@title "T"\n@author "me"\n@viewport 0 0 40\nA = (0, 0)\nB = (4, 0)';

function after(fig: string, line: string): string {
  const s = editorOf(fig);
  const r = runCommand(s, line, env);
  if (r.kind !== 'edit') throw new Error(`refused: ${r.reason}`);
  expect(r.result.state.history.past).toHaveLength(1);
  return print(r.result.state.doc);
}

describe('command bar: @viewport, @title and @author replace the existing one', () => {
  it('@viewport', () => {
    const text = after(FIG, '@viewport 1 1 30');
    expect(text).toContain('@viewport 1 1 30');
    expect(text).not.toContain('@viewport 0 0 40');
    expect(text.match(/@viewport/gu)).toHaveLength(1);
  });

  it('@title', () => {
    const text = after(FIG, '@title "U"');
    expect(text).toContain('@title "U"');
    expect(text.match(/@title/gu)).toHaveLength(1);
  });

  it('@author', () => {
    const text = after(FIG, '@author "you"');
    expect(text).toContain('@author "you"');
    expect(text.match(/@author/gu)).toHaveLength(1);
  });

  it('without one, the directive is added', () => {
    const text = after('A = (0, 0)', '@title "New"');
    expect(text).toContain('@title "New"');
  });

  it('a bad replacement is refused with its diagnostic on line 1', () => {
    const r = runCommand(editorOf(FIG), '@viewport 1 1', env);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') for (const d of r.diagnostics) expect(d.line).toBe(1);
  });
});
