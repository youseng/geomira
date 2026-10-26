/**
 * Run 13's tool files have their shards (scripts/mutation-shards.ts V11_A, V11_B): when a file
 * exists it is kernel-a's or kernel-b's and not the catch-all's; when it does not, the catch-all
 * would mutate it (nothing drops out). Each file belongs to exactly one kernel shard either way.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inScope, SHARDS, V11_A, V11_B } from './mutation-shards';

const ROOT = join(import.meta.dirname, '..');

function shard(id: string) {
  const s = SHARDS.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
}

describe('the v1.1 tool files in the mutation shards', () => {
  for (const [id, files] of [
    ['kernel-a', V11_A],
    ['kernel-b', V11_B],
  ] as const) {
    for (const file of files) {
      it(`${file} → ${id} when it exists, else the catch-all`, () => {
        const owners = SHARDS.filter((s) => s.pkg === 'kernel' && inScope(s, file, 1, 1)).map(
          (s) => s.id,
        );
        expect(owners).toEqual([existsSync(join(ROOT, file)) ? id : 'kernel-h']);
        expect(inScope(shard(id), file, 1, 1)).toBe(existsSync(join(ROOT, file)));
      });
    }
  }

  it('the two lists name four distinct tool files', () => {
    expect(new Set([...V11_A, ...V11_B]).size).toBe(4);
    for (const f of [...V11_A, ...V11_B]) expect(f).toMatch(/^packages\/kernel\/src\/tools\//u);
  });
});
