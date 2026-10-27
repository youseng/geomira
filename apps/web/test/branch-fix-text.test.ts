/**
 * ADR-0036 decisions 5 and 7: the texts of a branch fix. What moves names the objects; a fix
 * whose definition would repeat another object says which, and to use that object instead.
 */
import { describe, expect, it } from 'vitest';
import { parse } from '@geomira/lang/parse';
import { movesText, repeatsText } from '../src/panels/BranchFixes';
import { registry } from './helpers';

const DOC = parse(
  '@version 1\nA = (0, 0)\nB = (4, 0)\nX = midpoint(A, B)\nR = midpoint(B, A)\nK = midpoint(X, A)\n',
  registry,
).doc;
const id = (name: string) => DOC.objects.find((o) => o.name === name)?.id ?? -1;

describe('branch-fix texts', () => {
  it('what moves', () => {
    expect(movesText(DOC, { moves: [] })).toBe('nothing moves; only the selectors change');
    expect(movesText(DOC, { moves: [id('X')] })).toBe('X moves');
    expect(movesText(DOC, { moves: [id('X'), id('K')] })).toBe('X and K move');
  });

  it('a repeat names the object and the one to use instead', () => {
    expect(repeatsText(DOC, { repeats: [{ object: id('X'), of: id('R') }] })).toBe(
      'X would be the same construction as R: use R instead of X.',
    );
    expect(repeatsText(DOC, { repeats: [] })).toBe('');
  });
});
