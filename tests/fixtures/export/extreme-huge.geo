# A figure 10^9 wide and 10^9 from the origin (Run 10 audit): one world unit is about 3·10^-7 bp,
# so TikZ writes coordinates × 10^-7 relative to the view's center (tikz.ts); tex.yml compiles it
# and checks the Asymptote coordinates.
@version 1
@title "Export: a figure 10^9 wide, far from the origin"
A = (1000000000, 0)
B = (2000000000, 0)
C = (1300000000, 800000000)
t = polygon(A, B, C)
w = circle(A, B, C)
M = midpoint(A, B)
H = orthocenter(A, B, C)
