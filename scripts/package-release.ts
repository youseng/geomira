/** Assemble the public download after both Vite outputs are complete. No publication. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareCandidate } from './release-candidate';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const source =
  process.env['GEOMIRA_BUILD'] ??
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root('.'),
    encoding: 'utf8',
  }).trim();
prepareCandidate(root('apps/web/dist'), root('apps/web/dist-single/index.html'), {
  source,
  run: process.env['GITHUB_RUN_ID'] ?? 'local',
  attempt: process.env['GITHUB_RUN_ATTEMPT'] ?? '1',
  base: process.env['GEOMIRA_BASE'] ?? '/',
});
