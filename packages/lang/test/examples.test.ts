import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { testClaim } from '@geomira/claims/job';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

const dir = fileURLToPath(new URL('../../../examples/', import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.geo'))
  .sort();

describe('examples/: classical theorems (Run 6 item 7)', () => {
  it('there are the eight classical examples', () => {
    expect(files).toEqual([
      'euler-line.geo',
      'feuerbach.geo',
      'incenter-excenter.geo',
      'miquel.geo',
      'nine-point-circle.geo',
      'radical-axes.geo',
      'reflection-layer.geo',
      'simson.geo',
    ]);
  });

  for (const f of files) {
    it(`${f}: parses without diagnostics, is canonical, and every claim HOLDS locally (runJob, 2 seeds × 40 figures)`, () => {
      const text = readFileSync(`${dir}${f}`, 'utf8');
      const { doc, diagnostics } = parse(text, registry);
      expect(diagnostics).toEqual([]);
      expect(print(doc)).toBe(text);
      expect(doc.claims.length).toBeGreaterThan(0);
      for (const c of doc.claims) {
        for (const seed of [1, 2]) {
          const r = testClaim(
            { kind: 'testClaim', regime: 'local', doc, claim: c.id, seed, n: 40 },
            { registry },
          );
          expect(
            r.kind === 'verdict' && r.verdict.kind,
            `${f} claim ${c.kind}: ${r.kind === 'verdict' ? r.verdict.text : JSON.stringify(r)}`,
          ).toBe('holds');
        }
      }
    }, 120_000);
  }
});
