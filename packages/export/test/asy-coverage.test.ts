/**
 * The CI coordinate check (tex.yml, scripts/export-tex.ts) must cover every constructive
 * mapping (note C of Run 9a): the export fixtures and examples together use every variant
 * the mapping knows, every helper, and every constructive op of the registry, and every
 * object of the constructions fixture is written constructively except its free points and
 * the one call that must fall back (near(P) on a segment).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ASY_HELPERS } from '../src/asy-helpers';
import { planAsy } from '../src/asy-plan';
import { AsyDrawer, drawingCode } from '../src/asy-draw';
import { examples, frameOf, REGISTRY } from './helpers/figure';

/** Every variant asy-map.ts can write, by hand. */
const VARIANTS = [
  'add(real,real)',
  'apply(transform,gmcircle)',
  'apply(transform,gmline)',
  'apply(transform,pair)',
  'apply(transform,path)',
  'centroid(pair,pair,pair)',
  'circle(pair,pair)',
  'circle(pair,pair,pair)',
  'circle(pair,real)',
  'circumcenter(pair,pair,pair)',
  'circumcircle(pair,pair,pair)',
  'compose(transform,transform)',
  'div(real,real)',
  'foot(pair,gmline)',
  'foot(pair,pair,pair)',
  'homothety(pair,pair,real)',
  'homothety(pair,real)',
  'incenter(pair,pair,pair)',
  'incircle(pair,pair,pair)',
  'intersect(gmcircle,gmcircle) far_from',
  'intersect(gmcircle,gmcircle) near',
  'intersect(gmcircle,gmcircle) opposite_side',
  'intersect(gmcircle,gmcircle) orient',
  'intersect(gmcircle,gmcircle) other',
  'intersect(gmcircle,gmcircle) same_side',
  'intersect(gmcircle,gmline) other',
  'intersect(gmline,gmcircle) along',
  'intersect(gmline,gmcircle) far_from',
  'intersect(gmline,gmcircle) near',
  'intersect(gmline,gmcircle) opposite_side',
  'intersect(gmline,gmcircle) other',
  'intersect(gmline,gmcircle) same_side',
  'intersect(gmline,gmline) none',
  'inverse(transform)',
  'line(pair,pair)',
  'midpoint(pair,pair)',
  'mul(real,real)',
  'neg(real)',
  'orthocenter(pair,pair,pair)',
  'polygon(pair…)',
  'ray(pair,pair)',
  'reflect(gmline)',
  'reflect(gmline,pair)',
  'reflect(pair)',
  'reflect(pair,gmline)',
  'reflect(path,gmline)',
  'rotate(gmcircle,pair,real)',
  'rotate(pair,pair,real)',
  'rotate(pair,real)',
  'segment(pair,pair)',
  'spiral(pair,pair,pair,pair)',
  'spiral(pair,pair,pair,pair,pair)',
  'sub(real,real)',
  'translate(pair,pair)',
  'translate(pair,pair,pair)',
];

const fixture = (n: string) => readFileSync(`tests/fixtures/export/${n}.geo`, 'utf8');
const inputs = [
  ...examples().map((e) => e.text),
  fixture('constructions'),
  fixture('display'),
  fixture('numeric'),
];

describe('the coordinate check covers every constructive mapping', () => {
  const plans = inputs.map((t) => {
    const f = frameOf(t);
    const plan = planAsy(f, REGISTRY, 'standalone');
    const d = new AsyDrawer(f, plan);
    drawingCode(d);
    return { plan, drawHelpers: [...d.helpers] };
  });

  it('every variant is used by an input that tex.yml compiles and checks', () => {
    const used = new Set(plans.flatMap((p) => p.plan.decls.flatMap((d) => d.variants)));
    expect([...used].sort()).toEqual([...VARIANTS].sort());
  });

  it('every helper is used', () => {
    const used = new Set(
      plans.flatMap((p) => [...p.plan.decls.flatMap((d) => d.helpers), ...p.drawHelpers]),
    );
    expect([...used].sort()).toEqual(ASY_HELPERS.map(([k]) => k).sort());
  });

  it('every constructive op of the registry is used', () => {
    const ops = REGISTRY.tools.flatMap((t) =>
      t.export === 'numeric' ? [] : [t.export.constructive],
    );
    const used = new Set([...VARIANTS].map((v) => v.slice(0, v.indexOf('('))));
    expect([...used].sort()).toEqual([...ops].sort());
  });

  it('the constructions fixture is constructive except free points and near(P) on a segment', () => {
    const plan = planAsy(frameOf(fixture('constructions')), REGISTRY, 'standalone');
    const numeric = plan.decls.filter((d) => !d.constructive).map((d) => d.name);
    expect(numeric).toEqual(['A', 'B', 'C', 'P', 'N1']);
  });
});
