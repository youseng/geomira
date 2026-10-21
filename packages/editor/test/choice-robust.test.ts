/**
 * Note C of Run 8a: on random figures, the selector the GUI writes for a clicked
 * intersection (a) is never a bare index and passes the language's static checks; (b) picks
 * the clicked point in 200 PERTURBED COPIES of the figure in the LOCAL regime of the claims
 * tester (ADR-0008 decision 13: a random similarity z ↦ s·R·(z − c) + c + b, s = 2^u with
 * |u| ≤ 1, and Gaussian noise σ = 0.02·scale on the free points; no mirroring); (c) prefers
 * other / same_side / opposite_side / on_arc whenever one of them decides, checked by brute
 * force over every such selector of the construction (independently of choice.ts), so
 * orientation-dependent selectors appear only when none does.
 *
 * "The clicked point" in a copy is defined by CONTINUITY: the copy is reached by a path
 * (the similarity and the noise scaled from 0 to 1) and both candidates are followed along
 * it, with their velocities, in steps small against the gap between them (bisected as
 * needed; positions are taken back through the similarity, under which the candidates are
 * equivariant, so only the noise moves them). A copy is a CONFIGURATION CHANGE, counted and
 * reported but not judged, when the two candidates MEET on the way (too close to be told
 * apart: a tangency) or when the followed one CROSSES to the other side of the other (its
 * structural label changes: it passed through the other at a tangency, or a curve passed
 * through a degenerate state, see `label`). A fixed structural label
 * (along / orient) is not a valid reference: it jumps at such crossings (the second
 * intersection X of line BE with a circle through B moves through B, while "the point
 * before B along BE" jumps from X to B).
 */
import { describe, expect, it } from 'vitest';
import { evalContextFor } from '@geomira/kernel/context';
import { requireOnCircle } from '@geomira/kernel/incidence';
import type { Document } from '@geomira/kernel/document';
import { ref, type Selector } from '@geomira/kernel/expr';
import { formatExpr, formatSelector, isOrientationDependent } from '@geomira/kernel/selector';
import type { Value } from '@geomira/kernel/value';
import { parse } from '@geomira/lang/parse';
import { FloatField } from '@geomira/num/float-field';
import { createRng } from '@geomira/num/rng';
import { pointsCoincide } from '@geomira/scene/coincide';
import { chooseSelectors, ROBUST_SIGMAS } from '../src/choice';
import { firmness, localResponses } from '../src/robust';
import type { EditorState } from '../src/state';
import { editorOf, idOf, registry } from './helpers/editor';
import {
  ancestors,
  candidatesOf,
  type Copy,
  follow,
  label,
  localCopy,
  type V,
  withSelector,
} from './helpers/tracking';

const FIGURES = process.env.NIGHTLY === '1' ? 100 : 10;
const COPIES = 200;
const PAIRS: [string, string][] = [
  ['l1', 'c1'],
  ['l2', 'c1'],
  ['l3', 'c1'],
  ['l1', 'c2'],
  ['l2', 'c2'],
  ['c1', 'c2'],
];

function figureText(seed: number): string {
  const rng = createRng(seed);
  const c = () => (rng.nextInt(101) - 50) / 10;
  const pts = ['A', 'B', 'C', 'D', 'E'].map((n) => `${n} = (${String(c())}, ${String(c())})`);
  const curves = ['c1 = circle(A, B, C)', 'c2 = circle(D, E)', 'l1 = line(A, D)'];
  return [...pts, ...curves, 'l2 = line(B, E)', 'l3 = line(C, D)'].join('\n');
}

function show(s: EditorState, sel: Selector): string {
  const name = (id: number) => s.doc.objects.find((o) => o.id === id)?.name;
  return formatSelector(sel, (e) => formatExpr(e, name));
}

type Q = (values: ReadonlyMap<number, Value<number>>) => readonly number[] | undefined;

/**
 * Every reflection-equivariant selector of tiers 1–2 over the construction (brute force),
 * those of tier 2 with their deciding distances as a function of a figure's values (the two
 * candidates', matched to the original ones, and the witness's distances from the deciding
 * line), written here independently of options.ts.
 */
function semanticOptions(
  s: EditorState,
  a: number,
  b: number,
  cands: readonly V[],
): { sel: Selector; q?: Q }[] {
  const base = s.values.values;
  const at = (vals: ReadonlyMap<number, Value<number>>, id: number): V | undefined => {
    const v = vals.get(id);
    return v?.kind === 'point' ? v : undefined;
  };
  const dist = (p: V, d: V, w: V) => (d.x * (w.y - p.y) - d.y * (w.x - p.x)) / Math.hypot(d.x, d.y);
  const ctx = evalContextFor(s.doc);
  const candsIn = (vals: ReadonlyMap<number, Value<number>>): V[] | undefined => {
    const args = [vals.get(a), vals.get(b)].filter((v): v is Value<number> => v !== undefined);
    if (!ctx.ok || args.length !== 2) return undefined;
    const list = (registry.get('intersect')?.candidates?.(FloatField, args, ctx.ctx) ?? []).flatMap(
      (v) => (v.kind === 'point' ? [v] : []),
    );
    const [p, q] = list;
    const [x1, x2] = cands;
    if (p === undefined || q === undefined || x1 === undefined || x2 === undefined)
      return undefined;
    const d = (u: V, w: V) => Math.hypot(u.x - w.x, u.y - w.y);
    return d(p, x1) + d(q, x2) <= d(q, x1) + d(p, x2) ? [p, q] : [q, p];
  };
  const qOf =
    (line: (v: ReadonlyMap<number, Value<number>>) => [V, V] | undefined, w: number): Q =>
    (vals) => {
      const [l, wv, xs] = [line(vals), at(vals, w), candsIn(vals)];
      return l === undefined || wv === undefined || xs === undefined
        ? undefined
        : [...xs.map((x) => dist(l[0], l[1], x)), dist(l[0], l[1], wv)];
    };
  const pts = s.doc.objects.filter((o) => at(base, o.id) !== undefined).map((o) => o.id);
  const lines = s.doc.objects.filter((o) => base.get(o.id)?.kind === 'line').map((o) => o.id);
  const out: { sel: Selector; q?: Q }[] = pts.map((p) => ({ sel: { kind: 'other', p: ref(p) } }));
  for (const w of pts)
    for (const l of lines) {
      const line = (vals: ReadonlyMap<number, Value<number>>): [V, V] | undefined => {
        const v = vals.get(l);
        return v?.kind === 'line' ? [v.p, v.d] : undefined;
      };
      for (const kind of ['same_side', 'opposite_side'] as const)
        out.push({ sel: { kind, q: ref(w), l: ref(l) }, q: qOf(line, w) });
    }
  // on_arc means "on the arc BC of the circle that contains A": ends and witness on a circle
  // argument (incidence as the kernel decides it), as the GUI writes it.
  const circle = [base.get(a), base.get(b)].find((v) => v?.kind === 'circle');
  const on = pts.filter((p) => {
    const pv = at(base, p);
    return (
      pv !== undefined &&
      circle?.kind === 'circle' &&
      ctx.ok &&
      requireOnCircle(FloatField, pv, circle, ctx.ctx, 'x') === undefined
    );
  });
  for (const e1 of on)
    for (const e2 of on)
      for (const w of on) {
        if (e1 >= e2 || w === e1 || w === e2) continue;
        const line = (vals: ReadonlyMap<number, Value<number>>): [V, V] | undefined => {
          const [p, q] = [at(vals, e1), at(vals, e2)];
          return p === undefined || q === undefined
            ? undefined
            : [p, { x: q.x - p.x, y: q.y - p.y }];
        };
        for (const not of [false, true])
          out.push({
            sel: { kind: 'on_arc', b: ref(e1), c: ref(e2), a: ref(w), not },
            q: qOf(line, w),
          });
      }
  return out;
}

function picksIn(doc: Document, a: number, b: number, sel: Selector, x: V): boolean {
  const v = withSelector(doc, a, b, sel);
  const c = evalContextFor(doc);
  return c.ok && v?.kind === 'point' && pointsCoincide(v, x, c.ctx);
}

describe('note C: the GUI selector survives the local regime and prefers semantic selectors', () => {
  it(`${String(FIGURES)} random figures, every intersection of six curve pairs, ${String(COPIES)} copies each`, () => {
    const tiers: Record<string, number> = {};
    const tally = { cases: 0, copies: 0, judged: 0, met: 0, crossed: 0, undefined: 0 };
    for (let f = 0; f < FIGURES; f++) {
      const fig = figureText(9000 + f);
      const s = editorOf(fig);
      const ctx = evalContextFor(s.doc);
      if (!ctx.ok) continue;
      for (const [an, bn] of PAIRS) {
        const [a, b] = [idOf(s, an), idOf(s, bn)];
        const cands = candidatesOf(s.doc, a, b) ?? [];
        if (cands.length !== 2) continue;
        for (const [k, x] of cands.entries()) {
          const where = `${fig}\n${an} ∩ ${bn}, candidate ${String(k)}`;
          const ch = chooseSelectors(s.doc, s.values, registry, 'intersect', [a, b], x);
          expect(ch.ok, where).toBe(true);
          if (!ch.ok) continue;
          tally.cases++;
          tiers[String(ch.tier)] = (tiers[String(ch.tier)] ?? 0) + 1;
          // A semantic selector that decides firmly (other(P) always; a step-2 selector when its
          // deciding distances are at least ROBUST_SIGMAS deviations of the local noise) is
          // preferred to along / orient / near.
          const responses = localResponses(s.doc, s.values.values, registry, ctx.ctx);
          const firm = semanticOptions(s, a, b, cands).filter(
            (o) => o.q === undefined || firmness(s.values.values, responses, o.q) >= ROBUST_SIGMAS,
          );
          if (firm.some((o) => picksIn(s.doc, a, b, o.sel, x)))
            expect(ch.tier, where).toBeLessThanOrEqual(2);
          if (ch.tier <= 2)
            expect(ch.selectors.every((z) => !isOrientationDependent(z, null))).toBe(true);
          const [sel] = ch.selectors;
          if (sel === undefined) continue;
          // (a) the written call parses with no diagnostic (no bare index, a valid selector).
          const text = `@version 1\n${fig}\nX = intersect(${an}, ${bn}, ${show(s, sel)})`;
          expect(parse(text, registry).diagnostics, text).toEqual([]);
          // (b) 200 local copies: the selector picks the followed candidate.
          const rng = createRng(31 * f + k);
          for (let n = 0; n < COPIES; n++) {
            tally.copies++;
            // The noise is drawn for every free point of the figure; the path is followed on
            // the objects the two curves are built from (the others do not move them).
            const copy = localCopy(s.doc, ctx.ctx.scale, rng);
            const small: Copy = { at: (t) => ancestors(copy.at(t), [a, b]), back: copy.back };
            const other = cands[1 - k] ?? x;
            const end = follow(small, a, b, [x, other]);
            if (end === undefined) {
              tally.met++;
              continue;
            }
            const doc = copy.at(1);
            const [want, rest] = end;
            if (label(doc, a, b, want, rest) !== label(s.doc, a, b, x, other)) {
              tally.crossed++;
              continue;
            }
            const v = withSelector(doc, a, b, sel);
            if (v?.kind !== 'point') {
              tally.undefined++;
              continue;
            }
            tally.judged++;
            const c = evalContextFor(doc);
            const got = `${show(s, sel)} (step ${String(ch.tier)}) in copy ${String(n)}`;
            expect(c.ok && pointsCoincide(v, want, c.ctx), `${where}\n${got}`).toBe(true);
          }
        }
      }
    }
    console.warn(`note C: tiers ${JSON.stringify(tiers)}; ${JSON.stringify(tally)}`);
    expect(tally.cases).toBeGreaterThan(FIGURES * 4);
    expect(Object.keys(tiers).length).toBeGreaterThanOrEqual(2);
    // Configuration changes are rare: nearly every copy is judged.
    expect(tally.judged).toBeGreaterThan(tally.copies * 0.9);
  }, 600_000);
});
