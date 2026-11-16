/** Package and check the exact public bytes tested by one validation run (ADR-0076). */
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../apps/web/build/pwa';

export interface CandidateIdentity {
  readonly source: string;
  readonly run: string;
  readonly attempt: string;
  readonly base: string;
}
interface Candidate extends CandidateIdentity {
  readonly mode: 'public';
  readonly files: Readonly<Record<string, string>>;
}

function checksums(site: string): Record<string, string> {
  return Object.fromEntries(
    listFiles(site)
      .filter((path) => path !== 'release.json')
      .sort()
      .map((path) => [
        path,
        createHash('sha256')
          .update(readFileSync(join(site, path)))
          .digest('hex'),
      ]),
  );
}

export function prepareCandidate(
  site: string,
  offline: string,
  identity: CandidateIdentity,
): Candidate {
  if (!/^[a-f\d]{40}$/u.test(identity.source)) throw new Error('A full source SHA is required.');
  if (!readFileSync(offline, 'utf8').includes(identity.source))
    throw new Error('Offline build does not identify the candidate source SHA.');
  copyFileSync(offline, join(site, 'geomira.html'));
  const manifest: Candidate = { ...identity, mode: 'public', files: checksums(site) };
  writeFileSync(join(site, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function verifyCandidate(site: string, expected: CandidateIdentity): Candidate {
  const candidate: unknown = JSON.parse(readFileSync(join(site, 'release.json'), 'utf8'));
  if (typeof candidate !== 'object' || candidate === null)
    throw new Error('Candidate manifest is missing.');
  for (const key of ['source', 'run', 'attempt', 'base'] as const)
    if (!Object.hasOwn(candidate, key) || Reflect.get(candidate, key) !== expected[key])
      throw new Error(`Candidate ${key} does not match this validation run.`);
  if (!('mode' in candidate) || candidate.mode !== 'public')
    throw new Error('Only public artifacts may be published.');
  const files = checksums(site);
  if (
    !('files' in candidate) ||
    JSON.stringify(candidate.files) !== JSON.stringify(files) ||
    files['geomira.html'] === undefined ||
    files['index.html'] === undefined
  )
    throw new Error('Candidate contents do not match the tested checksums.');
  return { ...expected, mode: 'public', files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, site, offline, source, run, attempt, base] = process.argv.slice(2);
  if (
    site === undefined ||
    offline === undefined ||
    source === undefined ||
    run === undefined ||
    attempt === undefined ||
    base === undefined
  )
    throw new Error('Usage: release-candidate.ts prepare|check site offline sha run attempt base');
  const identity = { source, run, attempt, base };
  if (mode === 'prepare') prepareCandidate(site, offline, identity);
  else if (mode === 'check') verifyCandidate(site, identity);
  else throw new Error('Expected prepare or check.');
}
