import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as branchFix from '../src/branch-fix';
import * as find from '../src/find';
import * as hunt from '../src/hunt';
import * as job from '../src/job';
import * as lemmas from '../src/lemmas';
import * as text from '../src/text';
import * as types from '../src/types';

/** The public modules of @geomira/discovery (ADR-0002, ADR-0035) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './types': { module: types, names: ['CONSTRUCTION_SHOWN', 'DEFAULT_FIND_BUDGET', 'claimArgsOf'] },
  './job': { module: job, names: ['runDiscoveryJob'] },
  './find': { module: find, names: ['find', 'runFind', 'withFact'] },
  './hunt': { module: hunt, names: ['DEFAULT_HUNT_BUDGET', 'hunt', 'runHunt'] },
  './branch-fix': {
    module: branchFix,
    names: ['MAX_ASSIGNMENTS', 'assignmentOrder', 'branchFix', 'runBranchFix', 'valueChanged'],
  },
  './lemmas': {
    module: lemmas,
    names: ['EULER', 'LEMMA_TOOLS', 'MIQUEL', 'NINE_POINT', 'RADICAL', 'SIMSON', 'lemmaTag'],
  },
  './text': { module: text, names: ['capLines', 'grouped', 'rungText'] },
};

describe('@geomira/discovery subpath surface', () => {
  it('package.json exports exactly the root and these subpaths', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
  });

  it('each export target exists', () => {
    for (const target of Object.values(pkg.exports))
      expect(existsSync(fileURLToPath(new URL(`../${target}`, import.meta.url))), target).toBe(
        true,
      );
  });

  for (const [path, { module, names }] of Object.entries(SURFACE))
    it(`${path} exports exactly its documented names`, () => {
      expect(Object.keys(module).sort()).toEqual([...names].sort());
    });

  it('exported constants are frozen', () => {
    expect(Object.isFrozen(types.DEFAULT_FIND_BUDGET)).toBe(true);
    expect(Object.isFrozen(hunt.DEFAULT_HUNT_BUDGET)).toBe(true);
    expect(Object.isFrozen(lemmas.LEMMA_TOOLS)).toBe(true);
  });
});
