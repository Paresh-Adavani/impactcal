"""JHQ-C polyurethane-foam crane buffer GA sheets (catalogue PU Crane Buffers.pdf). PU body shown in red as on the
released JCQ-C-17 sample; grooved profile with chamfered striker end, bonded to an MS base plate."""
import os, re, sys, json, math
from frame import Sheet, std_scale, protect, THICK, THIN
HERE = os.path.dirname(os.path.abspath(__file__))
RED = (0.80, 0.16, 0.16); GREY = (0.72, 0.74, 0.78)

def parse():
    rows = {}
    for ln in open(os.path.join(HERE, '..', 'data', 'jhqc.txt')):
        m = re.match(r'\s*\d+\s+(JHQ-C-\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\d+)', ln)
        if m:
            v = m.groups(); rows[v[0]] = dict(D=int(v[1]), H=int(v[2]), h=int(v[3]), B=int(v[4]), b=int(v[5]),
                                             hole=int(v[6]), cap=float(v[7]), S=int(v[8]), P=int(v[9]))
    return rows

def draw(sh, r):
    D, H, h, B, b, hole, S = r['D'], r['H'], r['h'], r['B'], r['b'], r['hole'], r['S']
    L = H + h
    s = std_scale(L, B, 150.0, 46.0); k = 1.0 / s
    ox = 30.0; cy = 196.0 - 22.0 - B * k / 2
    X = lambda x: ox + x * k; R = lambda rr: rr * k
    # base plate (grey)
    sh.rect(X(0), cy - R(B / 2), R(h), R(B), THICK, color=GREY)
    # PU body profile: grooved cylinder, chamfered striker end. 3 grooves, depth 8 % of D, width 10 % of H
    ng = 3; gd = D * 0.08; gw = H * 0.10; ch = D * 0.06
    pitch = H / (ng + 1)
    prof = [(h, D / 2)]
    for i in range(1, ng + 1):
        xg = h + i * pitch
        prof += [(xg - gw / 2, D / 2), (xg - gw / 2 + gw * 0.15, D / 2 - gd), (xg + gw / 2 - gw * 0.15, D / 2 - gd), (xg + gw / 2, D / 2)]
    prof += [(L - ch, D / 2), (L, D / 2 - ch)]
    pts = [(X(x), cy + R(y)) for x, y in prof] + [(X(x), cy - R(y)) for x, y in reversed(prof)]
    sh.poly(pts, THICK, color=RED)
    sh.centerline(X(-6), cy, X(L + 6), cy)
    sh.line(X(L - S), cy - R(D / 2) - 1, X(L - S), cy + R(D / 2) + 1, THIN, dash=(2, 1))
    top = cy + R(B / 2); bot = cy - R(B / 2)
    sh.dim_h(X(L - S), X(L), top + 7, 'STROKE %g' % S, yfeat=(cy + R(D / 2), cy + R(D / 2)))
    sh.dim_h(X(h), X(L), top + 13, '%g' % H, yfeat=(cy + R(D / 2), cy + R(D / 2)))
    sh.dim_h(X(0), X(L), top + 19, '%g' % L, yfeat=(cy + R(B / 2), cy + R(D / 2)))
    sh.dim_h(X(0), X(h), bot - 7, '%g' % h, yfeat=(cy - R(B / 2), cy - R(B / 2)), txt_above=False)
    sh.dim_v(cy - R(D / 2), cy + R(D / 2), X(L) + 6, 'Ø%g' % D, xfeat=(X(L - ch), X(L - ch)))
    sh.leader(X(h + pitch * 1.5), cy + R(D / 2), X(h + pitch * 1.5) + 8, bot - 4.5, 'PU FOAM BUFFER (RED)')
    sh.leader(X(h / 2), cy - R(B / 2) * 0.6, X(h) + 6, bot - 9.5, 'MS BASE PLATE')
    sh.text(X(L / 2), max(bot - 19, 112), 'PU BUFFER - BASE PLATE MOUNT', 2.3, bold=True, anchor='c')
    # front view from striker end
    se = std_scale(B, B, 48, 48); ke = 1.0 / se; R2 = lambda rr: rr * ke
    ex = 285 - 16 - R2(B / 2) - 8; ey = cy
    sh.rect(ex - R2(B / 2), ey - R2(B / 2), R2(B), R2(B), THICK, color=GREY)
    sh.circle(ex, ey, R2(D / 2), THICK, color=RED)
    sh.circle(ex, ey, R2(D / 2 - ch), THIN)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hx, hy = ex + sx * R2(b / 2), ey + sy * R2(b / 2)
            sh.circle(hx, hy, R2(hole / 2), THICK, fill=1.0)
            sh.centerline(hx - R2(hole / 2) - 2, hy, hx + R2(hole / 2) + 2, hy); sh.centerline(hx, hy - R2(hole / 2) - 2, hx, hy + R2(hole / 2) + 2)
    sh.centerline(ex - R2(B / 2) - 4, ey, ex + R2(B / 2) + 4, ey); sh.centerline(ex, ey - R2(B / 2) - 4, ex, ey + R2(B / 2) + 4)
    sh.dim_h(ex - R2(B / 2), ex + R2(B / 2), ey - R2(B / 2) - 7, '%g' % B, yfeat=(ey - R2(B / 2), ey - R2(B / 2)), txt_above=False)
    sh.dim_h(ex - R2(b / 2), ex + R2(b / 2), ey + R2(B / 2) + 6, '%g' % b, yfeat=(ey + R2(b / 2), ey + R2(b / 2)))
    sh.dim_v(ey - R2(b / 2), ey + R2(b / 2), ex + R2(B / 2) + 6, '%g' % b, xfeat=(ex + R2(b / 2), ex + R2(b / 2)))
    hx, hy = ex - R2(b / 2), ey + R2(b / 2)
    sh.leader(hx - R2(hole / 2) * 0.7, hy - R2(hole / 2) * 0.7, hx - 12, hy - 6, '4 x Ø%g' % hole)
    sh.text(ex, ey - R2(B / 2) - 14, 'VIEW FROM STRIKER END' + ('' if se == s else '  (SCALE 1:%g)' % se), 2.3, bold=True, anchor='c')
    return s

def sheet_for(model, outdir, rows=None, date=None):
    r = (rows or parse())[model]
    params = [('Buffer diameter', 'Ø%g' % r['D'], 'mm'), ('Buffer height', '%g' % r['H'], 'mm'),
              ('Stroke (max. deflection)', '%g' % r['S'], 'mm'), ('Energy capacity', '%g' % r['cap'], 'kNm'),
              ('Max. buffer force', '%g' % r['P'], 'kN'), ('Base plate', '%g sq x %g thk' % (r['B'], r['h']), 'mm'),
              ('Mounting holes', '4 x Ø%g on %g sq' % (r['hole'], r['b']), 'mm'), ('Buffer material', 'Polyurethane foam', ''),
              ('Base plate material', 'MS, painted', '')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Dashed line = striker face at maximum deflection.',
             '3. Polyurethane (PU) foam buffer, shown in red, bonded to MS base plate; 4-bolt mounting.',
             '4. Grooved profile controls the deflection characteristic; groove pattern per Adoni Tech design.',
             '5. Operating temperature -20 to +80 °C.',
             '6. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    meta = dict(title=model, subtitle='POLYURETHANE FOAM CRANE BUFFER - GA', dwgno='AT/GA/JHQC/' + model[6:],
                rev='A', finish='PU red / plate painted', material='PU foam, MS base plate')
    if date: meta['date'] = date
    path = os.path.join(outdir, model + '.pdf')
    sh = Sheet(path, meta); s = draw(sh, r); sh.m['scale'] = '1:%g' % s
    sh.tech_table(14, 108, params, colw=(44, 30, 10)); sh.notes(102, 104.5, notes, title='NOTES')
    sh.frame(); sh.save(); protect(path)
    return path

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    rows = parse(); print(len(rows), 'models')
    for m in rows: sheet_for(m, out, rows)
