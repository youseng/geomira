import { describe, expect, it } from 'vitest';
import { checkDisabledTests } from './disabled-tests';
import { fixtureFiles, where } from './testing';

describe('rule (d): disabled, focused, todo and expected-failure tests', () => {
  it('flags every banned construct in the bad fixture', () => {
    expect(where(checkDisabledTests(fixtureFiles('disabled-tests', 'bad')))).toEqual([
      'apps/web/e2e/fixme.spec.ts:2',
      'apps/web/e2e/fixme.spec.ts:3',
      'packages/kernel/test/conditional.test.ts:2',
      'packages/kernel/test/conditional.test.ts:3',
      'packages/kernel/test/conditional.test.ts:4',
      'packages/kernel/test/fails.test.ts:2',
      'packages/kernel/test/jasmine.test.ts:1',
      'packages/kernel/test/jasmine.test.ts:2',
      'packages/kernel/test/only.test.ts:2',
      'packages/kernel/test/only.test.ts:3',
      'packages/kernel/test/skip.test.ts:2',
      'packages/kernel/test/skip.test.ts:3',
      'packages/kernel/test/todo.test.ts:2',
      'packages/lang/src/lexer.ts:1',
    ]);
  });

  it('accepts look-alike names (good fixture)', () => {
    expect(checkDisabledTests(fixtureFiles('disabled-tests', 'good'))).toEqual([]);
  });
});
