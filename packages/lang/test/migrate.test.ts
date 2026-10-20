import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOCUMENT_VERSION } from '@geomira/kernel/document';
import { MIGRATIONS, migrateText, readVersion, type Migration } from '../src/migrate';
import { parse } from '../src/parse';
import { print } from '../src/print';
import { registry } from './helpers/lang';

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/migration/${name}`, import.meta.url)), 'utf8');

/** A test migration from a (fictional) version 0: two spellings that changed. */
const V0: Migration = {
  from: 0,
  to: 1,
  describe: 'perpendicular_bisector → perp_bisector; assume_hyp → assume',
  migrate: (t) =>
    t
      .replace(/\bperpendicular_bisector\(/gu, 'perp_bisector(')
      .replace(/^assume_hyp /gmu, 'assume '),
};

describe('versions and migrations (SPEC §11.4)', () => {
  it('fixture: a version-0 file loads as the same document as its version-1 form', () => {
    const old = parse(fixture('v0-euler.geo'), registry, { migrations: [V0] });
    const cur = parse(fixture('v1-euler.geo'), registry);
    expect(old.diagnostics).toEqual([]);
    expect(cur.diagnostics).toEqual([]);
    expect(old.doc).toEqual(cur.doc);
    expect(print(old.doc)).toBe(fixture('v1-euler.geo'));
  });

  it('migrateText rewrites @version and reports what it applied', () => {
    const r = migrateText(fixture('v0-euler.geo'), [V0]);
    expect(r).toMatchObject({
      ok: true,
      from: 0,
      applied: ['0 → 1: perpendicular_bisector → perp_bisector; assume_hyp → assume'],
    });
    expect(r.ok && readVersion(r.text)).toEqual({ version: 1, line: 4 });
  });

  it('chains several steps; refuses gaps, newer files and migrations that lose @version', () => {
    const step = (from: number, to: number): Migration => ({
      from,
      to,
      describe: `${String(from)}→${String(to)}`,
      migrate: (t) => `${t}\n# ${String(from)}`,
    });
    const chained = migrateText('@version 0\nA = (0, 0)', [step(1, 3), step(0, 1)], 3);
    expect(chained).toMatchObject({ ok: true, text: '@version 3\nA = (0, 0)\n# 0\n# 1', from: 0 });
    expect(migrateText('@version 0', [step(1, 2)], 2)).toMatchObject({
      ok: false,
      reason: 'there is no migration from version 0',
      line: 1,
    });
    expect(migrateText('\n@version 5', [], 1)).toMatchObject({ ok: false, line: 2 });
    const lossy: Migration = { from: 0, to: 1, describe: 'x', migrate: () => 'A = (0, 0)' };
    expect(migrateText('@version 0', [lossy], 1).ok).toBe(false);
  });

  it('parse reports a newer or unmigratable file at its @version line and still reads the rest', () => {
    const r = parse('A = (0, 0)\n@version 9', registry);
    expect(r.diagnostics.map((d) => [d.line, d.message])).toEqual([
      [2, 'this file is version 9, newer than this program (version 1)'],
    ]);
    expect(r.doc.objects).toHaveLength(1);
    expect(parse('@version 0\nA = (0, 0)', registry).diagnostics[0]?.message).toBe(
      'there is no migration from version 0',
    );
  });

  it("the language's chain is contiguous and ends at the current version", () => {
    let v = DOCUMENT_VERSION - MIGRATIONS.length;
    for (const m of MIGRATIONS) {
      expect(m.from).toBe(v);
      expect(m.to).toBe(v + 1);
      v = m.to;
    }
    expect(v).toBe(DOCUMENT_VERSION);
  });
});
