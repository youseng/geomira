import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

/** The repository ESLint config, with type-aware rules off so virtual files can be linted. */
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

async function ruleIds(path: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, path) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const PURE = 'packages/num/src/probe.ts';
const TEST = 'packages/num/test/probe.test.ts';

describe('lint guards: pure packages', () => {
  const cases: [string, string, string][] = [
    ['Math.random', 'export const r = Math.random();\n', 'no-restricted-properties'],
    ['Date.now', 'export const t = Date.now();\n', 'no-restricted-properties'],
    ['new Date', 'export const d = new Date();\n', 'no-restricted-globals'],
    ['performance.now', 'export const p = performance.now();\n', 'no-restricted-properties'],
    ['window', 'export const w = window;\n', 'no-restricted-globals'],
    ['module-level let', 'export let counter = 0;\n', 'no-restricted-syntax'],
    ['module-level var', 'var counter = 0;\nexport const c = counter;\n', 'no-restricted-syntax'],
    [
      'module-level cache',
      'const cache = new Map<string, number>();\nexport const c = cache;\n',
      'no-restricted-syntax',
    ],
    [
      'react import',
      "import { useState } from 'react';\nexport const u = useState;\n",
      'no-restricted-imports',
    ],
    [
      'node import',
      "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n",
      'no-restricted-imports',
    ],
    ['any', 'export const f = (x: any) => x;\n', '@typescript-eslint/no-explicit-any'],
    [
      'as cast',
      'export const f = (x: unknown) => x as number;\n',
      '@typescript-eslint/consistent-type-assertions',
    ],
  ];
  for (const [name, code, rule] of cases) {
    it(`rejects ${name}`, async () => {
      expect(await ruleIds(PURE, code)).toContain(rule);
    });
  }

  it('accepts deterministic code with const data and local state', async () => {
    const code = [
      'export const TABLE = [1, 2, 3] as const;',
      'export function sum(xs: readonly number[]): number {',
      '  let total = 0;',
      '  for (const x of xs) total += x;',
      '  return total;',
      '}',
      '',
    ].join('\n');
    expect(await ruleIds(PURE, code)).toEqual([]);
  });

  it('requires a description on eslint-disable comments', async () => {
    const code =
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const f = (x: any) => x;\n';
    expect(await ruleIds(PURE, code)).toContain(
      '@eslint-community/eslint-comments/require-description',
    );
  });

  it('does not apply the purity bans to apps/web', async () => {
    expect(
      await ruleIds('apps/web/src/probe.ts', 'export const r = Math.random() + Date.now();\n'),
    ).toEqual([]);
  });
});

describe('lint guards: tests', () => {
  // Snippets are assembled from parts so this file does not itself trip `pnpm rules` (d).
  const banned: [string, string, string][] = [
    ['it', 'skip', "('a', () => {});"],
    ['it', 'only', "('a', () => {});"],
    ['it', 'todo', "('a');"],
    ['it', 'fails', "('a', () => {});"],
    ['describe', 'skip', "('a', () => {});"],
    ['it', 'skipIf', "(true)('a', () => {});"],
    ['describe', 'runIf', "(true)('a', () => {});"],
  ];
  for (const [obj, modifier, rest] of banned) {
    const line = [obj, modifier].join('.') + rest;
    it(`rejects ${obj} ${modifier}`, async () => {
      const code = `import { describe, it } from 'vitest';\n${line}\nexport const d = describe;\n`;
      const ids = await ruleIds(TEST, code);
      expect(ids.some((id) => id === 'no-restricted-syntax' || id.startsWith('vitest/'))).toBe(
        true,
      );
    });
  }

  it('accepts a plain test', async () => {
    const code =
      "import { expect, it } from 'vitest';\nit('a', () => {\n  expect(1).toBe(1);\n});\n";
    expect(await ruleIds(TEST, code)).toEqual([]);
  });
});
