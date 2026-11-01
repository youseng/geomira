/**
 * ADR-0058: a mutant's run is a timeout after timeoutFactor × the time of the tests that cover it
 * plus timeoutMS (Stryker's rule). A timed-out mutant counts as detected and costs its whole
 * timeout, so the cold runs' minutes were mostly timeouts (ADR-0057); every config waits 1.2 × the
 * tests' time plus 2.5 s instead of Stryker's defaults (1.5 × plus 5 s).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

describe('Stryker timeouts (ADR-0058)', () => {
  for (const pkg of ['num', 'kernel', 'claims', 'discovery'])
    it(`stryker.${pkg}.json waits 1.2 × the covering tests' time plus 2.5 s`, () => {
      const config = JSON.parse(readFileSync(join(ROOT, `stryker.${pkg}.json`), 'utf8')) as {
        timeoutMS?: number;
        timeoutFactor?: number;
        coverageAnalysis?: string;
      };
      expect([config.timeoutFactor, config.timeoutMS, config.coverageAnalysis]).toEqual([
        1.2,
        2500,
        'perTest',
      ]);
    });
});
