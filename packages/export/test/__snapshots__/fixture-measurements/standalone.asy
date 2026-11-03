// GEOMIRA export: Asymptote (standalone). One unit is 52.5bp (70 px on screen).
// Warning: u is undefined in this figure (coincident points: angle(A, B, C) needs A ≠ B): not drawn
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(52.5);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-3.5428571428571427, -2.4), gm_hi = (7.542857142857143, 6.4);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("B3261E");
pen gmc2 = rgb("1F6FD1");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
gmline gm_segment(pair a, pair b) { return gm_mkline(a, b - a, true, 0, true, 1); }
// The part of a line inside the drawn region gm_lo..gm_hi (as the canvas clips it).
path gm_path(gmline l) {
  real t0 = l.haslo ? l.lo : -realMax, t1 = l.hashi ? l.hi : realMax;
  real[] lo = {gm_lo.x, gm_lo.y}, hi = {gm_hi.x, gm_hi.y}, p = {l.p.x, l.p.y}, d = {l.d.x, l.d.y};
  for (int i = 0; i < 2; ++i) {
    if (d[i] == 0) { if (p[i] < lo[i] || p[i] > hi[i]) return nullpath; continue; }
    real a = (lo[i] - p[i]) / d[i], b = (hi[i] - p[i]) / d[i];
    t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b));
  }
  return t0 <= t1 ? (l.p + t0 * l.d)--(l.p + t1 * l.d) : nullpath;
}
// A point as the canvas draws it: a dot of radius r, outlined in the paper color, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (0, 0);
pair B = (6, 0);
pair C = (1, 4);
pair D = (-2, 3);
gmline s = gm_segment(A, B);
gmline l = gm_line(B, C);

// ---- drawing, back to front as on the screen ----
// s
draw(gm_path(s), gmc0 + linewidth(1.125));
// l
draw(gm_path(l), gmc0 + linewidth(1.125));
// d
// e
// h
// α
draw(arc((0, 0), 0.2, 0, 75.9638), gmc1 + linewidth(1.125));
// β
draw(arc((1, 4), 0.2, -104.0362, -38.6598), gmc0 + linewidth(1.125) + opacity(0.5));
// γ
draw(arc((6, 0), 0.2, 141.3402, 180), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.05, gmc0, 1);
// B
gm_dot(B, 0.05, gmc0, 1);
// C
gm_dot(C, 0.05, gmc0, 1);
// D
gm_dot(D, 0.05, gmc0, 1);
label("6.00", (3, 0.085714), (0, 1), gmc0); // label of d
label("b\textsubscript{1} = 4.123", (0.416845, 2.020789), (-1, 0), gmc2); // label of e
label("3.75", (1.009642, 1.404783), (-1, 0), gmc0); // label of h
label("75.96$^{\circ}$", (0.225202, 0.175832), (1, 1), gmc1); // label of α
label("$\beta$ = 65$^{\circ}$", (1.091377, 3.729292), (0, -1), gmc0 + opacity(0.5)); // label of β
label("38.7$^{\circ}$", (5.730392, 0.094573), (-1, 0), gmc0); // label of γ
label("$A$", (-0.090914, 0.090914), (-1, 1), gmc0); // label of A
label("$B$", (6.090914, 0.090914), (1, 1), gmc0); // label of B
label("$C$", (1.090914, 4.090914), (1, 1), gmc0); // label of C
label("$D$", (-1.909086, 3.090914), (1, 1), gmc0); // label of D
draw(box((-2.571429, -1.428571), (6.571429, 5.428571)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-2.571429, -1.428571), (6.571429, 5.428571)));
