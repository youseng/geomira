import { describe, expect, it } from 'vitest';
import { fixtureFiles, where } from './testing';
import { checkTolerance, isToleranceLiteral } from './tolerance';

describe('rule (a): tolerance literals', () => {
  it('flags every tolerance-like literal in the bad fixture', () => {
    expect(where(checkTolerance(fixtureFiles('tolerance', 'bad')))).toEqual([
      'apps/web/src/zoom.ts:1',
      'packages/kernel/src/eps.ts:1',
      'packages/kernel/src/eps.ts:2',
      'packages/kernel/src/eps.ts:3',
      'packages/kernel/src/eps.ts:4',
      'packages/kernel/src/eps.ts:5',
      'scripts/tool.ts:1',
    ]);
  });

  it('accepts tolerance.ts, tests and ordinary literals (good fixture)', () => {
    expect(checkTolerance(fixtureFiles('tolerance', 'good'))).toEqual([]);
  });

  it('classifies literal tokens', () => {
    for (const bad of ['1e-9', '2.5E-7', '1e-3', '0.0001', '.0001', '0.000', '00.0005']) {
      expect(isToleranceLiteral(bad), bad).toBe(true);
    }
    for (const ok of ['0.5', '0.001', '1e3', '1E+6', '10.0001', '1_000', '0', '3.14']) {
      expect(isToleranceLiteral(ok), ok).toBe(false);
    }
  });
});
