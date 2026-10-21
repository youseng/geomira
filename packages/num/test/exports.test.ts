import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as assert from '../src/assert';
import * as complex from '../src/complex';
import * as field from '../src/field';
import * as floatField from '../src/float-field';
import * as modp from '../src/modp';
import * as rationalField from '../src/rational-field';
import * as rational from '../src/rational';
import * as rng from '../src/rng';
import * as tolerance from '../src/tolerance';

/** The public modules of @geomira/num (ADR-0002) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './tolerance': {
    module: tolerance,
    names: [
      'BAND',
      'EPS',
      'EXPORT_TOL',
      'FALSE_ABS',
      'FALSE_FACTOR',
      'FLOOR_DELTA',
      'FLOOR_MAX',
      'FLOOR_MIN',
      'FLOOR_SAMPLES',
      'MAX_SCALE',
      'TRUE_FACTOR',
      'bandThreshold',
      'classifyResidual',
      'isZero',
      'isZeroArea',
      'isZeroDimless',
      'isZeroLen',
      'noiseFloor',
      'residualThresholds',
      'sign3',
      'toleranceContext',
      'zeroThreshold',
    ],
  },
  './assert': { module: assert, names: ['assertNever'] },
  './rng': {
    module: rng,
    names: ['createRng', 'cryptoSource', 'deriveSeed', 'restoreRng', 'uniformBigInt'],
  },
  './rational': {
    module: rational,
    names: [
      'ONE',
      'ZERO',
      'abs',
      'add',
      'bitSize',
      'compare',
      'div',
      'eq',
      'formatRational',
      'fromInteger',
      'fromNumber',
      'isInteger',
      'isZero',
      'mul',
      'neg',
      'parseRational',
      'rational',
      'sign',
      'sqrtExact',
      'sub',
      'toNumber',
      'tryToNumber',
    ],
  },
  './field': {
    module: field,
    names: ['allExact', 'inexact', 'isInexact', 'mapExact', 'withDivisorLog', 'withSqrtLog'],
  },
  './float-field': { module: floatField, names: ['FloatField'] },
  './rational-field': { module: rationalField, names: ['RationalField'] },
  './modp': { module: modp, names: ['ModPField', 'P'] },
  './complex': {
    module: complex,
    names: [
      'cAbs2',
      'cAdd',
      'cConj',
      'cDiv',
      'cEq',
      'cMul',
      'cNeg',
      'cPow',
      'cScale',
      'cSub',
      'complex',
    ],
  },
};

describe('@geomira/num subpath exports (ADR-0002)', () => {
  it('package.json exports the root entry and exactly the public modules', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
  });

  it('every export target exists and is named after its subpath', () => {
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url)))).toBe(true);
      if (subpath !== '.') expect(target).toBe(`./src/${subpath.slice(2)}.ts`);
    }
  });

  it.each(Object.entries(SURFACE))('%s exports exactly its documented names', (_, entry) => {
    expect(Object.keys(entry.module).sort()).toEqual([...entry.names].sort());
  });

  it('exported constants and field objects are frozen (no module-level mutable state)', () => {
    for (const f of [floatField.FloatField, rationalField.RationalField, modp.ModPField]) {
      expect(Object.isFrozen(f)).toBe(true);
    }
    expect(Object.isFrozen(rational.ZERO)).toBe(true);
    expect(Object.isFrozen(rational.ONE)).toBe(true);
  });
});
