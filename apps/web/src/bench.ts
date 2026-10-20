/**
 * Frame timing (SPEC §17 budget "drag frame ≤ 8 ms at 300 objects"). A DRAG frame moves the
 * first free point (document edit, incremental evaluation, scene, layout, canvas drawing);
 * a PAN frame moves the viewport (layout and drawing). Times are main-thread milliseconds
 * from performance.now around each frame's work, so the GPU's share is not counted. Each
 * series starts with WARMUP untimed frames (just-in-time compilation), so the numbers are
 * those of an ongoing drag or pan.
 */
import type { Registry } from '@geomira/kernel/registry';
import { layout } from '@geomira/scene/display';
import type { Size, Viewport } from '@geomira/scene/viewport';
import { movePoint, type Figure } from './figure';
import { drawDisplay, NO_UI, type Canvas2D, type Theme } from './render';

export interface Timing {
  readonly frames: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

export interface FrameTimes {
  readonly objects: number;
  readonly drag: Timing;
  readonly pan: Timing;
}

/** Untimed frames before each timed series. */
export const WARMUP = 20;

function timing(ms: number[]): Timing {
  const s = [...ms].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
  return { frames: s.length, median: at(0.5), p95: at(0.95), max: s[s.length - 1] ?? 0 };
}

interface Env {
  readonly ctx: Canvas2D;
  readonly registry: Registry;
  readonly size: Size;
  readonly viewport: Viewport;
  readonly dpr: number;
  readonly theme: Theme;
}

/** Times `frames` drag frames and `frames` pan frames of `figure`. */
export function measureFrames(figure: Figure, env: Env, frames: number): FrameTimes {
  const view = { viewport: env.viewport, size: env.size };
  const first = figure.doc.objects.find((o) => o.def.kind === 'call' && o.def.tool === 'point');
  const start = first === undefined ? undefined : figure.evaluation.values.get(first.id);
  const drag: number[] = [];
  let f = figure;
  for (let i = -WARMUP; i < frames; i++) {
    const t0 = performance.now();
    if (first !== undefined && start?.kind === 'point') {
      // The first free point runs around a small circle about where it started.
      const a = (2 * Math.PI * i) / frames;
      f = movePoint(
        f,
        env.registry,
        first.id,
        start.x + Math.cos(a) / 2,
        start.y + Math.sin(a) / 2,
      );
    }
    drawDisplay(env.ctx, layout(f.scene, view), NO_UI, env.theme, env.dpr);
    if (i >= 0) drag.push(performance.now() - t0);
  }
  const pan: number[] = [];
  for (let i = -WARMUP; i < frames; i++) {
    const t0 = performance.now();
    const shift = (((i % 20) + 20) % 20) / env.viewport.zoom;
    const viewport = { ...env.viewport, cx: env.viewport.cx + shift };
    drawDisplay(env.ctx, layout(figure.scene, { ...view, viewport }), NO_UI, env.theme, env.dpr);
    if (i >= 0) pan.push(performance.now() - t0);
  }
  return { objects: figure.doc.objects.length, drag: timing(drag), pan: timing(pan) };
}
