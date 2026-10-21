/**
 * Pointer gestures on the canvas, turned into editor edits (host code: the geometry is the
 * editor's and the scene's). One finger or the mouse: on a draggable object in the Move tool
 * it DRAGS (dragStart / dragMove / dragEnd, one history entry); elsewhere it PANS; a press
 * that moves less than CLICK_SLOP px is a CLICK, given to the active tool with the scene's
 * hit test at the cursor and its world position. Two fingers PINCH: zoom about their
 * midpoint and pan with it. Viewport changes are UI edits (outside history).
 */
import { hitTest } from '@geomira/scene/hit';
import type { DisplayList } from '@geomira/scene/display';
import { panViewport, toWorld, zoomViewport, type Vec2, type View } from '@geomira/scene/viewport';
import type { EditorStore } from './store';

/** A press that moved less than this (px) is a click. */
export const CLICK_SLOP = 4;

type Mode =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'press';
      readonly start: Vec2;
      last: Vec2;
      moved: boolean;
      readonly drag: boolean;
    }
  | {
      readonly kind: 'pinch';
      readonly d0: number;
      readonly mid0: Vec2;
      readonly view0: View;
    };

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function middle(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class Gestures {
  private readonly pointers = new Map<number, Vec2>();
  private mode: Mode = { kind: 'none' };

  constructor(private readonly store: EditorStore) {}

  private view(display: DisplayList): View {
    return { viewport: this.store.current().viewport, size: display.view.size };
  }

  private twoPointers(): [Vec2, Vec2] | undefined {
    const [a, b] = [...this.pointers.values()];
    return a === undefined || b === undefined ? undefined : [a, b];
  }

  down(id: number, q: Vec2, display: DisplayList): void {
    this.pointers.set(id, q);
    const two = this.twoPointers();
    if (two !== undefined) {
      if (this.mode.kind === 'press' && this.mode.drag) this.store.apply({ kind: 'dragCancel' });
      this.mode = {
        kind: 'pinch',
        d0: distance(...two),
        mid0: middle(...two),
        view0: this.view(display),
      };
      return;
    }
    if (this.pointers.size !== 1) return;
    const s = this.store.current();
    const target =
      s.tool === 'move' ? hitTest(display, q).hits.find((h) => h.part === 'point') : undefined;
    const drag = target !== undefined && this.store.apply({ kind: 'dragStart', id: target.id }).ok;
    this.mode = { kind: 'press', start: q, last: q, moved: false, drag };
  }

  move(id: number, q: Vec2, display: DisplayList): void {
    if (!this.pointers.has(id)) {
      this.hover(q, display);
      return;
    }
    this.pointers.set(id, q);
    const m = this.mode;
    if (m.kind === 'pinch') {
      this.pinch(m);
      return;
    }
    if (m.kind !== 'press') return;
    if (!m.moved && distance(q, m.start) < CLICK_SLOP) return;
    m.moved = true;
    if (m.drag) this.store.apply({ kind: 'dragMove', to: toWorld(this.view(display), q) });
    else {
      const vp = this.store.current().viewport;
      this.store.apply({
        kind: 'viewport',
        viewport: panViewport(vp, q.x - m.last.x, q.y - m.last.y),
      });
    }
    m.last = q;
  }

  private pinch(m: Extract<Mode, { kind: 'pinch' }>): void {
    const two = this.twoPointers();
    if (two === undefined || m.d0 <= 0) return;
    const mid = middle(...two);
    const panned = panViewport(m.view0.viewport, mid.x - m.mid0.x, mid.y - m.mid0.y);
    const viewport = zoomViewport(
      { viewport: panned, size: m.view0.size },
      mid,
      distance(...two) / m.d0,
    );
    this.store.apply({ kind: 'viewport', viewport });
  }

  up(id: number, q: Vec2, display: DisplayList): void {
    if (!this.pointers.delete(id)) return;
    const m = this.mode;
    if (m.kind === 'pinch') {
      // The remaining finger, if any, starts nothing new until it is lifted.
      if (this.pointers.size === 0) this.mode = { kind: 'none' };
      return;
    }
    this.mode = { kind: 'none' };
    if (m.kind !== 'press') return;
    if (m.drag) this.store.apply({ kind: m.moved ? 'dragEnd' : 'dragCancel' });
    if (!m.moved) this.click(q, display);
  }

  cancel(id: number): void {
    if (!this.pointers.delete(id)) return;
    if (this.mode.kind === 'press' && this.mode.drag) this.store.apply({ kind: 'dragCancel' });
    if (this.pointers.size === 0) this.mode = { kind: 'none' };
  }

  private click(q: Vec2, display: DisplayList): void {
    const world = toWorld(this.view(display), q);
    this.store.input({ kind: 'click', hit: hitTest(display, q), world });
  }

  private hover(q: Vec2, display: DisplayList): void {
    const id = hitTest(display, q).hits[0]?.id ?? null;
    if (id !== this.store.current().hover) this.store.apply({ kind: 'hover', id });
  }

  leave(): void {
    if (this.pointers.size === 0 && this.store.current().hover !== null)
      this.store.apply({ kind: 'hover', id: null });
  }
}
