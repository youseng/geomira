/**
 * ADR-0053: package.json's engines field names the oldest Node the repository's own tests run
 * on. The slice test (apps/web/test/host-discovery.test.ts, ADR-0044 decision 3) reads
 * `process.threadCpuUsage`, which Node has from 22.19, so the field says ≥ 22.19.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'),
);

function nodeRange(pkg: unknown): string | undefined {
  if (typeof pkg !== 'object' || pkg === null || !('engines' in pkg)) return undefined;
  const engines = pkg.engines;
  if (typeof engines !== 'object' || engines === null || !('node' in engines)) return undefined;
  return typeof engines.node === 'string' ? engines.node : undefined;
}

function version(text: string): readonly number[] {
  return text.replace(/^v/, '').split('.').map(Number);
}

describe('package.json engines (ADR-0053)', () => {
  it('asks for Node 22.19 or later', () => {
    expect(nodeRange(PKG)).toBe('>=22.19');
  });

  it('the Node running the tests satisfies it and has process.threadCpuUsage', () => {
    const [major = 0, minor = 0] = version(process.version);
    expect(major > 22 || (major === 22 && minor >= 19)).toBe(true);
    expect(typeof process.threadCpuUsage).toBe('function');
  });
});
