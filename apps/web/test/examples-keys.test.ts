/**
 * Bug-fix round (ADR-0028): a letter typed while the focus sat on the (invisible) examples
 * list opened another example by type-ahead, replacing the figure. On the closed list the
 * letters and arrows are ignored; Space, Enter and Alt+ArrowDown still open it.
 */
import { describe, expect, it } from 'vitest';
import { ignoredOnExamples } from '../src/Header';

describe('keys on the closed examples list', () => {
  it('letters, digits and arrows are ignored', () => {
    for (const k of ['r', 'M', '3', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown'])
      expect(ignoredOnExamples(k, false)).toBe(true);
  });

  it('Space, Enter, Tab, Escape and modified keys are not', () => {
    for (const k of [' ', 'Enter', 'Tab', 'Escape'])
      expect(ignoredOnExamples(k, false)).toBe(false);
    expect(ignoredOnExamples('ArrowDown', true)).toBe(false);
    expect(ignoredOnExamples('z', true)).toBe(false);
  });
});
