/**
 * Run 16a (ADR-0040): parallel lines now meet at an ideal point. Every example and fixture
 * figure must evaluate, draw and report its claims exactly as on the base of the run (main =
 * a9753c0), whose summaries are stored in fixtures/run-16a-baseline.json (written there with
 * BASELINE_WRITE=1 before any Run 16a change). Any difference is listed in STATUS.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRegistry } from '@geomira/kernel/registry';
import { describe, expect, it } from 'vitest';
import { figureFiles, summarize, type FigureSummary } from './helpers/figure-baseline';

const FILE = join(__dirname, 'fixtures', 'run-16a-baseline.json');
const REGISTRY = createRegistry();

describe('every example and fixture draws and reports as before Run 16a', () => {
  const now: Record<string, FigureSummary> = {};
  for (const f of figureFiles()) now[f.path] = summarize(f.text, REGISTRY);
  if (process.env['BASELINE_WRITE'] === '1')
    writeFileSync(FILE, `${JSON.stringify(now, null, 1)}\n`);
  const before = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, FigureSummary>;

  it('the same figures', () => {
    expect(Object.keys(now)).toEqual(Object.keys(before));
  });

  for (const path of Object.keys(before)) {
    it(path, () => {
      expect(now[path]).toEqual(before[path]);
    });
  }
});
