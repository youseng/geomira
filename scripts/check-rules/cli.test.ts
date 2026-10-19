import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempRepo } from './testing';

const ROOT = join(import.meta.dirname, '..', '..');
const TSX = join(ROOT, 'node_modules', '.bin', 'tsx');
const CLI = join(ROOT, 'scripts', 'check-rules.ts');

describe('pnpm rules (CLI)', () => {
  it('exits non-zero and names the failing rules on a bad tree', () => {
    const repo = tempRepo();
    try {
      repo.write('packages/kernel/src/eps.ts', 'export const EPS = 1e-9;\n');
      repo.write('docs/test-count.txt', '0\n');
      repo.commit('bad');
      const result = spawnSync(TSX, [CLI, repo.root], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('FAIL tolerance');
      expect(result.stderr).toContain('packages/kernel/src/eps.ts:1');
      expect(result.stderr).toContain('ok   forbidden-words');
      expect(result.stderr).toContain('no run-* tag yet');
    } finally {
      repo.dispose();
    }
  });
});
