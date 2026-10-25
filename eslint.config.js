// @ts-check
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Packages that must stay pure: no DOM, no framework, no module-level mutable state. */
const PURE = 'packages/*/src/**/*.ts';
const TESTS = ['**/*.test.ts', '**/*.test.tsx', '**/e2e/**/*.ts', '**/test/**/*.ts'];

/** Test-API members that disable or focus tests (CLAUDE.md: no .skip/.only/.todo/it.fails). */
const BANNED_TEST_MEMBERS = '^(skip|only|todo|fails|skipIf|runIf)$';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-single/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'reports/**',
      '.stryker-tmp/**',
      'scripts/check-rules/fixtures/**',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './packages/*/tsconfig.json',
          './apps/web/tsconfig.json',
          './tsconfig.tests.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: [PURE],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG (packages/num/src/rng.ts).',
        },
        { object: 'Date', property: 'now', message: 'Pure packages are deterministic.' },
        { object: 'performance', property: 'now', message: 'Pure packages are deterministic.' },
      ],
      'no-restricted-globals': [
        'error',
        ...['Date', 'performance', 'window', 'document', 'navigator', 'localStorage'].map(
          (name) => ({ name, message: `Pure packages must not use ${name}.` }),
        ),
        ...['process', 'setTimeout', 'setInterval', 'requestAnimationFrame'].map((name) => ({
          name,
          message: `Pure packages must not use ${name}.`,
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'zustand'].map((name) => ({
            name,
            message: 'Pure packages import no UI framework.',
          })),
          patterns: [{ group: ['node:*'], message: 'Pure packages import no Node built-ins.' }],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program > VariableDeclaration[kind!="const"]',
          message: 'No module-level mutable state (let/var) in pure packages.',
        },
        {
          selector: 'Program > ExportNamedDeclaration > VariableDeclaration[kind!="const"]',
          message: 'No module-level mutable state (let/var) in pure packages.',
        },
        {
          selector:
            ':matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/]',
          message: 'No module-level caches or singletons in pure packages; use explicit objects.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: TESTS,
    plugins: { vitest },
    rules: {
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: `MemberExpression[property.name=/${BANNED_TEST_MEMBERS}/]`,
          message: 'Disabled, focused, todo or expected-failure tests are forbidden (CLAUDE.md).',
        },
      ],
      '@typescript-eslint/consistent-type-assertions': 'off',
      'max-lines-per-function': 'off',
    },
  },
);
