import { violation, type Violation } from './types';

export const TEST_COUNT_FILE = 'docs/test-count.txt';

/** Outcome of counting the Vitest tests of a tree. */
export type TestCount =
  { readonly ok: true; readonly count: number } | { readonly ok: false; readonly error: string };

/** Parses docs/test-count.txt: a single non-negative integer (surrounding whitespace allowed). */
export function parseTestFloor(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/**
 * Rule (c): the total number of Vitest tests may never drop below docs/test-count.txt.
 * A missing or malformed floor, or a failure to count, is itself a violation.
 */
export function checkTestCount(floorText: string | undefined, counted: TestCount): Violation[] {
  const floor = parseTestFloor(floorText);
  if (floor === undefined) {
    const what = floorText === undefined ? 'is missing' : 'must contain one non-negative integer';
    return [violation('test-count', TEST_COUNT_FILE, 0, `${TEST_COUNT_FILE} ${what}`)];
  }
  if (!counted.ok) {
    return [violation('test-count', '.', 0, `could not count tests: ${counted.error}`)];
  }
  if (counted.count < floor) {
    return [
      violation(
        'test-count',
        TEST_COUNT_FILE,
        0,
        `${String(counted.count)} tests, below the floor of ${String(floor)}`,
      ),
    ];
  }
  return [];
}
