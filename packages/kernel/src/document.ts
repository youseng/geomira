/**
 * The document model (SPEC §5): the ENTIRE state of a figure. Documents are immutable
 * plain data; edits go through the helpers of edit.ts and layers.ts, and invariants
 * I1–I8 (invariants.ts) hold after every edit.
 */
import type { Expr, RefExpr } from './expr';

/** I8: the current document version. */
export const DOCUMENT_VERSION = 1;

/** The layer that always exists. */
export const MAIN_LAYER_ID = 'main';

export interface Style {
  readonly color?: string;
  readonly width?: number;
  readonly dash?: 'solid' | 'dashed' | 'dotted';
  readonly hidden?: boolean;
  /** Excludes the object from derived layers (SPEC §8.2). */
  readonly noimage?: boolean;
  readonly label?: string;
}

export interface DocObject {
  /** Never reused (I6). */
  readonly id: number;
  /** Unique and grammatical (I1). */
  readonly name: string;
  readonly def: Expr;
  readonly style: Style;
  /** Non-empty, existing layer ids (I3). */
  readonly layers: readonly string[];
  /** The id of the derived layer whose rule maintains this object (I4). */
  readonly managedBy?: string;
}

/** A derived layer's rule (SPEC §8.2): X* = apply(T, X) for every X of `source`. */
export interface LayerRule {
  readonly transform: RefExpr;
  readonly source: string;
  /** One or more `*` (ADR-0003). */
  readonly suffix: string;
  /** Object ids that get no image. */
  readonly exclude: readonly number[];
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  /** In [0, 1]. */
  readonly opacity: number;
  readonly order: number;
  readonly rule?: LayerRule;
}

export interface Viewport {
  readonly cx: number;
  readonly cy: number;
  /** Pixels per unit, > 0. */
  readonly zoom: number;
}

export interface View {
  readonly name: string;
  /** Layer id → visible; every key is an existing layer (I7). */
  readonly layerVisibility: Readonly<Record<string, boolean>>;
  readonly viewport?: Viewport;
}

/** A claim as data; packages/claims gives `kind` its meaning (ADR-0003). */
export interface Claim {
  readonly id: number;
  readonly name?: string;
  readonly kind: string;
  readonly args: readonly Expr[];
}

/** An `assume` line as data (packages/claims gives `kind` its meaning). */
export interface Assumption {
  readonly id: number;
  readonly kind: string;
  readonly args: readonly Expr[];
}

export interface Meta {
  readonly title?: string;
  readonly author?: string;
}

export interface Document {
  readonly version: number;
  /** The next id to issue (objects, claims, assumptions, layers); ids are never reused. */
  readonly nextId: number;
  /** Construction order: every reference points to an earlier object (I2). */
  readonly objects: readonly DocObject[];
  readonly layers: readonly Layer[];
  readonly views: readonly View[];
  readonly claims: readonly Claim[];
  readonly assumptions: readonly Assumption[];
  readonly viewport: Viewport | null;
  readonly meta: Meta;
}

export function mainLayer(): Layer {
  return {
    id: MAIN_LAYER_ID,
    name: MAIN_LAYER_ID,
    visible: true,
    locked: false,
    opacity: 1,
    order: 0,
  };
}

export function emptyDocument(): Document {
  return {
    version: DOCUMENT_VERSION,
    nextId: 1,
    objects: [],
    layers: [mainLayer()],
    views: [],
    claims: [],
    assumptions: [],
    viewport: null,
    meta: {},
  };
}

export function findObject(doc: Document, id: number): DocObject | undefined {
  return doc.objects.find((o) => o.id === id);
}

export function findObjectByName(doc: Document, name: string): DocObject | undefined {
  return doc.objects.find((o) => o.name === name);
}

export function findLayer(doc: Document, id: string): Layer | undefined {
  return doc.layers.find((l) => l.id === id);
}
