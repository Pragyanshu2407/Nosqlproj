"""Generates usecase-diagram.svg (UML-style use case diagram for DepGuard).
Run:  python3 make_usecase.py
"""
import math

W, H = 1000, 800
LX, RX = 340, 670          # left / right use-case column centres
RXL, RYL = 108, 27         # ellipse radii

# name -> (cx, cy, label lines)
UC = {
    "name":    (LX, 105, ["Enter project name"]),
    "upload":  (LX, 195, ["Upload requirements.txt", "or package.json"]),
    "scan":    (LX, 340, ["Scan dependencies"]),
    "dash":    (LX, 470, ["View dashboard", "statistics"]),
    "results": (LX, 580, ["View vulnerability", "results"]),
    "detail":  (LX, 690, ["View vulnerability", "details"]),
    "extract": (RX, 195, ["Extract package names", "and versions"]),
    "errors":  (RX, 267, ["Handle invalid file", "and API errors"]),
    "detect":  (RX, 340, ["Detect vulnerabilities"]),
    "store":   (RX, 420, ["Store scan results"]),
    "filter":  (RX, 610, ["Filter by severity"]),
    "search":  (RX, 685, ["Search package / ID"]),
}
DEV = (95, 400)
OSV = (905, 340)
MONGO = (905, 500)

out = []
a = out.append
a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W*2}" height="{H*2}" font-family="Arial, Helvetica, sans-serif">')
a('''<defs>
<marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
<path d="M1 1 L9 5 L1 9" fill="none" stroke="#475569" stroke-width="1.5"/></marker>
</defs>''')
a(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
a(f'<text x="{W/2}" y="26" text-anchor="middle" font-size="19" font-weight="700" fill="#0d1b3e">DepGuard – Use Case Diagram</text>')

# system boundary
a('<rect x="200" y="42" width="610" height="708" rx="6" fill="#f8fafc" stroke="#0d1b3e" stroke-width="2"/>')
a('<text x="505" y="66" text-anchor="middle" font-size="15" font-weight="700" fill="#0d1b3e">DepGuard System</text>')


def edge_point(cx, cy, tx, ty):
    """Point on the ellipse at (cx,cy) boundary towards (tx,ty)."""
    ang = math.atan2(ty - cy, tx - cx)
    # ellipse parametric radius along angle
    r = (RXL * RYL) / math.sqrt((RYL * math.cos(ang)) ** 2 + (RXL * math.sin(ang)) ** 2)
    return cx + r * math.cos(ang), cy + r * math.sin(ang)


def link(frm, to, kind=None):
    fx, fy = frm
    tx, ty = to
    x1, y1 = edge_point(fx, fy, tx, ty)
    x2, y2 = edge_point(tx, ty, fx, fy)
    if kind:
        a(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#475569" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#open)"/>')
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        a(f'<rect x="{mx-31:.1f}" y="{my-9:.1f}" width="62" height="16" fill="#f8fafc"/>')
        a(f'<text x="{mx:.1f}" y="{my+4:.1f}" text-anchor="middle" font-size="11" font-style="italic" fill="#334155">«{kind}»</text>')
    else:
        a(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#334155" stroke-width="1.4"/>')


def centre(k):
    return UC[k][0], UC[k][1]


# actor -> use case associations (drawn first, under ellipses)
dev_pt = (DEV[0] + 14, DEV[1] - 14)
for k in ("name", "upload", "scan", "dash", "results", "detail"):
    cx, cy = centre(k)
    x2, y2 = cx - RXL, cy
    a(f'<line x1="{dev_pt[0]}" y1="{dev_pt[1]}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#334155" stroke-width="1.4"/>')

# include / extend relationships
link(centre("upload"), centre("extract"), "include")
link(centre("scan"), centre("detect"), "include")
link(centre("scan"), centre("store"), "include")
link(centre("errors"), centre("upload"), "extend")
link(centre("errors"), centre("scan"), "extend")
link(centre("filter"), centre("results"), "extend")
link(centre("search"), centre("results"), "extend")
link(centre("detail"), centre("results"), "extend")

# secondary actors
for pt, ks in ((OSV, ["detect"]), (MONGO, ["store", "dash", "results"])):
    for k in ks:
        cx, cy = centre(k)
        x1, y1 = edge_point(cx, cy, pt[0] - 14, pt[1] - 14)
        a(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{pt[0]-14}" y2="{pt[1]-14}" stroke="#334155" stroke-width="1.4"/>')

# ellipses
for k, (cx, cy, lines) in UC.items():
    a(f'<ellipse cx="{cx}" cy="{cy}" rx="{RXL}" ry="{RYL}" fill="#eaf1ff" stroke="#2563eb" stroke-width="1.8"/>')
    n = len(lines)
    for i, t in enumerate(lines):
        y = cy + 4 + (i - (n - 1) / 2) * 15
        a(f'<text x="{cx}" y="{y:.1f}" text-anchor="middle" font-size="13" fill="#0f172a">{t}</text>')


def actor(x, y, label, sub=None, fill="#0f172a"):
    a(f'<g stroke="{fill}" stroke-width="2" fill="none" stroke-linecap="round">')
    a(f'<circle cx="{x}" cy="{y-42}" r="12" fill="#ffffff"/>')
    a(f'<line x1="{x}" y1="{y-30}" x2="{x}" y2="{y+12}"/>')
    a(f'<line x1="{x-22}" y1="{y-18}" x2="{x+22}" y2="{y-18}"/>')
    a(f'<line x1="{x}" y1="{y+12}" x2="{x-18}" y2="{y+42}"/>')
    a(f'<line x1="{x}" y1="{y+12}" x2="{x+18}" y2="{y+42}"/>')
    a('</g>')
    a(f'<text x="{x}" y="{y+62}" text-anchor="middle" font-size="13" font-weight="700" fill="{fill}">{label}</text>')
    if sub:
        a(f'<text x="{x}" y="{y+78}" text-anchor="middle" font-size="11" fill="#64748b">{sub}</text>')


actor(*DEV, "Developer / Student", "Primary actor")
actor(*OSV, "OSV.dev API", "External system")
actor(*MONGO, "MongoDB", "Database")

# legend
a('<g font-size="12" fill="#334155">')
a('<line x1="215" y1="772" x2="255" y2="772" stroke="#334155" stroke-width="1.4"/><text x="263" y="776">association</text>')
a('<line x1="365" y1="772" x2="405" y2="772" stroke="#475569" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#open)"/>'
  '<text x="413" y="776">«include» points to the included use case; «extend» points to the base use case</text>')
a('</g>')
a('</svg>')

open("usecase-diagram.svg", "w").write("\n".join(out))
print("written usecase-diagram.svg")
