# Euler line: the circumcentre O, the centroid G and the orthocentre H are collinear,
# and G divides OH in the ratio 1 : 2.
@version 1
@title "Euler line"
A = (1, 4)
B = (-2, 0)
C = (5, 0)
abc = polygon(A, B, C)
O = circumcenter(A, B, C)
G = centroid(A, B, C)
H = orthocenter(A, B, C)
e = line(O, H) [color=red, dash=dashed]
claim collinear(O, G, H) [name=euler]
claim GH = 2·OG
