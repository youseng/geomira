/**
 * Run 16b (ADR-0042): conics are a new kind; circles are never re-typed as conics. Every example
 * and fixture figure must evaluate, draw and report its claims exactly as on the base of the run
 * (main = 335803e, Run 16a), whose summaries are stored in fixtures/run-16b-baseline.json
 * (written there with BASELINE_WRITE_16B=1 before any Run 16b change). The figures Run 16b adds
 * are listed in NEW_FIGURES; any other difference fails here and is listed in STATUS.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRegistry } from '@geomira/kernel/registry';
import { describe, expect, it } from 'vitest';
import { figureFiles, summarize, type FigureSummary } from './helpers/figure-baseline';

const FILE = join(__dirname, 'fixtures', 'run-16b-baseline.json');
const REGISTRY = createRegistry();

/** Figures added by Run 16b (not in the base). */
const NEW_FIGURES: readonly string[] = [];

describe('every example and fixture draws and reports as before Run 16b', () => {
  const now: Record<string, FigureSummary> = {};
  for (const f of figureFiles()) now[f.path] = summarize(f.text, REGISTRY);
  if (process.env['BASELINE_WRITE_16B'] === '1')
    writeFileSync(FILE, `${JSON.stringify(now, null, 1)}\n`);
  const before = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, FigureSummary>;

  it('the same figures, plus the ones Run 16b adds', () => {
    expect(Object.keys(now).sort()).toEqual([...Object.keys(before), ...NEW_FIGURES].sort());
  });

  for (const path of Object.keys(before)) {
    it(path, () => {
      expect(now[path]).toEqual(before[path]);
    });
  }
});
