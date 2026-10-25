import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { pwaPlugin } from './build/pwa';
import { singleFileHtmlPlugin } from './build/singlefile';

// GitHub Pages serves the site under /<repo>/; deploy.yml sets GEOMIRA_BASE accordingly.
const base = process.env['GEOMIRA_BASE'] ?? '/';

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The build id the app shows (Help, the version banner): GEOMIRA_BUILD, else the commit. */
function buildId(): string {
  const env = process.env['GEOMIRA_BUILD'];
  if (env !== undefined && env !== '') return env;
  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Two builds (Run 12): the site (`vite build` → dist/, with the PWA's service worker) and the
 * single file (`vite build --mode singlefile` → dist-single/index.html, everything inlined, the
 * test worker included, for use from file://).
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  const build = buildId();
  return {
    base: single ? './' : base,
    define: {
      __GEOMIRA_BUILD__: JSON.stringify(build),
      __GEOMIRA_SINGLE_FILE__: JSON.stringify(single),
    },
    plugins: single
      ? [react(), singleFileHtmlPlugin(path('public/favicon.svg')), viteSingleFile()]
      : [react(), pwaPlugin({ template: path('src/sw/service-worker.ts'), build })],
    ...(single
      ? {
          publicDir: false,
          resolve: {
            alias: [{ find: /^\.\/spawn$/u, replacement: path('src/worker/spawn-inline.ts') }],
          },
        }
      : {}),
    build: {
      outDir: single ? 'dist-single' : 'dist',
      sourcemap: !single,
    },
  };
});
