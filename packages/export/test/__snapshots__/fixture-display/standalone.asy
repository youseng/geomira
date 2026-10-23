// GEOMIRA export: Asymptote (standalone). One unit is 30bp (40 px on screen).
// Warning: the color "notacolour" of x_a cannot be read: drawn in the default ink
// Warning: the label of t3 has a character TeX cannot write ("é", U+00E9): written as ?
// Warning: the label of t3 has a character TeX cannot write ("☃", U+2603): written as ?
// Warning: the label of t3* has a character TeX cannot write ("é", U+00E9): written as ?
// Warning: the label of t3* has a character TeX cannot write ("☃", U+2603): written as ?
// Compile with: asy -f pdf <file>.asy
texpreamble("\usepackage{amssymb}");
unitsize(30);
defaultpen(fontsize(11pt) + roundcap + roundjoin);
labelmargin = 0;
pen gm_paper = rgb("FBFBF8");
// The region the screen draws (the view and a margin): lines are cut to it.
pair gm_lo = (-6.350047347805511, -7.7), gm_hi = (13.049952652194488, 7.7);
pen gmc0 = rgb("1B1F24");
pen gmc1 = rgb("2266AA");
pen gmc2 = rgb("FF8C00");
pen gmc3 = rgb("C81E1E");
pen gmc4 = rgb("1F7A1F");

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
gmcircle gm_circler(pair o, real r) { return gm_mkcircle(o, r); }
pair gm_midpoint(pair a, pair b) { return (a + b) / 2; }
pair gm_foot(pair p, gmline l) { return l.p + dot(p - l.p, l.d) / dot(l.d, l.d) * l.d; }
pair gm_foot(pair p, pair a, pair b) { return gm_foot(p, gm_line(a, b)); }
pair gm_circumcenter(pair a, pair b, pair c) {
  pair u = b - a, v = c - a;
  real k = 2 * cross(u, v);
  return a + ((v.y * dot(u, u) - u.y * dot(v, v)) / k, (u.x * dot(v, v) - v.x * dot(u, u)) / k);
}
pair gm_orthocenter(pair a, pair b, pair c) { return a + b + c - 2 * gm_circumcenter(a, b, c); }
gmcircle gm_circumcircle(pair a, pair b, pair c) {
  pair o = gm_circumcenter(a, b, c);
  return gm_mkcircle(o, abs(a - o));
}
transform gm_reflect(gmline l) { return reflect(l.p, l.p + l.d); }
gmline gm_apply(transform t, gmline l) {
  return gm_mkline(t * l.p, t * (l.p + l.d) - t * l.p, l.haslo, l.lo, l.hashi, l.hi);
}
gmcircle gm_apply(transform t, gmcircle k) {
  return gm_mkcircle(t * k.c, k.r * sqrt(abs(t.xx * t.yy - t.xy * t.yx)));
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
// A point as the canvas draws it: a dot of radius r, outlined in the paper color, opacity a.
void gm_dot(pair z, real r, pen p, real a) {
  filldraw(circle(z, r), p + opacity(a), gm_paper + opacity(a) + linewidth(0.75));
}

// ---- the figure ----
pair A = (0, 0);
pair B = (6, 0);
pair C = (1, 4);
pair H = gm_orthocenter(A, B, C);
pair F = gm_foot(C, A, B);
path tri = A--B--C--cycle;
pair M_a = gm_midpoint(B, C);
pair M_ab = gm_midpoint(A, B);
pair Hp = gm_reflect(gm_line(A, B)) * H;
pair A_1pp = gm_midpoint(A, H);
pair P1 = gm_midpoint(A, C);
gmcircle omega = gm_circumcircle(A, B, C);
gmline x_a = gm_line(C, F);
gmcircle nu = gm_circler(H, 1);
transform s = gm_reflect(gm_line(A, B));
pair Cs = s * C;
pair Hs = s * H;
path tris = s * tri;
pair M_as = s * M_a;
pair Hps = s * Hp;
pair A_1pps = s * A_1pp;
pair P1s = s * P1;
gmcircle omegas = gm_apply(s, omega);
gmcircle nus = gm_apply(s, nu);

// ---- drawing, back to front as on the screen ----
// ν
draw(circle(nu.c, nu.r), gmc0 + linewidth(1.125));
// tri
fill(tri, gmc1 + opacity(0.08));
draw(tri, gmc1 + linewidth(1.125));
// ω
draw(circle(omega.c, omega.r), gmc2 + linewidth(1.875) + linetype(new real[] {1.875, 5.25}, false));
// x_a
draw(gm_path(x_a), gmc0 + linewidth(1.125));
// m1
draw((0.5, 0.125)--(0.5, -0.125), gmc0 + linewidth(1.125));
// m2
draw((3.45, 0.125)--(3.45, -0.125), gmc0 + linewidth(1.125));
draw((3.55, 0.125)--(3.55, -0.125), gmc0 + linewidth(1.125));
// m3
draw((3.5, 1.839922)--(3.656174, 2.035139), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false));
draw((3.421913, 1.902391)--(3.578087, 2.097609), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false));
draw((3.343826, 1.964861)--(3.5, 2.160078), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false));
// a1
draw(arc((0, 0), 0.35, 0, 75.9638), gmc0 + linewidth(1.125));
// a2
draw(arc((6, 0), 0.35, 141.3402, 180), gmc3 + linewidth(1.125));
draw(arc((6, 0), 0.45, 141.3402, 180), gmc3 + linewidth(1.125));
// a3
draw(arc((1, 4), 0.35, -104.0362, -38.6598), gmc4 + linewidth(1.125));
draw(arc((1, 4), 0.45, -104.0362, -38.6598), gmc4 + linewidth(1.125));
draw(arc((1, 4), 0.55, -104.0362, -38.6598), gmc4 + linewidth(1.125));
// r1
draw((1.275, 0)--(1.275, 0.275)--(1, 0.275), gmc0 + linewidth(1.125));
// A
gm_dot(A, 0.0875, gmc0, 1);
// B
gm_dot(B, 0.0875, gmc0, 1);
// C
gm_dot(C, 0.0875, gmc0, 1);
// H
gm_dot(H, 0.0875, gmc0, 1);
// F
gm_dot(F, 0.0875, gmc0, 1);
// M_a
gm_dot(M_a, 0.0875, gmc0, 1);
// M_{ab}
gm_dot(M_ab, 0.0875, gmc0, 1);
// H'
gm_dot(Hp, 0.0875, gmc0, 1);
// A_1''
gm_dot(A_1pp, 0.0875, gmc0, 1);
// P1
gm_dot(P1, 0.0875, gmc0, 1);
// t1
// t2
// t3
// ν*
draw(circle(nus.c, nus.r), gmc0 + linewidth(1.125) + opacity(0.5));
// tri*
fill(tris, gmc1 + opacity(0.04));
draw(tris, gmc1 + linewidth(1.125) + opacity(0.5));
// ω*
draw(circle(omegas.c, omegas.r), gmc2 + linewidth(1.875) + linetype(new real[] {1.875, 5.25}, false) + opacity(0.5));
// m3*
draw((3.656174, -2.035139)--(3.5, -1.839922), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false) + opacity(0.5));
draw((3.578087, -2.097609)--(3.421913, -1.902391), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false) + opacity(0.5));
draw((3.5, -2.160078)--(3.343826, -1.964861), gmc0 + linewidth(1.125) + linetype(new real[] {6.75, 5.25}, false) + opacity(0.5));
// a1*
draw(arc((0, 0), 0.35, -75.9638, 0), gmc0 + linewidth(1.125) + opacity(0.5));
// a2*
draw(arc((6, 0), 0.35, 180, 218.6598), gmc3 + linewidth(1.125) + opacity(0.5));
draw(arc((6, 0), 0.45, 180, 218.6598), gmc3 + linewidth(1.125) + opacity(0.5));
// a3*
draw(arc((1, -4), 0.35, 38.6598, 104.0362), gmc4 + linewidth(1.125) + opacity(0.5));
draw(arc((1, -4), 0.45, 38.6598, 104.0362), gmc4 + linewidth(1.125) + opacity(0.5));
draw(arc((1, -4), 0.55, 38.6598, 104.0362), gmc4 + linewidth(1.125) + opacity(0.5));
// r1*
draw((1, -0.275)--(1.275, -0.275)--(1.275, 0), gmc0 + linewidth(1.125) + opacity(0.5));
// C*
gm_dot(Cs, 0.0875, gmc0, 0.5);
// H*
gm_dot(Hs, 0.0875, gmc0, 0.5);
// M_a*
gm_dot(M_as, 0.0875, gmc0, 0.5);
// H'*
gm_dot(Hps, 0.0875, gmc0, 0.5);
// A_1''*
gm_dot(A_1pps, 0.0875, gmc0, 0.5);
// P1*
gm_dot(P1s, 0.0875, gmc0, 0.5);
// t1*
// t2*
// t3*
label("$\nu$-circle", (1.813173, 2.063173), (1, 1), gmc0); // label of ν
label("$A$", (-0.225, 0), (-1, 0), gmc0); // label of A
label("$B$", (6.225, 0), (1, 0), gmc0); // label of B
label("$C$", (0.840901, 4.159099), (-1, 1), gmc0); // label of C
label("$H$", (0.840901, 1.409099), (-1, 1), gmc0); // label of H
label("$F$", (1.159099, 0.159099), (1, 1), gmc0); // label of F
label("$M_{a}$", (3.725, 2), (1, 0), gmc0); // label of M_a
label("$M_{ab}$", (3, -0.35), (0, -1), gmc0); // label of M_{ab}
label("$H'$", (1.159099, -1.090901), (1, 1), gmc0); // label of H'
label("$A_{1}''$", (0.659099, 0.784099), (1, 1), gmc0); // label of A_1''
label("$P1$", (0.340901, 2.159099), (-1, 1), gmc0); // label of P1
label("Let $\omega$ be the circle; $\angle$ACB $\ne$ 90$^{\circ}$, AB $\le$ AC \& 50\% \#1 \{x\} \textasciitilde{}y", (1, 5), (0, 0), gmc0); // label of t1
label("$\ell_{1}$ $\parallel$ $\ell_{2}$ $\perp$ m, $\sqrt{\mbox{3}}$/2 --- done", (7, 3), (0, 0), gmc0); // label of t2
label("caf? ?", (5, -1), (0, 0), gmc0); // label of t3
label("$\nu$-circle\textsuperscript{*}", (1.813173, -0.436827), (1, 1), gmc0 + opacity(0.5)); // label of ν*
label("$C^{*}$", (0.840901, -4.159099), (-1, -1), gmc0 + opacity(0.5)); // label of C*
label("$H^{*}$", (0.840901, -1.409099), (-1, -1), gmc0 + opacity(0.5)); // label of H*
label("$M_{a}^{*}$", (3.5, -1.775), (0, 1), gmc0 + opacity(0.5)); // label of M_a*
label("$H^{\prime *}$", (0.840901, 1.409099), (-1, 1), gmc0 + opacity(0.5)); // label of H'*
label("$A_{1}^{\prime \prime *}$", (0.659099, -0.465901), (1, 1), gmc0 + opacity(0.5)); // label of A_1''*
label("$P1^{*}$", (0.340901, -2.159099), (-1, -1), gmc0 + opacity(0.5)); // label of P1*
label("Let $\omega$ be the circle; $\angle$ACB $\ne$ 90$^{\circ}$, AB $\le$ AC \& 50\% \#1 \{x\} \textasciitilde{}y", (1, -5), (0, 0), gmc0 + opacity(0.5)); // label of t1*
label("$\ell_{1}$ $\parallel$ $\ell_{2}$ $\perp$ m, $\sqrt{\mbox{3}}$/2 --- done", (7, -3), (0, 0), gmc0 + opacity(0.5)); // label of t2*
label("caf? ?", (5, 1), (0, 0), gmc0 + opacity(0.5)); // label of t3*
draw(box((-4.650047, -6), (11.349953, 6)), invisible); // the picture is the view: all of it, nothing outside
clip(box((-4.650047, -6), (11.349953, 6)));
