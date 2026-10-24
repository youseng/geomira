import { describe, expect, it } from 'vitest';
import { emptyDocument } from '@geomira/kernel/document';
import { testClaim } from '../src/job';
import { globalVerdict, newCollector, record, type Verdict } from '../src/verdict';
import { verdictLine } from '../src/verdict-line';
import { c, Figure, n, REGISTRY } from './helpers/build';

/**
 * Bug found in the pre-beta review (claims, item 3): in the global regime half the tested
 * figures are mirrored (SPEC §10.4). A construction with a fixed orientation (D = rotate(B, A,
 * −60)) puts D on the other side of AB in every mirrored figure, so `assume convex(A, D, B, C)`
 * almost never holds there, while unmirrored figures satisfy it easily. The verdict said "hard
 * to satisfy: few figures satisfy the hypotheses" and "only m of N figures satisfied the
 * hypotheses", blaming the hypotheses. Acceptance is now measured per orientation, and the
 * verdict names mirroring as the cause. SPEC §10.4 keeps EXACTLY half of the tested figures
 * mirrored, so the test cannot fill the other half with unmirrored figures: the shortfall is
 * stated as such.
 */
function kite(cx: number, cy: number, acLessBc: boolean): { f: Figure; id: number } {
  const f = new Figure()
    .point('A', 0, 0)
    .point('B', 4, 0)
    .point('C', cx, cy)
    .def('D', 'rotate', 'B', 'A', n(-60))
    .assume('convex', 'A', 'D', 'B', 'C')
    .assume('acute', 'A', 'B', 'C');
  if (acLessBc) f.assume('less', c('dist', 'A', 'C'), c('dist', 'B', 'C'));
  return { f, id: f.claim('length', 'A', 'D', 'B', 'D', n(1)) };
}

function global(f: Figure, id: number, seed = 1, nFigures = 200): Verdict {
  const r = testClaim(
    { kind: 'testClaim', regime: 'global', doc: f.doc, claim: id, seed, n: nFigures },
    { registry: REGISTRY },
  );
  if (r.kind !== 'verdict') throw new Error(JSON.stringify(r));
  return r.verdict;
}

describe('a low acceptance caused by mirroring names mirroring (review item 3)', () => {
  it('m2: every figure tested; mirroring named, the hypotheses not called hard to satisfy', () => {
    const { f, id } = kite(2, 6, false);
    const v = global(f, id);
    expect(v.kind).toBe('holds-across');
    expect(v.hardToSatisfy).toBeUndefined();
    expect(v.hardParity).toBe('mirrored');
    expect(v.parity?.mirrored.accepted).toBe(100);
    expect(v.parity?.unmirrored.accepted).toBe(100);
    expect(v.text).not.toContain('hard to satisfy');
    expect(v.text).toContain('mirrored figures rarely satisfy the hypotheses (100 of ');
    expect(v.text).toContain(
      'a construction with a fixed orientation (rotate by a literal angle, orient(±)) makes mirrored figures fail the hypotheses',
    );
    const line = verdictLine(v).text;
    expect(line).not.toContain('hard to satisfy');
    expect(line).toContain('mirrored figures rarely satisfy the hypotheses');
  });

  it('m5: fewer figures tested, stated as the mirrored half, not as hard hypotheses', () => {
    const { f, id } = kite(1.5, 5, true);
    const v = global(f, id);
    expect(v.tested).toBeLessThan(200);
    expect(v.hardParity).toBe('mirrored');
    expect(v.hardToSatisfy).toBeUndefined();
    expect(v.text).not.toContain('hard to satisfy');
    expect(v.text).not.toContain('figures satisfied the hypotheses');
    expect(v.text).toContain(
      `only ${String(v.tested)} of 200 figures tested: half of the tested figures are mirrored, as the global test requires`,
    );
    expect(v.mirrored).toBe(v.tested / 2);
    const line = verdictLine(v).text;
    expect(line).not.toContain('hard to satisfy');
    expect(line).toContain(`only ${String(v.tested)} of 200 figures tested`);
  });

  it('hypotheses hard in both orientations are still "hard to satisfy"', () => {
    const f = new Figure()
      .point('A', 0, 0)
      .point('B', 4, 0)
      .point('C', 1, 3)
      .assume('greater', c('angle', 'B', 'A', 'C'), n(172));
    const id = f.claim('collinear', 'A', c('midpoint', 'A', 'B'), 'B');
    const v = global(f, id, 1, 40);
    expect(v.hardParity).toBeUndefined();
    expect(v.hardToSatisfy).toBe(true);
    expect(v.text).toContain('hard to satisfy: few figures satisfy the hypotheses');
  });
});

describe('the parity notes, built by hand', () => {
  const COMMON = { seed: 3, n: 10, tested: 10, attempts: 400, hardToSatisfy: true };
  function holds(): ReturnType<typeof newCollector> {
    const col = newCollector();
    for (let i = 0; i < 10; i++)
      record(col, { kind: 'true', rung: 'exact over Q' }, () => emptyDocument());
    col.mirrored = 5;
    return col;
  }

  it('unmirrored figures rarely accepted, mirrored ones easily', () => {
    const parity = {
      unmirrored: { attempts: 380, accepted: 5 },
      mirrored: { attempts: 20, accepted: 5 },
    };
    const v = globalVerdict(holds(), { ...COMMON, parity }, { failing: 0, unrepaired: 0, k: 0 });
    expect(v.hardParity).toBe('unmirrored');
    expect(v.text).toBe(
      'HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 10/10; 5 mirrored) · unmirrored figures rarely satisfy the hypotheses (5 of 380 unmirrored attempts, 5 of 20 mirrored attempts): a construction with a fixed orientation (rotate by a literal angle, orient(±)) satisfies the hypotheses mainly in its mirror image · seed 3',
    );
  });

  it('both orientations easy: no note at all', () => {
    const parity = {
      unmirrored: { attempts: 6, accepted: 5 },
      mirrored: { attempts: 7, accepted: 5 },
    };
    const v = globalVerdict(
      holds(),
      { ...COMMON, attempts: 13, hardToSatisfy: false, parity },
      { failing: 0, unrepaired: 0, k: 0 },
    );
    expect(v.hardParity).toBeUndefined();
    expect(v.text).toBe(
      'HOLDS ACROSS THE DECLARED CONFIGURATION (exact over Q, 10/10; 5 mirrored) · seed 3',
    );
  });
});
