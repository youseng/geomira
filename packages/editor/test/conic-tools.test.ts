/**
 * The GUI tools on conics (Run 16b, ADR-0042): "Conic (5 points)" (key ;, in the Circles group)
 * builds conic(A, B, C, D, E); the Tangent tool takes a circle or a conic: at a point of the
 * conic the tangent, from an outside point both tangents (each with the GUI selector), from a
 * point inside it a refusal.
 */
import { describe, expect, it } from 'vitest';
import { keyAction } from '../src/keymap';
import { toolInput } from '../src/machine';
import { toolGroup } from '../src/tool-groups';
import type { EditorState } from '../src/state';
import {
  addedNames,
  defText,
  editorOf,
  env,
  idOf,
  input,
  useTool,
  valueOf,
} from './helpers/editor';

const FIG = [
  'A = (2, 0)',
  'B = (0, 1)',
  'C = (-2, 0)',
  'D = (0, -1)',
  'E = (6/5, 4/5)',
  'k = conic(A, B, C, D, E)',
  'P = on(k, 2, 1)',
  'Q = (3, 2)',
  'R = (1/2, 0)',
].join('\n');

function pick(s: EditorState, ...names: string[]): EditorState {
  return names.reduce((t, n) => input(t, { kind: 'object', id: idOf(t, n) }), s);
}

describe('the Conic tool', () => {
  it('builds conic(A, B, C, D, E) from five picked points; key ; in Circles', () => {
    const base = editorOf(FIG.split('\n').slice(0, 5).join('\n'));
    const s = pick(useTool(base, 'conic5'), 'A', 'B', 'C', 'D', 'E');
    const [name] = addedNames(base, s);
    expect(defText(s, name ?? '?')).toBe('conic(A, B, C, D, E)');
    expect(valueOf(s, name ?? '?').kind).toBe('conic');
    expect(keyAction({ key: ';', ctrl: false, shift: false, alt: false })).toEqual({
      kind: 'tool',
      tool: 'conic5',
    });
    expect(toolGroup('conic5')).toBe('circles');
  });
});

describe('the Tangent tool on a conic', () => {
  it('at a point of the conic: tangent(P, k)', () => {
    const base = editorOf(FIG);
    const s = pick(useTool(base, 'tangent'), 'P', 'k');
    const [name] = addedNames(base, s);
    expect(defText(s, name ?? '?')).toBe('tangent(P, k)');
  });

  it('from an outside point: both tangents, each with its selector', () => {
    const base = editorOf(FIG);
    const s = pick(useTool(base, 'tangent'), 'k', 'Q');
    const made = addedNames(base, s);
    expect(made).toHaveLength(2);
    for (const n of made) {
      expect(defText(s, n)).toMatch(/^tangent_from\(Q, k, /u);
      expect(valueOf(s, n).kind).toBe('line');
    }
  });

  it('from a point inside: refused, the conic named', () => {
    const s = pick(useTool(editorOf(FIG), 'tangent'), 'R');
    const r = toolInput(s, { kind: 'object', id: idOf(s, 'k') }, env);
    expect(r.ok ? 'made' : r.reason).toBe(
      'the point is inside the conic: there is no tangent from it',
    );
  });
});
