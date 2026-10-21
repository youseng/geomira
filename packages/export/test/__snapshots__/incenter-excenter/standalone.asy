// GEOMIRA export: Asymptote (standalone). One unit is 25.657718bp (34.210291 px on screen).
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(25.657718);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-9.841616510762364, -10.813799051457162), gm_hi = (12.841616510762364, 7.19247870789752);
pen gmc0 = rgb("1B1F24");

// ---- helpers ----
// A line p + t*d, t in [lo, hi] where haslo / hashi (a segment: [0, 1]; a ray: [0, oo)).
struct gmline { pair p; pair d; bool haslo; real lo; bool hashi; real hi; }
gmline gm_mkline(pair p, pair d, bool haslo, real lo, bool hashi, real hi) {
  gmline l = new gmline;
  l.p = p; l.d = d; l.haslo = haslo; l.lo = lo; l.hashi = hashi; l.hi = hi;
  return l;
}
gmline gm_line(pair a, pair b) { return gm_mkline(a, b - a, false, 0, false, 0); }
// A circle: center c, radius r.
struct gmcircle { pair c; real r; }
gmcircle gm_mkcircle(pair c, real r) { gmcircle k = new gmcircle; k.c = c; k.r = r; return k; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_incenter(pair a, pair b, pair c) {
  real la = abs(b - c), lb = abs(c - a), lc = abs(a - b);
  return (la * a + lb * b + lc * c) / (la + lb + lc);
}
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
// line meets circle: {along(-), along(+)}
pair[] gm_lc(gmline l, gmcircle k) {
  pair f = gm_foot(k.c, l);
  real h = sqrt(max(0, k.r^2 - abs(f - k.c)^2));
  return new pair[] {f - h * unit(l.d), f + h * unit(l.d)};
}
// other(P): the second intersection, 2F - P (Vieta)
pair gm_lc_other(gmline l, gmcircle k, pair p) { return 2 * gm_foot(k.c, l) - p; }
// A point as the canvas draws it: a dot of radius r, outlined in the paper color, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (1, 4);
pair B = (-2, 0);
pair C = (5, 0);
path abc = A--B--C--cycle;
pair I = gm_incenter(A, B, C);
pair I_a = (1.8284271247461903, -7.65685424949238); // numeric
gmcircle omega = gm_circumcircle(A, B, C);
pair M = gm_lc_other(gm_line(A, I), omega, A);

// ---- drawing, back to front as on the screen ----
// abc
draw(abc, gmc0 + linewidth(1.125));
// ω
draw(circle(omega.c, omega.r), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.1023084, gmc0, 1);
// B
gm_dot(B, 0.1023084, gmc0, 1);
// C
gm_dot(C, 0.1023084, gmc0, 1);
// I
gm_dot(I, 0.1023084, gmc0, 1);
// I_a
gm_dot(I_a, 0.1023084, gmc0, 1);
// M
gm_dot(M, 0.1023084, gmc0, 1);
label("$A$", (0.813975, 4.186025), (-1, 1), gmc0); // label of A
label("$B$", (-2.186025, -0.186025), (-1, -1), gmc0); // label of B
label("$C$", (5.186025, -0.186025), (1, -1), gmc0); // label of C
label("$I$", (1.357598, 1.771811), (1, 1), gmc0); // label of I
label("$I_{a}$", (2.014452, -7.470829), (1, 1), gmc0); // label of I_a
label("$M$", (1.686025, -2.849509), (1, 1), gmc0); // label of M
draw(box((-7.853911, -8.826093), (10.853911, 5.204773)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-7.853911, -8.826093), (10.853911, 5.204773)));
