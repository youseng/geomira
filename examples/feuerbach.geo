# Feuerbach's theorem: the nine-point circle touches the incircle and the three
# excircles.
@version 1
@title "Feuerbach"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
ν = ninepoint_circle(A, B, C) [color=blue]
i = incircle(A, B, C)
x_a = excircle(A, B, C)
x_b = excircle(B, C, A)
claim tangent(ν, i) [name=feuerbach]
claim tangent(ν, x_a)
claim tangent(ν, x_b)
