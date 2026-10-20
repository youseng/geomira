# Miquel's theorem: for points D, E, F on the sides BC, CA, AB, the circles AEF, BFD and
# CDE pass through one point M.
@version 1
@title "Miquel point"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
D = on(segment(B, C), 1/3)
E = on(segment(C, A), 2/5)
F = on(segment(A, B), 3/4)
a = circle(A, E, F)
b = circle(B, F, D)
c = circle(C, D, E)
M = intersect(a, b, other(F))
claim on(M, c) [name=miquel]
claim concyclic(C, D, E, M)
