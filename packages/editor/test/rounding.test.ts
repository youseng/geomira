/**
 * Drag-end rounding (SPEC §12): the grid is the finer of 10^(⌊log10 scale⌋ − 4) and the
 * power of ten just below 0.1 px at the current zoom; values are stored as exact decimals;
 * NO ROUNDED POINT MOVES BY MORE THAN 0.1 px ON SCREEN (free points, gliders of every form,
 * images dragged through maps that enlarge or shrink, at random zooms).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { fromNumber, parseRational, type Rational } from '@geomira/num/rational';
import {
  decimalText,
  floorLog10,
  gridExponent,
  parameterStep,
  pow10,
  roundTo,
  ROUNDING_PX,
} from '../src/rounding';
import { positionOf } from '../src/drag';
import type { EditorState } from '../src/state';
import { applyEdit } from '../src/edit';
import { edit, editorOf, env, idOf, valueOf } from './helpers/editor';

const RUNS = process.env.NIGHTLY === '1' ? 2000 : 200;

function q(text: string): Rational {
  const r = parseRational(text);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

describe('the grid', () => {
  it('is the finer of the scale grid and the power of ten just below 0.1 px', () => {
    expect(gridExponent(1, 50)).toBe(-4); // scale: 10^-4; pixels: 0.1/50 = 0.002 → 10^-3
    expect(gridExponent(1000, 1)).toBe(-1); // scale: 10^-1; pixels: 0.1 → 10^-1
    expect(gridExponent(1, 1e6)).toBe(-7); // pixels: 1e-7
    expect(gridExponent(5000, 0.001)).toBe(-1); // pixels: 100 → 10^2; scale: 10^-1
    expect(gridExponent(9.999, 50)).toBe(-4);
    expect(gridExponent(10, 50)).toBe(-3);
  });

  it('floorLog10 is exact at powers of ten (a float log10 is not)', () => {
    expect(floorLog10(q('1000'))).toBe(3);
    expect(floorLog10(q('999.99999999999999999'))).toBe(2);
    expect(floorLog10(q('1/10'))).toBe(-1);
    expect(floorLog10(q('1/1000000000000000000000000000000'))).toBe(-30);
    expect(floorLog10(fromNumber(0.1))).toBe(-1); // the double 0.1 is just above 1/10
    expect(floorLog10(fromNumber(0.3))).toBe(-1);
    expect(floorLog10(fromNumber(Number.MAX_VALUE))).toBe(308);
  });

  it('roundTo rounds to the nearest multiple (ties away from zero); decimalText prints it', () => {
    expect(roundTo(q('1.25'), -1)).toEqual(q('1.3'));
    expect(roundTo(q('-1.25'), -1)).toEqual(q('-1.3'));
    expect(roundTo(q('1.24999'), -1)).toEqual(q('1.2'));
    expect(roundTo(q('1234'), 2)).toEqual(q('1200'));
    expect(decimalText(q('1.2'), -1)).toBe('1.2');
    expect(decimalText(q('-0.05'), -4)).toBe('-0.05');
    expect(decimalText(q('0'), -3)).toBe('0');
    expect(decimalText(q('1200'), 2)).toBe('1200');
    expect(decimalText(q('-3'), -2)).toBe('-3');
    expect(pow10(-2)).toEqual(q('1/100'));
  });

  it('parameter grids keep a glider within half the grid', () => {
    expect(parameterStep('line', -4, 10)).toBe(-5);
    expect(parameterStep('stereo', -4, 2)).toBe(-5);
    expect(parameterStep('angle', -4, 1)).toBe(-3);
    expect(parameterStep('line', -4, Number.NaN)).toBe(-4);
  });
});

const FIGURE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'l = line(A, B)',
  'P = on(l, 1/3)',
  'c = circle(A, C)',
  'Q = on(c, 2, 1)',
  'k = circle(B, 2)',
  'R = on(k, 90)',
  'H = homothety(A, 3)',
  '@layer big = image(H, main) [exclude=c, k, l]',
  'S = homothety(B, 1/3)',
  '@layer small = image(S, main) [exclude=c, k, l, H] [suffix=**]',
].join('\n');

const DRAGGED = ['A', 'C', 'P', 'Q', 'R', 'C*', 'A**', 'P*', 'Q**'];

function screenMove(a: EditorState, b: EditorState, id: number): number {
  const [p, r] = [positionOf(a.values.values.get(id)), positionOf(b.values.values.get(id))];
  if (p === undefined || r === undefined) return Number.NaN;
  return Math.hypot(p.x - r.x, p.y - r.y) * a.viewport.zoom;
}

describe('no rounded point moves by more than 0.1 px on screen', () => {
  it('free points, gliders (t, (u : v), angle) and images dragged through maps ×3 and ×1/3', () => {
    const base = editorOf(FIGURE);
    let checked = 0;
    let drags = 0;
    let rounded = 0;
    fc.assert(
      fc.property(
        fc.constantFrom(...DRAGGED),
        fc.double({ min: -6, max: 6, noNaN: true }),
        fc.double({ min: -6, max: 6, noNaN: true }),
        fc.double({ min: 0.5, max: 5000, noNaN: true }),
        (name, x, y, zoom) => {
          let s = edit(base, { kind: 'viewport', viewport: { cx: 0, cy: 0, zoom } });
          const id = idOf(s, name);
          s = edit(s, { kind: 'dragStart', id });
          const r = applyEdit(s, { kind: 'dragMove', to: { x, y } }, env);
          // A glider's cursor exactly at its circle's centre has no nearest point.
          if (!r.ok) return;
          const moved = r.state;
          drags++;
          const end = edit(moved, { kind: 'dragEnd' });
          const base2 = end.drag === null ? idOf(end, name.replace(/\*+$/u, '')) : id;
          for (const target of new Set([id, base2])) {
            const d = screenMove(moved, end, target);
            if (Number.isNaN(d)) continue;
            checked++;
            expect(d, `${name}: ${String(target)}`).toBeLessThanOrEqual(ROUNDING_PX);
          }
          // Stored as exact decimals: the rewritten definition prints without fractions.
          const baseName = end.doc.objects.find((o) => o.id === base2)?.name ?? '?';
          const line = print(end.doc)
            .split('\n')
            .find((t) => t.startsWith(`${baseName} = `));
          if (line !== undefined && !line.includes('/')) rounded++;
        },
      ),
      { numRuns: RUNS, seed: 8 },
    );
    expect(checked).toBeGreaterThan(RUNS);
    // The rounding is applied (not skipped) in nearly every drag.
    expect(rounded).toBeGreaterThan(drags * 0.95);
    expect(valueOf(base, 'C*').kind).toBe('point');
  });
});
