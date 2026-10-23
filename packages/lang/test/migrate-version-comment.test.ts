/**
 * Migrations keep the comment on the `@version` line (bug-fix round, ADR-0028): the
 * framework rewrote the whole line, so `@version 0  # old file` lost its comment.
 */
import { describe, expect, it } from 'vitest';
import { migrateText, type Migration } from '../src/migrate';

const STEP: Migration = { from: 0, to: 1, describe: 'nothing', migrate: (t) => t };

describe('the @version line after a migration', () => {
  it('keeps its comment and its indentation', () => {
    const r = migrateText('@version 0  # old file\nA = (0, 0)', [STEP], 1);
    expect(r.ok && r.text).toBe('@version 1  # old file\nA = (0, 0)');
    const s = migrateText('  @version 0#x\r\nA = (0, 0)', [STEP], 1);
    expect(s.ok && s.text).toBe('  @version 1#x\r\nA = (0, 0)');
  });

  it('without a comment it is as before', () => {
    const r = migrateText('@version 0\nA = (0, 0)', [STEP], 1);
    expect(r.ok && r.text).toBe('@version 1\nA = (0, 0)');
  });
});
