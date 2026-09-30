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
    b += rect(x0 + L - 10, CY - 35, 9, 70, 'steel', 1)          # front flange at the rod end
    b += f'<circle cx="{x0 + L - 5.5}" cy="{CY - 27}" r="2.6" fill="#fff" {S}/><circle cx="{x0 + L - 5.5}" cy="{CY + 27}" r="2.6" fill="#fff" {S}/>'
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
    b += rect(fx, CY - 38, 9, 76, 'steel', 1) + f'<circle cx="{fx + 4.5}" cy="{CY - 30}" r="2.8" fill="#fff" {S}/><circle cx="{fx + 4.5}" cy="{CY + 30}" r="2.8" fill="#fff" {S}/>'
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


if __name__ == '__main__':
    for k, f in ICONS.items():
        open(os.path.join(OUT, k + '.svg'), 'w').write(f())
    os.makedirs(OUTW, exist_ok=True)
    for k in WRI:
        open(os.path.join(OUTW, k + '.svg'), 'w').write(wri(k))
    print('series icons:', len(ICONS), ' WRI mounting options:', len(WRI))
