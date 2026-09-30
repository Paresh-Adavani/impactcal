"""Model-type pictures for the selector (site/img/series/*.svg) and the WRI mounting options (site/img/wri-mount/*.svg).

Side views drawn to realistic proportions (rod diameter / body diameter as on the GA drawings):
  AC / ACX / AD / ADX  threaded body, rod ~0.33 x body, two lock nuts, PU cap; AD/ADX with rear adjuster knob
  AKHG                 hydraulic, nitrogen gas return: large rod ~0.55 x body, front flange, striker cap
  AKHS                 hydraulic, external spring return: coil spring round the rod, striker plate
  ED / EI              heavy hydraulic, internal nitrogen: ED rear flange, EI front flange
  SB                   spring buffer: tube housing, plunger, base plate
  JHQC                 polyurethane buffer: red PU block with grooves on a steel base plate
Run: python3 tools/series_icons.py
"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'img', 'series')
OUTW = os.path.join(os.path.dirname(__file__), '..', 'site', 'img', 'wri-mount')

DEFS = '''<defs>
<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".3" stop-color="#c3cad2"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".8" stop-color="#8f99a4"/><stop offset="1" stop-color="#5f6a75"/></linearGradient>
<linearGradient id="black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b6f75"/><stop offset=".45" stop-color="#2a2d31"/><stop offset="1" stop-color="#0d0e10"/></linearGradient>
<linearGradient id="yellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".45" stop-color="#f2c000"/><stop offset="1" stop-color="#9c7600"/></linearGradient>
<linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dbbff"/><stop offset=".45" stop-color="#1f6fe0"/><stop offset="1" stop-color="#0b3a86"/></linearGradient>
<linearGradient id="red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a80"/><stop offset=".45" stop-color="#d81c1c"/><stop offset="1" stop-color="#761010"/></linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e8ee"/><stop offset=".5" stop-color="#a6b0bb"/><stop offset="1" stop-color="#5b6570"/></linearGradient>
<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#c3cad2"/><line x1="0" y1="0" x2="0" y2="4" stroke="#4a525b" stroke-width="1"/></pattern>
<linearGradient id="pu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#555"/><stop offset=".5" stop-color="#1b1b1b"/><stop offset="1" stop-color="#000"/></linearGradient>
</defs>'''
S = 'stroke="#23272c" stroke-width="1.1"'
CY = 66   # centre line


def rect(x, y, w, h, fill, rx=0, extra=''):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="url(#{fill})" {S} {extra}/>'


def cyl(x, L, D, fill, rx=2):          # horizontal cylinder centred on CY
    return rect(x, CY - D / 2, L, D, fill, rx)


def threads(x, L, D, step=4):
    return ''.join(f'<line x1="{x + i:.1f}" y1="{CY - D / 2 + 1:.1f}" x2="{x + i - 2:.1f}" y2="{CY + D / 2 - 1:.1f}" stroke="#8a8f96" stroke-width=".7"/>' for i in range(3, int(L), step))


def nut(x, D):                          # hex lock nut, side view
    h = D * 1.45
    return (rect(x, CY - h / 2, 7, h, 'steel', 1) + f'<line x1="{x}" y1="{CY - h / 4:.1f}" x2="{x + 7}" y2="{CY - h / 4:.1f}" stroke="#555" stroke-width=".6"/>'
            f'<line x1="{x}" y1="{CY + h / 4:.1f}" x2="{x + 7}" y2="{CY + h / 4:.1f}" stroke="#555" stroke-width=".6"/>')


def sflange(x, top, bot, holes, w=7):
    """flange plate cut in section (hatched) with bolt holes running through its thickness, and centre lines"""
    s = f'<rect x="{x:.1f}" y="{top:.1f}" width="{w}" height="{bot - top:.1f}" fill="url(#hatch)" {S}/>'
    for hy in holes:
        s += f'<rect x="{x:.1f}" y="{hy - 2.4:.1f}" width="{w}" height="4.8" fill="#fff"/>'
        s += f'<line x1="{x:.1f}" y1="{hy - 2.4:.1f}" x2="{x + w:.1f}" y2="{hy - 2.4:.1f}" stroke="#23272c" stroke-width=".9"/><line x1="{x:.1f}" y1="{hy + 2.4:.1f}" x2="{x + w:.1f}" y2="{hy + 2.4:.1f}" stroke="#23272c" stroke-width=".9"/>'
        s += f'<line x1="{x - 4:.1f}" y1="{hy:.1f}" x2="{x + w + 4:.1f}" y2="{hy:.1f}" stroke="#23272c" stroke-width=".5" stroke-dasharray="4 1.5 1 1.5"/>'
    return s


def label(t, sub=''):
    s = f'<text x="120" y="128" font-size="12.5" font-weight="700" fill="#1B3160" font-family="Arial" text-anchor="middle">{t}</text>'
    if sub:
        s += f'<text x="120" y="143" font-size="10.5" fill="#44536a" font-family="Arial" text-anchor="middle">{sub}</text>'
    return s


def badge(x, text, fill='#1B3160'):
    return f'<text x="{x}" y="{CY + 3.5}" font-size="8.5" font-weight="700" fill="{fill}" font-family="Arial" text-anchor="middle">{text}</text>'


def svg(body, name, sub):
    # no caption inside the picture: the selector card prints the series name and description under it
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 18 232 96" stroke-linejoin="round"><title>{name} — {sub}</title>{DEFS}{body}</svg>'


def industrial(adjuster, name, sub):
    # threaded body M-thread: D 30, length 104; rod 10 (0.33 x D); stroke 34; PU cap 22 x 10
    x0, L, D, d = 40 if adjuster else 30, 104, 30, 10
    b = ''
    if adjuster:   # rear adjuster knob with knurling
        b += rect(x0 - 12, CY - 11, 12, 22, 'steel', 2) + ''.join(f'<line x1="{x0 - 11 + i}" y1="{CY - 10}" x2="{x0 - 11 + i}" y2="{CY + 10}" stroke="#6d7680" stroke-width=".6"/>' for i in range(2, 11, 2))
    b += cyl(x0, L, D, 'black', 2) + threads(x0, L, D)
    b += nut(x0 + 14, D) + nut(x0 + L - 26, D)
    b += cyl(x0 + L, 38, d, 'chrome', 0)                       # piston rod
    b += rect(x0 + L + 38, CY - 11, 11, 22, 'pu', 3)           # PU cap
    return svg(b, name, sub)


def akhg():
    # body 46, rod 26 (0.56 x body), front flange 70 x 8, striker cap 34
    x0, L, D, d = 22, 118, 46, 26
    b = cyl(x0, L, D, 'yellow', 4)
    b += sflange(x0 + L - 10, CY - 35, CY + 35, (CY - 28, CY + 28), 9)      # front flange at the rod end, in section
    b += cyl(x0 + L - 1, 44, d, 'chrome', 0)
    b += rect(x0 + L + 43, CY - 17, 10, 34, 'steel', 3)         # striker cap
    b += badge(x0 + 48, 'N₂ gas return')
    return svg(b, 'AKHG', 'Hydraulic · nitrogen gas return')


def akhs():
    # body 42, rod 16 (0.38), external coil spring 36 round the rod, striker plate 50
    x0, L, D, d = 18, 96, 42, 16
    b = cyl(x0, L, D, 'blue', 4) + rect(x0 - 7, CY - 30, 7, 60, 'steel', 1)     # rear flange
    b += cyl(x0 + L, 70, d, 'chrome', 0)
    px = x0 + L + 70
    b += rect(px, CY - 26, 8, 52, 'steel', 2)                                     # striker plate
    n, sx, ex, r = 9, x0 + L + 3, px - 2, 17
    pts = ' '.join(f'{sx + (ex - sx) * i / (2 * n):.1f},{CY + (r if i % 2 else -r):.1f}' for i in range(2 * n + 1))
    b += f'<polyline points="{pts}" fill="none" stroke="#3a3f45" stroke-width="3.2"/><polyline points="{pts}" fill="none" stroke="#b9c1ca" stroke-width="1.6"/>'
    b += badge(x0 + 48, 'hydraulic', '#fff')
    return svg(b, 'AKHS', 'Hydraulic · external spring return')


def heavy(front, name, sub):
    # ED / EI: body 56, rod 28 (0.5), flange 76, cap 38
    x0, L, D, d = 26 if not front else 20, 116, 56, 28
    b = cyl(x0, L, D, 'yellow', 5)
    fx = x0 + L - 10 if front else x0 - 8
    b += sflange(fx, CY - 38, CY + 38, (CY - 30, CY + 30), 9)
    b += cyl(x0 + L - 1, 36, d, 'chrome', 0) + rect(x0 + L + 35, CY - 19, 10, 38, 'steel', 3)
    b += badge(x0 + 50, 'internal N₂')
    return svg(b, name, sub)


def sb():
    x0, L, D = 26, 92, 50
    b = rect(x0 - 8, CY - 36, 8, 72, 'steel', 1) + cyl(x0, L, D, 'yellow', 3)
    n, sx, ex, r = 7, x0 + 6, x0 + L - 6, 17                     # spring inside (dashed)
    pts = ' '.join(f'{sx + (ex - sx) * i / (2 * n):.1f},{CY + (r if i % 2 else -r):.1f}' for i in range(2 * n + 1))
    b += f'<polyline points="{pts}" fill="none" stroke="#7a5d00" stroke-width="1.4" stroke-dasharray="3 2"/>'
    b += cyl(x0 + L, 40, 30, 'chrome', 0) + rect(x0 + L + 40, CY - 24, 9, 48, 'steel', 2)
    return svg(b, 'SB', 'Spring buffer · helical spring inside')


def jhqc():
    x0 = 50
    b = rect(x0 - 10, CY - 44, 10, 88, 'steel', 1)
    b += f'<path d="M{x0},{CY - 34} H{x0 + 82} L{x0 + 94},{CY - 24} V{CY + 24} L{x0 + 82},{CY + 34} H{x0} Z" fill="url(#red)" {S}/>'
    for gx in (x0 + 22, x0 + 44, x0 + 66):
        b += f'<rect x="{gx}" y="{CY - 34}" width="5" height="68" fill="#8a1010" opacity=".55"/>'
    return svg(b, 'JHQ-C', 'Polyurethane buffer')


ICONS = {
    'AC': lambda: industrial(False, 'AC', 'Hydraulic · spring return · fixed damping'),
    'ACX': lambda: industrial(False, 'ACX', 'Hydraulic · spring return · self-compensating'),
    'AD': lambda: industrial(True, 'AD', 'Hydraulic · spring return · adjustable damping'),
    'ADX': lambda: industrial(True, 'ADX', 'Hydraulic · spring return · adjustable, large bore'),
    'AKHG': akhg, 'AKHS': akhs,
    'ED': lambda: heavy(False, 'ED', 'Hydraulic · internal nitrogen · rear flange'),
    'EI': lambda: heavy(True, 'EI', 'Hydraulic · internal nitrogen · front flange'),
    'SB': sb, 'JHQC': jhqc,
}

# ---------------------------------------------------------------- wire rope isolator mounting options (top bar / bottom bar)
WRI = {'A': ('thru', 'csink'), 'B': ('csink', 'csink'), 'C': ('thru', 'thread'), 'D': ('thread', 'thread'), 'E': ('thread', 'csink'), 'S': ('thru', 'thru')}
NAMES = {'thru': 'through hole', 'csink': 'countersunk', 'thread': 'threaded'}


def hole(kind, x, y, w, h, top):
    """hole through a mounting bar drawn as a section: bar from y to y+h, hole centred at x"""
    r = 5.5
    s = f'<rect x="{x - r}" y="{y}" width="{2 * r}" height="{h}" fill="#fff"/>'
    if kind == 'csink':                      # countersink on the outer face of the bar
        oy = y if top else y + h
        dy = 5 if top else -5
        s += f'<path d="M{x - r - 6},{oy} L{x - r},{oy + dy * 1.4} L{x + r},{oy + dy * 1.4} L{x + r + 6},{oy} Z" fill="#fff"/>'
        s += f'<path d="M{x - r - 6},{oy} L{x - r},{oy + dy * 1.4} M{x + r + 6},{oy} L{x + r},{oy + dy * 1.4}" stroke="#23272c" stroke-width="1.2" fill="none"/>'
    if kind == 'thread':
        s += ''.join(f'<line x1="{x - r}" y1="{y + i}" x2="{x + r}" y2="{y + i + 2}" stroke="#23272c" stroke-width="1.1"/>' for i in range(1, int(h) - 1, 3))
        s += f'<rect x="{x - r}" y="{y}" width="3" height="{h}" fill="#23272c"/><rect x="{x + r - 3}" y="{y}" width="3" height="{h}" fill="#23272c"/>'
    s += f'<line x1="{x - r}" y1="{y}" x2="{x - r}" y2="{y + h}" stroke="#23272c" stroke-width="1"/><line x1="{x + r}" y1="{y}" x2="{x + r}" y2="{y + h}" stroke="#23272c" stroke-width="1"/>'
    return s


def wri(code):
    top, bot = WRI[code]
    b = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 150">' + DEFS
    b += '<path d="M40,34 C8,40 8,104 40,110 M120,34 C152,40 152,104 120,110" fill="none" stroke="#6d7680" stroke-width="7"/>'
    b += '<path d="M40,34 C8,40 8,104 40,110 M120,34 C152,40 152,104 120,110" fill="none" stroke="#c9d0d8" stroke-width="3"/>'
    b += rect(30, 22, 100, 16, 'steel', 2) + rect(30, 106, 100, 16, 'steel', 2)
    b += hole(top, 80, 22, 100, 16, True) + hole(bot, 80, 106, 100, 16, False)
    b += f'<text x="80" y="75" font-size="30" font-weight="700" fill="#1B3160" font-family="Arial" text-anchor="middle">{code}</text>'
    b += f'<text x="80" y="14" font-size="10.5" fill="#1B3160" font-family="Arial" text-anchor="middle">top: {NAMES[top]}</text>'
    b += f'<text x="80" y="140" font-size="10.5" fill="#1B3160" font-family="Arial" text-anchor="middle">bottom: {NAMES[bot]}</text>'
    return b + '</svg>'


# ---------------------------------------------------------------- AKHG / EI mounting types (site/img/mount/*.svg)
OUTM = os.path.join(os.path.dirname(__file__), '..', 'site', 'img', 'mount')
MOUNTS = {'RS': 'Rear flange', 'FS': 'Front flange', 'SS': 'Front + rear flange', 'RC': 'Rod clevis', 'TM': 'Front flange + foot, rear flange', 'FM': 'Front + rear foot',
          'FF': 'Front flange (EI)', 'FR': 'Rear flange (EI)'}   # EI keeps its own codes


def mount(code):
    x0, L, D, d = 50, 104, 38, 20          # rear end x0, front end x0+L (rod side)
    b = ''
    base = code in ('TM', 'FM')
    BY = CY + 40                           # floor line for foot-mounted versions
    if base:
        b += f'<rect x="16" y="{BY}" width="208" height="4" fill="#9aa3ad"/>'
        b += ''.join(f'<line x1="{16 + i}" y1="{BY + 4}" x2="{10 + i}" y2="{BY + 10}" stroke="#9aa3ad" stroke-width="1"/>' for i in range(4, 208, 8))

    def flange(x, down=False):             # flange plate; foot versions reach down to the lug
        return sflange(x, CY - 32, BY if down else CY + 32, (CY - 25, CY + 25))   # foot versions: flange bottom flush with the foot pad on the floor

    def lug(x, direction):                 # foot lug welded to the flange bottom: gusset + base pad with a bolt hole
        w = 22 * direction
        pad_x = x if direction > 0 else x + w
        s = f'<path d="M{x},{CY + 14} L{x},{BY - 6} L{x + w},{BY - 6} Z" fill="url(#steel)" {S}/>'
        hx = x + w * 0.62                  # base pad in section with a vertical bolt hole
        s += f'<rect x="{pad_x:.1f}" y="{BY - 6}" width="{abs(w)}" height="6" fill="url(#hatch)" {S}/>'
        s += f'<rect x="{hx - 2:.1f}" y="{BY - 6}" width="4" height="6" fill="#fff"/><line x1="{hx - 2:.1f}" y1="{BY - 6}" x2="{hx - 2:.1f}" y2="{BY}" stroke="#23272c" stroke-width=".9"/><line x1="{hx + 2:.1f}" y1="{BY - 6}" x2="{hx + 2:.1f}" y2="{BY}" stroke="#23272c" stroke-width=".9"/>'
        s += f'<line x1="{hx:.1f}" y1="{BY - 10}" x2="{hx:.1f}" y2="{BY + 3}" stroke="#23272c" stroke-width=".5" stroke-dasharray="4 1.5 1 1.5"/>'
        return s

    def clevis(x, direction):              # fork with pin; direction -1 = pointing rearwards, +1 = forwards
        L2 = 24
        x1 = x if direction > 0 else x - L2
        s = rect(x1, CY - 12, L2, 5, 'steel', 1) + rect(x1, CY + 7, L2, 5, 'steel', 1)
        yoke = x if direction > 0 else x - 6
        s += rect(yoke, CY - 12, 6, 24, 'steel', 0)
        px = x + direction * (L2 - 8)
        s += f'<circle cx="{px}" cy="{CY}" r="4" fill="url(#chrome)" {S}/><line x1="{px}" y1="{CY - 15}" x2="{px}" y2="{CY + 15}" stroke="#23272c" stroke-width="1.4"/>'
        return s

    if code == 'RC':
        b += clevis(x0, -1)
    b += cyl(x0, L, D, 'yellow', 4)
    rod_end = x0 + L + 40
    b += cyl(x0 + L, 40, d, 'chrome', 0)
    if code == 'RC':
        b += clevis(rod_end, +1)            # clevis on the rod end as well
    else:
        b += rect(rod_end, CY - 14, 9, 28, 'steel', 3)
    rear_f, front_f = x0 - 7, x0 + L - 8
    if code in ('RS', 'SS', 'TM', 'FR', 'FM'):
        b += flange(rear_f, down=(code == 'FM'))
    if code in ('FS', 'SS', 'TM', 'FF', 'FM'):
        b += flange(front_f, down=code in ('FM', 'TM'))
    if code == 'TM':
        b += lug(front_f + 7, +1)           # foot lug just in front of the front flange
    if code == 'FM':
        b += lug(rear_f, -1)                          # rear lug on the left, away from the body
        b += lug(front_f + 7, +1)                     # lug at the bottom right of the front flange
    b += f'<text x="120" y="22" font-size="14" font-weight="700" fill="#1B3160" font-family="Arial" text-anchor="middle">{code}</text>'
    b += f'<text x="120" y="{CY + 66}" font-size="11" fill="#1B3160" font-family="Arial" text-anchor="middle">{MOUNTS[code]}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 4 220 136" stroke-linejoin="round"><title>{code} - {MOUNTS[code]}</title>{DEFS}{b}</svg>'


if __name__ == '__main__':
    for k, f in ICONS.items():
        open(os.path.join(OUT, k + '.svg'), 'w').write(f())
    os.makedirs(OUTW, exist_ok=True)
    for k in WRI:
        open(os.path.join(OUTW, k + '.svg'), 'w').write(wri(k))
    os.makedirs(OUTM, exist_ok=True)
    for k in MOUNTS:
        open(os.path.join(OUTM, k + '.svg'), 'w').write(mount(k))
    print('series icons:', len(ICONS), ' WRI mounting options:', len(WRI), ' crane mountings:', len(MOUNTS))
