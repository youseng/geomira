/**
 * The debug report's "last 50 edits" (SPEC §12) keep the document edits: viewport, hover,
 * selection and tool edits, which come at mouse rate, no longer push them out of the log.
 */
import { describe, expect, it } from 'vitest';
import { debugReport } from '../src/report';
import { LOG_LENGTH, type EditorState } from '../src/state';
import { edit, editorOf, idOf } from './helpers/editor';
import { call, lit } from '@geomira/kernel/expr';
import { fromInteger } from '@geomira/num/rational';

function addPoint(s: EditorState, name: string, x: number): EditorState {
  const def = call('point', [lit(fromInteger(x)), lit(fromInteger(0))]);
  return edit(s, { kind: 'add', object: { name, def, layers: ['main'] } });
}

function uiNoise(s: EditorState, n: number): EditorState {
  let t = s;
  for (let i = 0; i < n; i++) {
    t = edit(t, { kind: 'viewport', viewport: { cx: i / 100, cy: 0, zoom: 50 } });
    t = edit(t, { kind: 'hover', id: i % 2 === 0 ? null : idOf(t, 'A') });
    t = edit(t, { kind: 'select', ids: [idOf(t, 'A')], mode: 'replace' });
    t = edit(t, { kind: 'tool', tool: i % 2 === 0 ? 'point' : 'move' });
  }
  return t;
}

const kinds = (s: EditorState) =>
  s.log.map((e) => (typeof e === 'object' && e !== null && 'kind' in e ? e.kind : '?'));

describe('the debug log keeps document edits', () => {
  it('an add followed by 200 UI edits is still in the log and the report', () => {
    let s = addPoint(editorOf('A = (0, 0)'), 'B', 1);
    s = uiNoise(s, 50);
    expect(s.log).toHaveLength(LOG_LENGTH);
    expect(kinds(s)[0]).toBe('add');
    expect(kinds(s).filter((k) => k === 'add')).toHaveLength(1);
    const report = debugReport(s, { appVersion: 'x', userAgent: 'y' });
    expect(report).toContain('"kind":"add"');
  });

  it('with 60 document edits and UI noise, the log is the last 50 document edits', () => {
    let s = editorOf('A = (0, 0)');
    for (let i = 0; i < 60; i++) {
      s = addPoint(s, `P_${String(i)}`, i + 1);
      s = uiNoise(s, 2);
    }
    expect(s.log).toHaveLength(LOG_LENGTH);
    expect(kinds(s).every((k) => k === 'add')).toBe(true);
    const report = debugReport(s, { appVersion: 'x', userAgent: 'y' });
    expect(report).not.toContain('"name":"P_9"');
    expect(report).toContain('"name":"P_10"');
    expect(report).toContain('"name":"P_59"');
  });

  it('UI edits still fill the slots document edits do not need', () => {
    const s = uiNoise(addPoint(editorOf('A = (0, 0)'), 'B', 1), 1);
    expect(kinds(s)).toEqual(['add', 'viewport', 'hover', 'select', 'tool']);
  });
});
