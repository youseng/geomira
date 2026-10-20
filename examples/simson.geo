# Simson line: the feet of the perpendiculars from a point P of the circumcircle to the
# sides of the triangle are collinear. P is a glider on ω.
@version 1
@title "Simson line"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
ω = circumcircle(A, B, C)
P = on(ω, 3, 1)
D = foot(P, B, C)
E = foot(P, C, A)
F = foot(P, A, B)
s = line(D, E) [color=red]
claim collinear(D, E, F) [name=simson]
