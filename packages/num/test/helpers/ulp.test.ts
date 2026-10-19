import { describe, expect, it } from 'vitest';
import { nextDown, nextUp } from './ulp';

describe('ulp helpers', () => {
  it('step to the adjacent doubles', () => {
    expect(nextUp(1)).toBe(1 + Number.EPSILON);
    expect(nextDown(1)).toBe(1 - Number.EPSILON / 2);
    expect(nextUp(0)).toBe(Number.MIN_VALUE);
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(nextUp(-Number.MIN_VALUE)).toBe(-0);
    expect(nextUp(-1)).toBe(-1 + Number.EPSILON / 2);
    expect(nextDown(-1)).toBe(-1 - Number.EPSILON);
  });
});
