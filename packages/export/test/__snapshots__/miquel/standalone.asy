// GEOMIRA export: Asymptote (standalone). One unit is 41.786165bp (55.714887 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(41.786165);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-5.409645292680986, -5.117632119799227), gm_hi = (8.518409456484985, 5.938658763559328);
pen gmc0 = rgb("1B1F24");

// ---- helpers ----
// A circle: centre c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
// circle meets circle: {orient(-), orient(+)}
pair[] gm_cc(gmcircle a, gmcircle b) {
  pair d = b.c - a.c;
  real s = dot(d, d);
  real x = (s + a.r^2 - b.r^2) / (2 * s);
  real h = sqrt(max(0, a.r^2 - x^2 * s));
  pair n = (-d.y, d.x) / sqrt(s);
  return new pair[] {a.c + x * d - h * n, a.c + x * d + h * n};
}
// other(P): the reflection of P in the line of centres
pair gm_cc_other(gmcircle a, gmcircle b, pair p) { return reflect(a.c, b.c) * p; }
// A point as the canvas draws it: a dot of radius r, outlined in the paper colour, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
path abc = A--B--C--cycle;
pair D = (0.33333333333333304, 0); // numeric
pair E = (3.4, 1.6); // numeric
pair F = (-1.25, 1); // numeric
gmcircle a = gm_circumcircle(A, E, F);
gmcircle b = gm_circumcircle(B, F, D);
gmcircle c = gm_circumcircle(C, D, E);
pair M = gm_cc_other(a, b, F);

// ---- drawing, back to front as on the screen ----
// abc
fill(abc, gmc0 + opacity(0.08));
draw(abc, gmc0 + linewidth(1.125));
// a
draw(circle(a.c, a.r), gmc0 + linewidth(1.125));
// b
draw(circle(b.c, b.r), gmc0 + linewidth(1.125));
// c
draw(circle(c.c, c.r), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.0628198, gmc0, 1);
// B
gm_dot(B, 0.0628198, gmc0, 1);
// C
gm_dot(C, 0.0628198, gmc0, 1);
// D
gm_dot(D, 0.0628198, gmc0, 1);
// E
gm_dot(E, 0.0628198, gmc0, 1);
// F
gm_dot(F, 0.0628198, gmc0, 1);
// M
gm_dot(M, 0.0628198, gmc0, 1);
label("$A$", (0.885776, 4.114224), (-1, 1), gmc0); // label of A
label("$B$", (-2.114224, 0.114224), (-1, 1), gmc0); // label of B
label("$C$", (5.114224, 0.114224), (1, 1), gmc0); // label of C
label("$D$", (0.21911, 0.114224), (-1, 1), gmc0); // label of D
label("$E$", (3.514224, 1.714224), (1, 1), gmc0); // label of E
label("$F$", (-1.364224, 1.114224), (-1, 1), gmc0); // label of F
label("$M$", (0.110554, -0.479828), (-1, 1), gmc0); // label of M
draw(box((-4.189146, -3.897132), (7.29791, 4.718159)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-4.189146, -3.897132), (7.29791, 4.718159)));
