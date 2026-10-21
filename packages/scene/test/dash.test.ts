import { describe, expect, it } from 'vitest';
import { dashPattern } from '../src/style';

describe('dashPattern (shared by the canvas and the exporters)', () => {
  it('solid has no pattern; dashes and dots grow with the width', () => {
    expect(dashPattern('solid', 1.5)).toEqual([]);
    expect(dashPattern('dashed', 1.5)).toEqual([9, 7]);
    expect(dashPattern('dotted', 1.5)).toEqual([1.5, 5]);
    expect(dashPattern('dotted', 0.5)).toEqual([1, 3]);
  });
});
