import { describe, expect, it } from 'vitest';
import { checkFileLength, countLines, MAX_LINES } from './file-length';
import { fixtureFiles, where } from './testing';

describe('rule (b): file length', () => {
  it('flags files over 400 lines, tests included (bad fixture)', () => {
    expect(where(checkFileLength(fixtureFiles('file-length', 'bad')))).toEqual([
      'apps/web/src/long.css:0',
      'packages/kernel/src/long.ts:0',
      'packages/kernel/test/long.test.ts:0',
    ]);
  });

  it('accepts exactly 400 lines, the lockfile and prose (good fixture)', () => {
    expect(checkFileLength(fixtureFiles('file-length', 'good'))).toEqual([]);
  });

  it('counts lines with or without a final newline', () => {
    expect(MAX_LINES).toBe(400);
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('\n\n')).toBe(2);
  });
});
