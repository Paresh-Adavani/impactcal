"""Generic hydraulic-buffer GA (AKHG / AKHS / EI / ED style): cylindrical body, square mounting flange
(rear = RS, front = FS), piston rod with striker cap. Full outline, end view, technical-parameter table."""
import math
from frame import Sheet, std_scale, THICK, THIN

def draw_buffer(sh, g, mount, params, notes, model):
    """g: dict(D body dia, L overall, C flange rear position (front mount), F flange square, P hole pitch,
       dh hole dia, t flange thk, cap cap length, rod rod dia, S stroke, gap rod gap at full compression)
       mount: 'RS' or 'FS'."""
    D, L, S = g['D'], g['L'], g['S']
    F, P, dh, t, cap, rod = g['F'], g['P'], g['dh'], g['t'], g['cap'], g['rod']
    gap = g.get('gap', 10); capD = g.get('capD', D)
    # ---- scale & placement ----
    # drawing area: x 14..190 for side view (leaving end view 45 mm right), y 105..195
    avail_w = 165.0; avail_h = 50.0
    s = std_scale(L, max(F, D), avail_w, avail_h)
    k = 1.0 / s
    ox = 26.0
    cy = 196.0 - 22.0 - max(F, D) * k / 2     # axis y so that 3 dimension tiers fit above the outline
    X = lambda x: ox + x * k
    R = lambda r: r * k
    # ---- side view geometry (x from rear end) ----
    if mount == 'RS':
        fl_x = 0.0
    else:
        fl_x = L - g['C']                     # C is measured from the front (striker cap) end to the flange rear face
    body_end = L - cap - S - gap              # front face of body
    rod_end = L - cap
    # body cylinder
    sh.rect(X(0), cy - R(D / 2), R(body_end), R(D), THICK)
    # flange
    sh.rect(X(fl_x), cy - R(F / 2), R(t), R(F), THICK, fill=1.0)
    sh.rect(X(fl_x), cy - R(F / 2), R(t), R(F), THICK)
    # redraw body edge lines through flange region are hidden - fine (flange filled white)
    # rod
    sh.rect(X(body_end), cy - R(rod / 2), R(rod_end - body_end), R(rod), THICK)
    # striker cap
    sh.rect(X(rod_end), cy - R(capD / 2), R(cap), R(capD), THICK)
    # centreline
    sh.centerline(X(-8), cy, X(L + 8), cy)
    # stroke marker (compressed position of cap face)
    sh.line(X(rod_end - S), cy - R(capD / 2) - 1, X(rod_end - S), cy + R(capD / 2) + 1, THIN, dash=(2, 1))
    # ---- dimensions ----
    top = cy + R(max(F, D) / 2)
    bot = cy - R(max(F, D) / 2)
    # stroke (tier 1) and overall (tier 2) above
    sh.dim_h(X(rod_end - S), X(rod_end), top + 7, 'STROKE %g' % S, yfeat=(cy + R(capD / 2), cy + R(capD / 2)))
    if mount == 'FS':
        sh.dim_h(X(fl_x), X(L), top + 13, '%g' % g['C'], yfeat=(cy + R(F / 2), cy + R(D / 2)))
    sh.dim_h(X(0), X(L), top + 19, '%g' % L, yfeat=(cy + R(D / 2), cy + R(capD / 2)))
    # flange thickness below
    sh.dim_h(X(fl_x), X(fl_x + t), bot - 7, '%g' % t, yfeat=(cy - R(F / 2), cy - R(F / 2)), txt_above=False)
    # cap length below
    sh.dim_h(X(rod_end), X(L), bot - 7, '%g' % cap, yfeat=(cy - R(capD / 2), cy - R(capD / 2)), txt_above=False)
    # diameters at right of side view
    xr = X(L) + 6
    sh.dim_v(cy - R(capD / 2), cy + R(capD / 2), xr, 'Ø%g' % capD, xfeat=(X(L), X(L)))
    sh.dim_v(cy - R(rod / 2), cy + R(rod / 2), X(body_end + (rod_end - body_end) * 0.35), 'Ø%g' % rod, xfeat=None) if False else None
    sh.dim_v(cy - R(D / 2), cy + R(D / 2), X(0) - 6, 'Ø%g' % D, xfeat=(X(0), X(0)), txt_left=True)
    # ---- end view (from front / rod end) ----
    se = std_scale(max(F, D), max(F, D), 48, 48)
    ke = 1.0 / se
    R = lambda r: r * ke
    ex = 285 - 16 - R(F / 2) - 8; ey = cy
    sh.rect(ex - R(F / 2), ey - R(F / 2), R(F), R(F), THICK)
    sh.circle(ex, ey, R(D / 2), THICK)
    sh.circle(ex, ey, R(capD / 2), THIN) if capD != D else None
    sh.circle(ex, ey, R(rod / 2), THIN)
    for sx in (-1, 1):
        for sy in (-1, 1):
            hx, hy = ex + sx * R(P / 2), ey + sy * R(P / 2)
            sh.circle(hx, hy, R(dh / 2), THICK)
            sh.centerline(hx - R(dh / 2) - 2, hy, hx + R(dh / 2) + 2, hy)
            sh.centerline(hx, hy - R(dh / 2) - 2, hx, hy + R(dh / 2) + 2)
    sh.centerline(ex - R(F / 2) - 4, ey, ex + R(F / 2) + 4, ey)
    sh.centerline(ex, ey - R(F / 2) - 4, ex, ey + R(F / 2) + 4)
    # end view dims: square (below), pitch (right), hole callout
    sh.dim_h(ex - R(F / 2), ex + R(F / 2), ey - R(F / 2) - 7, '%g' % F, yfeat=(ey - R(F / 2), ey - R(F / 2)), txt_above=False)
    sh.dim_h(ex - R(P / 2), ex + R(P / 2), ey + R(F / 2) + 6, '%g' % P, yfeat=(ey + R(P / 2), ey + R(P / 2)))
    sh.dim_v(ey - R(P / 2), ey + R(P / 2), ex + R(F / 2) + 6, '%g' % P, xfeat=(ex + R(P / 2), ex + R(P / 2)))
    hx, hy = ex - R(P / 2), ey + R(P / 2)
    sh.leader(hx - R(dh / 2) * 0.7, hy - R(dh / 2) * 0.7, hx - 12, hy - 6, '4 x Ø%g' % dh)
    sh.text(ex, ey - R(F / 2) - 14, 'VIEW FROM ROD END' + ('' if se == s else '  (SCALE 1:%g)' % se), 2.3, bold=True, anchor='c')
    sh.text(X(L / 2), max(bot - 19, 112), g.get('label') or '%s MOUNT  (%s)' % ('REAR FLANGE' if mount == 'RS' else 'FRONT FLANGE', mount), 2.3, bold=True, anchor='c')
    # ---- technical table + notes ----
    sh.tech_table(14, 108, params)
    sh.notes(100, 104.5, notes, title='NOTES')
    return s


def buffer_sheet(path, meta, g, mount, params, notes, model):
    sh = Sheet(path, meta)
    s = draw_buffer(sh, g, mount, params, notes, model)
    sh.m['scale'] = '1:%g' % s
    sh.frame()
    sh.save()
    return s
