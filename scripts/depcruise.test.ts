import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cruise, type ICruiseResult, type IForbiddenRuleType } from 'dependency-cruiser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface DepcruiseConfig {
  readonly forbidden: IForbiddenRuleType[];
}

interface SpecDependencies {
  readonly allowed: Record<string, readonly string[]>;
}

const require = createRequire(import.meta.url);
const config = require('../.dependency-cruiser.cjs') as DepcruiseConfig;
const table = require('./spec-dependencies.cjs') as SpecDependencies;
const PACKAGES = ['num', 'kernel', 'claims', 'lang', 'scene', 'editor', 'export', 'discovery'];

/** SPEC §2, restated independently of the config so a config edit cannot weaken both. */
const SPEC: Record<string, readonly string[]> = {
  num: [],
  kernel: ['num'],
  claims: ['kernel', 'num'],
  lang: ['kernel', 'claims', 'num'],
  scene: ['kernel', 'num'],
  editor: ['kernel', 'claims', 'lang', 'scene', 'num', 'discovery'],
  export: ['scene', 'kernel', 'lang', 'num'],
  discovery: ['kernel', 'claims', 'num'],
};

let root: string;
let result: ICruiseResult;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** Builds a tree in which every package imports every other package, plus impure imports. */
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'geomira-depcruise-'));
  write('package.json', '{"name":"t","dependencies":{"fake-lib":"1.0.0","lz-string":"1.0.0"}}');
  for (const name of ['fake-lib', 'lz-string']) {
    write(
      `node_modules/${name}/package.json`,
      `{"name":"${name}","version":"1.0.0","main":"index.js"}`,
    );
    write(`node_modules/${name}/index.js`, 'module.exports = {};\n');
  }
  for (const from of PACKAGES) {
    write(`packages/${from}/src/index.ts`, 'export const VERSION = "0";\n');
    for (const to of PACKAGES.filter((p) => p !== from)) {
      write(`packages/${from}/src/to-${to}.ts`, `export * from '../../${to}/src/index';\n`);
    }
  }
  write('apps/web/src/main.ts', 'export const app = 1;\n');
  write(
    'packages/num/src/uses-node.ts',
    "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n",
  );
  write('packages/kernel/src/uses-npm.ts', "export * from 'fake-lib';\n");
  write('packages/editor/src/share.ts', "export * from 'lz-string';\n");
  write('packages/scene/src/uses-app.ts', "export * from '../../../apps/web/src/main';\n");
  const output = await cruise(['packages', 'apps'], {
    baseDir: root,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  });
  if (typeof output.output === 'string') throw new Error('expected a JSON cruise result');
  result = output.output;
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function violations(prefix: string): string[] {
  return result.summary.violations
    .filter((v) => v.rule.name.startsWith(prefix))
    .map((v) => `${v.from} -> ${v.to}`)
    .sort();
}

describe('dependency-cruiser encodes SPEC §2', () => {
  it('declares exactly the SPEC §2 allowed imports', () => {
    expect(table.allowed).toEqual(SPEC);
  });

  it('flags exactly the package pairs SPEC §2 forbids', () => {
    const expected = PACKAGES.flatMap((from) =>
      PACKAGES.filter((to) => to !== from && !(SPEC[from] ?? []).includes(to)).map(
        (to) => `packages/${from}/src/to-${to}.ts -> packages/${to}/src/index.ts`,
      ),
    ).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(violations('spec2-')).toEqual(expected);
  });

  it('forbids Node built-ins and npm packages in pure packages, except lz-string in editor', () => {
    expect(violations('pure-')).toEqual([
      'packages/kernel/src/uses-npm.ts -> node_modules/fake-lib/index.js',
      'packages/num/src/uses-node.ts -> fs',
    ]);
  });

  it('forbids packages importing apps', () => {
    expect(violations('packages-not-to-apps')).toEqual([
      'packages/scene/src/uses-app.ts -> apps/web/src/main.ts',
    ]);
  });
});
