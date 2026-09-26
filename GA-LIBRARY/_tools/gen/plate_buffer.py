"""Plate-mounted buffer GA (SB spring buffers, JHQ-C polyurethane buffers): square base plate with 4 holes,
then cylindrical segments stacked away from the plate. Drawn horizontally, plate at left."""
from frame import Sheet, std_scale, THICK, THIN

def draw_plate_buffer(sh, g, params, notes, label):
    """g: A plate square, tp plate thk, B hole pitch, dh hole dia, segs [(length, dia, style)], S stroke,
       L overall (plate face to striker face) - segs must sum to L - tp."""
    A, tp, B, dh, segs, S, L = g['A'], g['tp'], g['B'], g['dh'], g['segs'], g['S'], g['L']
    Dmax = max(max(d for _, d, _ in segs), A)
    s = std_scale(L, Dmax, 165.0, 50.0); k = 1.0 / s
    ox = 26.0; cy = 196.0 - 22.0 - Dmax * k / 2
    X = lambda x: ox + x * k; R = lambda r: r * k
    # plate
    sh.rect(X(0), cy - R(A / 2), R(tp), R(A), THICK)
    x = tp
    for ln, d, st in segs:
        if st == 'taper':   # spring housing cone: from previous dia to d
            pass
        sh.rect(X(x), cy - R(d / 2), R(ln), R(d), THICK)
        x += ln
    sh.centerline(X(-8), cy, X(L + 8), cy)
    # stroke marker
    sh.line(X(L - S), cy - R(segs[-1][1] / 2) - 1, X(L - S), cy + R(segs[-1][1] / 2) + 1, THIN, dash=(2, 1))
    top = cy + R(Dmax / 2); bot = cy - R(Dmax / 2)
    dl = segs[-1][1]
    sh.dim_h(X(L - S), X(L), top + 7, 'STROKE %g' % S, yfeat=(cy + R(dl / 2), cy + R(dl / 2)))
    sh.dim_h(X(0), X(L), top + 13, '%g' % L, yfeat=(cy + R(A / 2), cy + R(dl / 2)))
    sh.dim_h(X(0), X(tp), bot - 7, '%g' % tp, yfeat=(cy - R(A / 2), cy - R(A / 2)), txt_above=False)
    # main diameter (largest cylindrical segment) on the right of the view
    big = max(segs, key=lambda t: t[1])
    xb = tp + sum(ln for ln, d, _ in segs[:segs.index(big)]) + big[0] / 2
    sh.dim_v(cy - R(big[1] / 2), cy + R(big[1] / 2), X(L) + 6, 'Ø%g' % big[1], xfeat=(X(xb), X(xb)))
    sh.text(X(L / 2), max(bot - 19, 112), label, 2.3, bold=True, anchor='c')
    # ---- end view from striker end ----
    se = std_scale(A, A, 48, 48); ke = 1.0 / se; R = lambda r: r * ke
    ex = 285 - 16 - R(A / 2) - 8; ey = cy
    sh.rect(ex - R(A / 2), ey - R(A / 2), R(A), R(A), THICK)
    for ln, d, st in segs: sh.circle(ex, ey, R(d / 2), THICK if d == big[1] else THIN)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hx, hy = ex + sx * R(B / 2), ey + sy * R(B / 2)
            sh.circle(hx, hy, R(dh / 2), THICK)
            sh.centerline(hx - R(dh / 2) - 2, hy, hx + R(dh / 2) + 2, hy)
            sh.centerline(hx, hy - R(dh / 2) - 2, hx, hy + R(dh / 2) + 2)
    sh.centerline(ex - R(A / 2) - 4, ey, ex + R(A / 2) + 4, ey); sh.centerline(ex, ey - R(A / 2) - 4, ex, ey + R(A / 2) + 4)
    sh.dim_h(ex - R(A / 2), ex + R(A / 2), ey - R(A / 2) - 7, '%g' % A, yfeat=(ey - R(A / 2), ey - R(A / 2)), txt_above=False)
    sh.dim_h(ex - R(B / 2), ex + R(B / 2), ey + R(A / 2) + 6, '%g' % B, yfeat=(ey + R(B / 2), ey + R(B / 2)))
    sh.dim_v(ey - R(B / 2), ey + R(B / 2), ex + R(A / 2) + 6, '%g' % B, xfeat=(ex + R(B / 2), ex + R(B / 2)))
    hx, hy = ex - R(B / 2), ey + R(B / 2)
    sh.leader(hx - R(dh / 2) * 0.7, hy - R(dh / 2) * 0.7, hx - 12, hy - 6, '4 x Ø%g' % dh)
    sh.text(ex, ey - R(A / 2) - 14, 'VIEW FROM STRIKER END' + ('' if se == s else '  (SCALE 1:%g)' % se), 2.3, bold=True, anchor='c')
    sh.tech_table(14, 108, params, colw=(40, 26, 12))
    sh.notes(100, 104.5, notes, title='NOTES')
    return s

def plate_sheet(path, meta, g, params, notes, label):
    sh = Sheet(path, meta)
    s = draw_plate_buffer(sh, g, params, notes, label)
    sh.m['scale'] = '1:%g' % s
    sh.frame(); sh.save(); return s
