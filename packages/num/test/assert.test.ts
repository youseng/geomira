import { describe, expect, it } from 'vitest';
import { assertNever } from '../src/assert';

describe('assertNever', () => {
  it('throws on a value that escaped an exhaustive switch', () => {
    const escaped = 'circle' as never;
    expect(() => assertNever(escaped)).toThrow(/unexpected value: "circle"/);
    expect(() => assertNever(escaped, 'kind')).toThrow(/unexpected kind/);
  });
});
