/**
 * The common tangents and the centres of similitude in the text (ADR-0045): tangent(c1, c2, …)
 * and tangent_point(c1, c2, …) are branchable, so a call without a selector is an error with the
 * "add a selector" hint; along(±) and orient(±) apply to two circles, not with a conic; other(P)
 * does not apply; tangent(P, c) takes no selector. Round trips print what they read.
 */
import { evaluate } from '@geomira/kernel/evaluate';
import { evalContextFor } from '@geomira/kernel/context';
import { FloatField } from '@geomira/num/float-field';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { diagnostics, file, firstError, parseOk, registry } from './helpers/lang';

const BASE = ['A = (0, 0)', 'B = (10, 0)', 'c = circle(A, 7)', 'd = circle(B, 1)'];
const CONIC = 'k = conic((1, 2), (3, 1), (5, 2), (3, 3), (2, 2.8))';

describe('common tangents in the text (ADR-0045)', () => {
  it('a call without a selector: the add-a-selector error, with along(±) and orient(±)', () => {
    const e = firstError([...BASE, 't = tangent(c, d)'].join('\n'));
    expect(e.message).toBe(
      'tangent(c, d): tangent(c1, c2) can have up to four candidates and the call has no selector',
    );
    expect(e.hint).toBe('add a selector, e.g. near(P), same_side(Q, l) or along(±) or orient(±)');
    const p = firstError([...BASE, CONIC, 'T = tangent_point(k, d)'].join('\n'));
    expect(p.message).toContain('tangent_point(k1, k2) can have up to four candidates');
    expect(p.hint).toBe('add a selector, e.g. near(P), same_side(Q, l)');
  });

  it('selectors that do not apply, and the tangent at a point with a selector', () => {
    const conic = firstError([...BASE, CONIC, 't = tangent(k, d, orient(+))'].join('\n'));
    expect(conic.message).toContain('orient(±) does not apply to tangent(k1, k2)');
    const other = firstError([...BASE, 't = tangent(c, d, other(A))'].join('\n'));
    expect(other.message).toContain('other(P) does not apply: tangent(c1, c2) takes no other(P)');
    const at = firstError([...BASE, 'P = (7, 0)', 't = tangent(P, c, near(B))'].join('\n'));
    expect(at.message).toContain('this tangent has one result and takes no selectors');
    const index = firstError([...BASE, 't = tangent(c, d, 2)'].join('\n'));
    expect(index.message).toContain('bare index');
  });

  it('reads, evaluates and prints the four tangents and the centres of similitude', () => {
    const text = file(
      ...BASE,
      'e_1 = tangent(c, d, along(-), orient(+))',
      'e_2 = tangent(c, d, along(-), orient(-))',
      'i_1 = tangent(c, d, along(+), near((0, 10)))',
      'T = tangent_point(c, d, near((0, 10)))',
      'E = exsimilicenter(c, d)',
      'I = insimilicenter(c, d)',
    );
    expect(diagnostics(text)).toEqual([]);
    const doc = parseOk(text);
    const again = parse(print(doc), registry);
    expect(again.diagnostics).toEqual([]);
    expect(print(again.doc)).toBe(print(doc));
    const ctx = evalContextFor(doc);
    if (!ctx.ok) throw new Error(ctx.reason);
    const ev = evaluate(doc, registry, FloatField, ctx.ctx);
    const v = (n: string) => ev.values.get(doc.objects.find((o) => o.name === n)?.id ?? -1);
    for (const n of ['e_1', 'e_2', 'i_1']) expect(v(n)?.kind, n).toBe('line');
    expect(v('T')).toMatchObject({ kind: 'point' });
    const E = v('E');
    expect(E?.kind === 'point' && [E.x, E.y + 0]).toEqual([70 / 6, 0]);
  });
});
