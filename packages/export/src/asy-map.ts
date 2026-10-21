/**
 * Constructive Asymptote (SPEC §14 "constructive where mapped", note C of Run 9a): a
 * definition becomes an Asymptote expression when its tool's ToolSpec has a constructive
 * export mapping (ADR-0014) and every argument maps too: references are the objects'
 * variables, exact literals are numbers, nested calls map recursively. The variant of an
 * op follows the overload the registry resolves for the argument types (foot(P, l) or
 * foot(P, A, B), intersect of lines or curves, reflect(l) or reflect(P), the image sugar
 * reflect(X, …) = apply(reflect(…), X)). Anything else is undefined, and the object is
 * written numerically (asy-plan.ts).
 *
 * Branch selection maps when the helper provably picks the kernel's candidate: one selector,
 * other(P) (Vieta / reflection, as the kernel), along(±) and orient(±) (structural labels:
 * the range of a segment only removes candidates, never relabels them), near / far_from /
 * same_side / opposite_side only on unbounded lines (a range could remove the candidate
 * the helper would rank first). Curves without a selector (refused by the language: they can
 * have two candidates) are written numerically.
 */
import { assertNever } from '@geomira/num/assert';
import { formatRational } from '@geomira/num/rational';
import type { Expr, Selector } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import type { ExportOp } from '@geomira/kernel/tool';
import type { ValueKind } from '@geomira/kernel/value';

export type AsyType = 'pair' | 'gmline' | 'gmcircle' | 'real' | 'transform' | 'path';

export type AsyDialect = 'standalone' | 'aops';

export interface AsyExpr {
  readonly code: string;
  readonly type: AsyType;
  /** Whether the code needs parentheses as an operand (`a + b`). */
  readonly compound: boolean;
  /** For lines: a bounded range (segment, ray). */
  readonly bounded: boolean;
  /** Helpers the code calls (asy-helpers.ts ids). */
  readonly helpers: readonly string[];
  /**
   * The constructive variants used, `op(types)` and for intersect the selector
   * (`intersect(gmline,gmcircle) along`): what the coordinate check must cover.
   */
  readonly variants: readonly string[];
}

export interface MapEnv {
  readonly registry: Registry;
  readonly dialect: AsyDialect;
  /** The variable of an object, declaring it first; undefined when it has none. */
  ref(id: number): AsyExpr | undefined;
}

/** The value kind an Asymptote type stands for (to resolve overloads). */
export const KIND_OF: Readonly<Record<AsyType, ValueKind>> = {
  pair: 'point',
  gmline: 'line',
  gmcircle: 'circle',
  real: 'number',
  transform: 'transform',
  path: 'polygon',
};

function ex(
  code: string,
  type: AsyType,
  helpers: readonly string[],
  args: readonly AsyExpr[] = [],
  extra: { compound?: boolean; bounded?: boolean } = {},
): AsyExpr {
  return {
    code,
    type,
    compound: extra.compound ?? false,
    bounded: extra.bounded ?? false,
    helpers: [...helpers, ...args.flatMap((a) => a.helpers)],
    variants: args.flatMap((a) => a.variants),
  };
}

/** An operand: parenthesised when compound. */
function op(a: AsyExpr): string {
  return a.compound ? `(${a.code})` : a.code;
}

function call(name: string, type: AsyType, helpers: readonly string[], args: readonly AsyExpr[]) {
  return ex(`${name}(${args.map((a) => a.code).join(', ')})`, type, helpers, args);
}

const types = (args: readonly AsyExpr[]) => args.map((a) => a.type).join(',');

/** A transform applied to X (apply(T, X) and the image sugar). */
function applied(t: AsyExpr, x: AsyExpr): AsyExpr | undefined {
  if (t.type !== 'transform') return undefined;
  if (x.type === 'pair' || x.type === 'path')
    return ex(`${op(t)} * ${op(x)}`, x.type, [], [t, x], { compound: true });
  if (x.type === 'gmline' || x.type === 'gmcircle')
    return ex(`gm_apply(${t.code}, ${x.code})`, x.type, ['apply'], [t, x], { bounded: x.bounded });
  return undefined;
}

/** The map of a transformation tool from its base arguments (without X). */
function mapOf(o: MapOp, a: readonly AsyExpr[]): AsyExpr | undefined {
  const [p, q, r, s] = a;
  const t = types(a);
  switch (o) {
    case 'reflect':
      if (t === 'gmline' && p !== undefined) return call('gm_reflect', 'transform', ['reflect'], a);
      if (t === 'pair' && p !== undefined) return ex(`rotate(180, ${p.code})`, 'transform', [], a);
      return undefined;
    case 'rotate':
      return t === 'pair,real' && p !== undefined && q !== undefined
        ? ex(`rotate(${q.code}, ${p.code})`, 'transform', [], a)
        : undefined;
    case 'homothety':
      return t === 'pair,real' ? call('gm_homothety', 'transform', ['homothety'], a) : undefined;
    case 'translate':
      return t === 'pair,pair' && p !== undefined && q !== undefined
        ? ex(`shift(${op(q)} - ${op(p)})`, 'transform', [], a)
        : undefined;
    case 'spiral':
      return t === 'pair,pair,pair,pair' && r !== undefined && s !== undefined
        ? call('gm_spiral', 'transform', ['spiral'], a)
        : undefined;
    default:
      return assertNever(o, 'map op');
  }
}

/** One selector of a pair of candidates `cands` (a gm_lc / gm_cc call). */
function selected(
  sel: Selector,
  cands: AsyExpr,
  bounded: boolean,
  arg: (e: Expr) => AsyExpr | undefined,
): AsyExpr | undefined {
  const pickH = ['pick'];
  switch (sel.kind) {
    case 'along':
    case 'orient':
      return ex(`gm_low(${cands.code}, ${sel.sign > 0 ? '+1' : '-1'})`, 'pair', pickH, [cands]);
    case 'near':
    case 'far_from': {
      const p = arg(sel.p);
      if (bounded || p?.type !== 'pair') return undefined;
      const f = sel.kind === 'near' ? 'gm_near' : 'gm_far';
      return ex(`${f}(${cands.code}, ${p.code})`, 'pair', pickH, [cands, p]);
    }
    case 'same_side':
    case 'opposite_side': {
      const [q, m] = [arg(sel.q), arg(sel.l)];
      if (bounded || q?.type !== 'pair' || m?.type !== 'gmline') return undefined;
      const same = sel.kind === 'same_side' ? 'true' : 'false';
      return ex(`gm_side(${cands.code}, ${q.code}, ${m.code}, ${same})`, 'pair', pickH, [
        cands,
        q,
        m,
      ]);
    }
    case 'other':
    case 'on_arc':
    case 'between':
    case 'inside':
    case 'outside':
      return undefined;
    default:
      return assertNever(sel, 'selector');
  }
}

/** intersect(a, b, selectors) (module comment). */
function intersect(
  a: readonly AsyExpr[],
  sels: readonly Selector[],
  arg: (e: Expr) => AsyExpr | undefined,
): AsyExpr | undefined {
  const [x, y] = a;
  if (x === undefined || y === undefined || a.length !== 2 || sels.length > 1) return undefined;
  const sel = sels[0];
  if (x.type === 'gmline' && y.type === 'gmline')
    return sel === undefined ? call('gm_meet', 'pair', ['meet'], a) : undefined;
  const lineFirst = x.type === 'gmline' && y.type === 'gmcircle';
  const circleFirst = x.type === 'gmcircle' && y.type === 'gmline';
  const circles = x.type === 'gmcircle' && y.type === 'gmcircle';
  if (!lineFirst && !circleFirst && !circles) return undefined;
  const pair = circles ? [x, y] : lineFirst ? [x, y] : [y, x];
  const prefix = circles ? 'gm_cc' : 'gm_lc';
  const helper = circles ? 'cc' : 'lc';
  const bounded = pair.some((e) => e.bounded);
  // Without a selector the language refuses a pair of curves (two candidates); a hand-made
  // call is written numerically.
  if (sel === undefined) return undefined;
  if (sel.kind === 'other') {
    const p = arg(sel.p);
    return p?.type === 'pair' ? call(`${prefix}_other`, 'pair', [helper], [...pair, p]) : undefined;
  }
  if ((sel.kind === 'along' && circles) || (sel.kind === 'orient' && !circles)) return undefined;
  return selected(sel, call(prefix, 'pair', [helper], pair), bounded, arg);
}

type PointOp = 'midpoint' | 'foot' | 'circumcenter' | 'incenter' | 'centroid' | 'orthocenter';
type CurveOp = 'line' | 'segment' | 'ray' | 'circle' | 'circumcircle' | 'incircle' | 'polygon';
type MapOp = 'reflect' | 'rotate' | 'homothety' | 'translate' | 'spiral';
type NumberOp = 'add' | 'sub' | 'mul' | 'div' | 'neg';

/** Points: the helpers, or olympiad's foot / circumcenter / incenter in the aops dialect. */
function pointOp(o: PointOp, a: readonly AsyExpr[], aops: boolean): AsyExpr | undefined {
  const t = types(a);
  const P3 = t === 'pair,pair,pair';
  switch (o) {
    case 'midpoint':
      return t === 'pair,pair' ? call('gm_midpoint', 'pair', ['midpoint'], a) : undefined;
    case 'foot':
      if (t === 'pair,gmline') return call('gm_foot', 'pair', ['foot'], a);
      if (!P3) return undefined;
      return aops ? call('foot', 'pair', [], a) : call('gm_foot', 'pair', ['foot_points'], a);
    case 'circumcenter':
    case 'incenter':
      if (!P3) return undefined;
      return aops ? call(o, 'pair', [], a) : call(`gm_${o}`, 'pair', [o], a);
    case 'centroid':
    case 'orthocenter':
      return P3 ? call(`gm_${o}`, 'pair', [o], a) : undefined;
    default:
      return assertNever(o, 'point op');
  }
}

/** Lines, circles and polygons. */
function curveOp(o: CurveOp, a: readonly AsyExpr[]): AsyExpr | undefined {
  const t = types(a);
  const P3 = t === 'pair,pair,pair';
  switch (o) {
    case 'line':
    case 'segment':
    case 'ray':
      return t === 'pair,pair'
        ? { ...call(`gm_${o}`, 'gmline', [o], a), bounded: o !== 'line' }
        : undefined;
    case 'circle':
      if (t === 'pair,pair') return call('gm_circle', 'gmcircle', ['circle_point'], a);
      if (t === 'pair,real') return call('gm_circler', 'gmcircle', ['circle_radius'], a);
      return P3 ? call('gm_circumcircle', 'gmcircle', ['circumcircle'], a) : undefined;
    case 'circumcircle':
    case 'incircle':
      return P3 ? call(`gm_${o}`, 'gmcircle', [o], a) : undefined;
    case 'polygon':
      return a.length >= 3 && a.every((x) => x.type === 'pair')
        ? ex(`${a.map(op).join('--')}--cycle`, 'path', [], a, { compound: true })
        : undefined;
    default:
      return assertNever(o, 'curve op');
  }
}

/** A map from its base arguments, or its image of X (the sugar: X first). */
function mapOrImage(o: MapOp, a: readonly AsyExpr[]): AsyExpr | undefined {
  const direct = mapOf(o, a);
  if (direct !== undefined) return direct;
  const [x, ...rest] = a;
  const m = mapOf(o, rest);
  return x === undefined || m === undefined ? undefined : applied(m, x);
}

function numberOp(o: NumberOp, a: readonly AsyExpr[]): AsyExpr | undefined {
  const [x, y] = a;
  if (o === 'neg')
    return types(a) === 'real' && x !== undefined
      ? ex(`-${op(x)}`, 'real', [], a, { compound: true })
      : undefined;
  const sym = { add: '+', sub: '-', mul: '*', div: '/' }[o];
  return types(a) === 'real,real' && x !== undefined && y !== undefined
    ? ex(`${op(x)} ${sym} ${op(y)}`, 'real', [], a, { compound: true })
    : undefined;
}

/** A constructive op on mapped arguments (module comment), or undefined. */
function construct(
  o: ExportOp,
  a: readonly AsyExpr[],
  sels: readonly Selector[],
  env: MapEnv,
  arg: (e: Expr) => AsyExpr | undefined,
): AsyExpr | undefined {
  if (o === 'intersect') return intersect(a, sels, arg);
  if (sels.length > 0) return undefined;
  const [x, y] = a;
  switch (o) {
    case 'midpoint':
    case 'foot':
    case 'circumcenter':
    case 'incenter':
    case 'centroid':
    case 'orthocenter':
      return pointOp(o, a, env.dialect === 'aops');
    case 'line':
    case 'segment':
    case 'ray':
    case 'circle':
    case 'circumcircle':
    case 'incircle':
    case 'polygon':
      return curveOp(o, a);
    case 'reflect':
    case 'rotate':
    case 'homothety':
    case 'translate':
    case 'spiral':
      return mapOrImage(o, a);
    case 'compose':
      return types(a) === 'transform,transform' && x !== undefined && y !== undefined
        ? ex(`${op(x)} * ${op(y)}`, 'transform', [], a, { compound: true })
        : undefined;
    case 'inverse':
      return types(a) === 'transform' ? call('inverse', 'transform', [], a) : undefined;
    case 'apply':
      return x !== undefined && y !== undefined && a.length === 2 ? applied(x, y) : undefined;
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
    case 'neg':
      return numberOp(o, a);
    default:
      return assertNever(o, 'export op');
  }
}

/** The Asymptote of an expression, or undefined when it does not map (module comment). */
export function mapExpr(e: Expr, env: MapEnv): AsyExpr | undefined {
  switch (e.kind) {
    case 'ref':
      return env.ref(e.id);
    case 'lit': {
      const s = formatRational(e.value);
      return ex(s, 'real', [], [], { compound: s.startsWith('-') || s.includes('/') });
    }
    case 'str':
      return undefined;
    case 'call': {
      const tool = env.registry.get(e.tool);
      if (tool === undefined || tool.export === 'numeric') return undefined;
      const args: AsyExpr[] = [];
      for (const x of e.args) {
        const m = mapExpr(x, env);
        if (m === undefined) return undefined;
        args.push(m);
      }
      const resolved = env.registry.resolve(
        e.tool,
        args.map((a) => ({ kind: KIND_OF[a.type] })),
      );
      if (!resolved.ok) return undefined;
      const o = tool.export.constructive;
      const r = construct(o, args, e.selectors, env, (x) => mapExpr(x, env));
      if (r === undefined) return undefined;
      const shown = o === 'polygon' ? 'pair…' : types(args);
      const sel = o === 'intersect' ? ` ${e.selectors[0]?.kind ?? 'none'}` : '';
      return { ...r, variants: [...r.variants, `${o}(${shown})${sel}`] };
    }
    default:
      return assertNever(e, 'expression');
  }
}
