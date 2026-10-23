# Circles whose screen radius is 6500 to 32500 px (ADR-0028): TikZ writes them as Bezier pieces,
# since arc[radius=R] makes TeX compute R and 2R as dimensions beyond \maxdimen; Asymptote draws
# them from enough Bezier pieces to stay within 1/16 of a pixel. tex.yml compiles it.
@version 1
@title "Export: arcs of a large screen radius"
@viewport 0 0 50
P = (0, 0)
O = (0, -600)
c = circle(O, P)
Q = (0, 130.2)
d = circle(Q, P)
R = (-650, 0)
e = circle(R, (0.5, 0))
