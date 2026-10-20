# Nine-point circle: the midpoints of the sides, the feet of the altitudes and the
# midpoints of AH, BH, CH lie on one circle.
@version 1
@title "Nine-point circle"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
H = orthocenter(A, B, C)
M_a = midpoint(B, C)
M_b = midpoint(C, A)
M_c = midpoint(A, B)
D = foot(A, B, C)
E = foot(B, C, A)
F = foot(C, A, B)
X = midpoint(A, H)
Y = midpoint(B, H)
Z = midpoint(C, H)
ν = ninepoint_circle(A, B, C) [color=blue]
claim concyclic(M_a, M_b, M_c, D, E, F, X, Y, Z)
claim on(D, ν)
claim on(X, ν)
