/**
 * Checks of laws L8 (hit/render consistency) and L9 (finite scenes), shared by the scene's
 * own fuzz tests and by apps/web/test (which runs them on parsed documents and through the
 * canvas renderer). The checks measure distances by dense sampling of the drawn paths,
 * independently of hit-geom.ts.
 */
import { expect } from 'vitest';
import type { DisplayItem, DisplayList, Path } from '../../src/display';
import { HIT_RADIUS, hitTest } from '../../src/hit';
import type { Vec2 } from '../../src/viewport';

/** Every number reachable in `x` (objects, arrays) is finite; returns how many were seen. */
export function assertAllFinite(x: unknown, where = 'value'): number {
  let n = 0;
  const visit = (v: unknown, path: string): void => {
    if (typeof v === 'number') {
      n++;
      if (!Number.isFinite(v)) throw new Error(`L9: ${path} is ${String(v)}`);
    } else if (Array.isArray(v)) {
      for (const [i, e] of v.entries()) visit(e, `${path}[${String(i)}]`);
    } else if (v !== null && typeof v === 'object')
      for (const [k, e] of Object.entries(v)) visit(e, `${path}.${k}`);
  };
  visit(x, where);
  return n;
}

/** Points along a path (n per piece), as drawn. */
export function samplePath(p: Path, n: number): Vec2[] {
  switch (p.kind) {
    case 'dot':
      return [p.c, { x: p.c.x + p.r, y: p.c.y }, { x: p.c.x, y: p.c.y - p.r }];
    case 'arc': {
      const out: Vec2[] = [];
      for (let i = 0; i <= n; i++) {
        const a = p.from + ((p.to - p.from) * i) / n;
        out.push({ x: p.c.x + p.r * Math.cos(a), y: p.c.y - p.r * Math.sin(a) });
      }
      return out;
    }
    case 'poly': {
      const out: Vec2[] = [];
      const pts = p.closed && p.pts[0] !== undefined ? [...p.pts, p.pts[0]] : p.pts;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        if (a === undefined || b === undefined) continue;
        for (let j = 0; j <= n; j++)
          out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
      }
      return out;
    }
  }
}

function onSurface(d: DisplayList, q: Vec2): boolean {
  return q.x >= 0 && q.y >= 0 && q.x <= d.view.size.width && q.y <= d.view.size.height;
}

/** Brute-force distance from q to an item's stroked paths (dense sampling). */
function sampledDistance(item: DisplayItem, q: Vec2): number {
  let best = Infinity;
  for (const p of item.paths) {
    if (p.kind === 'dot') {
      best = Math.min(best, Math.max(0, Math.hypot(q.x - p.c.x, q.y - p.c.y) - p.r));
      continue;
    }
    const pts = samplePath(p, 400);
    for (const s of pts) best = Math.min(best, Math.hypot(q.x - s.x, q.y - s.y));
  }
  return best;
}

function windingInside(pts: readonly Vec2[], q: Vec2): boolean {
  let w = 0;
  for (const [i, a] of pts.entries()) {
    const b = pts[(i + 1) % pts.length] ?? a;
    const cross = (b.x - a.x) * (q.y - a.y) - (q.x - a.x) * (b.y - a.y);
    if (a.y <= q.y && b.y > q.y && cross > 0) w++;
    else if (a.y > q.y && b.y <= q.y && cross < 0) w--;
  }
  return w !== 0;
}

export interface L8Counts {
  samples: number;
  cursors: number;
  hits: number;
}

/**
 * L8 on one display list: (1) every sampled point of every drawn path that lies on the
 * surface hits its item; (2) at random cursors, every hit item has drawn geometry within
 * the pick radius (plus half its stroke and the sampling error), or contains the cursor in
 * its fill, and every item with drawn geometry clearly within the radius is hit.
 */
export function checkL8(d: DisplayList, cursors: readonly Vec2[], counts: L8Counts): void {
  for (const item of d.items)
    for (const p of item.paths)
      for (const q of samplePath(p, 8)) {
        if (!onSurface(d, q)) continue;
        counts.samples++;
        const ids = hitTest(d, q).hits.map((h) => h.id);
        expect(ids, `L8: a drawn point of ${item.name} is not hit`).toContain(item.id);
      }
  for (const q of cursors) {
    counts.cursors++;
    const r = hitTest(d, q);
    const hit = new Set(r.hits.map((h) => h.id));
    for (const item of d.items) {
      const dist = sampledDistance(item, q);
      const reach = HIT_RADIUS + item.style.width / 2;
      const fill = item.fill !== null && windingInside(item.fill, q);
      if (hit.has(item.id)) {
        counts.hits++;
        expect(dist <= reach + 1 || fill, `L8: ${item.name} hit but not drawn there`).toBe(true);
      } else {
        expect(dist > HIT_RADIUS - 1 && !fill, `L8: ${item.name} drawn there but not hit`).toBe(
          true,
        );
      }
    }
  }
}
