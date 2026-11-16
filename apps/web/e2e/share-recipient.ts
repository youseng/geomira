import { SITE_URL } from '../src/build-info';

/** Test the canonical offline recipient against this run's hosted artifact, never live Pages. */
export function recipientUrl(link: string): string {
  if (!link.startsWith(SITE_URL)) return link;
  const source = new URL(link);
  const port =
    process.env['GEOMIRA_PREVIEW_PORT'] ??
    (process.env['GEOMIRA_ENGINE_E2E'] === '1' ? '4174' : '4173');
  const hosted = new URL(`http://localhost:${port}${process.env['GEOMIRA_BASE'] ?? '/'}`);
  hosted.hash = source.hash;
  return hosted.href;
}
