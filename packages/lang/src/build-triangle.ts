/**
 * `triangle A B C [type]` (SPEC §6.2, ADR-0009 decision 11, ADR-0025 decision 3): new
 * vertices, the polygon and the type's assumptions. Vertices defined on an earlier line are
 * used as they are; the new ones are then drawn so that the triangle with the existing
 * points has the type with a margin (ADR-0028, triangle-fixed.ts). When that is impossible
 * the line is an error and nothing of it is applied.
 */
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { FloatField } from '@geomira/num/float-field';
import type { Condition, ExprNode, Statement } from './ast';
import { define, freePoint } from './build-defs';
import type { State } from './build-state';
import { error, type Span } from './diagnostic';
import { expandTriangle, type P, type TriangleType } from './triangle';
import { placeAround } from './triangle-fixed';

type Tri = Extract<Statement, { kind: 'triangle' }>;

function triangleType(st: State, s: Tri): { type: TriangleType; types: string[] } | undefined {
  let t: TriangleType = { acute: false, scalene: false };
  const types: string[] = [];
  for (const a of s.attrs) {
    const at = /^obtuse_at_(.+)$/u.exec(a.key)?.[1];
    const vertex = at === undefined ? -1 : s.points.findIndex((p) => p.name === at);
    if (a.values !== null || (a.key !== 'acute' && a.key !== 'scalene' && vertex < 0)) {
      st.diags.push(
        error(
          a.span,
          `"${a.key}" is not a triangle type`,
          `types: acute, scalene, obtuse_at_${s.points[0]?.name ?? 'A'}`,
        ),
      );
      return undefined;
    }
    types.push(a.key);
    if (a.key === 'acute') t = { ...t, acute: true };
    else if (a.key === 'scalene') t = { ...t, scalene: true };
    else if (t.obtuse !== undefined && t.obtuse !== vertex) {
      st.diags.push(
        error(a.span, 'a triangle has at most one obtuse angle', 'keep one obtuse_at_…'),
      );
      return undefined;
    } else t = { ...t, obtuse: vertex };
  }
  if (t.acute && t.obtuse !== undefined) {
    st.diags.push(
      error(s.span, 'an acute triangle has no obtuse angle', 'keep acute or obtuse_at_…'),
    );
    return undefined;
  }
  return { type: t, types };
}

/** The id of a vertex defined on an earlier line, or undefined (the vertex is new). */
function existingId(st: State, name: string, line: number): number | undefined {
  return (st.defLines.get(name) ?? line) < line ? st.ids.get(name) : undefined;
}

/**
 * The values of the existing vertices in the figure so far (undefined where a vertex is new),
 * or why one cannot be used: it is undefined here, or not a point.
 */
function existingPoints(
  st: State,
  s: Tri,
  ids: readonly (number | undefined)[],
): (P | undefined)[] | string {
  if (ids.every((id) => id === undefined)) return [undefined, undefined, undefined];
  const ctx = evalContextFor(st.doc);
  if (!ctx.ok) return `the figure cannot be evaluated here (${ctx.reason})`;
  const values = evaluate(st.doc, st.registry, FloatField, ctx.ctx).values;
  const out: (P | undefined)[] = [];
  const news = s.points.filter((_, i) => ids[i] === undefined).map((p) => p.name);
  const forNew = news.length === 0 ? '' : `, so no place can be drawn for ${news.join(' and ')}`;
  for (const [i, id] of ids.entries()) {
    const name = s.points[i]?.name ?? '?';
    const v = id === undefined ? undefined : values.get(id);
    if (id === undefined) out.push(undefined);
    else if (v?.kind === 'point') out.push([v.x, v.y]);
    else if (v === undefined || v.kind === 'undefined' || v.kind === 'inexact')
      return `${name} is undefined here${forNew}`;
    else
      return `${name} is ${/^[aeiou]/u.test(v.kind) ? 'an' : 'a'} ${v.kind.replace(/_/gu, ' ')}, not a point`;
  }
  return out;
}

/** Marks every name of a triangle line as failed (nothing of the line is applied). */
function failAll(st: State, s: Tri, line: number, poly: string): { conditions: Condition[] } {
  for (const p of s.points)
    if (existingId(st, p.name, line) === undefined) st.failed.set(p.name, line);
  st.failed.set(poly, line);
  return { conditions: [] };
}

/** Expands a triangle: its points and polygon now, its conditions returned for later. */
export function triangle(
  st: State,
  s: Tri,
  line: number,
  poly: string,
): { first?: number; conditions: Condition[] } {
  const tt = triangleType(st, s);
  if (tt === undefined) return failAll(st, s, line, poly);
  const ex = expandTriangle(s.points, tt.type, tt.types, s.span);
  const ids = s.points.map((p) => existingId(st, p.name, line));
  const given = existingPoints(st, s, ids);
  const names = s.points.map((p) => p.name);
  const all = ids.every((id) => id === undefined);
  const place =
    typeof given === 'string' || all ? undefined : placeAround(ex.seed, tt.type, names, given);
  const why =
    typeof given === 'string'
      ? `triangle ${names.join('')}: ${given}`
      : place?.ok === false
        ? place.reason
        : undefined;
  if (why !== undefined) {
    st.diags.push(
      error(s.span, why, 'move the existing points, change the type, or construct the triangle'),
    );
    return failAll(st, s, line, poly);
  }
  const made = s.points.map((p, i) => {
    const at = all ? ex.points[i] : place?.ok === true ? place.points[i] : undefined;
    return ids[i] ?? define(st, p, freePoint(p, at ?? ['0', '0']), [], line);
  });
  const refs: ExprNode[] = s.points.map((p) => ({ kind: 'name', name: p.name, span: p.span }));
  const span: Span = s.span;
  define(
    st,
    { name: poly, span },
    { kind: 'call', tool: 'polygon', args: refs, selectors: [], span },
    [],
    line,
  );
  const first = made[0];
  return first === undefined
    ? { conditions: [...ex.conditions] }
    : { first, conditions: [...ex.conditions] };
}
