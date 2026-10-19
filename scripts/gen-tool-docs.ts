/** Writes docs/tools.md from the tool registry (`pnpm docs:tools`). */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToolDocs } from '../packages/kernel/src/docs';
import { createRegistry } from '../packages/kernel/src/registry';

const target = fileURLToPath(new URL('../docs/tools.md', import.meta.url));
writeFileSync(target, renderToolDocs(createRegistry()));
process.stdout.write(`wrote ${target}\n`);
