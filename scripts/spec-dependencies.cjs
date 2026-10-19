/**
 * SPEC §2: which workspace packages each package may import (besides itself).
 * Single source for .dependency-cruiser.cjs; scripts/depcruise.test.ts checks it against
 * an independent copy of SPEC §2 and checks every generated rule on a synthetic tree.
 * @type {Record<string, string[]>}
 */
const allowed = {
  num: [],
  kernel: ['num'],
  claims: ['kernel', 'num'],
  lang: ['kernel', 'claims', 'num'],
  scene: ['kernel', 'num'],
  editor: ['kernel', 'claims', 'lang', 'scene', 'num'],
  export: ['scene', 'kernel', 'lang', 'num'],
};

/** npm packages a pure package's src may import (SPEC §12: share links use lz-string). */
const npmAllowed = { editor: ['lz-string'] };

module.exports = { allowed, npmAllowed };
