import { describe, expect, it } from 'vitest';
import { BAND, EPS } from '@geomira/num/tolerance';
import { evalContextFor } from '@geomira/kernel/context';
import { coincides } from '../src/coincide';
import { Doc, drawn } from './helpers/docs';

/**
 * SPEC §13: a managed image whose value coincides with its source within BAND is not drawn
 * while the source is drawn; it is drawn when the source is hidden (an "image only" view).
 */
function mirror(): Doc {
  const t = new Doc().point('A', 1, 4).point('B', -2, 0).point('C', 5, 0);
  t.add('m', t.call('line', 'B', 'C'));
  t.add('s', t.call('reflect', 'm'));
  return t.derived('refl', 's');
}

describe('coincident images (SPEC §13)', () => {
  it('points on the mirror line and the mirror line itself are not drawn twice', () => {
    const s = mirror().scene();
    expect(drawn(s).sort()).toEqual(['A', 'A*', 'B', 'C', 'm'].sort());
    const t = mirror();
    expect([...s.coincident].sort()).toEqual(['B*', 'C*', 'm*'].map((n) => t.id(n)).sort());
  });

  it('an "image only" view (source layer hidden) draws every image, fixed points included', () => {
    const t = mirror().visible('main', false);
    const s = t.scene();
    expect(drawn(s).sort()).toEqual(['A*', 'B*', 'C*', 'm*']);
    expect(s.coincident).toEqual([]);
  });

  it('an image is drawn when its source is hidden by style or Undefined', () => {
    const t = mirror();
    t.style('B*', { hidden: false }).style('B', { hidden: true });
    expect(drawn(t.scene())).toContain('B*');
    const u = new Doc().point('A', 1, 4).point('B', -2, 0).point('C', 5, 0);
    u.add('m', u.call('line', 'B', 'C'));
    u.add('s', u.call('reflect', 'm'));
    u.add('P', u.call('intersect', 'm', u.call('line', 'A', 'A')));
    u.derived('refl', 's');
    expect(drawn(u.scene())).not.toContain('P*');
    expect(
      u
        .scene()
        .unavailable.map((x) => x.name)
        .sort(),
    ).toEqual(['P', 'P*']);
  });

  it('the decision is BAND (relative to the figure scale), not EPS', () => {
    const base = mirror().doc;
    const ctx = evalContextFor(base);
    if (!ctx.ok) throw new Error(ctx.reason);
    const scale = ctx.ctx.scale;
    const near = (k: number) => {
      const t = mirror();
      t.point('P', 1, (k * BAND * scale) / 2); // P* = P mirrored: |PP*| = k·BAND·scale
      return drawn(t.scene()).includes('P*');
    };
    expect(near(0.9)).toBe(false);
    expect(near((10 * EPS) / BAND)).toBe(false); // beyond EPS, inside BAND: still hidden
    expect(near(1.1)).toBe(true);
    expect(near(100)).toBe(true);
  });

  it('chains: X** coincident with a hidden-as-coincident X* is not drawn either', () => {
    const t = mirror().derived('refl2', 's', 'refl');
    const s = t.scene();
    expect(drawn(s)).not.toContain('B**');
    expect(drawn(s)).not.toContain('m**');
    expect(drawn(s)).toContain('A**'); // A** lies on A, but its source is A*, which it is not
    t.visible('main', false).visible('refl', false);
    expect(drawn(t.scene()).sort()).toEqual(['A**', 'B**', 'C**', 'm**']);
  });

  it('coincidence is of point sets: swapped segment ends and permuted polygons coincide', () => {
    const t = new Doc().point('A', 0, 3).point('B', -2, 0).point('C', 2, 0);
    t.add('bc', t.call('segment', 'B', 'C'));
    t.add('tri', t.call('polygon', 'A', 'B', 'C'));
    t.add('w', t.call('circumcircle', 'A', 'B', 'C'));
    t.add('M', t.call('midpoint', 'B', 'C'));
    t.add('r', t.call('ray', 'M', 'C'));
    t.add('s', t.call('reflect', t.call('perp_bisector', 'B', 'C')));
    t.derived('refl', 's');
    const d = drawn(t.scene());
    for (const n of ['bc*', 'tri*', 'w*', 'A*', 'M*']) expect(d).not.toContain(n);
    for (const n of ['B*', 'C*', 'r*']) expect(d).toContain(n); // swapped, or the opposite ray
  });

  it('values of different kinds, Undefined values and overflowing ones never coincide', () => {
    const ctx = { scale: 1 };
    const P = { kind: 'point' as const, x: 0, y: 0 };
    const big = { kind: 'point' as const, x: Number.MAX_VALUE, y: 0 };
    const negBig = { kind: 'point' as const, x: -Number.MAX_VALUE, y: 0 };
    expect(coincides(P, { kind: 'undefined', reason: 'x' }, ctx)).toBe(false);
    expect(coincides(P, { kind: 'number', v: 0 }, ctx)).toBe(false);
    expect(coincides(big, negBig, ctx)).toBe(false);
    expect(coincides(big, big, ctx)).toBe(true);
    const line = {
      kind: 'line' as const,
      p: P,
      d: { x: 1e300, y: 1e300 },
      lo: null,
      hi: null,
      chiral: false,
    };
    expect(coincides(line, line, ctx)).toBe(false); // |d|² overflows: drawn twice, never hidden wrongly
  });
});

describe('images are styled like their sources unless overridden', () => {
  it('colour, width, dash and hidden are inherited; the image overrides field by field', () => {
    const t = mirror().style('A', { color: 'red', width: 2, dash: 'dashed' });
    const a = () => t.scene().primitives.find((p) => p.name === 'A*');
    expect(a()?.style).toEqual({ color: 'red', width: 2, dash: 'dashed', opacity: 1 });
    t.style('A*', { color: 'gray' });
    expect(a()?.style).toEqual({ color: 'gray', width: 2, dash: 'dashed', opacity: 1 });
    t.style('A', { hidden: true });
    expect(a()).toBeUndefined();
  });

  it("an image's label is its source's label text plus the suffix, else its own name", () => {
    const t = mirror().derived('refl2', 's', 'refl');
    const label = (n: string) => t.scene().primitives.find((p) => p.name === n)?.label?.text;
    expect(label('A*')).toBe('A*');
    t.style('A', { label: 'X_1' });
    expect(label('A*')).toBe('X_1*');
    expect(label('A**')).toBe('X_1**');
    t.style('A*', { label: 'Y' });
    expect(label('A**')).toBe('Y*');
    t.style('A', { label: '' }).style('A*', {});
    expect(label('A*')).toBeUndefined();
  });
});
