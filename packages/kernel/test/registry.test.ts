import type { Field } from '@geomira/num/field';
import { FloatField } from '@geomira/num/float-field';
import { ModPField } from '@geomira/num/modp';
import { RationalField } from '@geomira/num/rational-field';
import { describe, expect, it } from 'vitest';
import { call } from '../src/expr';
import { createRegistry, rejection } from '../src/registry';
import { formatSignature, type ToolSpec } from '../src/tool';
import { undef, type Value } from '../src/value';
import { evaluate } from '../src/evaluate';
import { Builder, REGISTRY, contextOf, must, pt, valueOf } from './helpers/doc';

const k = (kind: string) => ({ kind });

describe('createRegistry', () => {
  it('is a value: each call builds a new registry; nothing is shared', () => {
    const a = createRegistry();
    const b = createRegistry();
    expect(a).not.toBe(b);
    expect(a.tools.map((t) => t.name)).toEqual(b.tools.map((t) => t.name));
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.tools)).toBe(true);
  });

  it('holds the Run 2 tools, each with one compute and complete metadata', () => {
    expect(REGISTRY.tools.map((t) => t.name)).toEqual([
      'point',
      'param',
      'midpoint',
      'divide',
      'foot',
      'intersect',
      'circumcenter',
      'centroid',
      'orthocenter',
      'line',
      'segment',
      'ray',
      'parallel',
      'perp',
      'perp_bisector',
      'dist',
      'ratio',
      'angle',
      'dangle',
      'area',
      'polygon',
      'add',
      'sub',
      'mul',
      'div',
      'neg',
      'circle',
      'circumcircle',
      'cline',
      'diameter_circle',
      'ninepoint_circle',
      'center',
      'on',
      'other',
      'tangent',
      'polar',
      'radical_axis',
      'incenter',
      'excenter',
      'incircle',
      'excircle',
      'bisector',
      'ext_bisector',
      'sqrt',
      'sin',
      'cos',
      'tan',
      'ninepoint_center',
      'power',
      'radius',
      'tangent_point',
      'tangent_from',
    ]);
    for (const t of REGISTRY.tools) {
      expect(t.id).toBe(t.name);
      expect(t.signatures.length).toBeGreaterThan(0);
      expect(t.outputKinds.length).toBeGreaterThan(0);
      expect(t.doc.length).toBeGreaterThan(0);
      expect(t.examples.length).toBeGreaterThan(0);
      expect(t.export).toBe('numeric');
      expect(REGISTRY.get(t.name)).toBe(t);
    }
    expect(REGISTRY.get('nope')).toBeUndefined();
  });

  it('extends with extra tools; duplicate names are a construction error', () => {
    const extra: ToolSpec = {
      ...must(REGISTRY.get('midpoint')),
      id: 'test_mid',
      name: 'test_mid',
    };
    const r = createRegistry([extra]);
    expect(r.get('test_mid')).toBe(extra);
    expect(REGISTRY.get('test_mid')).toBeUndefined();
    expect(() => createRegistry([must(REGISTRY.get('line'))])).toThrow(/two tools are named line/);
  });
});

describe('capability-based overload resolution', () => {
  it('picks the first signature whose capabilities accept the arguments', () => {
    const foot = REGISTRY.resolve('foot', [k('point'), k('line')]);
    expect(foot.ok && foot.signature.params).toEqual(['point', 'linear']);
    const foot3 = REGISTRY.resolve('foot', [k('point'), k('point'), k('point')]);
    expect(foot3.ok && foot3.signature.params).toEqual(['point', 'point', 'point']);
    const area = REGISTRY.resolve('area', [
      k('point'),
      k('point'),
      k('point'),
      k('point'),
      k('point'),
    ]);
    expect(area.ok && area.signature.rest).toBe('point');
    expect(REGISTRY.resolve('area', [k('polygon')]).ok).toBe(true);
  });

  it('rejects with a message listing the available signatures', () => {
    expect(REGISTRY.resolve('midpoint', [k('point'), k('line')])).toEqual({
      ok: false,
      reason: 'midpoint does not accept (point, line); signatures: midpoint(point, point)',
    });
    expect(REGISTRY.resolve('foot', [k('point'), k('number')])).toEqual({
      ok: false,
      reason:
        'foot does not accept (point, number); signatures: foot(point, linear) · foot(point, point, point)',
    });
    expect(REGISTRY.resolve('area', [k('point'), k('point')])).toMatchObject({ ok: false });
    expect(REGISTRY.resolve('midpoint', [k('point'), k('point'), k('point')])).toMatchObject({
      ok: false,
    });
    expect(REGISTRY.resolve('nope', [])).toEqual({ ok: false, reason: 'unknown tool "nope"' });
    expect(formatSignature('polygon', { params: ['point'], rest: 'point' })).toBe(
      'polygon(point, point…)',
    );
    expect(rejection(must(REGISTRY.get('neg')), [])).toBe(
      'neg does not accept (); signatures: neg(number)',
    );
  });

  it('E2: kinds are safe by default: an unknown (future) kind is rejected, never computed with', () => {
    // A test-only kind no tool knows (SPEC §18 E2), e.g. a Phase 2 conic.
    const conic = { kind: 'test_conic' };
    expect(REGISTRY.resolve('midpoint', [conic, k('point')])).toEqual({
      ok: false,
      reason: 'midpoint does not accept (test_conic, point); signatures: midpoint(point, point)',
    });
    // Through evaluation: a test-only tool produces the unknown kind and a v1 tool gets it.
    const make: ToolSpec = {
      ...must(REGISTRY.get('point')),
      id: 'make_conic',
      name: 'make_conic',
      signatures: [{ params: [] }],
      compute: <T>(): Value<T> => conic as unknown as Value<T>,
    };
    const registry = createRegistry([make]);
    const b = new Builder();
    const c = b.add('c', call('make_conic', []));
    b.add('M', call('midpoint', [c, pt(0, 0)]));
    b.add('l', call('line', [pt(1, 0), c]));
    for (const F of [FloatField, RationalField, ModPField] as Field<unknown>[]) {
      const ev = evaluate(b.doc, registry, F, contextOf(b.doc));
      expect(valueOf(b.doc, ev, 'c')).toBe(conic);
      expect(valueOf(b.doc, ev, 'M')).toEqual(
        undef('midpoint does not accept (test_conic, point); signatures: midpoint(point, point)'),
      );
      expect(valueOf(b.doc, ev, 'l').kind).toBe('undefined');
    }
  });
});
