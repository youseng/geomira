/**
 * The development page's model: a figure is a parsed document, its float values and its
 * scene. Pure functions; the React components hold a Figure and a viewport in state. Layer
 * toggles are document edits (a layer's visibility is part of the text, CLAUDE.md "every UI
 * state is expressible in the text format"); the viewport is the document's viewport when it
 * has one, else fitted to the scene.
 */
import { evalContextFor } from '@geomira/kernel/context';
import type { Document, Viewport } from '@geomira/kernel/document';
import { applyDocEdit } from '@geomira/kernel/doc-edit';
import { call, lit } from '@geomira/kernel/expr';
import { evaluate, evaluateFrom, type Evaluation } from '@geomira/kernel/evaluate';
import type { Registry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import type { Diagnostic } from '@geomira/lang/diagnostic';
import { FloatField } from '@geomira/num/float-field';
import { rational } from '@geomira/num/rational';
import { sceneBounds } from '@geomira/scene/bounds';
import { buildScene } from '@geomira/scene/build';
import type { Scene } from '@geomira/scene/types';
import { fitViewport, type Size } from '@geomira/scene/viewport';

export interface Figure {
  readonly doc: Document;
  readonly diagnostics: readonly Diagnostic[];
  readonly evaluation: Evaluation<number>;
  readonly scene: Scene;
}

/** Margin around a fitted figure, CSS px. */
export const FIT_MARGIN = 40;

function evaluated(doc: Document, registry: Registry): Evaluation<number> {
  const c = evalContextFor(doc);
  return evaluate(doc, registry, FloatField, c.ok ? c.ctx : { scale: 0 });
}

export function figureOf(
  doc: Document,
  registry: Registry,
  diagnostics: readonly Diagnostic[] = [],
) {
  const evaluation = evaluated(doc, registry);
  const figure: Figure = {
    doc,
    diagnostics,
    evaluation,
    scene: buildScene(doc, evaluation.values),
  };
  return figure;
}

/** The figure of a text (errors are kept as diagnostics; parse is total). */
export function loadFigure(text: string, registry: Registry): Figure {
  const r = parse(text, registry);
  return figureOf(r.doc, registry, r.diagnostics);
}

/** The figure with one layer shown or hidden. */
export function setLayerVisible(
  f: Figure,
  registry: Registry,
  id: string,
  visible: boolean,
): Figure {
  const r = applyDocEdit(f.doc, registry, { kind: 'updateLayer', id, patch: { visible } });
  if (!r.ok) return f;
  return { ...f, doc: r.doc, scene: buildScene(r.doc, f.evaluation.values) };
}

/**
 * The figure after a free point is moved to (x, y), rounded to thousandths (the editor run
 * implements SPEC §12's rounding) — one frame of a drag: the document edit, the incremental
 * evaluation and the scene. A point that is not a free `point(x, y)` (or an
 * edit the kernel refuses) leaves the figure unchanged.
 */
export function movePoint(f: Figure, registry: Registry, id: number, x: number, y: number): Figure {
  const o = f.doc.objects.find((p) => p.id === id);
  if (o?.def.kind !== 'call' || o.def.tool !== 'point') return f;
  const [qx, qy] = [Math.round(x * 1000), Math.round(y * 1000)];
  if (!Number.isFinite(qx) || !Number.isFinite(qy)) return f;
  const milli = (n: number) => lit(rational(BigInt(n), 1000n));
  const def = call('point', [milli(qx), milli(qy)]);
  const r = applyDocEdit(f.doc, registry, { kind: 'redefine', id, def });
  if (!r.ok) return f;
  const c = evalContextFor(r.doc);
  const ctx = c.ok ? c.ctx : { scale: 0 };
  const evaluation = evaluateFrom(f.evaluation, r.doc, registry, FloatField, ctx, [id]);
  return { ...f, doc: r.doc, evaluation, scene: buildScene(r.doc, evaluation.values) };
}

/** The viewport to show: the document's, else the scene fitted into `size`. */
export function viewportFor(f: Figure, size: Size): Viewport {
  return f.doc.viewport ?? fitViewport(sceneBounds(f.scene), size, FIT_MARGIN);
}
