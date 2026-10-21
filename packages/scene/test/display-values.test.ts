/**
 * The display values in the scene (ADR-0011): shapes, layout (pixel-sized marks), labels
 * (a text is its string, centred), hit-testing (marks are strokes, a text's handle is its
 * anchor, marks are never virtual curves), coincident images, draw order and bounds.
 */
import { describe, expect, it } from 'vitest';
import type { Expr } from '@geomira/kernel/expr';
import type { AngleMark } from '@geomira/kernel/value';
import { sceneBounds } from '../src/bounds';
import { layout } from '../src/display';
import { hitTest } from '../src/hit';
import { MARK_GAP, MARK_RADIUS, RIGHT_SIDE, TICK_GAP, TICK_LENGTH } from '../src/mark-paths';
import { shapeOf } from '../src/shapes';
import { toScreen, type View } from '../src/viewport';
import { Doc, drawn } from './helpers/docs';

const str = (value: string): Expr => ({ kind: 'str', value });
const VIEW: View = { viewport: { cx: 0, cy: 0, zoom: 20 }, size: { width: 400, height: 300 } };

function figure(): Doc {
  const t = new Doc();
  t.point('A', 0, 0).point('B', 4, 0).point('C', 1, 3);
  t.add('H', t.call('rotate', 'B', 'A', 90));
  t.add('a', t.call('mark_angle', 'B', 'A', 'C', 2));
  t.add('r', t.call('mark_right', 'B', 'A', 'H'));
  t.add('s', t.call('mark_segment', 'A', 'B', 3));
  t.add('t', t.call('text', 'C', str('M_a')), { style: { label: 'ignored' } });
  return t;
}

function item(t: Doc, name: string) {
  const d = layout(t.scene(), VIEW);
  const i = d.items.find((x) => x.name === name);
  if (i === undefined) throw new Error(`${name} is not drawn`);
  return { d, i };
}

describe('display values in the scene (ADR-0011)', () => {
  it('shapes: the convex span counter-clockwise, whatever the order of a hand-made value', () => {
    const mark = (from: [number, number], to: [number, number]): AngleMark<number> => ({
      kind: 'angle_mark',
      b: { x: 0, y: 0 },
      from: { x: from[0], y: from[1] },
      to: { x: to[0], y: to[1] },
      arcs: 1,
      right: false,
    });
    for (const m of [mark([1, 0], [0, 1]), mark([0, 1], [1, 0])]) {
      const s = shapeOf(m);
      expect(
        s.kind === 'shape' && s.shape.kind === 'angle_mark' && [s.shape.from, s.shape.to],
      ).toEqual([0, Math.PI / 2]);
    }
    const back = shapeOf(mark([-1, -1e-9], [1, 0]));
    expect(
      back.kind === 'shape' && back.shape.kind === 'angle_mark' && back.shape.to - back.shape.from,
    ).toBeLessThanOrEqual(Math.PI);
    expect(shapeOf({ ...mark([1, 0], [0, 1]), arcs: 4 })).toEqual({
      kind: 'unavailable',
      reason: 'an angle mark needs 1 to 3 arcs',
    });
    expect(shapeOf(mark([0, 0], [0, 1])).kind).toBe('unavailable');
    expect(
      shapeOf({ kind: 'segment_mark', p: { x: 0, y: 0 }, q: { x: 1, y: 0 }, ticks: 0 }).kind,
    ).toBe('unavailable');
    expect(shapeOf({ kind: 'text', at: { x: 0, y: 0 }, text: '' }).kind).toBe('unavailable');
    expect(shapeOf({ kind: 'string', s: 'x' })).toEqual({ kind: 'none' });
  });

  it('layout: arcs of fixed pixel radii, the square, perpendicular ticks, the text handle', () => {
    const t = figure();
    const a = item(t, 'a').i;
    expect(a.paths.map((p) => (p.kind === 'arc' ? [p.r, p.from, p.to] : p.kind))).toEqual([
      [MARK_RADIUS, 0, Math.atan2(3, 1)],
      [MARK_RADIUS + MARK_GAP, 0, Math.atan2(3, 1)],
    ]);
    const r = item(t, 'r').i;
    const o = toScreen(VIEW, { x: 0, y: 0 });
    expect(r.paths).toEqual([
      {
        kind: 'poly',
        pts: [
          { x: o.x + RIGHT_SIDE, y: o.y },
          { x: o.x + RIGHT_SIDE, y: o.y - RIGHT_SIDE },
          { x: o.x, y: o.y - RIGHT_SIDE },
        ],
        closed: false,
      },
    ]);
    const s = item(t, 's').i;
    const m = toScreen(VIEW, { x: 2, y: 0 });
    expect(s.paths).toEqual(
      [-1, 0, 1].map((k) => ({
        kind: 'poly',
        pts: [
          { x: m.x + k * TICK_GAP, y: m.y - TICK_LENGTH / 2 },
          { x: m.x + k * TICK_GAP, y: m.y + TICK_LENGTH / 2 },
        ],
        closed: false,
      })),
    );
    expect(item(t, 't').i.paths).toEqual([
      { kind: 'dot', c: toScreen(VIEW, { x: 1, y: 3 }), r: 0 },
    ]);
    // Zoom does not change a mark's size on screen.
    const far = layout(t.scene(), { ...VIEW, viewport: { cx: 0, cy: 0, zoom: 2 } });
    const a2 = far.items.find((x) => x.name === 'a');
    expect(a2?.paths.map((p) => p.kind === 'arc' && p.r)).toEqual([
      MARK_RADIUS,
      MARK_RADIUS + MARK_GAP,
    ]);
  });

  it('labels: a text is labelled with its string (not its style label), centred on its anchor', () => {
    const t = figure();
    const { d } = item(t, 't');
    const l = d.labels.find((x) => x.id === t.id('t'));
    expect(l).toMatchObject({ text: 'M_a', align: 'center', baseline: 'middle' });
    expect(l?.at).toEqual(toScreen(VIEW, { x: 1, y: 3 }));
    t.style('t', { labelAngle: 0, labelDist: 5 });
    const moved = layout(t.scene(), VIEW).labels.find((x) => x.id === t.id('t'));
    expect(moved).toMatchObject({ align: 'left', at: { x: (l?.at.x ?? 0) + 5, y: l?.at.y } });
    t.style('a', { label: '\\alpha' });
    const al = layout(t.scene(), VIEW).labels.find((x) => x.id === t.id('a'));
    expect(al?.text).toBe('\\alpha');
    expect(al?.angle).toBeCloseTo((Math.atan2(3, 1) / 2) * (180 / Math.PI), 9);
  });

  it('hits: marks by their strokes, a text by its handle; marks are not curves for virtual hits', () => {
    const t = figure();
    const { d, i } = item(t, 'a');
    const p = i.paths[1];
    if (p?.kind !== 'arc') throw new Error('arc expected');
    const onArc = { x: p.c.x + p.r * Math.cos(0.3), y: p.c.y - p.r * Math.sin(0.3) };
    const h = hitTest(d, onArc);
    expect(h.hits.map((x) => x.name)).toContain('a');
    expect(h.virtual.kind).toBe('free');
    const at = toScreen(VIEW, { x: 1, y: 3 });
    const th = hitTest(d, { x: at.x + 3, y: at.y });
    expect(th.hits[0]).toMatchObject({ name: 't', kind: 'text', part: 'point' });
    expect(hitTest(d, { x: at.x + 20, y: at.y }).hits.map((x) => x.name)).not.toContain('t');
  });

  it('coincident images: a mark symmetric in the mirror, a reversed segment mark, a text on the mirror', () => {
    const t = new Doc();
    t.point('O', 0, 0).point('X', 4, 0).point('Y', 0, 4).point('Z', 3, 3);
    t.add('a', t.call('mark_angle', 'X', 'O', 'Y'));
    t.add('b', t.call('mark_angle', 'X', 'O', 'Z'));
    t.add('s', t.call('mark_segment', 'X', 'Y', 2));
    t.add('u', t.call('text', 'Z', str('on the mirror')));
    t.add('v', t.call('text', 'X', str('off the mirror')));
    t.add('m', t.call('reflect', t.call('line', 'O', 'Z')));
    t.derived('refl', 'm');
    const scene = t.scene();
    const hidden = scene.coincident.map((id) => t.doc.objects.find((o) => o.id === id)?.name);
    expect(hidden).toEqual(expect.arrayContaining(['a*', 's*', 'u*', 'Z*']));
    expect(hidden).not.toContain('b*');
    expect(hidden).not.toContain('v*');
    expect(drawn(scene)).toEqual(expect.arrayContaining(['b*', 'v*']));
    // The source hidden (images inherit hidden unless they say otherwise, ADR-0010): the
    // image is drawn (fixed points never disappear).
    t.style('a', { hidden: true }).style('a*', { hidden: false });
    expect(drawn(t.scene())).toContain('a*');
  });

  it('draw order: marks above curves and below points, texts on top; bounds include them', () => {
    const t = figure();
    t.add('l', t.call('line', 'A', 'C'));
    const order = drawn(t.scene());
    const at = (n: string) => order.indexOf(n);
    expect(at('l')).toBeLessThan(at('s'));
    expect(at('s')).toBeLessThan(at('a'));
    expect(at('a')).toBeLessThan(at('A'));
    expect(at('C')).toBeLessThan(at('t'));
    const only = new Doc();
    only.point('A', 0, 0).point('B', 1, 0).point('C', 5, 7);
    only.add('t', only.call('text', 'C', str('x')), { style: {} });
    only.style('A', { hidden: true }).style('B', { hidden: true }).style('C', { hidden: true });
    expect(sceneBounds(only.scene())).toEqual({ minX: 5, maxX: 5, minY: 7, maxY: 7 });
  });
});
