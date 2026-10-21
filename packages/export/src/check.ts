/**
 * The Asymptote coordinate check (SPEC §14, note C of Run 9a): the numbers Asymptote
 * computes for every variable of an export (`toAsymptoteCheck`'s write lines) are compared
 * with the kernel's float values. Errors are relative: positions and lengths divided by the
 * figure scale, numbers by max(1, |x|); a variable passes within EXPORT_TOL. A line passes
 * when two of its points (p and p + scale·d̂) lie on the kernel's carrier, its direction
 * has the kernel's sense, its range flags agree and its range ends coincide; a circle by
 * centre and radius; a transform by the images of three points; a path by its vertices.
 * Every variable must be written exactly once.
 */
import { EXPORT_TOL } from '@geomira/num/tolerance';
import type { Value } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import type { AsyPlan } from './asy-plan';

export interface CoordProblem {
  readonly id: number;
  readonly name: string;
  readonly reason: string;
}

export interface CoordCheck {
  /** Variables compared. */
  readonly checked: number;
  /** Constructive variables among them. */
  readonly constructive: number;
  /** The largest relative error. */
  readonly worst: number;
  readonly problems: readonly CoordProblem[];
}

interface V2 {
  readonly x: number;
  readonly y: number;
}

const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: V2, b: V2) => a.x * b.y - a.y * b.x;
const gap = (a: V2, b: V2) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Distance from q to the line through p with direction d. */
function toCarrier(q: V2, p: V2, d: V2): number {
  return Math.abs(cross(sub(q, p), d)) / Math.hypot(d.x, d.y);
}

/** The numbers of each `write` line: `<id> x₁ x₂ …`. */
export function parseWrites(stdout: string): Map<number, number[][]> {
  const out = new Map<number, number[][]>();
  for (const line of stdout.split('\n')) {
    const parts = line.trim().split(/\s+/u);
    const [head, ...rest] = parts;
    if (head === undefined || !/^\d+$/u.test(head)) continue;
    const xs = rest.map(Number);
    if (xs.some((x) => !Number.isFinite(x))) continue;
    const id = Number(head);
    out.set(id, [...(out.get(id) ?? []), xs]);
  }
  return out;
}

type Num = readonly number[];

function linePoint(xs: Num, t: number): V2 {
  return { x: (xs[0] ?? 0) + t * (xs[2] ?? 0), y: (xs[1] ?? 0) + t * (xs[3] ?? 0) };
}

/** A line: two of its points on the kernel's carrier, the same sense, range and ends. */
function lineError(
  xs: Num,
  v: Extract<Value<number>, { kind: 'line' }>,
  scale: number,
): number | string {
  if (xs.length !== 8) return 'not a line';
  const p = { x: xs[0] ?? Number.NaN, y: xs[1] ?? Number.NaN };
  const d = { x: xs[2] ?? Number.NaN, y: xs[3] ?? Number.NaN };
  const n = Math.hypot(d.x, d.y);
  if (!(n > 0)) return 'a line without direction';
  const q = { x: p.x + (scale * d.x) / n, y: p.y + (scale * d.y) / n };
  if (d.x * v.d.x + d.y * v.d.y <= 0) return 'the direction has the other sense';
  if ((xs[4] === 1) !== (v.lo !== null) || (xs[6] === 1) !== (v.hi !== null))
    return 'the range differs';
  const kernel = [v.p.x, v.p.y, v.d.x, v.d.y];
  const ends = [
    v.lo === null ? 0 : gap(linePoint(xs, xs[5] ?? 0), linePoint(kernel, v.lo)),
    v.hi === null ? 0 : gap(linePoint(xs, xs[7] ?? 0), linePoint(kernel, v.hi)),
  ];
  return Math.max(toCarrier(p, v.p, v.d), toCarrier(q, v.p, v.d), ...ends) / scale;
}

/** A transform: the images of three points of the figure's size. */
function transformError(
  xs: Num,
  v: Extract<Value<number>, { kind: 'transform' }>,
  scale: number,
): number | string {
  if (xs.length !== 6) return 'not a transform';
  const [bx = 0, by = 0, xx = 0, xy = 0, yx = 0, yy = 0] = xs;
  const { a, b, anti } = v.t;
  const asy = (z: V2): V2 => ({ x: bx + xx * z.x + xy * z.y, y: by + yx * z.x + yy * z.y });
  const kernel = (z: V2): V2 => {
    const w = anti ? { x: z.x, y: -z.y } : z;
    return { x: a.re * w.x - a.im * w.y + b.re, y: a.im * w.x + a.re * w.y + b.im };
  };
  const probes = [
    { x: 0, y: 0 },
    { x: scale, y: 0 },
    { x: 0, y: scale },
  ];
  return Math.max(...probes.map((z) => gap(asy(z), kernel(z)))) / scale;
}

/** The relative error of a variable against its kernel value, or the reason it cannot match. */
function errorOf(xs: Num, v: Value<number>, scale: number): number | string {
  const at = (i: number): V2 => ({ x: xs[i] ?? Number.NaN, y: xs[i + 1] ?? Number.NaN });
  switch (v.kind) {
    case 'point':
      return xs.length === 2 ? gap(at(0), v) / scale : 'not a point';
    case 'line':
      return lineError(xs, v, scale);
    case 'circle':
      return xs.length === 3
        ? Math.max(gap(at(0), v.c), Math.abs((xs[2] ?? 0) - Math.sqrt(v.r2))) / scale
        : 'not a circle';
    case 'number':
      return xs.length === 1
        ? Math.abs((xs[0] ?? 0) - v.v) / Math.max(1, Math.abs(v.v))
        : 'not a number';
    case 'transform':
      return transformError(xs, v, scale);
    case 'polygon':
      if (xs.length !== 2 * v.pts.length) return 'a different number of vertices';
      return Math.max(...v.pts.map((p, i) => gap(at(2 * i), p))) / scale;
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
    case 'string':
    case 'undefined':
    case 'inexact':
      return `a ${v.kind} has no variable`;
    default:
      return assertNever(v, 'value');
  }
}

/** Compares Asymptote's output with the kernel (module comment). */
export function checkCoordinates(
  plan: AsyPlan,
  values: ReadonlyMap<number, Value<number>>,
  scale: number,
  stdout: string,
): CoordCheck {
  const writes = parseWrites(stdout);
  const problems: CoordProblem[] = [];
  let worst = 0;
  for (const d of plan.decls) {
    const lines = writes.get(d.id) ?? [];
    const v = values.get(d.id);
    const problem = (reason: string) => problems.push({ id: d.id, name: d.name, reason });
    if (lines.length !== 1 || v === undefined) {
      problem(`written ${String(lines.length)} times`);
      continue;
    }
    const e = errorOf(lines[0] ?? [], v, scale);
    if (typeof e === 'string') problem(e);
    else if (!(e <= EXPORT_TOL)) problem(`off by ${e.toExponential(2)} of the scale`);
    else worst = Math.max(worst, e);
  }
  for (const id of writes.keys())
    if (!plan.byId.has(id)) problems.push({ id, name: '?', reason: 'written but not declared' });
  return {
    checked: plan.decls.length,
    constructive: plan.decls.filter((d) => d.constructive).length,
    worst,
    problems,
  };
}
