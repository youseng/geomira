/** ADR-0029: the long press of an Objects panel row (browsers without a touch contextmenu). */
import { describe, expect, it } from 'vitest';
import { CLICK_SLOP, LONG_PRESS_MS } from '../src/gestures';
import { LongPress, type Schedule } from '../src/long-press';

function fake() {
  const t = { f: null as (() => void) | null, ms: 0, cancelled: 0 };
  const schedule: Schedule = (f, ms) => {
    t.f = f;
    t.ms = ms;
    return () => {
      t.cancelled += 1;
      t.f = null;
    };
  };
  return { t, press: new LongPress(schedule) };
}

describe('LongPress', () => {
  it('a touch held still fires once after LONG_PRESS_MS; its click is swallowed once', () => {
    const { t, press } = fake();
    let holds = 0;
    press.down(10, 10, true, () => (holds += 1));
    expect(t.ms).toBe(LONG_PRESS_MS);
    press.move(11, 10);
    t.f?.();
    expect(holds).toBe(1);
    press.stop();
    expect(press.takeClick()).toBe(true);
    expect(press.takeClick()).toBe(false);
  });

  it('moving, releasing or a mouse press: no long press, and the click is a click', () => {
    const { t, press } = fake();
    let holds = 0;
    press.down(10, 10, true, () => (holds += 1));
    press.move(10 + CLICK_SLOP, 10);
    expect(t.cancelled).toBe(1);
    press.down(10, 10, true, () => (holds += 1));
    press.stop();
    expect(t.cancelled).toBe(2);
    t.ms = 0;
    press.down(10, 10, false, () => (holds += 1));
    expect(t.ms).toBe(0);
    expect(holds).toBe(0);
    expect(press.takeClick()).toBe(false);
  });
});
