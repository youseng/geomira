import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as canonical from '../src/canonical';
import * as diagnostic from '../src/diagnostic';
import * as docs from '../src/docs';
import * as grammar from '../src/grammar';
import * as migrate from '../src/migrate';
import * as notation from '../src/notation';
import * as parse from '../src/parse';
import * as parseInto from '../src/parse-into';
import * as print from '../src/print';

/** The public modules of @geomira/lang (ADR-0002, ADR-0009) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './parse': { module: parse, names: ['parse', 'parseDetailed'] },
  './print': { module: print, names: ['print'] },
  './parse-into': { module: parseInto, names: ['parseInto'] },
  './diagnostic': {
    module: diagnostic,
    names: ['error', 'formatDiagnostic', 'hasErrors', 'join', 'warning'],
  },
  './migrate': { module: migrate, names: ['MIGRATIONS', 'migrateText', 'readVersion'] },
  './canonical': {
    module: canonical,
    names: ['canonicalDocument', 'sameUpToIds', 'sortImageRuns', 'stable'],
  },
  './notation': {
    module: notation,
    names: ['ASSUMPTION_NOTATION', 'CLAIM_NOTATION', 'NOTATION_FIGURE'],
  },
  './grammar': { module: grammar, names: ['GRAMMAR'] },
  './docs': { module: docs, names: ['renderLanguageDocs'] },
};

describe('@geomira/lang subpath surface', () => {
  it('package.json exports exactly the root and these subpaths', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
  });

  it('each export target exists', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url))), target).toBe(
        true,
      );
    }
  });

  for (const [path, { module, names }] of Object.entries(SURFACE)) {
    it(`${path} exports exactly its documented names`, () => {
      expect(Object.keys(module).sort()).toEqual([...names].sort());
    });
  }

  it('exported tables are frozen', () => {
    expect(Object.isFrozen(migrate.MIGRATIONS)).toBe(true);
    expect(Object.isFrozen(notation.CLAIM_NOTATION)).toBe(true);
    expect(Object.isFrozen(notation.ASSUMPTION_NOTATION)).toBe(true);
  });
});
