/**
 * The step-2 selectors of the GUI choice (choice.ts): same_side(Q, l) / opposite_side(Q, l)
 * with a point and a line of the construction, on_arc(B, C, [not] A) with points of the
 * construction on the intersected circle (its arc BC that contains A). Each option comes
 * with its DECIDING DISTANCES as a function of the figure's values (the two candidates' and
 * the witness's signed distances from the deciding line), which robust.ts scores against
 * the local noise. Only options whose signs single out the clicked candidate are listed.
 */
import type { Document } from '@geomira/kernel/document';
import { ref, type Selector } from '@geomira/kernel/expr';
import type { Evaluation } from '@geomira/kernel/evaluate';
import { requireOnCircle } from '@geomira/kernel/incidence';
import type { Registry } from '@geomira/kernel/registry';
import type { EvalContext } from '@geomira/kernel/tool';
import type { Value, Vec } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { matched, type Values } from './robust';

type V = Vec<number>;

/** At most this many points of a circle are tried as on_arc ends and witnesses. */
const MAX_ARC_POINTS = 24;

export interface ChoiceCtx {
  readonly doc: Document;
  readonly values: Evaluation<number>;
  readonly registry: Registry;
  readonly ctx: EvalContext;
  /** The tool that decides a candidate as a point (tangent_from: tangent_point). */
  readonly tool: string;
  readonly argIds: readonly number[];
  readonly args: readonly Value<number>[];
  /** The candidates (positions) and which one was clicked. */
  readonly cands: readonly V[];
  readonly clicked: number;
}

export interface Option {
  readonly s: Selector;
  /** The deciding distances in a figure, or undefined when it has no such configuration. */
  readonly q: (values: Values) => readonly number[] | undefined;
}

const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });

/** Signed distance of q from the line through p with direction d (a length). */
export function side(p: V, d: V, q: V): number {
  return (d.x * (q.y - p.y) - d.y * (q.x - p.x)) / Math.hypot(d.x, d.y);
}

/** The clicked candidate and the other one in a figure (matched to the original ones). */
function candidatesIn(c: ChoiceCtx, values: Values): [V, V | undefined] | undefined {
  const spec = c.registry.get(c.tool);
  const args = c.argIds.map((id) => values.get(id));
  const known = args.filter((a): a is Value<number> => a !== undefined);
  if (spec?.candidates === undefined || known.length !== args.length) return undefined;
  const list = spec
    .candidates(FloatField, known, c.ctx)
    .flatMap((v) => (v.kind === 'point' ? [v] : []));
  const [x1, x2] = [c.cands[c.clicked], c.cands[1 - c.clicked]];
  if (x1 === undefined || list.length !== c.cands.length) return undefined;
  return matched(list, [x1, x2]);
}

function pointIn(values: Values, id: number): V | undefined {
  const v = values.get(id);
  return v?.kind === 'point' ? v : undefined;
}

/** Distances from a line through p with direction d: clicked, other (if any), witness. */
function distances(c: ChoiceCtx, values: Values, p: V, d: V, w: V): number[] | undefined {
  const x = candidatesIn(c, values);
  if (x === undefined || !(Math.hypot(d.x, d.y) > 0)) return undefined;
  const [x1, x2] = x;
  return x2 === undefined
    ? [side(p, d, x1), side(p, d, w)]
    : [side(p, d, x1), side(p, d, x2), side(p, d, w)];
}

/** Whether the base distances single out the clicked candidate, and on which side of W. */
function decision(q: readonly number[] | undefined): 'same' | 'opposite' | undefined {
  if (q === undefined || q.some((x) => !(Math.abs(x) > 0) || !Number.isFinite(x))) return undefined;
  const [s1 = 0, ...rest] = q.map(Math.sign);
  const sw = rest[rest.length - 1] ?? 0;
  if (rest.length === 2 && rest[0] === s1) return undefined;
  return sw === s1 ? 'same' : 'opposite';
}

/** same_side / opposite_side options over the points and lines of the construction. */
export function sideOptions(c: ChoiceCtx, points: readonly number[]): Option[] {
  const out: Option[] = [];
  const base = c.values.values;
  for (const o of c.doc.objects) {
    if (base.get(o.id)?.kind !== 'line') continue;
    for (const w of points) {
      const q = (values: Values) => {
        const [l, wv] = [values.get(o.id), pointIn(values, w)];
        return l?.kind === 'line' && wv !== undefined
          ? distances(c, values, l.p, l.d, wv)
          : undefined;
      };
      const d = decision(q(base));
      if (d === undefined) continue;
      const kind = d === 'same' ? 'same_side' : 'opposite_side';
      out.push({ s: { kind, q: ref(w), l: ref(o.id) }, q });
    }
  }
  return out;
}

/** on_arc options: ends B, C and witness A among the points on a circle argument. */
export function arcOptions(c: ChoiceCtx, points: readonly number[]): Option[] {
  const circle = c.args.find((a) => a.kind === 'circle');
  if (circle?.kind !== 'circle') return [];
  const base = c.values.values;
  // Points ON the circle, decided as the kernel decides incidence (ADR-0004 item 1).
  const on = points
    .filter((id) => {
      const p = pointIn(base, id);
      return (
        p !== undefined && requireOnCircle(FloatField, p, circle, c.ctx, 'on_arc') === undefined
      );
    })
    .slice(0, MAX_ARC_POINTS);
  const out: Option[] = [];
  for (const b of on)
    for (const e of on)
      for (const a of on) {
        if (b >= e || a === b || a === e) continue;
        const q = (values: Values) => {
          const [bv, ev, av] = [pointIn(values, b), pointIn(values, e), pointIn(values, a)];
          return bv === undefined || ev === undefined || av === undefined
            ? undefined
            : distances(c, values, bv, sub(ev, bv), av);
        };
        const d = decision(q(base));
        if (d === undefined) continue;
        out.push({
          s: { kind: 'on_arc', b: ref(b), c: ref(e), a: ref(a), not: d === 'opposite' },
          q,
        });
      }
  return out;
}
