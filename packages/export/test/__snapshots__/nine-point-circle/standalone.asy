// GEOMIRA export: Asymptote (standalone). One unit is 60bp (80 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(60);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-3.35, -1.8588834764831845), gm_hi = (6.35, 5.841116523516815);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("1F6FD1");

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
pair gm_midpoint(pair a, pair b) { return (a + b) / 2; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
pair gm_foot(pair p, pair a, pair b) { return gm_foot(p, gm_line(a, b)); }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }
// A point as the canvas draws it: a dot of radius r, outlined in the paper colour, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
path abc = A--B--C--cycle;
pair H = gm_orthocenter(A, B, C);
pair M_a = gm_midpoint(B, C);
pair M_b = gm_midpoint(C, A);
pair M_c = gm_midpoint(A, B);
pair D = gm_foot(A, B, C);
pair E = gm_foot(B, C, A);
pair F = gm_foot(C, A, B);
pair X = gm_midpoint(A, H);
pair Y = gm_midpoint(B, H);
pair Z = gm_midpoint(C, H);
gmcircle nu = gm_mkcircle((1.25, 1.75), 1.7677669529663689); // numeric

// ---- drawing, back to front as on the screen ----
// abc
draw(abc, gmc0 + linewidth(1.125));
// ν
draw(circle(nu.c, nu.r), gmc1 + linewidth(1.125));
// A
gm_dot(A, 0.04375, gmc0, 1);
// B
gm_dot(B, 0.04375, gmc0, 1);
// C
gm_dot(C, 0.04375, gmc0, 1);
// H
gm_dot(H, 0.04375, gmc0, 1);
// M_a
gm_dot(M_a, 0.04375, gmc0, 1);
// M_b
gm_dot(M_b, 0.04375, gmc0, 1);
// M_c
gm_dot(M_c, 0.04375, gmc0, 1);
// D
gm_dot(D, 0.04375, gmc0, 1);
// E
gm_dot(E, 0.04375, gmc0, 1);
// F
gm_dot(F, 0.04375, gmc0, 1);
// X
gm_dot(X, 0.04375, gmc0, 1);
// Y
gm_dot(Y, 0.04375, gmc0, 1);
// Z
gm_dot(Z, 0.04375, gmc0, 1);
label("$A$", (1.07955, 4.07955), (1, 1), gmc0); // label of A
label("$B$", (-2.07955, 0.07955), (-1, 1), gmc0); // label of B
label("$C$", (5.07955, 0.07955), (1, 1), gmc0); // label of C
label("$H$", (1.07955, 3.07955), (1, 1), gmc0); // label of H
label("$M_{a}$", (1.42045, 0.07955), (-1, 1), gmc0); // label of M_a
label("$M_{b}$", (3.07955, 2.07955), (1, 1), gmc0); // label of M_b
label("$M_{c}$", (-0.57955, 2.07955), (-1, 1), gmc0); // label of M_c
label("$D$", (1.07955, 0.07955), (1, 1), gmc0); // label of D
label("$E$", (1.57955, 3.57955), (1, 1), gmc0); // label of E
label("$F$", (0.44045, 3.43955), (-1, 1), gmc0); // label of F
label("$X$", (0.92045, 3.57955), (-1, 1), gmc0); // label of X
label("$Y$", (-0.42045, 1.57955), (1, 1), gmc0); // label of Y
label("$Z$", (2.92045, 1.57955), (-1, 1), gmc0); // label of Z
draw(box((-2.5, -1.008883), (5.5, 4.991117)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-2.5, -1.008883), (5.5, 4.991117)));
