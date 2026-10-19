/** Prints the exactness table of the registry (`pnpm docs:exactness`, pasted into STATUS). */
import { createRegistry } from '../packages/kernel/src/registry';
import { renderExactnessTable } from './exactness/table';

process.stdout.write(`${renderExactnessTable(createRegistry())}\n`);
