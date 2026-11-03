/**
 * ADR-0055: the test timeout is a hang guard (15 s for the packages), and every project reports
 * the tests slower than SLOW_TEST_MS (2.5 s) with their times, in CI's log as everywhere.
 */
import { describe, expect, it } from 'vitest';
import config, { SLOW_TEST_MS } from '../vitest.config';

interface Project {
  readonly test?: {
    readonly name?: string;
    readonly slowTestThreshold?: number;
    readonly testTimeout?: number;
  };
}

const projects = (config.test?.projects ?? []) as readonly Project[];

describe('vitest configuration (ADR-0055)', () => {
  it('the reporters list every test slower than 2.5 s (a root option: it covers every project)', () => {
    expect(SLOW_TEST_MS).toBe(2500);
    expect(config.test?.slowTestThreshold).toBe(SLOW_TEST_MS);
    expect(projects.map((p) => p.test?.name)).toEqual(['packages', 'web', 'scripts']);
  });

  it('the packages project has the 15 s hang guard', () => {
    expect(projects[0]?.test?.testTimeout).toBe(15_000);
  });
});
