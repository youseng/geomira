import { describe, expect, it } from 'vitest';
import { checkForbiddenWords, findForbiddenWords, stringLiterals } from './forbidden-words';
import { fixtureFiles, where } from './testing';

describe('rule (f): forbidden words', () => {
  it('flags apps/ text and package strings (bad fixture)', () => {
    expect(where(checkForbiddenWords(fixtureFiles('forbidden-words', 'bad')))).toEqual([
      'apps/web/index.html:2',
      'apps/web/src/Verdict.tsx:1',
      'apps/web/src/Verdict.tsx:2',
      'apps/web/src/Verdict.tsx:3',
      'packages/claims/src/verdict.ts:1',
      'packages/claims/src/verdict.ts:2',
      'packages/claims/src/verdict.ts:3',
      'packages/claims/src/verdict.ts:4',
    ]);
  });

  it('ignores comments and identifiers in packages, tests, docs and scripts (good fixture)', () => {
    expect(checkForbiddenWords(fixtureFiles('forbidden-words', 'good'))).toEqual([]);
  });

  it('matches whole words, including camelCase parts', () => {
    const words = (s: string) => findForbiddenWords(s).map((h) => h.word);
    expect(words('Proved. proven, unproven; PROOF proofs')).toEqual([
      'Proved',
      'proven',
      'unproven',
      'PROOF',
      'proofs',
    ]);
    expect(words('isProven ProofBadge')).toEqual(['Proven', 'Proof']);
    expect(words('improved IMPROVED waterproof approval provenance reproof')).toEqual([]);
  });

  it('extracts string, template and JSX text pieces', () => {
    const pieces = stringLiterals(
      'x.tsx',
      "const a = 'one'; const b = `two ${a} three`; const c = <p>four</p>;",
    );
    expect(pieces.map((p) => p.text)).toEqual(["'one'", '`two ${', '} three`', 'four']);
  });
});
