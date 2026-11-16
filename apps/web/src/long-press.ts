/**
 * A long press on an element (ADR-0029: a row of the Objects panel opens the style card), for
 * browsers that send no contextmenu on a held touch: a touch or pen press held LONG_PRESS_MS
 * within CLICK_SLOP px fires once; the click that ends that press is swallowed (it is not
 * also a pick). A mouse press never fires: its right button sends contextmenu. Host code; the
 * timer is injected, so the logic is tested without a browser.
 */
import { CLICK_SLOP, LONG_PRESS_MS } from './gestures';
import type { Schedule } from './schedule';
export { timeout, type Schedule } from './schedule';

export class LongPress {
  private pending: { readonly x: number; readonly y: number; readonly cancel: () => void } | null =
    null;
  private fired = false;

  constructor(private readonly schedule: Schedule) {}

  /** A press starts; `touch`: a finger or a pen. */
  down(x: number, y: number, touch: boolean, onHold: () => void): void {
    this.stop();
    this.fired = false;
    if (!touch) return;
    const cancel = this.schedule(() => {
      this.pending = null;
      this.fired = true;
      onHold();
    }, LONG_PRESS_MS);
    this.pending = { x, y, cancel };
  }

  /** The press moves: beyond CLICK_SLOP it is no long press. */
  move(x: number, y: number): void {
    const p = this.pending;
    if (p !== null && Math.hypot(x - p.x, y - p.y) >= CLICK_SLOP) this.stop();
  }

  /** The press ends (released, cancelled, left): a pending long press will not fire. */
  stop(): void {
    this.pending?.cancel();
    this.pending = null;
  }

  /** Whether the click now arriving ends a press that fired (then it is swallowed); once. */
  takeClick(): boolean {
    const f = this.fired;
    this.fired = false;
    return f;
  }
}
