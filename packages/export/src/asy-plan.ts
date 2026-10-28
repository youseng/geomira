/**
 * The named objects of an Asymptote export ("named pairs", SPEC §14): every drawn point,
 * line, circle and polygon has a variable, and so has every object a constructive
 * definition refers to (hidden helpers included; they are declared, not drawn). A variable
 * is CONSTRUCTIVE when its definition maps (asy-map.ts) to an expression of the type of its
 * value; otherwise NUMERIC: the float value's coordinates, written exactly (shortest
 * round-trip decimals). Declarations follow the construction order, so every reference
 * precedes its use (invariant I2).
 */
import { assertNever } from '@geomira/num/assert';
import { refsOf } from '@geomira/kernel/expr';
import type { Registry } from '@geomira/kernel/registry';
import { isKnownKind, type Value } from '@geomira/kernel/value';
import type { ExportFrame } from './frame';
import { mapExpr, type AsyDialect, type AsyExpr, type AsyType } from './asy-map';
import { AsyNames } from './asy-names';

export interface AsyDecl {
  readonly id: number;
  readonly name: string;
  readonly ident: string;
  readonly type: AsyType;
  /** The right-hand side. */
  readonly code: string;
  readonly constructive: boolean;
  /** The constructive variants its expression uses (asy-map.ts). */
  readonly variants: readonly string[];
  /** Whether the definition refers to other objects (a numeric one is then marked). */
  readonly dependent: boolean;
  readonly helpers: readonly string[];
}

export interface AsyPlan {
  /** In construction order. */
  readonly decls: readonly AsyDecl[];
  readonly byId: ReadonlyMap<number, AsyDecl>;
  readonly names: AsyNames;
}

/** The Asymptote type of a value, or undefined when it has no variable. */
export function typeOfValue(v: Value<number>): AsyType | undefined {
  // A kind outside the Value union (a future or test-only kind, SPEC §18 E2) has no variable.
  if (!isKnownKind(v)) return undefined;
  switch (v.kind) {
    case 'point':
      return 'pair';
    case 'line':
      // Two rays (ADR-0032) are not a gmline: drawn from the display list, like an arc.
      return v.outside === true ? undefined : 'gmline';
    case 'circle':
      return 'gmcircle';
    case 'number':
      return 'real';
    case 'transform':
      // A Möbius map is not an Asymptote transform (ADR-0032): no variable, numeric images.
      return v.t.type === 'similarity' ? 'transform' : undefined;
    case 'polygon':
      return 'path';
    case 'ideal_point':
    case 'conic':
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
    case 'string':
    case 'undefined':
    case 'inexact':
      // A conic (ADR-0042) has no Asymptote primitive: drawn from the display list, numerically.
      return undefined;
    default:
      return assertNever(v, 'value');
  }
}

/** A double as Asymptote reads it back exactly (the shortest round-trip decimal). */
export function exactNum(x: number): string {
  return Object.is(x, -0) ? '0' : String(x);
}

const pairOf = (v: { readonly x: number; readonly y: number }) =>
  `(${exactNum(v.x)}, ${exactNum(v.y)})`;

/** The numeric right-hand side of a value of type `t`, with the helpers it needs. */
function numeric(v: Value<number>): { code: string; helpers: string[] } | undefined {
  switch (v.kind) {
    case 'point':
      return { code: pairOf(v), helpers: [] };
    case 'line': {
      const b = (x: number | null) => (x === null ? 'false, 0' : `true, ${exactNum(x)}`);
      return {
        code: `gm_mkline(${pairOf(v.p)}, ${pairOf(v.d)}, ${b(v.lo)}, ${b(v.hi)})`,
        helpers: ['gmline'],
      };
    }
    case 'circle':
      return {
        code: `gm_mkcircle(${pairOf(v.c)}, ${exactNum(Math.sqrt(v.r2))})`,
        helpers: ['gmcircle'],
      };
    case 'number':
      return { code: exactNum(v.v), helpers: [] };
    case 'transform': {
      if (v.t.type !== 'similarity') return undefined;
      // z ↦ a·z + b, or a·z̄ + b: the matrix of a (complex multiplication), conjugated when anti.
      const { a, b, anti } = v.t;
      const [xx, xy, yx, yy] = anti ? [a.re, a.im, a.im, -a.re] : [a.re, -a.im, a.im, a.re];
      return { code: `(${[b.re, b.im, xx, xy, yx, yy].map(exactNum).join(', ')})`, helpers: [] };
    }
    case 'polygon':
      return { code: `${v.pts.map(pairOf).join('--')}--cycle`, helpers: [] };
    case 'ideal_point':
    case 'conic':
    case 'angle_mark':
    case 'segment_mark':
    case 'text':
    case 'string':
    case 'undefined':
    case 'inexact':
      return undefined;
    default:
      return assertNever(v, 'value');
  }
}

/** The declarations of the frame's drawn objects and their constructive dependencies. */
export function planAsy(f: ExportFrame, registry: Registry, dialect: AsyDialect): AsyPlan {
  const names = new AsyNames();
  const byId = new Map<number, AsyDecl>();
  const failed = new Set<number>();
  const objects = new Map(f.doc.objects.map((o) => [o.id, o]));

  const declare = (id: number): AsyDecl | undefined => {
    const known = byId.get(id);
    if (known !== undefined || failed.has(id)) return known;
    const o = objects.get(id);
    const value = f.values.get(id);
    const type = value === undefined ? undefined : typeOfValue(value);
    if (o === undefined || value === undefined || type === undefined) {
      failed.add(id);
      return undefined;
    }
    failed.add(id); // a cycle (never in a valid document) ends here
    const mapped = mapExpr(o.def, { registry, dialect, ref: (r) => asRef(declare(r)) });
    failed.delete(id);
    const fallback = numeric(value);
    const constructive = mapped !== undefined && mapped.type === type;
    if (!constructive && fallback === undefined) {
      failed.add(id);
      return undefined;
    }
    const d: AsyDecl = {
      id,
      name: o.name,
      ident: names.of(o.name),
      type,
      code: constructive ? mapped.code : (fallback?.code ?? ''),
      constructive,
      dependent: refsOf(o.def).length > 0,
      variants: constructive ? mapped.variants : [],
      helpers: constructive ? mapped.helpers : (fallback?.helpers ?? []),
    };
    byId.set(id, d);
    return d;
  };

  const values = f.values;
  function asRef(d: AsyDecl | undefined): AsyExpr | undefined {
    if (d === undefined) return undefined;
    const v = values.get(d.id);
    const bounded = v?.kind === 'line' && (v.lo !== null || v.hi !== null);
    return { code: d.ident, type: d.type, compound: false, bounded, helpers: [], variants: [] };
  }

  for (const p of f.scene.primitives)
    if (['point', 'line', 'circle', 'polygon'].includes(p.shape.kind)) declare(p.id);
  const order = new Map(f.doc.objects.map((o, i) => [o.id, i]));
  const decls = [...byId.values()].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { decls, byId, names };
}
