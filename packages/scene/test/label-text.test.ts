import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseLabel } from '../src/label-text';

const base = (text: string) => ({ text, pos: 'base' });
const sub = (text: string) => ({ text, pos: 'sub' });
const sup = (text: string) => ({ text, pos: 'sup' });

describe('label grammar (SPEC §11.2 names, SPEC §13 labels)', () => {
  it('point names: subscripts, primes, stars', () => {
    expect(parseLabel('A')).toEqual([base('A')]);
    expect(parseLabel('A1')).toEqual([base('A1')]);
    expect(parseLabel('A_1')).toEqual([base('A'), sub('1')]);
    expect(parseLabel('M_a')).toEqual([base('M'), sub('a')]);
    expect(parseLabel('M_{ab}')).toEqual([base('M'), sub('ab')]);
    expect(parseLabel("H'")).toEqual([base('H′')]);
    expect(parseLabel("A_1''")).toEqual([base('A'), sub('1'), base('″')]);
    expect(parseLabel("A'''")).toEqual([base('A‴')]);
    expect(parseLabel("A''''''")).toEqual([base('A′′′′′′')]);
    expect(parseLabel('A*')).toEqual([base('A'), sup('*')]);
    expect(parseLabel('A**')).toEqual([base('A'), sup('**')]);
    expect(parseLabel("M_{ab}'*")).toEqual([base('M'), sub('ab'), base('′'), sup('*')]);
  });

  it('lowercase and Greek names, with stars', () => {
    expect(parseLabel('ω*')).toEqual([base('ω'), sup('*')]);
    expect(parseLabel('circ_1')).toEqual([base('circ'), sub('1')]);
    expect(parseLabel('l*')).toEqual([base('l'), sup('*')]);
  });

  it('label texts: superscripts, Greek escapes, literal escapes', () => {
    expect(parseLabel('x^2')).toEqual([base('x'), sup('2')]);
    expect(parseLabel('\\omega_1')).toEqual([base('ω'), sub('1')]);
    expect(parseLabel('\\Gamma')).toEqual([base('Γ')]);
    expect(parseLabel('\\foo')).toEqual([base('\\foo')]);
    expect(parseLabel('a\\_b\\*')).toEqual([base('a_b*')]);
    expect(parseLabel('T_{\\alpha}')).toEqual([base('T'), sub('α')]);
    expect(parseLabel('P_\\beta')).toEqual([base('P'), sub('β')]);
  });

  it('total: trailing operators are literal, unclosed groups run to the end, empty is empty', () => {
    expect(parseLabel('')).toEqual([]);
    expect(parseLabel('A_')).toEqual([base('A_')]);
    expect(parseLabel('A^')).toEqual([base('A^')]);
    expect(parseLabel('A_{bc')).toEqual([base('A'), sub('bc')]);
    expect(parseLabel('A_{}')).toEqual([base('A')]);
    expect(parseLabel('\\')).toEqual([base('\\')]);
  });

  it('property: never throws; runs are non-empty and alternate in position', () => {
    fc.assert(
      fc.property(
        fc.string({
          unit: fc.constantFrom('A', 'b', '_', '^', "'", '*', '{', '}', '\\', 'ω', ' '),
        }),
        (s) => {
          const runs = parseLabel(s);
          for (const [i, r] of runs.entries()) {
            expect(r.text.length).toBeGreaterThan(0);
            if (i > 0) expect(r.pos).not.toBe(runs[i - 1]?.pos);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });
});
