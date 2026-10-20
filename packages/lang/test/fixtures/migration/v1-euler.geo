# A version-0 file (fixture: version 0 never existed; the test migration defines it).
# Version 0 spelled the perpendicular bisector "perpendicular_bisector" and wrote
# "assume_hyp" for "assume".
@version 1
A = (1, 4)
B = (-2, 0)
C = (5, 0)
p = perp_bisector(B, C)
q = perp_bisector(C, A)
O = intersect(p, q)
assume acute(A, B, C)
claim on(O, perp_bisector(A, B))
