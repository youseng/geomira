/**
 * The GUI choice for four candidates (conic ∩ conic and conic ∩ circle, ADR-0043 decision 14):
 * tier 1 other(P, Q, R) when points sit at the three other candidates; otherwise one filter or
 * two with points and lines of the construction (never along / orient: conic ∩ conic has none);
 * every choice verified by the kernel; and each written choice keeps its candidate when the
 * figure moves as the LOCAL regime moves it (the candidates tracked along the path, matched
 * step by step; paths where candidates come close are left out, as the 200-copy test does).
 */
import type { Document } from '@geomira/kernel/document';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { chooseSelectors } from '../src/choice';
import { matchAll } from '../src/choice-many';
import type { EditorState } from '../src/state';
import {
  addedNames,
  defText,
  editorOf,
  idOf,
  input,
  registry,
  useTool,
  valueOf,
} from './helpers/editor';
import { candidatesOf, localCopy, valuesOf, withSelector, type V } from './helpers/tracking';

const ELLIPSE = ['A = (2, 0)', 'B = (0, 1)', 'C = (-2, 0)', 'D = (0, -1)', 'E = (6/5, 4/5)'];
const CIRCLE = [
  'F = (3/2, 0)',
  'G = (0, 3/2)',
  'H = (-3/2, 0)',
  'I = (0, -3/2)',
  'J = (9/10, 6/5)',
];
const FIG = [...ELLIPSE, ...CIRCLE, 'k = conic(A, B, C, D, E)', 'm = conic(F, G, H, I, J)'].join(
  '\n',
);
const [SX, SY] = [Math.sqrt(5 / 3), Math.sqrt(7 / 12)];
const TARGETS: readonly V[] = [
  { x: SX, y: SY },
  { x: -SX, y: SY },
  { x: -SX, y: -SY },
  { x: SX, y: -SY },
];

const near = (p: V, q: V) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-9;

/** Follows the candidates from the figure to a local copy in small steps (undefined: too close). */
function follow(
  doc: Document,
  a: number,
  b: number,
  seed: number,
): { at: Document; cands: V[] } | undefined {
  const copy = localCopy(doc, 4, createRng(seed));
  let cur = candidatesOf(doc, a, b);
  if (cur === undefined) return undefined;
  for (let i = 1; i <= 32; i++) {
    const next = candidatesOf(copy.at(i / 32), a, b);
    if (next === undefined || next.length !== cur.length) return undefined;
    const m = matchAll(next, cur);
    if (m === undefined) return undefined;
    // Each moved by less than a third of the closest gap: the matching is not in doubt.
    const prev = cur;
    const gap = Math.min(
      ...prev.flatMap((p, j) => prev.slice(j + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y))),
    );
    if (m.some((p, j) => Math.hypot(p.x - (prev[j]?.x ?? 0), p.y - (prev[j]?.y ?? 0)) > gap / 3))
      return undefined;
    cur = m;
  }
  return { at: copy.at(1), cands: cur };
}

describe('the GUI choice among four candidates', () => {
  it('writes reflection-equivariant selectors that pick each candidate, robust under the local noise', () => {
    const s = editorOf(FIG);
    const [a, b] = [idOf(s, 'k'), idOf(s, 'm')];
    // The copies, each followed once, serve all four candidates.
    const copies = Array.from({ length: 60 }, (_, k) => follow(s.doc, a, b, deriveSeed(1630, k)));
    for (const [i, t] of TARGETS.entries()) {
      const ch = chooseSelectors(s.doc, s.values, registry, 'intersect', [a, b], t);
      expect(ch.ok, `candidate ${String(i)}: ${ch.ok ? '' : ch.reason}`).toBe(true);
      if (!ch.ok) continue;
      expect(ch.selectors.every((x) => x.kind !== 'along' && x.kind !== 'orient')).toBe(true);
      let [checked, wrong] = [0, 0];
      for (const [k, f] of copies.entries()) {
        if (f === undefined) continue;
        const idx = (candidatesOf(s.doc, a, b) ?? []).findIndex((x) => near(x, t));
        const want = f.cands[idx];
        const doc = f.at;
        const v =
          ch.selectors.length === 1
            ? withSelector(doc, a, b, ch.selectors[0] ?? { kind: 'along', sign: 1 })
            : twoSelectors(doc, a, b, ch.selectors);
        const right = v?.kind === 'point' && want !== undefined && near(v, want);
        // A firm choice (≥ ROBUST_SIGMAS) never loses its candidate; one written with a note
        // (fewer deviations) may, in a few copies.
        if (ch.note === undefined) expect(right, `copy ${String(k)}`).toBe(true);
        if (!right) wrong++;
        checked++;
      }
      expect(checked).toBeGreaterThan(30);
      expect(wrong).toBeLessThanOrEqual(checked * 0.15);
    }
  });

  it('with points at three of the four common points, the fourth is other(P, Q, R)', () => {
    const base = editorOf(
      [
        FIG,
        'P = intersect(k, m, near(E))',
        'Q = intersect(k, m, on_arc(B, D, C), on_arc(A, C, B))',
        'R = intersect(k, m, on_arc(B, D, C), on_arc(A, C, D))',
      ].join('\n'),
    );
    for (const [n, t] of [
      ['P', TARGETS[0]],
      ['Q', TARGETS[1]],
      ['R', TARGETS[2]],
    ] as const) {
      const v = valueOf(base, n);
      expect(v.kind === 'point' && t !== undefined && near(v, t), n).toBe(true);
    }
    const ch = chooseSelectors(
      base.doc,
      base.values,
      registry,
      'intersect',
      [idOf(base, 'k'), idOf(base, 'm')],
      TARGETS[3] ?? { x: 0, y: 0 },
    );
    expect(ch.ok && ch.tier).toBe(1);
    // The three points in the candidates' order (by x, then y): R, Q, P.
    const ids = ['R', 'Q', 'P'].map((n) => ({ kind: 'ref', id: idOf(base, n) }));
    expect(ch.ok && ch.selectors).toEqual([{ kind: 'other', p: ids[0], rest: [ids[1], ids[2]] }]);
  });

  it('the intersection tool builds every common point it can single out', () => {
    const base = editorOf(FIG);
    const s = [idOf(base, 'k'), idOf(base, 'm')].reduce(
      (t: EditorState, id) => input(t, { kind: 'object', id }),
      useTool(base, 'intersection'),
    );
    const made = addedNames(base, s);
    expect(made.length).toBeGreaterThan(0);
    for (const n of made) {
      expect(defText(s, n)).toMatch(/^intersect\(k, m, /u);
      const v = valueOf(s, n);
      expect(v.kind === 'point' && TARGETS.some((t) => near(v, t))).toBe(true);
    }
  });
});

/** intersect(a, b, s₁, s₂) in a figure. */
function twoSelectors(
  doc: Document,
  a: number,
  b: number,
  sels: readonly import('@geomira/kernel/expr').Selector[],
) {
  const x = {
    id: doc.nextId,
    name: 'x_probe',
    def: {
      kind: 'call' as const,
      tool: 'intersect',
      args: [
        { kind: 'ref' as const, id: a },
        { kind: 'ref' as const, id: b },
      ],
      selectors: sels,
    },
    style: {},
    layers: ['main'],
  };
  return valuesOf({ ...doc, nextId: doc.nextId + 1, objects: [...doc.objects, x] })?.get(x.id);
}
