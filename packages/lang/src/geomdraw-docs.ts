/**
 * The section of docs/language.md on Geomdraw's notation (ADR-0025): its grammar (ADR-0025
 * carries it verbatim, as ADR-0009 carries the main grammar), and a table of examples whose
 * "read as" column is produced by parsing each example and printing the result, so the
 * documentation cannot drift from the parser.
 */
import type { Registry } from '@geomira/kernel/registry';
import { STYLE_WORD_LIST } from './parse-attrs';
import { TOOL_ALIASES } from './geomdraw';
import { parse } from './parse';
import { print } from './print';

/** The conveniences, as additions to the grammar of ADR-0009 (the canonical text never prints them). */
export const GEOMDRAW_GRAMMAR = `(* ---- Geomdraw's notation (ADR-0025): read; the short notation writes runs and
        branchesStmt (ADR-0061); the canonical text never does ---- *)
statement    += pointsStmt | branchesStmt ;
pointsStmt    = ( "point" | "points" ) , pointName , { pointName } , { attr } ;
                                    (* free points at places drawn from the names *)
branchesStmt  = name , "," , name , "=" , call , { attr } ;
                                    (* a two-candidate call without selectors: the first name
                                       takes along(+) or orient(+), the second along(-) or orient(-) *)
definition   += name , "=" , "point" , "(" , ")" , { attr } ;           (* a free point *)
triangleStmt += "triangle" , pointName , pointName , pointName ,
                { "acute" | "scalene" | "obtuse" | "obtuse_at_" , pointName } , { attr } ;
                                    (* names that exist are used; "obtuse": at the first vertex *)
              | pointName , pointName , pointName , "triangle" , … ;
                                    (* ABC triangle: three glued names, then the word (ADR-0061) *)
primary      += run ;
run           = pointName , pointName , { pointName } ;    (* glued: AB is line(A, B), ABC is
                                       circle(A, B, C), ABCD… polygon(A, B, C, D, …); as an argument
                                       a run is spread into its points where the call or the claim
                                       takes the points and not the line, circle or polygon *)
call         += Capitalised , "(" , [ args ] , ")" ;    (* Midpoint(…) is midpoint(…) *)
tool         += alias ;                                     (* see "Other names"; and a tool
                                       name with "centre" for "center": circumcentre (ADR-0061) *)
attr         += "@" , styleWord ;                           (* @red is [color=red] *)
claim        += expr , { "," , expr } , ( "collinear" | "concyclic" | "cyclic" | "concurrent" )
              | expr , ( "⟂" | "⊥" | "perp" | "perpendicular" | "∥" | "parallel"
                       | "on" | "tangent" ) , expr ;
symbol escapes += "\\perp" = "⟂", "\\parallel" = "∥".
keywords: Triangle, Point, Points, Claim, Assume, Style, Label start a line as in lowercase.`;

/** Examples on one figure: what is written, and (generated) what it is read as. */
const FIGURE = ['A = (1, 2)', 'B = (3, 4)', 'C = (0, 5)', 'D = (2, 7)', 'P = (9, 9)', 'ω = ABC'];

const EXAMPLES: readonly string[] = [
  'points E F',
  'Q = point()',
  'triangle ABC',
  'DPC triangle',
  'M = midpoint(BC)',
  'O = circumcenter(ABC)',
  'I = incentre(ABC)',
  'H = foot(C, AB)',
  'X, Y = intersect(ω, AB)',
  't_1, t_2 = tangents(P, ω)',
  'l = AB @red @dashed',
  'G = Centroid(A, B, C)',
  'claim A, B, C collinear',
  'claim ABCD cyclic',
  'claim AB ⟂ CD',
  'claim AD ∥ BC',
  'claim D on ω',
];

function readAs(registry: Registry, example: string): string {
  const base = new Set(
    print(parse(['@version 1', ...FIGURE].join('\n'), registry).doc).split('\n'),
  );
  const r = parse(['@version 1', ...FIGURE, example].join('\n'), registry);
  const errors = r.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) return `error: ${errors.map((d) => d.message).join('; ')}`;
  return print(r.doc)
    .split('\n')
    .filter((l) => l !== '' && !base.has(l))
    .join(' · ');
}

const cell = (s: string): string => s.replace(/\|/gu, '\\|');

export function geomdrawSection(registry: Registry): string[] {
  return [
    "## Geomdraw's notation",
    '',
    "The notation of the maintainer's earlier Geomdraw is read too (ADR-0025). The CANONICAL text (files, share links, exports) holds only the forms above; the text panel shows the SHORT notation (ADR-0061), which writes a line or circle argument of point names as a run (`foot(C, AB)`), a call of three point names glued (`circumcenter(ABC)`) and the two branches of one call as one statement (`X, Y = intersect(ω, AB)`, `t, u = tangents(P, ω)`), wherever that reads back to the same definition. Both read back to the same figure. The command bar takes several statements separated by `;`. Examples on the figure `" +
      FIGURE.join('; ') +
      '`:',
    '',
    '| written | read as (canonical) |',
    '| --- | --- |',
    ...EXAMPLES.map((e) => `| \`${cell(e)}\` | \`${cell(readAs(registry, e))}\` |`),
    '',
    `Style words: ${STYLE_WORD_LIST.map((w) => `\`@${w}\``).join(', ')}.`,
    '',
    `Other names: ${Object.entries(TOOL_ALIASES)
      .map(([a, t]) => `\`${a}\` = \`${t}\``)
      .join(', ')}.`,
    '',
    '```ebnf',
    GEOMDRAW_GRAMMAR,
    '```',
    '',
  ];
}
