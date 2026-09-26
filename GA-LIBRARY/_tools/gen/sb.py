"""SB spring buffer GA sheets (catalogue SB SERIES.pdf) - rear base plate with gusset stiffeners, spring housing,
flange ring, inner guide tube and front striker plate. Drawn horizontally, base plate at left."""
import os, re, sys, json
from frame import Sheet, std_scale, protect, THICK, THIN
HERE = os.path.dirname(os.path.abspath(__file__))

def parse():
    rows = {}
    for ln in open(os.path.join(HERE, '..', 'data', 'sb.txt')):
        m = re.match(r'\s*(SB-\d{4}-?[A-P])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)', ln)
        if m:
            v = [int(x) for x in m.groups()[1:]]
            rows[m.group(1)] = dict(S=v[0], E=v[1], EH=v[2], A=v[3], B=v[4], D=v[5], L=v[6], d2=v[7])
    return rows

def geometry(r):
    """Derived outline (catalogue gives plate A, pitch B, tube D, overall L, hole d2). Plate thicknesses follow the
    released 1204 / 1220 drawings: 8 mm up to 300 sq plate, 12 mm above; other diameters proportional."""
    A, B, D, L, S = r['A'], r['B'], r['D'], r['L'], r['S']
    tp = 8 if A <= 300 else 12                    # rear (base) plate
    tf = tp                                       # front (striker) plate
    tfl = tp + 4                                  # flange ring
    Dh = min(round(A * 0.72 / 5) * 5, round((B * 1.4142 - r['d2'] - 12) / 5) * 5)   # cylindrical housing dia, clears corner bolts
    Dfl = Dh + 2 * tfl                            # flange ring at the housing front end
    D = min(D, round((Dh - 30) / 5) * 5)          # guide tube runs inside the housing
    Dfp = D + 2 * tp                              # front plate dia
    Lh = L - tp - S - tf - 15                     # housing length (base plate face to flange)
    Lh = max(Lh, round(0.45 * L))
    tube = L - tp - Lh - tfl - tf                 # exposed tube length at full extension
    gus = round(Lh * 0.55)                        # gusset length along housing
    return dict(A=A, B=B, D=D, L=L, S=S, d2=r['d2'], tp=tp, tf=tf, tfl=tfl, Dh=Dh, Dfl=Dfl, Dfp=Dfp, Lh=Lh, tube=tube, gus=gus)

def draw(sh, g):
    A, B, D, L, S, d2 = g['A'], g['B'], g['D'], g['L'], g['S'], g['d2']
    tp, tf, tfl, Dh, Dfl, Dfp, Lh, gus = g['tp'], g['tf'], g['tfl'], g['Dh'], g['Dfl'], g['Dfp'], g['Lh'], g['gus']
    s = std_scale(L, A, 150.0, 46.0); k = 1.0 / s
    ox = 30.0; cy = 196.0 - 22.0 - A * k / 2
    X = lambda x: ox + x * k; R = lambda r: r * k
    # rear plate
    sh.rect(X(0), cy - R(A / 2), R(tp), R(A), THICK)
    # cylindrical housing, flange ring, tube, front plate
    x1 = tp; x2 = tp + Lh
    sh.rect(X(x1), cy - R(Dh / 2), R(Lh), R(Dh), THICK)
    sh.rect(X(x2), cy - R(Dfl / 2), R(tfl), R(Dfl), THICK, fill=1.0); sh.rect(X(x2), cy - R(Dfl / 2), R(tfl), R(Dfl), THICK)
    x3 = x2 + tfl; x4 = L - tf
    sh.rect(X(x3), cy - R(D / 2), R(x4 - x3), R(D), THICK)
    sh.rect(X(x4), cy - R(Dfp / 2), R(tf), R(Dfp), THICK)
    # gusset stiffeners (top and bottom, seen in side view)
    for sg in (1, -1):
        sh.poly([(X(x1), cy + sg * R(Dh / 2)), (X(x1), cy + sg * R(A / 2 - 8)), (X(x1 + gus), cy + sg * R(Dh / 2))], THICK)
    sh.centerline(X(-6), cy, X(L + 6), cy)
    sh.line(X(L - S), cy - R(Dfp / 2) - 1, X(L - S), cy + R(Dfp / 2) + 1, THIN, dash=(2, 1))
    top = cy + R(A / 2); bot = cy - R(A / 2)
    sh.dim_h(X(L - S), X(L), top + 7, 'STROKE %g' % S, yfeat=(cy + R(Dfp / 2), cy + R(Dfp / 2)))
    sh.dim_h(X(0), X(L), top + 13, '%g' % L, yfeat=(cy + R(A / 2), cy + R(Dfp / 2)))
    sh.dim_h(X(0), X(tp), bot - 7, '%g' % tp, yfeat=(cy - R(A / 2), cy - R(A / 2)), txt_above=False)
    sh.dim_h(X(x4), X(L), bot - 7, '%g' % tf, yfeat=(cy - R(Dfp / 2), cy - R(Dfp / 2)), txt_above=False)
    sh.dim_v(cy - R(Dfp / 2), cy + R(Dfp / 2), X(L) + 6, 'Ø%g' % Dfp, xfeat=(X(L), X(L)))
    sh.leader(X(x1 + gus * 0.4), cy + R(Dh / 2 + (A / 2 - 8 - Dh / 2) * 0.5), X(x1 + gus) + 10, cy + R(A / 2) + 1, '4 STIFFENERS')
    sh.text(X(L / 2), max(bot - 19, 112), 'SPRING BUFFER - BASE PLATE MOUNT', 2.3, bold=True, anchor='c')
    # ---- front view from striker end ----
    se = std_scale(A, A, 48, 48); ke = 1.0 / se; R2 = lambda r: r * ke
    ex = 285 - 16 - R2(A / 2) - 8; ey = cy
    sh.rect(ex - R2(A / 2), ey - R2(A / 2), R2(A), R2(A), THICK)
    for dia, lw in ((Dh, THICK), (Dfl, THICK), (Dfp, THICK), (D, THIN)): sh.circle(ex, ey, R2(dia / 2), lw)
    for ang in (0, 90, 180, 270):          # gusset stiffeners seen end-on
        import math
        a = math.radians(ang); r1 = R2(Dh / 2); r2 = R2(A / 2 - 8)
        for off in (-1.0, 1.0):
            sh.line(ex + r1 * math.cos(a) - off * 0.8 * math.sin(a), ey + r1 * math.sin(a) + off * 0.8 * math.cos(a),
                    ex + r2 * math.cos(a) - off * 0.8 * math.sin(a), ey + r2 * math.sin(a) + off * 0.8 * math.cos(a), THICK)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hx, hy = ex + sx * R2(B / 2), ey + sy * R2(B / 2)
            sh.circle(hx, hy, R2(d2 / 2), THICK)
            sh.centerline(hx - R2(d2 / 2) - 2, hy, hx + R2(d2 / 2) + 2, hy); sh.centerline(hx, hy - R2(d2 / 2) - 2, hx, hy + R2(d2 / 2) + 2)
    sh.centerline(ex - R2(A / 2) - 4, ey, ex + R2(A / 2) + 4, ey); sh.centerline(ex, ey - R2(A / 2) - 4, ex, ey + R2(A / 2) + 4)
    sh.dim_h(ex - R2(A / 2), ex + R2(A / 2), ey - R2(A / 2) - 7, '%g' % A, yfeat=(ey - R2(A / 2), ey - R2(A / 2)), txt_above=False)
    sh.dim_h(ex - R2(B / 2), ex + R2(B / 2), ey + R2(A / 2) + 6, '%g' % B, yfeat=(ey + R2(B / 2), ey + R2(B / 2)))
    sh.dim_v(ey - R2(B / 2), ey + R2(B / 2), ex + R2(A / 2) + 6, '%g' % B, xfeat=(ex + R2(B / 2), ex + R2(B / 2)))
    hx, hy = ex - R2(B / 2), ey + R2(B / 2)
    sh.leader(hx - R2(d2 / 2) * 0.7, hy - R2(d2 / 2) * 0.7, hx - 12, hy - 6, '4 x Ø%g' % d2)
    sh.text(ex, ey - R2(A / 2) - 14, 'VIEW FROM STRIKER END' + ('' if se == s else '  (SCALE 1:%g)' % se), 2.3, bold=True, anchor='c')
    return s

def sheet_for(model, outdir, rows=None, date=None):
    r = (rows or parse())[model]; g = geometry(r)
    params = [('Stroke', '%g' % r['S'], 'mm'), ('Energy capacity per stroke', '{:,}'.format(r['E']), 'Nm'),
              ('Energy capacity per hour', '{:,}'.format(r['EH']), 'Nm/h'), ('Base plate', '%g sq x %g thk' % (g['A'], g['tp']), 'mm'),
              ('Front (striker) plate', 'Ø%g x %g thk' % (g['Dfp'], g['tf']), 'mm'), ('Mounting holes', '4 x Ø%g on %g sq' % (g['d2'], g['B']), 'mm'),
                            ('Overall length', '%g' % g['L'], 'mm'), ('Return', 'Helical spring', '')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown free; dashed line = striker plate face at full stroke.',
             '3. Base plate mounting, 4 bolts; 4 gusset stiffeners between base plate and housing are standard.',
             '4. MS fabricated housing, painted yellow; spring steel helical spring.',
             '5. Housing cylindrical, MS fabricated; front plate diameter per Adoni Tech design.',
             '6. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    meta = dict(title=model, subtitle='SPRING BUFFER - GENERAL ARRANGEMENT', dwgno='AT/GA/SB/' + model[3:],
                rev='A', finish='Painted yellow', material='MS housing, spring steel')
    if date: meta['date'] = date
    path = os.path.join(outdir, model + '.pdf')
    sh = Sheet(path, meta); s = draw(sh, g); sh.m['scale'] = '1:%g' % s
    sh.tech_table(14, 108, params, colw=(44, 30, 10)); sh.notes(102, 104.5, notes, title='NOTES')
    sh.frame(); sh.save(); protect(path)
    return path

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    rows = parse(); print(len(rows), 'models')
    for m in rows: sheet_for(m, out, rows)
