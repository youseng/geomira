/**
 * The single-file build (Run 12, SPEC §1 v1.1): one HTML file that works opened from disk
 * (file://). vite-plugin-singlefile inlines the scripts and styles; the test worker is inlined
 * by replacing spawn.ts with spawn-inline.ts (Vite's `?worker&inline`); this plugin inlines the
 * favicon and removes what only the site has (the web app manifest: no service worker runs from
 * a file).
 */
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** index.html for the single file: the favicon as a data: URL, no manifest link. */
export function singleFileHtml(html: string, faviconSvg: string): string {
  const data = `data:image/svg+xml,${encodeURIComponent(faviconSvg.trim())}`;
  return html
    .replace(/<link rel="manifest"[^>]*>\s*/u, '')
    .replace(/(<link rel="icon" type="image\/svg\+xml" href=")[^"]*(")/u, `$1${data}$2`);
}

export function singleFileHtmlPlugin(faviconPath: string): Plugin {
  return {
    name: 'geomira-single-file-html',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const notices = bundle['third-party-licenses.txt'];
        const index = bundle['index.html'];
        if (notices?.type !== 'asset' || index?.type !== 'asset')
          this.error('Missing standalone dependency notices');
        // Vite collects licences from chunks before we drop the files already inlined by viteSingleFile.
        for (const name of Object.keys(bundle)) {
          if (name.endsWith('.js') || name.endsWith('.css')) Reflect.deleteProperty(bundle, name);
        }
        const text = String(notices.source).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
        index.source = String(index.source).replace(
          '</body>',
          () => `<template id="third-party-licenses"><pre>${text}</pre></template></body>`,
        );
        delete bundle['third-party-licenses.txt'];
      },
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => singleFileHtml(html, readFileSync(faviconPath, 'utf8')),
    },
  };
}
