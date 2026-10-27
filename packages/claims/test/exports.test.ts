import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as check from '../src/check';
import * as constants from '../src/constants';
import * as evalClaim from '../src/eval-claim';
import * as hypotheses from '../src/hypotheses';
import * as job from '../src/job';
import * as kind from '../src/kind';
import * as kinds from '../src/kinds';
import * as ndg from '../src/ndg';
import * as rungs from '../src/rungs';
import * as verdict from '../src/verdict';
import * as verdictLine from '../src/verdict-line';
import * as figureHypotheses from '../src/figure-hypotheses';
import * as randomize from '../src/randomize';
import * as kindRegistry from '../src/kind-registry';
import * as screen from '../src/screen';
import * as symmetry from '../src/symmetry';
import * as free from '../src/free';
import * as exprPath from '../src/expr-path';

/** The public modules of @geomira/claims (ADR-0002, ADR-0008) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './check': { module: check, names: ['argProblem', 'claimProblem'] },
  './kinds': { module: kinds, names: ['CLAIM_KINDS', 'POLYNOMIAL_KINDS', 'claimKind'] },
  './kind': {
    module: kind,
    names: [
      'argLabel',
      'badClaim',
      'circleAt',
      'distinctAll',
      'fitsParam',
      'formatClaimMessage',
      'isLiteralParam',
      'lineAt',
      'litAt',
      'pairs',
      'paramAt',
      'pointAt',
      'pointsFrom',
    ],
  },
  './ndg': { module: ndg, names: ['ndgFailure', 'ndgStatus'] },
  './hypotheses': {
    module: hypotheses,
    names: ['ASSUMPTION_KINDS', 'assumptionProblem', 'checkAssumption', 'comparisonDim'],
  },
  './eval-claim': { module: evalClaim, names: ['evalClaim', 'valueOf'] },
  './job': { module: job, names: ['runJob', 'testClaim'] },
  './verdict': {
    module: verdict,
    names: ['globalVerdict', 'localVerdict', 'newCollector', 'record'],
  },
  './verdict-line': { module: verdictLine, names: ['verdictLine'] },
  './figure-hypotheses': {
    module: figureHypotheses,
    names: ['assumptionText', 'hypothesesInFigure'],
  },
  './randomize': {
    module: randomize,
    names: [
      'OBTUSE_MIN_DEG',
      'RANDOMIZE_ATTEMPTS',
      'SHAPE_MIN_DEG',
      'TRIANGLE_TYPES',
      'randomFigure',
    ],
  },
  './kind-registry': { module: kindRegistry, names: ['claimKindRegistry'] },
  './screen': { module: screen, names: ['screenFigure', 'screenSteps'] },
  './free': { module: free, names: ['findFree', 'readFree', 'writeFree'] },
  './expr-path': {
    module: exprPath,
    names: ['callsOf', 'children', 'exprAt', 'flipSelector', 'replaceAt'],
  },
  './symmetry': { module: symmetry, names: ['claimKey', 'orbit', 'transposition'] },
  './rungs': { module: rungs, names: ['RUNG_NAMES', 'claimArgs', 'decideSample', 'floatValues'] },
  './constants': {
    module: constants,
    names: [
      'EXACT_BUDGET_BITS',
      'GLOBAL_SIGMA',
      'GRID_BITS',
      'HARD_ACCEPTANCE',
      'LOCAL_SIGMA',
      'MAX_ANGLE_MULTIPLE',
      'MIN_VALID_FRACTION',
      'RETRY_FACTOR',
      'SIMILARITY_OCTAVES',
    ],
  },
};

describe('@geomira/claims subpath surface', () => {
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

  it('exported constants are frozen', () => {
    expect(Object.isFrozen(kinds.CLAIM_KINDS)).toBe(true);
    expect(Object.isFrozen(kinds.POLYNOMIAL_KINDS)).toBe(true);
    expect(Object.isFrozen(hypotheses.ASSUMPTION_KINDS)).toBe(true);
    expect(Object.isFrozen(rungs.RUNG_NAMES)).toBe(true);
    expect(Object.isFrozen(randomize.TRIANGLE_TYPES)).toBe(true);
  });
});
