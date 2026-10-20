/**
 * ToolSpec.candidates (SPEC §6.1, ADR-0006 item 2): the values a branchable call can select,
 * 0–2, in a fixed order (line ∩ circle: along(−), along(+); circle ∩ circle: orient(−),
 * orient(+); tangent choices: orient(+), orient(−)); a double point is one value; none or a
 * degenerate input → []; positions that are not representable → Inexact entries. And
 * consistency with compute: whatever a call selects is one of its candidates.
 */
import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { call, type Expr, type Selector } from '../src/expr';
import type { EvalContext } from '../src/tool';
import type { Value } from '../src/value';
import { Builder, REGISTRY, contextOf, evalDoc, must, pt, valueOf } from './helpers/doc';
import { branchFigure, len, resultPoint, sub, type Kind } from './helpers/branch-figures';
import { plain } from './helpers/degenerate';

/** ToolSpec.candidates of a registry tool, called as a method. */
function listOf<T>(
  tool: string,
  F: Field<T>,
  args: readonly Value<T>[],
  ctx: EvalContext,
): readonly Value<T>[] {
  const spec = must(REGISTRY.get(tool));
  if (spec.candidates === undefined) throw new Error(`${tool} is not branchable`);
  return spec.candidates(F, args, ctx);
}

/** The candidates of tool(args) in a document (arguments evaluated by evaluate). */
function candidatesOf<T>(F: Field<T>, tool: string, args: Expr[]): readonly Value<T>[] {
  const b = new Builder();
  const names = args.map((a, i) => b.add(`k${String(i)}`, a));
  const ev = evalDoc(b.doc, F);
  const values = names.map((_, i) => valueOf(b.doc, ev, `k${String(i)}`));
  return listOf(tool, F, values, contextOf(b.doc));
}

const C5 = call('circle', [pt(0, 0), pt(5, 0)]);
const DIAG = call('line', [pt(-4, -3), pt(4, 3)]);
const ORDERED = [FloatField, RationalField] as Field<unknown>[];

describe('ToolSpec.candidates', () => {
  it('intersect: two candidates in label order, the double point, none, ranges', () => {
    for (const F of ORDERED) {
      const p = (vs: readonly Value<unknown>[]) => vs.map((v) => plain(F, v));
      expect(p(candidatesOf(F, 'intersect', [DIAG, C5]))).toEqual([
        [-4, -3],
        [4, 3],
      ]);
      expect(p(candidatesOf(F, 'intersect', [C5, DIAG]))).toEqual([
        [-4, -3],
        [4, 3],
      ]);
      expect(p(candidatesOf(F, 'intersect', [C5, call('circle', [pt(6, 0), pt(3, 4)])]))).toEqual([
        [3, -4],
        [3, 4],
      ]);
      expect(p(candidatesOf(F, 'intersect', [call('line', [pt(5, -1), pt(5, 1)]), C5]))).toEqual([
        [5, 0],
      ]);
      expect(p(candidatesOf(F, 'intersect', [call('line', [pt(6, -1), pt(6, 1)]), C5]))).toEqual(
        [],
      );
      expect(
        p(candidatesOf(F, 'intersect', [call('segment', [pt(-4, -3), pt(0, 0)]), C5])),
      ).toEqual([[-4, -3]]);
      expect(p(candidatesOf(F, 'intersect', [call('segment', [pt(-1, 0), pt(1, 0)]), C5]))).toEqual(
        [],
      );
      expect(p(candidatesOf(F, 'intersect', [DIAG, call('line', [pt(0, 0), pt(1, 0)])]))).toEqual([
        [0, 0],
      ]);
      expect(p(candidatesOf(F, 'intersect', [DIAG, call('line', [pt(0, 1), pt(4, 4)])]))).toEqual(
        [],
      );
      expect(p(candidatesOf(F, 'intersect', [C5, C5]))).toEqual([]);
    }
    // A candidate within the band of a segment end is not selectable.
    const end = call('segment', [pt(-4, -3), pt(4 + 4e-8, 3 + 3e-8)]);
    expect(candidatesOf(FloatField, 'intersect', [end, C5])).toEqual([]);
  });

  it('tangent_point and tangent_from: orient(+) first; P on c: one; P inside: none', () => {
    for (const F of ORDERED) {
      expect(candidatesOf(F, 'tangent_point', [pt(5, 5), C5]).map((v) => plain(F, v))).toEqual([
        [5, 0],
        [0, 5],
      ]);
      expect(candidatesOf(F, 'tangent_point', [pt(3, 4), C5]).map((v) => plain(F, v))).toEqual([
        [3, 4],
      ]);
      expect(candidatesOf(F, 'tangent_point', [pt(1, 1), C5])).toEqual([]);
      const lines = candidatesOf(F, 'tangent_from', [pt(5, 5), C5]);
      expect(
        lines.map((v) =>
          v.kind === 'line'
            ? [
                plain(F, { kind: 'point', x: v.p.x, y: v.p.y }),
                [F.toNumber(v.d.x) + 0, F.toNumber(v.d.y) + 0],
                v.chiral,
              ]
            : v.kind,
        ),
      ).toEqual([
        [[5, 0], [0, 5], true],
        [[0, 5], [-5, 0], true],
      ]);
    }
  });

  it('not representable → Inexact entries (one per candidate); mod p only exact zeros count one', () => {
    const c2 = call('circle', [pt(0, 0), pt(1, 1)]);
    const xAxis = call('line', [pt(0, 0), pt(1, 0)]);
    expect(candidatesOf(RationalField, 'intersect', [xAxis, c2]).map((v) => v.kind)).toEqual([
      'inexact',
      'inexact',
    ]);
    expect(candidatesOf(ModPField, 'intersect', [DIAG, C5]).map((v) => v.kind)).toEqual([
      'inexact',
      'inexact',
    ]);
    expect(candidatesOf(ModPField, 'intersect', [call('line', [pt(5, -1), pt(5, 1)]), C5])).toEqual(
      [{ kind: 'point', x: 5n, y: 0n }],
    );
    expect(candidatesOf(ModPField, 'tangent_point', [pt(5, 5), C5]).map((v) => v.kind)).toEqual([
      'inexact',
      'inexact',
    ]);
  });

  it('arguments no signature accepts → []', () => {
    for (const tool of ['intersect', 'tangent_point', 'tangent_from']) {
      expect(
        listOf(tool, FloatField, [{ kind: 'point', x: 0, y: 0 }], {
          scale: 1,
        }),
      ).toEqual([]);
    }
  });

  it('whatever a call selects is one of its candidates (random figures, every low-level choice)', () => {
    let compared = 0;
    for (let i = 0; i < 400; i += 1) {
      const rng = createRng(deriveSeed(5150, i));
      const kind: Kind = (['lc', 'cc', 'tp', 'tf'] as const)[i % 4] ?? 'lc';
      const f = branchFigure(rng, kind);
      if (f === undefined) continue;
      const sels: Selector[] =
        kind === 'lc'
          ? [
              { kind: 'along', sign: 1 },
              { kind: 'along', sign: -1 },
            ]
          : [
              { kind: 'orient', sign: 1 },
              { kind: 'orient', sign: -1 },
            ];
      sels.forEach((s, k) => f.b.add(`X_${String(k)}`, call(f.tool, [...f.args], [s])));
      const ctx = contextOf(f.b.doc);
      const ev = evalDoc(f.b.doc, FloatField, ctx);
      const cands = listOf(
        f.tool,
        FloatField,
        f.args.map((a) =>
          a.kind === 'ref' ? must(ev.values.get(a.id)) : { kind: 'undefined', reason: '' },
        ),
        ctx,
      );
      expect(cands).toHaveLength(2);
      const picked = sels.map((_, k) => resultPoint(valueOf(f.b.doc, ev, `X_${String(k)}`)));
      const listed = cands.map(resultPoint);
      for (const [k, p] of picked.entries()) {
        const q =
          listed[
            k === 0
              ? kind === 'lc' || kind === 'cc'
                ? 1
                : 0
              : kind === 'lc' || kind === 'cc'
                ? 0
                : 1
          ];
        expect(
          p !== undefined && q !== undefined && len(sub(p, q)) === 0,
          `${kind} figure ${String(i)}`,
        ).toBe(true);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(700);
  });
});
