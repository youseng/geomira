/**
 * The parse-level checks of SPEC §7 (Run 3b, ADR-0006 item 14): a bare index and a
 * two-candidate call without selectors are errors with a hint, decided statically from the
 * kinds an expression can have; so are selectors on a tool that takes none, along / orient
 * / other where they do not apply, and other twice. Evaluation agrees: every flagged call
 * that reaches evaluate is Undefined with the same meaning.
 */
import { FloatField } from '@geomira/num/float-field';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import {
  bareIndexMessage,
  bareIndexProblem,
  callDiagnostics,
  selectorDiagnostics,
  staticKinds,
} from '../src/selector-check';
import { Builder, REGISTRY, evalDoc, num, pt, valueOf } from './helpers/doc';

const along: Selector = { kind: 'along', sign: 1 };
const orient: Selector = { kind: 'orient', sign: -1 };

/** A document with A, B, C, D, c = circle(A, B), d = circle(C, D), l = line(A, C). */
function base(): Builder {
  const b = new Builder();
  const [A, B, C, D] = [
    b.point('A', 0, 0),
    b.point('B', 5, 0),
    b.point('C', 6, 0),
    b.point('D', 3, 4),
  ];
  b.call('c', 'circle', A, B);
  b.call('d', 'circle', C, D);
  b.call('l', 'line', A, D);
  b.call('m', 'line', B, D);
  b.call('k', 'cline', A, B, C);
  return b;
}

function messages(b: Builder): string[] {
  return selectorDiagnostics(b.doc, REGISTRY).map((d) => d.message);
}

describe('parse-level selector checks (SPEC §7)', () => {
  it('a bare index is an error with a hint, and evaluates to Undefined with the same message', () => {
    const b = base();
    b.add('X', call('intersect', [b.ref('l'), b.ref('c'), num(2)]));
    b.add('T', call('tangent_point', [b.ref('D'), b.ref('d'), num(1)]));
    const diags = selectorDiagnostics(b.doc, REGISTRY);
    expect(diags.map((d) => [d.id, d.message, d.hint])).toEqual([
      [
        b.id('X'),
        'intersect(l, c, 2): bare index: intersect(…, n) does not select a candidate (candidates have no fixed order); use a selector, e.g. other(P), near(P), same_side(Q, l) or along(±)',
        'replace the index by a selector',
      ],
      [
        b.id('T'),
        'tangent_point(D, d, 1): bare index: tangent_point(…, n) does not select a candidate (candidates have no fixed order); use a selector, e.g. other(P), near(P), same_side(Q, l) or orient(±)',
        'replace the index by a selector',
      ],
    ]);
    const ev = evalDoc(b.doc, FloatField);
    expect(valueOf(b.doc, ev, 'X')).toEqual({
      kind: 'undefined',
      reason: bareIndexMessage('intersect', [
        { candidates: 2, low: 'along', other: true, describe: 'line ∩ circle' },
      ]),
    });
    expect(valueOf(b.doc, ev, 'T')).toMatchObject({
      kind: 'undefined',
      reason: expect.stringMatching(/^bare index: tangent_point/) as unknown,
    });
    // Not a bare index: a wrong argument of a tool that is not branchable, or a list that
    // does not resolve without its last number.
    expect(
      bareIndexProblem(call('midpoint', []), [{ kind: 'point' }, { kind: 'number' }], REGISTRY),
    ).toBeUndefined();
    expect(
      bareIndexProblem(call('intersect', []), [{ kind: 'point' }, { kind: 'number' }], REGISTRY),
    ).toBeUndefined();
    expect(
      bareIndexProblem(call('intersect', []), [{ kind: 'line' }, { kind: 'circle' }], REGISTRY),
    ).toBeUndefined();
  });

  it('a two-candidate call without selectors is an error; one candidate is not', () => {
    const b = base();
    b.add('X', call('intersect', [b.ref('l'), b.ref('c')]));
    b.add('Y', call('intersect', [b.ref('c'), b.ref('d')]));
    b.add('Z', call('intersect', [b.ref('l'), b.ref('m')]));
    b.add('W', call('intersect', [b.ref('k'), b.ref('l')]));
    b.add('t', call('tangent_from', [b.ref('C'), b.ref('c')]));
    const diags = selectorDiagnostics(b.doc, REGISTRY);
    expect(diags.map((d) => [d.id, d.message])).toEqual([
      [
        b.id('X'),
        'intersect(l, c): line ∩ circle can have two candidates and the call has no selector',
      ],
      [
        b.id('Y'),
        'intersect(c, d): circle ∩ circle can have two candidates and the call has no selector',
      ],
      [
        b.id('W'),
        'intersect(k, l): line ∩ circle can have two candidates and the call has no selector',
      ],
      [
        b.id('t'),
        'tangent_from(C, c): tangent_from(P, c) can have two candidates and the call has no selector',
      ],
    ]);
    expect(diags.map((d) => d.hint)).toEqual([
      'add a selector, e.g. other(P), near(P), same_side(Q, l) or along(±)',
      'add a selector, e.g. other(P), near(P), same_side(Q, l) or orient(±)',
      'add a selector, e.g. other(P), near(P), same_side(Q, l) or along(±)',
      'add a selector, e.g. other(P), near(P), same_side(Q, l) or orient(±)',
    ]);
    const ev = evalDoc(b.doc, RationalField);
    for (const n of ['X', 'Y', 't']) {
      expect(valueOf(b.doc, ev, n)).toMatchObject({
        kind: 'undefined',
        reason: expect.stringMatching(/^ambiguous: add a selector/) as unknown,
      });
    }
    expect(valueOf(b.doc, ev, 'Z').kind).toBe('point');
  });

  it('selectors on a tool that takes none, and low-level selectors where no overload accepts them', () => {
    const b = base();
    b.add('M', call('midpoint', [b.ref('A'), b.ref('B')], [along]));
    b.add('X', call('intersect', [b.ref('l'), b.ref('c')], [orient]));
    b.add('Y', call('intersect', [b.ref('c'), b.ref('d')], [along]));
    b.add(
      'Z',
      call('intersect', [b.ref('l'), b.ref('m')], [along, { kind: 'other', p: b.ref('A') }]),
    );
    b.add(
      'V',
      call(
        'intersect',
        [b.ref('l'), b.ref('c')],
        [
          { kind: 'other', p: b.ref('A') },
          { kind: 'other', p: b.ref('D') },
        ],
      ),
    );
    // cline may be a circle or a line: both selectors are accepted by some overload.
    b.add('U', call('intersect', [b.ref('k'), b.ref('c')], [orient]));
    b.add('S', call('intersect', [b.ref('k'), b.ref('c')], [along]));
    expect(messages(b)).toEqual([
      'midpoint(A, B, along(+)): midpoint takes no selectors',
      'intersect(l, c, orient(-)): orient(±) does not apply to line ∩ circle',
      'intersect(c, d, along(+)): along(±) does not apply to circle ∩ circle',
      'intersect(l, m, along(+), other(A)): along(±) does not apply to line ∩ line',
      'intersect(l, m, along(+), other(A)): other(P) does not apply: the objects meet only once',
      'intersect(l, c, other(A), other(D)): other(·) appears more than once',
    ]);
    const hints = selectorDiagnostics(b.doc, REGISTRY).map((d) => d.hint);
    expect(hints).toEqual([
      'remove the selectors: only intersect, tangent_point, tangent_from, foci choose among candidates',
      'use along(±) instead',
      'use orient(±) instead',
      'remove along(±)',
      'remove other(P)',
      'keep one other(P)',
    ]);
    const ev = evalDoc(b.doc, FloatField);
    for (const n of ['M', 'X', 'Y', 'Z', 'V'])
      expect(valueOf(b.doc, ev, n).kind, n).toBe('undefined');
  });

  it('nested calls, selector expressions, unknown tools and clean documents', () => {
    const b = base();
    const inner: Expr = call('intersect', [b.ref('l'), b.ref('c')]);
    b.add('M', call('midpoint', [inner, b.ref('A')]));
    b.add('X', call('intersect', [b.ref('m'), b.ref('c')], [{ kind: 'near', p: inner }]));
    b.add('U', call('intersect', [call('no_such_tool', []), b.ref('c')]));
    b.add('N', call('no_such_tool', [b.ref('A')], [along]));
    const diags = selectorDiagnostics(b.doc, REGISTRY);
    expect(diags.map((d) => [d.id, d.message])).toEqual([
      [
        b.id('M'),
        'intersect(l, c): line ∩ circle can have two candidates and the call has no selector',
      ],
      [
        b.id('X'),
        'intersect(l, c): line ∩ circle can have two candidates and the call has no selector',
      ],
    ]);
    expect(selectorDiagnostics(base().doc, REGISTRY)).toEqual([]);
    const kinds = (id: number) => (id === 1 ? (['point'] as const) : undefined);
    expect(staticKinds(num(1), kinds, REGISTRY)).toEqual(['number']);
    expect(staticKinds(call('cline', []), kinds, REGISTRY)).toEqual(['circle', 'line']);
    expect(staticKinds({ kind: 'ref', id: 1 }, kinds, REGISTRY)).toEqual(['point']);
    expect(staticKinds({ kind: 'ref', id: 9 }, kinds, REGISTRY)).toBeUndefined();
    expect(() => staticKinds({ kind: 'bogus' } as never, kinds, REGISTRY)).toThrow(
      /unexpected expression/,
    );
    const show = () => 'e';
    expect(callDiagnostics(call('intersect', [pt(0, 0), pt(1, 1)]), kinds, REGISTRY, show)).toEqual(
      [],
    );
  });
});
