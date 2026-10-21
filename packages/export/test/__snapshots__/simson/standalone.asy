// GEOMIRA export: Asymptote (standalone). One unit is 39.811379bp (53.081839 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(39.811379);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-5.809467888754756, -5.070128060534577), gm_hi = (8.809467888754755, 6.534594154601839);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("FF0000");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
// A circle: centre c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
pair gm_foot(pair p, pair a, pair b) { return gm_foot(p, gm_line(a, b)); }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
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
// A point as the canvas draws it: a dot of radius r, outlined in the paper colour, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
path abc = A--B--C--cycle;
gmcircle omega = gm_circumcircle(A, B, C);
pair P = (-1, 3); // numeric
pair D = gm_foot(P, B, C);
pair E = gm_foot(P, C, A);
pair F = gm_foot(P, A, B);
gmline s = gm_line(D, E);

// ---- drawing, back to front as on the screen ----
// abc
fill(abc, gmc0 + opacity(0.08));
draw(abc, gmc0 + linewidth(1.125));
// ω
draw(circle(omega.c, omega.r), gmc0 + linewidth(1.125));
// s
draw(gm_path(s), gmc1 + linewidth(1.125));
// A
gm_dot(A, 0.0659359, gmc0, 1);
// B
gm_dot(B, 0.0659359, gmc0, 1);
// C
gm_dot(C, 0.0659359, gmc0, 1);
// P
gm_dot(P, 0.0659359, gmc0, 1);
// D
gm_dot(D, 0.0659359, gmc0, 1);
// E
gm_dot(E, 0.0659359, gmc0, 1);
// F
gm_dot(F, 0.0659359, gmc0, 1);
label("$A$", (0.88011, 4.11989), (-1, 1), gmc0); // label of A
label("$B$", (-2.11989, -0.11989), (-1, -1), gmc0); // label of B
label("$C$", (5.11989, -0.11989), (1, -1), gmc0); // label of C
label("$P$", (-1.11989, 3.11989), (-1, 1), gmc0); // label of P
label("$D$", (-1.11989, 0.11989), (-1, 1), gmc0); // label of D
label("$E$", (0.38011, 4.61989), (-1, 1), gmc0); // label of E
label("$F$", (-0.31989, 2.51989), (-1, 1), gmc0); // label of F
draw(box((-4.528427, -3.789087), (7.528427, 5.253553)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-4.528427, -3.789087), (7.528427, 5.253553)));
