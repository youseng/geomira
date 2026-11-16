import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareCandidate, verifyCandidate } from './release-candidate';

const sha = '1234567890abcdef1234567890abcdef12345678';
const identity = { source: sha, run: '123', attempt: '1', base: '/geomira/' };

function fixture(run: (site: string, offline: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'geomira-candidate-'));
  try {
    const site = join(dir, 'site');
    mkdirSync(site);
    writeFileSync(join(site, 'index.html'), `<script>const build="${sha}"</script>`);
    const offline = join(dir, 'offline.html');
    writeFileSync(offline, `<html>offline build ${sha}</html>`);
    run(site, offline);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('release candidate integrity', () => {
  it('copies the exact offline bytes and records all delivered checksums and provenance', () => {
    fixture((site, offline) => {
      prepareCandidate(site, offline, identity);
      expect(readFileSync(join(site, 'geomira.html'))).toEqual(readFileSync(offline));
      const candidate = verifyCandidate(site, identity);
      expect(candidate).toMatchObject({ ...identity, mode: 'public' });
      for (const path of ['index.html', 'geomira.html'])
        expect(candidate.files[path]).toMatch(/^[a-f\d]{64}$/u);
    });
  });

  it('rejects another SHA, run, attempt or deployment base rather than borrowing approval', () => {
    fixture((site, offline) => {
      prepareCandidate(site, offline, identity);
      for (const key of ['source', 'run', 'attempt', 'base'] as const)
        expect(() => verifyCandidate(site, { ...identity, [key]: 'other' })).toThrow();
    });
  });

  it('rejects missing, changed or injected delivered files', () => {
    fixture((site, offline) => {
      prepareCandidate(site, offline, identity);
      writeFileSync(join(site, 'index.html'), 'different');
      expect(() => verifyCandidate(site, identity)).toThrow();
      prepareCandidate(site, offline, identity);
      rmSync(join(site, 'geomira.html'));
      expect(() => verifyCandidate(site, identity)).toThrow();
      prepareCandidate(site, offline, identity);
      writeFileSync(join(site, 'unexpected.html'), 'unvalidated');
      expect(() => verifyCandidate(site, identity)).toThrow();
    });
  });

  it('refuses an old offline build or a non-public manifest', () => {
    fixture((site, offline) => {
      writeFileSync(offline, 'old build');
      expect(() => prepareCandidate(site, offline, identity)).toThrow();
      writeFileSync(offline, `build ${sha}`);
      prepareCandidate(site, offline, identity);
      const manifest = join(site, 'release.json');
      const content = readFileSync(manifest, 'utf8').replace('"public"', '"claim-engine"');
      writeFileSync(manifest, content);
      expect(() => verifyCandidate(site, identity)).toThrow();
    });
  });
});
