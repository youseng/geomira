/**
 * A text's handle (its anchor, a radius-0 dot) is hit as the text's part 'point', so the
 * Move tool can drag it, but it is not a point of the figure (ADR-0028): the virtual hit
 * near it is what it would be without the text, so tools can still create a point there.
 */
import { describe, expect, it } from 'vitest';
import type { Expr } from '@geomira/kernel/expr';
import { layout } from '../src/display';
import { hitTest } from '../src/hit';
import { toScreen, type View } from '../src/viewport';
import { Doc } from './helpers/docs';

const str = (value: string): Expr => ({ kind: 'str', value });
const view: View = { viewport: { cx: 0, cy: 0, zoom: 50 }, size: { width: 800, height: 600 } };

function figure(): Doc {
  const t = new Doc().point('A', -4, 0).point('B', 4, 0);
  t.add('l', t.call('line', 'A', 'B'));
  t.add('t', t.call('text', t.call('point', 0, 0.5), str('the line l')));
  t.add('u', t.call('text', t.call('point', 2, 0), str('on l')));
  return t;
}

describe("a text's handle is not a point for virtual hits", () => {
  it('on its anchor: the text is hit, and the virtual hit is a free position', () => {
    const d = layout(figure().scene(), view);
    const h = hitTest(d, toScreen(view, { x: 0, y: 0.5 }));
    expect(h.hits[0]).toMatchObject({ name: 't', kind: 'text', part: 'point' });
    expect(h.virtual.kind).toBe('free');
  });

  it('an anchor on a curve: the virtual hit is a point on the curve', () => {
    const t = figure();
    const h = hitTest(layout(t.scene(), view), toScreen(view, { x: 2, y: 0 }));
    expect(h.hits.map((x) => [x.name, x.part])).toEqual([
      ['u', 'point'],
      ['l', 'curve'],
    ]);
    expect(h.virtual).toMatchObject({ kind: 'on', curve: t.id('l') });
  });

  it('a real point under the cursor still makes the virtual hit none', () => {
    const h = hitTest(layout(figure().scene(), view), toScreen(view, { x: 4, y: 0 }));
    expect(h.virtual).toEqual({ kind: 'none' });
  });
});
