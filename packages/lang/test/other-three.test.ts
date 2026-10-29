/**
 * The selector other(P, Q, R) of conic ∩ conic (ADR-0043 decision 12): read first among a
 * branchable call's selectors (where it reads as a call to the other TOOL, whose first argument
 * is a curve, and becomes the selector because its first argument is a point) or after another
 * selector; printed as other(P, Q, R); the parse-level checks of conic ∩ conic.
 */
import { describe, expect, it } from 'vitest';
import { print } from '../src/print';
import { defOf, file, firstError, parseOk } from './helpers/lang';

const BASE = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (0, 3)',
  'D = (3, 5)',
  'k = conic(A, B, C, D, (-1, 2))',
  'm = conic(A, B, C, D, (2, -2))',
];

describe('other(P, Q, R) in the text', () => {
  it('reads first or after a selector, and prints back', () => {
    const doc = parseOk(
      file(
        ...BASE,
        'X = intersect(k, m, other(A, B, C))',
        'Y = intersect(m, k, near(D), other(B, C, A))',
        'Z = intersect(k, m, other(A, B, C), near(D))',
      ),
    );
    const x = defOf(doc, 'X');
    expect(x.kind === 'call' && x.args.length === 2 && x.selectors[0]?.kind).toBe('other');
    expect(
      x.kind === 'call' && x.selectors[0]?.kind === 'other' && x.selectors[0].rest?.length,
    ).toBe(2);
    const text = print(doc);
    expect(text).toContain('X = intersect(k, m, other(A, B, C))');
    expect(text).toContain('Y = intersect(m, k, near(D), other(B, C, A))');
    expect(text).toContain('Z = intersect(k, m, other(A, B, C), near(D))');
    expect(print(parseOk(text))).toBe(text);
  });

  it('nested point expressions are points too', () => {
    const doc = parseOk(file(...BASE, 'X = intersect(k, m, other(midpoint(A, A), B, C))'));
    const x = defOf(doc, 'X');
    expect(x.kind === 'call' && x.selectors[0]?.kind).toBe('other');
  });

  it('the other tool with a curve first stays the tool', () => {
    const doc = parseOk(
      file(...BASE, 'l = line(A, D)', 'c = circle(A, B, C)', 'W = circle(B, C, other(l, c, A))'),
    );
    const w = defOf(doc, 'W');
    expect(w.kind === 'call' && w.args[2]?.kind === 'call' && w.args[2].tool).toBe('other');
  });

  it('conic ∩ conic needs a selector; other(P) does not apply to it; other(P, Q, R) only to it', () => {
    expect(firstError(file(...BASE, 'X = intersect(k, m)')).message).toBe(
      'intersect(k, m): conic ∩ conic can have up to four candidates and the call has no selector',
    );
    expect(firstError(file(...BASE, 'X = intersect(k, m, other(A))')).message).toBe(
      'intersect(k, m, other(A)): other(P) does not apply to conic ∩ conic',
    );
    expect(
      firstError(file(...BASE, 'l = line(A, D)', 'X = intersect(l, k, near(B), other(A, B, C))'))
        .message,
    ).toBe(
      'intersect(l, k, near(B), other(A, B, C)): other(P, Q, R) applies only to conic ∩ conic',
    );
    expect(firstError(file(...BASE, 'X = intersect(k, m, along(+))')).message).toMatch(
      /along\(±\) does not apply to conic ∩ conic/,
    );
  });

  it('foci needs a selector on a conic, none on a circle', () => {
    parseOk(file(...BASE, 'F = foci(k, near(A))', 'c = circle(A, B)', 'G = foci(c)'));
    expect(firstError(file(...BASE, 'F = foci(k)')).message).toBe(
      'foci(k): foci(k) can have two candidates and the call has no selector',
    );
  });
});
