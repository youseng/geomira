/**
 * The notation of every claim kind (ADR-0008) and every assumption kind, as data: the
 * forms the parser reads and the printer writes, with an example of each (the examples
 * are parsed and printed by the tests, and listed in docs/language.md).
 */

export interface NotationEntry {
  readonly kind: string;
  /** The forms, as written in the text. */
  readonly forms: readonly string[];
  /** A complete statement, over the example figure of the docs. */
  readonly example: string;
}

export const CLAIM_NOTATION: readonly NotationEntry[] = Object.freeze([
  { kind: 'collinear', forms: ['collinear(A, B, C, …)'], example: 'claim collinear(O, G, H)' },
  {
    kind: 'concyclic',
    forms: ['concyclic(A, B, C, D, …)'],
    example: 'claim concyclic(A, B, C, P)',
  },
  {
    kind: 'concurrent',
    forms: ['concurrent(l, m, n, …)'],
    example: 'claim concurrent(line(A, H), line(B, H), line(C, H))',
  },
  {
    kind: 'parallel',
    forms: ['parallel(l, m)'],
    example: 'claim parallel(line(M_b, M_c), line(B, C))',
  },
  {
    kind: 'perpendicular',
    forms: ['perpendicular(l, m)'],
    example: 'claim perpendicular(line(A, H), line(B, C))',
  },
  {
    kind: 'equal',
    forms: ['P = Q', 'equal(P, Q)'],
    example: 'claim reflect(H, M_a) = reflect(A, O)',
  },
  { kind: 'on', forms: ['on(P, curve)'], example: 'claim on(M_a, ninepoint_circle(A, B, C))' },
  {
    kind: 'tangent',
    forms: ['tangent(a, b)'],
    example: 'claim tangent(ninepoint_circle(A, B, C), incircle(A, B, C))',
  },
  {
    kind: 'length',
    forms: ['AB = CD', 'AB = k·CD', 'dist(X, Y) = k·dist(Z, W)'],
    example: 'claim GH = 2·OG',
  },
  { kind: 'ratio', forms: ['AB/CD = EF/GH'], example: 'claim AG/GM_a = BG/GM_b' },
  { kind: 'ratio_value', forms: ['AB/CD = k'], example: 'claim AG/GM_a = 2' },
  {
    kind: 'dangle',
    forms: ['∡ABC = ∡DEF', 'n∡ABC = ∡DEF', '∡(X, Y, Z) = ∡(…)'],
    example: 'claim 2∡APB = ∡AOB',
  },
  { kind: 'dangle_lines', forms: ['∡(l, m) = θ'], example: 'claim ∡(line(A, H), line(B, C)) = 90' },
  {
    kind: 'angle_eq',
    forms: ['∠ABC = ∠DEF', 'angle(X, Y, Z) = angle(…)'],
    example: 'claim ∠ABH = ∠ACH',
  },
  { kind: 'angle_sum', forms: ['∠ABC + ∠DEF = θ'], example: 'claim ∠BHC + ∠BAC = 180°' },
  { kind: 'angle_diff', forms: ['∠ABC - ∠DEF = θ'], example: 'claim ∠ABH - ∠ACH = 0' },
  {
    kind: 'cross_ratio',
    forms: ['cross_ratio(A, B, C, D) = k (four collinear or concyclic points)'],
    example: 'claim cross_ratio(B, C, M_a, P) = 2',
  },
  {
    kind: 'harmonic',
    forms: ['harmonic(A, B; C, D) (four collinear or concyclic points)'],
    example: 'claim harmonic(B, C; M_a, P)',
  },
  {
    kind: 'cross_ratio_lines',
    forms: [
      'cross_ratio(a, b, c, d) = k (four concurrent lines)',
      'cross_ratio_lines(a, b, c, d, k)',
    ],
    example: 'claim cross_ratio_lines(line(A, B), line(A, C), line(A, M_a), line(A, H), -1)',
  },
  {
    kind: 'harmonic_lines',
    forms: ['harmonic(a, b; c, d) (four concurrent lines)', 'harmonic_lines(a, b, c, d)'],
    example: 'claim harmonic_lines(line(A, B), line(A, C), line(A, M_a), line(A, H))',
  },
  {
    kind: 'conconic',
    forms: ['conconic(A, B, C, D, E, F, …) (no three collinear)'],
    example: 'claim conconic(A, B, C, H, M_a, P)',
  },
]);

export const ASSUMPTION_NOTATION: readonly NotationEntry[] = Object.freeze([
  { kind: 'acute', forms: ['acute(A, B, C)'], example: 'assume acute(A, B, C)' },
  { kind: 'scalene', forms: ['scalene(A, B, C)'], example: 'assume scalene(A, B, C)' },
  { kind: 'convex', forms: ['convex(A, B, C, D, …)'], example: 'assume convex(A, B, M_a, M_b)' },
  {
    kind: 'inside',
    forms: ['P inside poly', 'inside(P, poly)'],
    example: 'assume H inside polygon(A, B, C)',
  },
  {
    kind: 'in_order',
    forms: ['A, B, C in order on curve', 'in_order(A, B, C, curve)'],
    example: 'assume B, C, A in order on ω',
  },
  {
    kind: 'less',
    forms: ['x < y (x, y: AB, ∠ABC, angle(…), dist(…), numbers)'],
    example: 'assume AB < AC',
  },
  { kind: 'greater', forms: ['x > y'], example: 'assume ∠BAC > 30' },
  { kind: 'not_equal', forms: ['x ≠ y', 'x != y'], example: 'assume AB ≠ AC' },
]);

/** The figure the notation examples refer to (an acute triangle and its classical points). */
export const NOTATION_FIGURE: readonly string[] = Object.freeze([
  'A = (1, 3)',
  'B = (0, 0)',
  'C = (4, 0)',
  'O = circumcenter(A, B, C)',
  'G = centroid(A, B, C)',
  'H = orthocenter(A, B, C)',
  'M_a = midpoint(B, C)',
  'M_b = midpoint(C, A)',
  'M_c = midpoint(A, B)',
  'ω = circumcircle(A, B, C)',
  'P = on(ω, 2, 1)',
]);
