/**
 * ADR-0050: lines, segments, rays, circles and tangents a GUI tool builds from named points
 * are named from those points (line(A, C) is l_AC); the rules: grammatical (nameProblem),
 * at most MAX_DESCRIPTIVE_NAME code points, the next free variant base_2, base_3, … when
 * taken, else the usual rule of names.ts (l, l_1, …); conventional names (ADR-0016) win;
 * existing objects are never renamed.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isPointName, nameProblem } from '@geomira/kernel/names';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import {
  descriptiveBase,
  descriptiveName,
  MAX_DESCRIPTIVE_NAME,
  wantedName,
} from '../src/descriptive-names';
import type { ToolInput } from '../src/machine';
import type { EditorState } from '../src/state';
import type { ToolId } from '../src/tool-state';
import {
  addedNames,
  click,
  defText,
  docOf,
  edit,
  editorOf,
  idOf,
  input,
  registry,
  useTool,
} from './helpers/editor';

const FIG = [
  'A = (0, 0)',
  'B = (4, 0)',
  'C = (1, 3)',
  'P = (6, 0)',
  'O = (-3, -3)',
  'm = line(A, B)',
  'k = circle(A, C)',
].join('\n');

/** The names a tool adds when its picks are the objects named `picks`, in order. */
function names(tool: ToolId, picks: readonly string[], fig = FIG): string[] {
  const start = editorOf(fig);
  let s = useTool(start, tool);
  for (const p of picks) s = input(s, { kind: 'object', id: idOf(s, p) });
  expect(s.toolState.picks).toEqual([]);
  return addedNames(start, s);
}

function run(s: EditorState, ...inputs: ToolInput[]): EditorState {
  return inputs.reduce((t, i) => input(t, i), s);
}

describe('each tool names what it builds from its points', () => {
  const cases: [ToolId, string[], string[], string][] = [
    ['line', ['A', 'C'], ['l_AC'], 'line(A, C)'],
    ['line', ['C', 'A'], ['l_CA'], 'line(C, A)'],
    ['segment', ['A', 'C'], ['s_AC'], 'segment(A, C)'],
    ['ray', ['A', 'C'], ['r_AC'], 'ray(A, C)'],
    ['circle3', ['A', 'B', 'C'], ['c_ABC'], 'circle(A, B, C)'],
    ['circle', ['O', 'A'], ['c_O'], 'circle(O, A)'],
    ['circle_radius', ['O'], ['c_O'], 'circle(O, 1)'],
    ['perpendicular', ['P', 'm'], ['l_P'], 'perp(P, m)'],
    ['perpendicular', ['m', 'P'], ['l_P'], 'perp(P, m)'],
    ['parallel', ['C', 'm'], ['l_C'], 'parallel(C, m)'],
    ['tangent', ['C', 'k'], ['t_C'], 'tangent(C, k)'],
    ['tangent', ['k', 'C'], ['t_C'], 'tangent(C, k)'],
  ];
  for (const [tool, picks, added, def] of cases)
    it(`${tool} on ${picks.join(', ')} is ${added.join(', ')} = ${def}`, () => {
      expect(names(tool, picks)).toEqual(added);
      let s = useTool(editorOf(FIG), tool);
      for (const p of picks) s = input(s, { kind: 'object', id: idOf(s, p) });
      expect(defText(s, added[0] ?? '?')).toBe(def);
    });

  it('both tangents from an outside point are t_P and t_P_2, in one history entry', () => {
    let s = useTool(editorOf(FIG), 'tangent');
    s = run(s, { kind: 'object', id: idOf(s, 'P') }, { kind: 'object', id: idOf(s, 'k') });
    expect(addedNames(editorOf(FIG), s)).toEqual(['t_P', 't_P_2']);
    expect(s.history.past).toHaveLength(1);
    expect(defText(s, 't_P')).toMatch(/^tangent_from\(P, k, .+\)$/u);
    expect(defText(s, 't_P_2')).toMatch(/^tangent_from\(P, k, .+\)$/u);
  });

  it('a second line through P is l_P_2, a third l_P_3', () => {
    let s = useTool(editorOf(FIG), 'perpendicular');
    s = run(s, { kind: 'object', id: idOf(s, 'P') }, { kind: 'object', id: idOf(s, 'm') });
    s = useTool(s, 'parallel');
    s = run(s, { kind: 'object', id: idOf(s, 'P') }, { kind: 'object', id: idOf(s, 'm') });
    s = useTool(s, 'perpendicular');
    s = run(s, { kind: 'object', id: idOf(s, 'P') }, { kind: 'object', id: idOf(s, 'l_P_2') });
    expect(addedNames(editorOf(FIG), s)).toEqual(['l_P', 'l_P_2', 'l_P_3']);
    expect(defText(s, 'l_P_2')).toBe('parallel(P, m)');
    expect(defText(s, 'l_P_3')).toBe('perp(P, l_P_2)');
  });

  it('a polygon side clicked where a line is wanted is s_AB, as the Segment tool names it', () => {
    const tri = `${FIG}\ntri = polygon(A, B, C)`;
    let s = useTool(editorOf(tri), 'perpendicular');
    s = input(s, click(s, 2.5, 1.5));
    s = input(s, { kind: 'object', id: idOf(s, 'A') });
    expect(addedNames(editorOf(tri), s)).toEqual(['s_BC', 'l_A']);
    expect(defText(s, 's_BC')).toBe('segment(B, C)');
    expect(defText(s, 'l_A')).toBe('perp(A, s_BC)');
  });

  it('a point a click creates is named first, then the line from it', () => {
    let s = useTool(editorOf(FIG), 'line');
    s = run(s, { kind: 'object', id: idOf(s, 'A') }, click(s, -2, 4));
    expect(addedNames(editorOf(FIG), s)).toEqual(['D', 'l_AD']);
  });
});

describe('points with subscripts and primes', () => {
  const fig = [
    'A_1 = (0, 0)',
    'B_1 = (4, 0)',
    'C_12 = (1, 3)',
    'M_a = (2, 5)',
    "H' = (-2, 5)",
    'A1 = (5, 5)',
    'B = (-4, 1)',
  ].join('\n');
  it('a grammatical glued form: l_A_1B_1, l_M_aB, l_A1B', () => {
    expect(names('line', ['A_1', 'B_1'], fig)).toEqual(['l_A_1B_1']);
    expect(names('line', ['M_a', 'B'], fig)).toEqual(['l_M_aB']);
    expect(names('line', ['A1', 'B'], fig)).toEqual(['l_A1B']);
  });

  it("a prime only at the end: l_BH' is grammatical, l_H'B is not (the usual l)", () => {
    expect(names('line', ['B', "H'"], fig)).toEqual(["l_BH'"]);
    expect(names('line', ["H'", 'B'], fig)).toEqual(['l']);
    expect(names('tangent', ["H'", 'k'], `${fig}\nk = circle(B, H')`)).toEqual(["t_H'"]);
  });

  it('a taken name ending in a prime has no grammatical variant: the usual l', () => {
    expect(names('line', ['B', "H'"], `${fig}\nl_BH' = line(A_1, B_1)`)).toEqual(['l']);
  });

  it(`at most ${String(MAX_DESCRIPTIVE_NAME)} characters: c_A_1B_1C_12 is used, longer is not`, () => {
    expect(names('circle3', ['A_1', 'B_1', 'C_12'], fig)).toEqual(['c_A_1B_1C_12']);
    const long = `${fig}\nA_12 = (7, 1)\nB_12 = (8, 3)`;
    expect(names('circle3', ['A_12', 'B_12', 'C_12'], long)).toEqual(['c']);
  });
});

describe('fallbacks to the usual rule (names.ts)', () => {
  it('a point not named by the point grammar asks for no descriptive name', () => {
    const fig = `${FIG}\np = (2, 5)\nM_{ab} = (-2, 5)`;
    expect(names('line', ['p', 'A'], fig)).toEqual(['l']);
    expect(names('line', ['M_{ab}', 'A'], fig)).toEqual(['l']);
    expect(names('circle', ['p', 'A'], fig)).toEqual(['c']);
    expect(names('perpendicular', ['p', 'm'], fig)).toEqual(['l']);
    // A managed image A* (ADR-0003) or a missing name gives none either.
    const d = { prefix: 'l', picks: 'all' } as const;
    expect(descriptiveBase(d, ['A*', 'B'])).toBeUndefined();
    expect(descriptiveBase(d, [undefined, 'B'])).toBeUndefined();
    expect(descriptiveBase(d, [])).toBeUndefined();
  });

  it('tools outside ADR-0050 keep the usual names (their points would misname them)', () => {
    expect(names('perp_bisector', ['A', 'B'])).toEqual(['l']);
    expect(names('bisector', ['A', 'B', 'C'])).toEqual(['l']);
    expect(names('diameter_circle', ['A', 'B'])).toEqual(['c']);
    expect(names('conic5', ['A', 'B', 'C', 'P', 'O'])).toEqual(['c']);
  });
});

describe('collisions: the next free variant', () => {
  it('taken by an object, a claim or a layer: base_2, then base_3', () => {
    expect(names('line', ['A', 'C'], `${FIG}\nl_AC = line(B, C)`)).toEqual(['l_AC_2']);
    const both = `${FIG}\nl_AC = line(B, C)\nl_AC_2 = line(B, P)`;
    expect(names('line', ['A', 'C'], both)).toEqual(['l_AC_3']);
    const claim = `${FIG}\nclaim collinear(A, B, P) [name=s_AC]`;
    expect(names('segment', ['A', 'C'], claim)).toEqual(['s_AC_2']);
    expect(names('ray', ['A', 'C'], `${FIG}\n@layer r_AC`)).toEqual(['r_AC_2']);
  });

  it('the same construction again is reused, not named again (ADR-0029)', () => {
    const fig = `${FIG}\nl_AC = line(A, C)`;
    expect(names('line', ['C', 'A'], fig)).toEqual([]);
  });
});

describe('conventional names still win (ADR-0016 decision 23)', () => {
  it('the circumcircle is ω when free, else the usual c (as ADR-0016 states)', () => {
    expect(names('circumcircle', ['A', 'B', 'C'])).toEqual(['ω']);
    expect(names('circumcircle', ['A', 'B', 'C'], `${FIG}\nω = circle(A, 1)`)).toEqual(['c']);
  });

  it('wantedName: a free conventional name first, then the descriptive one', () => {
    const doc = docOf(FIG);
    const d = { prefix: 'c', picks: 'all' } as const;
    expect(wantedName(doc, 'ω', d, ['A', 'B', 'C'])).toBe('ω');
    expect(wantedName(docOf(`${FIG}\nω = circle(A, 1)`), 'ω', d, ['A', 'B', 'C'])).toBe('c_ABC');
    expect(wantedName(doc, undefined, d, ['A', 'B', 'C'])).toBe('c_ABC');
    expect(wantedName(doc, undefined, undefined, ['A'])).toBeUndefined();
  });
});

describe('existing objects are never renamed', () => {
  it('renaming a point later keeps the name of the line built from it', () => {
    let s = useTool(editorOf(FIG), 'line');
    s = run(s, { kind: 'object', id: idOf(s, 'A') }, { kind: 'object', id: idOf(s, 'C') });
    s = edit(s, { kind: 'rename', id: idOf(s, 'A'), name: 'X' });
    expect(defText(s, 'l_AC')).toBe('line(X, C)');
  });

  it('building leaves every other object’s name as it was', () => {
    const start = editorOf(FIG);
    let s = useTool(start, 'circle3');
    s = run(s, ...['A', 'B', 'C'].map((n): ToolInput => ({ kind: 'object', id: idOf(s, n) })));
    expect(s.doc.objects.slice(0, start.doc.objects.length).map((o) => o.name)).toEqual(
      start.doc.objects.map((o) => o.name),
    );
  });
});

describe('the names are grammatical and round-trip through the language (P1, P2)', () => {
  it('a figure built with every tool prints and parses back to the same names', () => {
    let s = editorOf(`${FIG}\nA_1 = (3, 3)\nM_a = (-1, 4)`);
    const builds: [ToolId, string[]][] = [
      ['line', ['A_1', 'M_a']],
      ['segment', ['A', 'C']],
      ['ray', ['C', 'A']],
      ['circle3', ['A', 'B', 'C']],
      ['circle', ['O', 'A']],
      ['perpendicular', ['P', 'm']],
      ['parallel', ['P', 'm']],
      ['tangent', ['C', 'k']],
    ];
    for (const [tool, picks] of builds) {
      s = useTool(s, tool);
      for (const p of picks) s = input(s, { kind: 'object', id: idOf(s, p) });
    }
    const text = print(s.doc);
    for (const n of ['l_A_1M_a', 's_AC', 'r_CA', 'c_ABC', 'c_O', 'l_P', 'l_P_2', 't_C'])
      expect(text).toContain(`\n${n} = `);
    const back = parse(text, registry);
    expect(back.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(back.doc.objects.map((o) => o.name)).toEqual(s.doc.objects.map((o) => o.name));
    expect(print(back.doc)).toBe(text);
  });

  const letter = fc.constantFrom('A', 'B', 'C', 'D', 'H', 'M', 'O', 'P', 'Q');
  const pointName = fc.oneof(
    letter,
    fc.tuple(letter, fc.integer({ min: 0, max: 99 })).map(([l, n]) => `${l}_${String(n)}`),
    fc.tuple(letter, fc.integer({ min: 0, max: 9 })).map(([l, n]) => `${l}${String(n)}`),
    fc.tuple(letter, fc.constantFrom('a', 'b', 'c')).map(([l, s]) => `${l}_${s}`),
    fc.tuple(letter, fc.integer({ min: 1, max: 2 })).map(([l, n]) => l + "'".repeat(n)),
    letter.map((l) => `${l}_{ab}`),
  );
  const prefix = fc.constantFrom('l', 's', 'r', 'c', 't');

  it('law: every descriptive name is grammatical, short, and reads back as that one name', () => {
    fc.assert(
      fc.property(prefix, fc.array(pointName, { minLength: 1, maxLength: 3 }), (p, pts) => {
        expect(pts.every(isPointName)).toBe(true);
        const n = descriptiveBase({ prefix: p, picks: 'all' }, pts);
        if (n === undefined) return;
        expect(nameProblem(n)).toBeUndefined();
        expect(Array.from(n).length).toBeLessThanOrEqual(MAX_DESCRIPTIVE_NAME);
        expect(n).toBe(`${p}_${pts.join('')}`);
        expect(docOf(`${n} = 1`).objects.map((o) => o.name)).toEqual([n]);
      }),
      { seed: 50, numRuns: 400 },
    );
  });

  it('law: a variant of a taken name is grammatical and free, or there is none', () => {
    fc.assert(
      fc.property(fc.array(pointName, { minLength: 2, maxLength: 2 }), (pts) => {
        const base = descriptiveBase({ prefix: 'l', picks: 'all' }, pts);
        if (base === undefined) return;
        const doc = docOf(`${base} = 1`);
        const v = descriptiveName(doc, { prefix: 'l', picks: 'all' }, pts);
        if (v === undefined) expect(base.endsWith("'")).toBe(true);
        else expect([v, nameProblem(v)]).toEqual([`${base}_2`, undefined]);
      }),
      { seed: 51, numRuns: 200 },
    );
  });
});
