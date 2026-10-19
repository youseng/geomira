import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo>/; deploy.yml sets GEOMIRA_BASE accordingly.
const base = process.env['GEOMIRA_BASE'] ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
