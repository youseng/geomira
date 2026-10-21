/**
 * The export frame: what every format exports is the scene of the document (packages/scene,
 * the same primitives the canvas draws) laid out in a VIEW, so layers, opacity, z-order,
 * hidden objects, images of derived layers, the coincident-image rule (SPEC §13) and the
 * labels' placement (collision avoidance, explicit label_angle / label_dist) are exactly
 * the screen's (note A of Run 9a). The view is the canvas's when the app exports; without
 * one it is the document's @viewport, else the figure fitted into DEFAULT_SIZE.
 */
import type { Document } from '@geomira/kernel/document';
import type { Value } from '@geomira/kernel/value';
import { sceneBounds } from '@geomira/scene/bounds';
import { buildScene } from '@geomira/scene/build';
import { layout, type DisplayList } from '@geomira/scene/display';
import type { Scene } from '@geomira/scene/types';
import { fitViewport, viewProblem, type Size, type View } from '@geomira/scene/viewport';
import { EXPORT_THEME, type ExportTheme } from './paint';

/** The surface of an export without a view, CSS px. */
export const DEFAULT_SIZE: Size = Object.freeze({ width: 640, height: 480 });

/** Margin around a fitted figure, CSS px (the app's FIT_MARGIN). */
export const FIT_MARGIN = 40;

/**
 * Largest exported surface side, CSS px: TikZ coordinates must stay below TeX's largest
 * dimension (16383.99 pt), and 8192 px is 6144 bp.
 */
export const MAX_EXPORT_SIDE = 8192;

export interface ExportOptions {
  /** The view to export (the canvas's); default: the @viewport, else a fit. */
  readonly view?: View;
  readonly theme?: ExportTheme;
  /** How a star of an image name is written in TeX labels (default `*`). */
  readonly star?: string;
}

export interface ExportFrame {
  readonly doc: Document;
  readonly values: ReadonlyMap<number, Value<number>>;
  readonly scene: Scene;
  readonly display: DisplayList;
  readonly view: View;
  readonly theme: ExportTheme;
  readonly star: string;
}

export type FrameResult =
  | { readonly ok: true; readonly frame: ExportFrame }
  | { readonly ok: false; readonly problem: string };

/** The view of an export without one (module comment). */
export function defaultView(doc: Document, scene: Scene): View {
  const viewport = doc.viewport ?? fitViewport(sceneBounds(scene), DEFAULT_SIZE, FIT_MARGIN);
  return { viewport, size: DEFAULT_SIZE };
}

/**
 * The frame of `doc` with its float values. Degenerate: a view the scene refuses
 * (viewProblem) or a surface side above MAX_EXPORT_SIDE → the problem, nothing exported.
 */
export function exportFrame(
  doc: Document,
  values: ReadonlyMap<number, Value<number>>,
  options: ExportOptions = {},
): FrameResult {
  const scene = buildScene(doc, values);
  const view = options.view ?? defaultView(doc, scene);
  const problem = viewProblem(view);
  if (problem !== undefined) return { ok: false, problem };
  if (view.size.width > MAX_EXPORT_SIDE || view.size.height > MAX_EXPORT_SIDE)
    return {
      ok: false,
      problem: `an export is at most ${String(MAX_EXPORT_SIDE)} pixels wide and high`,
    };
  return {
    ok: true,
    frame: {
      doc,
      values,
      scene,
      display: layout(scene, view),
      view,
      theme: options.theme ?? EXPORT_THEME,
      star: options.star ?? '*',
    },
  };
}
