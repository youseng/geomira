import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import * as context from '../src/context';
import * as figureSize from '../src/figure-size';
import * as derived from '../src/derived';
import * as derivedEdit from '../src/derived-edit';
import * as docEdit from '../src/doc-edit';
import * as drag from '../src/drag';
import * as docs from '../src/docs';
import * as document from '../src/document';
import * as edit from '../src/edit';
import * as evaluate from '../src/evaluate';
import * as expr from '../src/expr';
import * as geom from '../src/geom';
import * as glider from '../src/glider';
import * as incidence from '../src/incidence';
import * as invariants from '../src/invariants';
import * as layers from '../src/layers';
import * as names from '../src/names';
import * as registry from '../src/registry';
import * as selector from '../src/selector';
import * as selectorCheck from '../src/selector-check';
import * as similarity from '../src/similarity';
import * as views from '../src/views';
import * as tool from '../src/tool';
import * as value from '../src/value';

/** The public modules of @geomira/kernel (ADR-0002) and the runtime names each exports. */
const SURFACE: Record<string, { module: object; names: string[] }> = {
  './value': {
    module: value,
    names: [
      'CAPABILITIES',
      'DISPLAY_KINDS',
      'VALUE_KINDS',
      'capabilityKinds',
      'hasCapability',
      'isKnownKind',
      'isLine',
      'isNum',
      'isPoint',
      'isPolygon',
      'isUnavailable',
      'numOf',
      'numbersOf',
      'pointOf',
      'undef',
    ],
  },
  './expr': {
    module: expr,
    names: ['call', 'exprEquals', 'lit', 'ref', 'refsOf', 'selectorExprs'],
  },
  './names': {
    module: names,
    names: ['KEYWORDS', 'isImageSuffix', 'isPointName', 'isUserName', 'nameProblem'],
  },
  './document': {
    module: document,
    names: [
      'DOCUMENT_VERSION',
      'MAIN_LAYER_ID',
      'emptyDocument',
      'findLayer',
      'findObject',
      'findObjectByName',
      'mainLayer',
    ],
  },
  './invariants': { module: invariants, names: ['assertInvariants', 'checkInvariants'] },
  './edit': {
    module: edit,
    names: [
      'addObject',
      'applyRemoval',
      'dependents',
      'fail',
      'redefineObject',
      'removeCascade',
      'renameObject',
      'setObjectLayers',
      'setStyle',
    ],
  },
  './layers': { module: layers, names: ['addLayer', 'removeLayer', 'updateLayer'] },
  './tool': { module: tool, names: ['formatSignature'] },
  './registry': { module: registry, names: ['createRegistry', 'rejection'] },
  './context': { module: context, names: ['contextProblem', 'evalContextFor'] },
  './figure-size': { module: figureSize, names: ['figureDiameter'] },
  './evaluate': { module: evaluate, names: ['evaluate', 'evaluateFrom'] },
  './docs': {
    module: docs,
    names: ['exactness', 'exampleDocument', 'formatValue', 'renderToolDocs', 'runExample'],
  },
  './glider': { module: glider, names: ['dragParameter', 'gliderParameter', 'gliderPoint'] },
  './selector': {
    module: selector,
    names: ['formatExpr', 'formatSelector', 'isOrientationDependent', 'selectorClass'],
  },
  './selector-check': {
    module: selectorCheck,
    names: [
      'bareIndexMessage',
      'bareIndexProblem',
      'callDiagnostics',
      'selectorDiagnostics',
      'staticKinds',
    ],
  },
  './similarity': {
    module: similarity,
    names: [
      'applySimilarity',
      'composeSimilarities',
      'inverseSimilarity',
      'mapDirection',
      'mapPoint',
      'scale2',
      'similarity',
      'similarityProblem',
      'transformOf',
    ],
  },
  './derived': {
    module: derived,
    names: [
      'exprKinds',
      'hasImage',
      'imageDef',
      'imagedBy',
      'objectKinds',
      'sourceOf',
      'syncDerived',
      'syncProblems',
    ],
  },
  './derived-edit': {
    module: derivedEdit,
    names: [
      'DEFAULT_SUFFIX',
      'NO_REMOVAL',
      'addDerivedLayer',
      'mergeRemovals',
      'removeRule',
      'ruleProblem',
      'updateRule',
    ],
  },
  './doc-edit': { module: docEdit, names: ['applyDocEdit', 'moveObject', 'reservedName'] },
  './views': { module: views, names: ['addView', 'applyView', 'removeView'] },
  './drag': { module: drag, names: ['dragThrough'] },
  './geom': {
    module: geom,
    names: [
      'abs',
      'half',
      'isZeroNormalized',
      'isZeroVec',
      'signNormalized',
      'two',
      'vAdd',
      'vCross',
      'vDot',
      'vLerp',
      'vRot90',
      'vScale',
      'vSub',
      'vec',
    ],
  },
  './incidence': {
    module: incidence,
    names: ['circleGap', 'requireOnCircle', 'requireOnLine', 'rootGap'],
  },
};

describe('@geomira/kernel subpath surface', () => {
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

  for (const [path, { module, names: expected }] of Object.entries(SURFACE)) {
    it(`${path} exports exactly its documented names`, () => {
      expect(Object.keys(module).sort()).toEqual([...expected].sort());
    });
  }

  it('exported constants are frozen', () => {
    expect(Object.isFrozen(value.CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(value.VALUE_KINDS)).toBe(true);
    expect(Object.isFrozen(names.KEYWORDS)).toBe(true);
    expect(Object.isFrozen(derivedEdit.NO_REMOVAL)).toBe(true);
  });
});
