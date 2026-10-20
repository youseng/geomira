# Incenter–excenter lemma: the line AI meets the circumcircle again at M, the midpoint of
# the arc BC not containing A; M is equidistant from B, C, the incenter I and the
# A-excenter I_a.
@version 1
@title "Incenter–excenter lemma"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
I = incenter(A, B, C)
I_a = excenter(A, B, C)
ω = circumcircle(A, B, C)
M = intersect(line(A, I), ω, other(A))
claim MB = MC
claim MB = MI
claim MI = MI_a
claim collinear(A, I, I_a)
