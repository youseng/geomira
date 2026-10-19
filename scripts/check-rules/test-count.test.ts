import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTestCount, parseTestFloor, TEST_COUNT_FILE } from './test-count';
import { FIXTURES } from './testing';

function floorText(variant: string): string | undefined {
  try {
    return readFileSync(join(FIXTURES, 'test-count', variant, TEST_COUNT_FILE), 'utf8');
  } catch {
    return undefined;
  }
}

describe('rule (c): test-count floor', () => {
  it('fails when the count drops below the floor', () => {
    const found = checkTestCount(floorText('floor-5'), { ok: true, count: 4 });
    expect(found.map((v) => v.message)).toEqual(['4 tests, below the floor of 5']);
  });

  it('passes at or above the floor', () => {
    expect(checkTestCount(floorText('floor-5'), { ok: true, count: 5 })).toEqual([]);
    expect(checkTestCount(floorText('floor-5'), { ok: true, count: 6 })).toEqual([]);
  });

  it('fails on a missing, malformed or negative floor file', () => {
    for (const variant of ['missing', 'malformed', 'negative']) {
      expect(checkTestCount(floorText(variant), { ok: true, count: 100 }), variant).toHaveLength(1);
    }
  });

  it('fails when the tests cannot be counted', () => {
    const found = checkTestCount(floorText('floor-5'), { ok: false, error: 'boom' });
    expect(found.map((v) => v.message)).toEqual(['could not count tests: boom']);
  });

  it('parses the floor strictly', () => {
    expect(parseTestFloor('12\n')).toBe(12);
    expect(parseTestFloor(' 0 ')).toBe(0);
    expect(parseTestFloor('1.5')).toBeUndefined();
    expect(parseTestFloor('')).toBeUndefined();
    expect(parseTestFloor('3 4')).toBeUndefined();
  });
});
