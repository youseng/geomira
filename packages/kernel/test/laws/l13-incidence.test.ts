/**
 * Law L13, incidence preservation (SPEC §8.1), fuzzed: on registry-driven random documents
 * (helpers/fuzz.ts: every tool, including on, intersect, other, foot, tangent and the
 * transformations themselves), every pair (point P, curve Y) of evaluated values is tested
 * for incidence (P on the carrier of a line, or on a circle) EXACTLY over Q and mod p; the
 * images under a random similarity (direct or anti) have the same incidence status, in
 * both directions (incident pairs stay incident, others stay apart). In floats, pairs that
 * are exactly incident over Q stay within a relative 1e-9 after mapping. Arcs: a point on
 * the counter-clockwise arc from P to Q maps onto the image arc (an anti map reverses it).
 */
import type { Field } from '@geomira/num/field';
import type { Rational } from '@geomira/num/rational';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { createRng, deriveSeed } from '@geomira/num/rng';
import { describe, expect, it } from 'vitest';
import { vCross, vDot, vSub } from '../../src/geom';
import { applySimilarity, scale2 } from '../../src/similarity';
import type { Similarity, Value, Vec } from '../../src/value';
import { REGISTRY, contextOf, evalDoc } from '../helpers/doc';
import { fuzzDocument } from '../helpers/fuzz';
import { LAW_TIMEOUT, lawCount } from '../helpers/laws';
import { fq } from '../helpers/degenerate-transforms';
import { randomSimilarity } from '../helpers/similarity-gen';

const DOCS = lawCount(300);

/** The incidence quantity: cross(P − p, d) for a line, |P − c|² − r² for a circle. */
function gap<T>(F: Field<T>, P: Vec<T>, Y: Value<T>): T | undefined {
  if (Y.kind === 'line') return vCross(F, vSub(F, P, Y.p), Y.d);
  if (Y.kind === 'circle') {
    const w = vSub(F, P, Y.c);
    return F.sub(vDot(F, w, w), Y.r2);
  }
  return undefined;
}

interface Pairs<T> {
  readonly points: Vec<T>[];
  readonly curves: Value<T>[];
}

function pairsOf<T>(values: Iterable<Value<T>>): Pairs<T> {
  const out: Pairs<T> = { points: [], curves: [] };
  for (const v of values) {
    if (v.kind === 'point') out.points.push(v);
    if (v.kind === 'line' || v.kind === 'circle') out.curves.push(v);
  }
  return out;
}

function imageOf<T>(F: Field<T>, s: Similarity<T>, v: Value<T>): Value<T> {
  return applySimilarity(F, s, v);
}

function exactRun<T>(F: Field<T>, seedBase: number): { incident: number; apart: number } {
  let [incident, apart] = [0, 0];
  for (let i = 0; i < DOCS; i += 1) {
    const rng = createRng(deriveSeed(seedBase, i));
    const doc = fuzzDocument(rng, REGISTRY, {
      points: 4,
      calls: 14,
      degenerate: false,
      maxDepth: 3,
    });
    const { points, curves } = pairsOf(evalDoc(doc, F, contextOf(doc)).values.values());
    const s = randomSimilarity(F, rng);
    for (const P of points) {
      const Pi = imageOf(F, s, { kind: 'point', ...P });
      if (Pi.kind !== 'point') throw new Error('image of a point');
      for (const Y of curves) {
        const [g, gi] = [gap(F, P, Y), gap(F, Pi, imageOf(F, s, Y))];
        if (g === undefined || gi === undefined) throw new Error('gap');
        const on = F.eq(g, F.zero);
        expect(F.eq(gi, F.zero), `document ${String(i)}`).toBe(on);
        if (on) incident += 1;
        else apart += 1;
      }
    }
  }
  return { incident, apart };
}

describe(
  `L13: similarities preserve incidence (${String(DOCS)} fuzzed documents)`,
  { timeout: LAW_TIMEOUT },
  () => {
    for (const [k, F] of ([RationalField, ModPField] as Field<unknown>[]).entries()) {
      it(`${F.name}: exact incidence status of every point–curve pair is preserved`, () => {
        const { incident, apart } = exactRun(F, 1300 + k);
        process.stdout.write(
          `L13 incidence ${F.name}: ${String(incident)} incident and ${String(apart)} apart pairs preserved\n`,
        );
        expect(incident).toBeGreaterThan(DOCS);
        expect(apart).toBeGreaterThan(DOCS);
      });
    }

    it('FloatField: pairs incident over Q stay incident (relative 1e-9) after mapping', () => {
      let checked = 0;
      for (let i = 0; i < DOCS; i += 1) {
        const rng = createRng(deriveSeed(1310, i));
        const doc = fuzzDocument(rng, REGISTRY, {
          points: 4,
          calls: 14,
          degenerate: false,
          maxDepth: 3,
        });
        const ctx = contextOf(doc);
        const [q, f] = [evalDoc(doc, RationalField, ctx), evalDoc(doc, FloatField, ctx)];
        const s = randomSimilarity(FloatField, rng);
        const k = Math.sqrt(scale2(FloatField, s));
        const ids = [...q.values.keys()];
        for (const pid of ids) {
          const [Pq, Pf] = [q.values.get(pid), f.values.get(pid)];
          if (Pq?.kind !== 'point' || Pf?.kind !== 'point') continue;
          for (const yid of ids) {
            const [Yq, Yf] = [q.values.get(yid), f.values.get(yid)];
            if (Yq === undefined || Yf === undefined || Yf.kind !== Yq.kind) continue;
            const g = gap(RationalField, Pq, Yq);
            if (g === undefined || !RationalField.eq(g, RationalField.zero)) continue;
            const Pi = imageOf(FloatField, s, Pf);
            const gi =
              Pi.kind === 'point' ? gap(FloatField, Pi, imageOf(FloatField, s, Yf)) : undefined;
            if (gi === undefined) throw new Error('image');
            // The gap is an area (|P − c|² − r², cross with an unnormalised d): relative to
            // the mapped figure's size squared.
            const size = k * Math.max(ctx.scale, Math.hypot(Pf.x, Pf.y));
            expect(Math.abs(gi) / (size * size), `document ${String(i)}`).toBeLessThan(1e-9);
            checked += 1;
          }
        }
      }
      process.stdout.write(
        `L13 incidence FloatField: ${String(checked)} exactly incident pairs stay incident\n`,
      );
      expect(checked).toBeGreaterThan(DOCS);
    });

    it('a point on an arc maps onto the image arc (anti maps reverse the arc)', () => {
      const F: Field<Rational> = RationalField;
      let [direct, anti] = [0, 0];
      for (let i = 0; i < lawCount(2000); i += 1) {
        const rng = createRng(deriveSeed(1320, i));
        const s = randomSimilarity(F, rng);
        // The arc of the circle x² + y² = 25 from (5, 0) to (0, 5) and its interior point (3, 4).
        const P = (x: number, y: number) => ({ x: fq(F, x), y: fq(F, y) });
        const [from, to, mid] = [P(5, 0), P(0, 5), P(3, 4)];
        const arc: Value<Rational> = {
          kind: 'circle',
          c: P(0, 0),
          r2: fq(F, 25),
          arc: { from, to },
        };
        const img = imageOf(F, s, arc);
        const m = imageOf(F, s, { kind: 'point', ...mid });
        if (img.kind !== 'circle' || img.arc === null || m.kind !== 'point')
          throw new Error('image');
        // m lies on the counter-clockwise arc from `from` to `to` (strictly between): seen
        // from the centre, from → m and m → to both turn counter-clockwise (arcs below 180°).
        const turn = (a: Vec<Rational>, b: Vec<Rational>) =>
          F.sign(vCross(F, vSub(F, a, img.c), vSub(F, b, img.c)), 'area', { scale: 1 });
        expect(turn(img.arc.from, m)).toBe(1);
        expect(turn(m, img.arc.to)).toBe(1);
        if (s.anti) anti += 1;
        else direct += 1;
      }
      expect(Math.min(direct, anti)).toBeGreaterThan(lawCount(2000) / 3);
    });
  },
);
