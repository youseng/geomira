import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Document } from '@geomira/kernel/document';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import { emptyDocument } from '@geomira/kernel/document';
import { rational } from '@geomira/num/rational';
import { sameUpToIds } from '../../src/canonical';
import { parse } from '../../src/parse';
import { print } from '../../src/print';
import { LAW_TIMEOUT, registry, runs } from '../helpers/lang';

/**
 * Note A's property: printing any document and re-parsing it never confuses a product
 * with a managed name. Documents mix lowercase numbers (a, w, k), lowercase curves whose
 * images are lowercase managed names (l*, w*), and products and quotients in every
 * position next to them.
 */
function base(): { doc: Document; nums: number[]; lines: number[]; circles: number[] } {
  let doc = emptyDocument();
  const add = (name: string, def: Expr): number => {
    const r = applyDocEdit(doc, registry, { kind: 'add', object: { name, def } });
    if (!r.ok || r.id === undefined) throw new Error(r.ok ? 'no id' : r.error);
    doc = r.doc;
    return r.id;
  };
  const n = (x: bigint): Expr => lit(rational(x));
  const A = add('A', call('point', [n(0n), n(0n)]));
  const B = add('B', call('point', [n(4n), n(1n)]));
  const l = add('l', call('line', [ref(A), ref(B)]));
  const w = add('w', call('circle', [ref(A), ref(B)]));
  const t = add('t', call('reflect', [ref(l)]));
  const r = applyDocEdit(doc, registry, {
    kind: 'addDerivedLayer',
    spec: { name: 'im', transform: t, source: 'main' },
  });
  if (!r.ok) throw new Error(r.error);
  doc = r.doc;
  const ids = (name: string): number => doc.objects.find((o) => o.name === name)?.id ?? -1;
  const a = add('a', n(2n));
  const k = add('k', n(3n));
  return { doc, nums: [a, k], lines: [l, ids('l*')], circles: [w, ids('w*')] };
}

const OPS = ['mul', 'div', 'add', 'sub'] as const;

describe('note A: products and managed names never get confused by print → parse', () => {
  it(
    'random arithmetic over lowercase names next to lowercase images',
    () => {
      const b = base();
      const leaf = fc.oneof(
        fc.constantFrom(...b.nums).map((id): Expr => ref(id)),
        fc.integer({ min: -5, max: 5 }).map((x): Expr => lit(rational(BigInt(x)))),
        fc.constantFrom(...b.circles).map((id): Expr => call('radius', [ref(id)])),
        fc
          .constantFrom(...b.circles)
          .map((id): Expr => call('power', [ref(b.doc.objects[0]?.id ?? 1), ref(id)])),
        fc
          .constantFrom(...b.lines)
          .map((id): Expr => call('dist', [ref(b.doc.objects[0]?.id ?? 1), ref(id)])),
      );
      const expr: fc.Arbitrary<Expr> = fc.letrec<{ e: Expr }>((tie) => ({
        e: fc.oneof(
          { weight: 3, arbitrary: leaf },
          {
            weight: 2,
            arbitrary: fc
              .tuple(fc.constantFrom(...OPS), tie('e'), tie('e'))
              .map(([op, x, y]) => call(op, [x, y])),
          },
          { weight: 1, arbitrary: tie('e').map((x) => call('neg', [x])) },
        ),
      })).e;
      fc.assert(
        fc.property(fc.array(expr, { minLength: 1, maxLength: 5 }), (es) => {
          let doc = b.doc;
          es.forEach((def, i) => {
            const r = applyDocEdit(doc, registry, {
              kind: 'add',
              object: { name: `m${String(i)}`, def },
            });
            if (r.ok) doc = r.doc;
          });
          const p = parse(print(doc), registry);
          expect(p.diagnostics).toEqual([]);
          expect(sameUpToIds(p.doc, doc)).toBe(true);
        }),
        { numRuns: runs(400), seed: 41 },
      );
    },
    LAW_TIMEOUT,
  );

  it('worked examples', () => {
    const t = [
      '@version 1',
      '@layer im = image(t, main)',
      'A = (0, 0)',
      'B = (4, 1)',
      'l = line(A, B)',
      'w = circle(A, B)',
      't = reflect(l)',
      'a = 2',
      'x = a * radius(w*) * a',
      'y = radius(w*) / a - a',
      'claim parallel(l*, l)',
      '',
    ].join('\n');
    expect(print(parse(t, registry).doc)).toBe(t);
    expect(parse(t, registry).diagnostics).toEqual([]);
  });
});
