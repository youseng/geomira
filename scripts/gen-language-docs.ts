/** Writes docs/language.md from the grammar, notation tables and registry (`pnpm docs:lang`). */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRegistry } from '../packages/kernel/src/registry';
import { renderLanguageDocs } from '../packages/lang/src/docs';

const target = fileURLToPath(new URL('../docs/language.md', import.meta.url));
writeFileSync(target, renderLanguageDocs(createRegistry()));
process.stdout.write(`wrote ${target}\n`);
