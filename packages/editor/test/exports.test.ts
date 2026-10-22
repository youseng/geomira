/**
 * The public surface of @geomira/editor (SPEC §12): each subpath and the runtime names it
 * exports. options.ts, robust.ts, checks.ts and order.ts are internal (no subpath).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as stateMod from '../src/state';
import * as editMod from '../src/edit';
import * as resultMod from '../src/result';
import * as historyMod from '../src/history';
import * as toolStateMod from '../src/tool-state';
import * as toolsMod from '../src/tools';
import * as machineMod from '../src/machine';
import * as choiceMod from '../src/choice';
import * as createMod from '../src/create';
import * as dragMod from '../src/drag';
import * as dragEditMod from '../src/drag-edit';
import * as uiEditMod from '../src/ui-edit';
import * as claimEditMod from '../src/claim-edit';
import * as roundingMod from '../src/rounding';
import * as namesMod from '../src/names';
import * as autosaveMod from '../src/autosave';
import * as shareMod from '../src/share';
import * as reportMod from '../src/report';
import * as commandMod from '../src/command';
import * as keymapMod from '../src/keymap';
import * as panelsMod from '../src/panels';
import * as restoreMod from '../src/restore';
import * as randomizeMod from '../src/randomize';
import * as toolGroupsMod from '../src/tool-groups';
import * as promptMod from '../src/prompt';

const SURFACE: Record<string, { module: object; names: string[] }> = {
  './state': {
    module: stateMod,
    names: ['LOG_LENGTH', 'createEditor', 'evaluationOf', 'reevaluate', 'withDocument'],
  },
  './edit': { module: editMod, names: ['applyEdit'] },
  './result': { module: resultMod, names: ['done', 'refuse', 'viewportProblem'] },
  './history': {
    module: historyMod,
    names: ['EMPTY_HISTORY', 'HISTORY_LIMIT', 'amendLast', 'dropLast', 'record', 'redo', 'undo'],
  },
  './tool-state': { module: toolStateMod, names: ['DEFAULT_CLAIM_KIND', 'idleTool'] },
  './tools': { module: toolsMod, names: ['TOOLS', 'toolUI'] },
  './machine': { module: machineMod, names: ['claimToolKinds', 'stepsOf', 'toolInput'] },
  './choice': { module: choiceMod, names: ['ROBUST_SIGMAS', 'chooseSelectors'] },
  './create': {
    module: createMod,
    names: ['createdPoint', 'freePoint', 'gliderAt', 'gridOf', 'intersectionAt'],
  },
  './drag': {
    module: dragMod,
    names: [
      'chainScale',
      'dragBase',
      'dragDefinition',
      'dragGrid',
      'positionOf',
      'roundedDefinition',
      'withinRounding',
    ],
  },
  './drag-edit': { module: dragEditMod, names: ['dragEdit'] },
  './ui-edit': { module: uiEditMod, names: ['uiEdit'] },
  './claim-edit': {
    module: claimEditMod,
    names: ['addAssumption', 'addClaim', 'removeAssumption', 'removeClaim', 'renameClaim'],
  },
  './rounding': {
    module: roundingMod,
    names: [
      'ROUNDING_PX',
      'decimalText',
      'floorLog10',
      'gridExponent',
      'parameterStep',
      'pow10',
      'roundTo',
    ],
  },
  './names': { module: namesMod, names: ['freshName'] },
  './autosave': {
    module: autosaveMod,
    names: ['EMPTY_SLOTS', 'afterEdit', 'openSession', 'restorePrevious', 'save', 'shouldSave'],
  },
  './share': { module: shareMod, names: ['SHARE_PREFIX', 'decodeShare', 'encodeShare'] },
  './report': { module: reportMod, names: ['debugReport'] },
  './command': {
    module: commandMod,
    names: ['MAX_COMPLETIONS', 'acceptCompletion', 'completions', 'runCommand'],
  },
  './keymap': { module: keymapMod, names: ['KEYMAP', 'helpSections', 'keyAction', 'keyText'] },
  './panels': {
    module: panelsMod,
    names: ['claimRows', 'hypothesisRows', 'objectsByLayer', 'statementLines'],
  },
  './restore': { module: restoreMod, names: ['openAtStartup', 'restoreOffer', 'restoredSession'] },
  './randomize': { module: randomizeMod, names: ['randomizeEdit'] },
  './tool-groups': { module: toolGroupsMod, names: ['TOOL_GROUPS', 'keyCap', 'toolGroup'] },
  './prompt': { module: promptMod, names: ['toolPrompt'] },
};

describe('@geomira/editor subpath surface', () => {
  it('package.json exports exactly the root and these subpaths', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', ...Object.keys(SURFACE)].sort());
  });

  it('each subpath file exists and exports exactly its names', () => {
    for (const [path, { module, names }] of Object.entries(SURFACE)) {
      const file = (pkg.exports as Record<string, string>)[path] ?? '';
      expect(existsSync(fileURLToPath(new URL(`../${file}`, import.meta.url))), path).toBe(true);
      expect(Object.keys(module).sort(), path).toEqual([...names].sort());
    }
  });
});
