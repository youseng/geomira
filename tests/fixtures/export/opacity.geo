# The per-object style opacity (ADR-0029) in every export format: points, a segment, a line,
# circles, a filled polygon, angle and segment marks, a text and labels with their own
# opacity, one of them in a layer of opacity 0.5 (the opacities multiply), and images in a
# derived layer that inherit their source's opacity. tex.yml compiles it.
@version 1
@title "Export: opacity"
@layer faint [opacity=0.5]
@layer refl = image(s, main) [suffix=*]
A = (0, 0) [opacity=0.6]
B = (6, 0) [color=red, opacity=0.25]
C = (1, 4)
D = (3, 5) [opacity=0.5] [layers=faint]
tri = polygon(A, B, C) [color=blue, opacity=0.4]
ab = segment(A, B) [width=2, opacity=0.8]
l = line(C, D) [dash=dashed, opacity=0.3]
ω = circumcircle(A, B, C) [color=green, opacity=0.7]
k = circle(D, 1) [color=orange, opacity=0.45, label="k"]
a1 = mark_angle(B, A, C) [opacity=0.5]
m1 = mark_segment(A, C) [opacity=0.35]
t1 = text((4, 6), "faded") [opacity=0.55]
s = reflect(line(A, B))
