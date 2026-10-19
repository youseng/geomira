/** Dependency rules of SPEC §2, generated from scripts/spec-dependencies.cjs. */
const { allowed, npmAllowed } = require('./scripts/spec-dependencies.cjs');

const packages = Object.keys(allowed);

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const direction = packages.map((from) => {
  const ok = [from, ...(allowed[from] ?? [])];
  const banned = packages.filter((p) => !ok.includes(p));
  return {
    name: `spec2-${from}`,
    comment: `SPEC §2: ${from} may import only ${ok.join(', ')}.`,
    severity: 'error',
    from: { path: `^packages/${from}/` },
    to: { path: banned.length > 0 ? `^packages/(${banned.join('|')})/` : '^$' },
  };
});

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const purity = packages.map((p) => ({
  name: `pure-${p}-npm`,
  comment: `SPEC §2 / CLAUDE.md: packages/${p}/src imports no npm or Node built-in modules.`,
  severity: 'error',
  from: { path: `^packages/${p}/src/` },
  to: {
    dependencyTypes: [
      'npm',
      'npm-dev',
      'npm-optional',
      'npm-peer',
      'npm-no-pkg',
      'npm-unknown',
      'core',
    ],
    ...((npmAllowed[p] ?? []).length > 0
      ? { pathNot: `node_modules/(${(npmAllowed[p] ?? []).join('|')})/` }
      : {}),
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    ...direction,
    ...purity,
    {
      name: 'packages-not-to-apps',
      comment: 'Packages never import apps.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'src-not-to-dev-deps',
      comment: 'Shipped code must not depend on devDependencies.',
      severity: 'error',
      from: { path: '^(packages/[^/]+|apps/[^/]+)/src/' },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.tests.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
  },
};
