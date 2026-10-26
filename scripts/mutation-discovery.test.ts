/**
 * ADR-0035: packages/discovery has its own mutation config and nightly shard, and the gate
 * holds it to 75 %, as claims.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHARDS } from './mutation-shards';
import { threshold } from './mutation-summary';

const ROOT = join(import.meta.dirname, '..');

describe('the discovery mutation gate', () => {
  it('one whole-package shard, gated at 75 %', () => {
    expect(SHARDS.filter((s) => s.pkg === 'discovery')).toEqual([
      { id: 'discovery', pkg: 'discovery', mutate: [], parent: '' },
    ]);
    expect(threshold('discovery')).toBe(75);
  });

  it('the config mutates the package source with its own tests', () => {
    const config = JSON.parse(readFileSync(join(ROOT, 'stryker.discovery.json'), 'utf8')) as {
      mutate: string[];
      vitest: { configFile: string };
      tsconfigFile: string;
    };
    expect(config.mutate).toEqual([
      'packages/discovery/src/**/*.ts',
      '!packages/discovery/src/index.ts',
    ]);
    expect(config.vitest.configFile).toBe('vitest.discovery.config.ts');
    expect(config.tsconfigFile).toBe('packages/discovery/tsconfig.json');
    expect(readFileSync(join(ROOT, 'vitest.discovery.config.ts'), 'utf8')).toContain(
      "include: ['packages/discovery/test/**/*.test.ts']",
    );
  });
});
