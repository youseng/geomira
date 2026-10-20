import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderLanguageDocs } from '../src/docs';
import { GRAMMAR } from '../src/grammar';
import { registry } from './helpers/lang';

describe('the generated language reference (docs/language.md)', () => {
  it('is up to date: run `pnpm docs:lang` after changing the grammar, notation or registry', () => {
    const path = fileURLToPath(new URL('../../../docs/language.md', import.meta.url));
    expect(readFileSync(path, 'utf8')).toBe(renderLanguageDocs(registry));
  });

  it('lists every tool with its exactness observed over RationalField', () => {
    const md = renderLanguageDocs(registry);
    for (const t of registry.tools) expect(md, t.name).toContain(`| \`${t.name}\` |`);
    expect(md).toMatch(/\| `midpoint` \|[^\n]*\| can succeed \|/u);
    expect(md).toMatch(/\| `incenter` \|[^\n]*\| can succeed \| [^\n]*not rational/u);
    expect(md).toMatch(/\| `midpoint` \|[^\n]*\| can succeed \| — \|/u);
  });

  it('ADR-0009 carries the grammar verbatim', () => {
    const adr = readFileSync(
      fileURLToPath(new URL('../../../docs/adr/0009-grammar.md', import.meta.url)),
      'utf8',
    );
    expect(adr).toContain(`\`\`\`ebnf\n${GRAMMAR}\n\`\`\``);
  });
});
