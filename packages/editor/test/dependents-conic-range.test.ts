/**
 * Run 16c audit (ADR-0027: the drag-end rounding is not applied when a dependent object moves
 * by more than DEPENDENT_PX on screen): a conic counted as kept whenever it stayed a conic, and
 * a segment or ray whenever its carrier line stayed put, however far its ends moved (a
 * projective image's end near the sent line moves many pixels for a small move of its source).
 * Both now compare what is drawn: the conic's points, the range's ends.
 */
import type { Value } from '@geomira/kernel/value';
import { describe, expect, it } from 'vitest';
import { dependentsKept } from '../src/drag-dependents';

const ZOOM = 50;
const kept = (a: Value<number>, b: Value<number>) =>
  dependentsKept(new Map([[1, a]]), new Map([[1, b]]), ZOOM, new Set());

/** x²/4 + y² = s² (anchor (2s, 0)), in the normal form's proportions (any factor works). */
const ellipse = (s: number): Value<number> => ({
  kind: 'conic',
  a: 1,
  b: 0,
  c: 4,
  d: 0,
  e: 0,
  f: -4 * s * s,
  anchor: { x: 2 * s, y: 0 },
});

const segment = (hi: number): Value<number> => ({
  kind: 'line',
  p: { x: 0, y: 0 },
  d: { x: 1, y: 0 },
  lo: 0,
  hi,
  chiral: false,
});

describe('the drag-end dependents check compares what is drawn', () => {
  it('a conic that grows by 10 px is not kept; one that moves by a hundredth of a pixel is', () => {
    expect(kept(ellipse(1), ellipse(1.1))).toBe(false);
    expect(kept(ellipse(1), ellipse(1 + 1e-4))).toBe(true);
  });

  it('a segment whose end moves by 10 px on the same carrier is not kept', () => {
    expect(kept(segment(1), segment(1.2))).toBe(false);
    expect(kept(segment(1), segment(1 + 1e-4))).toBe(true);
  });
});
