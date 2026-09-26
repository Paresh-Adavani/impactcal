"""AC / AD / ACX industrial shock absorber GA sheets - one parametric outline, data from the AC catalogue tables
(AD shares every outline dimension; AD <= 36 shows the rear adjuster boss, AC never does)."""
import os, re, sys
from frame import Sheet, std_scale, protect, THICK, THIN

HERE = os.path.dirname(os.path.abspath(__file__))
TAB = open(os.path.join(HERE, '..', 'data', 'ac_tables.txt'), encoding='utf-8').read()

def table(n):
    m = re.search(r'=== TABLE %d .*?\n(.*?)(?==== TABLE|\Z)' % n, TAB, re.S)
    rows = [[c.strip() for c in ln.split('|')] for ln in m.group(1).strip().splitlines()]
    return rows[0], rows[1:]

def f(v):
    v = v.replace(',', '').replace('–', '-').strip()
    return float(v) if re.match(r'^-?\d+(\.\d+)?$', v) else v

# cap projection (length lost with the N option) by thread family - table 8
CAP = {}
for r in table(8)[1]:
    for key in re.findall(r'(\d+)', r[0].split('series')[0]):
        pass
CAPLEN = {8: 6, 10: 6, 12: 9.5, 14: 8, 16: 11, 20: 11, 22: 11, 25: 13, 26: 13, 30: 20, 33: 20, 36: 20, 37: 20,
          42: 26, 45: 30, 64: 32, 85: 42, 115: 55}
CAPLEN_1412 = 14.3
NUTAF = {}   # thread size -> (A/F, thk) from lock-nut table 26
for r in table(26)[1]:
    for i in (0, 4):
        m = re.match(r'LN-(\d+)', r[i])
        if m: NUTAF[int(m.group(1))] = (f(r[i + 2]), f(r[i + 3]))

def dims():
    """returns {model_key: geom} for AC/ACX outline; key like 'AC 42-50' / 'ACX 64-150' / 'AC 14-10'."""
    G = {}
    # mini - table 9: Model Thread Stroke A B C D E F H I
    for r in table(9)[1]:
        d = int(r[1].split()[1].split('X')[0]); S = f(r[2])
        G[r[0]] = dict(fam='mini', d=d, thread=r[1], S=S, A=f(r[3]), B=f(r[4]), capD=f(r[5]), rod=f(r[6]), cap=f(r[7]),
                       af=f(r[9]), nut=f(r[10]), C=0, K=0, bodyD=None)
    # small - table 11: Model Thread Stroke B C D E F G H A/F   (A = B + S + F)
    for r in table(11)[1]:
        d = int(r[1].split()[1].split('X')[0]); S = f(r[2]); B = f(r[3]); F = f(r[7])
        G[r[0]] = dict(fam='small', d=d, thread=r[1], S=S, A=B + S + F, B=B, capD=f(r[6]), rod=f(r[5]), cap=F,
                       af=f(r[10]), nut=f(r[9]), C=f(r[4]), K=round(d * 0.6), bodyD=None)
    # medium - table 13: Model Thread Stroke A B C D E F G H K
    for r in table(13)[1]:
        d = int(r[1].split()[1].split('X')[0])
        G[r[0]] = dict(fam='medium', d=d, thread=r[1], S=f(r[2]), A=f(r[3]), B=f(r[4]), capD=f(r[7]), rod=f(r[6]), cap=CAPLEN[d],
                       af=NUTAF[d][0], nut=f(r[10]), C=f(r[5]), K=f(r[11]), bodyD=None)
    # large - table 16 and ACX table 18: Model Thread Stroke A B D E H ØS
    for n in (16, 18):
        for r in table(n)[1]:
            d = int(r[1].split()[1].split('X')[0])
            G[r[0]] = dict(fam='large', d=d, thread=r[1], S=f(r[2]), A=f(r[3]), B=f(r[4]), capD=f(r[6]), rod=f(r[5]), cap=CAPLEN[d],
                           af=NUTAF[d][0], nut=f(r[7]), C=0, K=0, bodyD=f(r[8]))
    return G

def perf_ac():
    """AC/ACX per-code performance -> {model: dict(S, E, EH, me_min, me_max, v_min, v_max, spring, wt, codes)}"""
    P = {}
    for n in (10, 12, 14, 15, 17, 19, 20):
        try: hdr, rows = table(n)
        except Exception: continue
        if not hdr or not hdr[0].startswith('Model'): continue
        for r in rows:
            m = re.match(r'(ACX?)-(\d+)-(\d+)-(\d)', r[0])
            if not m: continue
            key = '%s %s-%s' % (m.group(1), m.group(2), m.group(3))
            me = [f(x) for x in r[4].replace('–', '-').split('-')]; v = [f(x) for x in r[5].replace('–', '-').split('-')]
            p = P.setdefault(key, dict(S=f(r[1]), E=f(r[2]), EH=f(r[3]), me_min=me[0], me_max=me[1], v_min=v[0], v_max=v[1],
                                       spring=r[6], wt=f(r[7]), codes=[]))
            p['codes'].append(int(m.group(4)))
            p['me_min'] = min(p['me_min'], me[0]); p['me_max'] = max(p['me_max'], me[1])
            p['v_min'] = min(p['v_min'], v[0]); p['v_max'] = max(p['v_max'], v[1])
    return P

def perf_ad():
    """AD performance from the AD catalogue text: {model: dict(S, E, EH, me_min, me_max, spring, wt)}"""
    P = {}
    txt = open(os.path.join(HERE, '..', 'data', 'ad.txt'), encoding='utf-8').read().splitlines()
    for ln in txt:
        m = re.match(r'\s*AD (\d+)-(\d+)\s*\S*\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,\-]+)\s+([\d,\-]+)\s+(\d+)\s+(\d+)\s+(\d+)', ln)
        if not m: continue
        key = 'AD %s-%s' % (m.group(1), m.group(2))
        def rng(s):
            s = s.replace(',', '')
            return [float(x) for x in s.split('-')] if '-' in s else [float(s)]
        me1 = rng(m.group(6)); me2 = rng(m.group(7)) if m.group(7) != '-' else me1
        P[key] = dict(S=float(m.group(3)), E=f(m.group(4)), EH=f(m.group(5)), me_min=min(me1), me_max=max(me2),
                      spring='%s – %s' % (m.group(8), m.group(9)), wt=float(m.group(10)))
    return P

def draw_shock(sh, g, series, model, adjuster):
    d, A, B, S, rod, capD, cap = g['d'], g['A'], g['B'], g['S'], g['rod'], g['capD'], g['cap']
    af, nut, C, K = g['af'], g['nut'], g['C'], g['K']
    if series == 'AC' and g['fam'] in ('small', 'medium') and C:
        A = A - C; B = B - C            # AC: rear adjuster projection removed, body shortened accordingly
        C = 0
    Dmax = max(d, capD, af, g['bodyD'] or 0)
    s = std_scale(A, Dmax, 160.0, 46.0); k = 1.0 / s
    ox = 30.0; cy = 196.0 - 22.0 - Dmax * k / 2
    X = lambda x: ox + x * k; R = lambda r: r * k
    x0 = 0.0
    # rear adjuster boss (AD <= 36 only): length C, across-flats K, drawn as a smaller cylinder at the rear
    if adjuster and C:
        sh.rect(X(0), cy - R(K / 2), R(C), R(K), THICK); x0 = C
    # body
    if g['fam'] == 'large' and g['bodyD']:
        plain = A - cap - S - 5 - B
        if plain > 2:
            sh.rect(X(x0), cy - R(g['bodyD'] / 2), R(plain), R(g['bodyD']), THICK); xb = x0 + plain
        else: xb = x0
        sh.rect(X(xb), cy - R(d / 2), R(B), R(d), THICK); body_end = xb + B
    else:
        body_end = A - cap - S - (3 if g['fam'] != 'medium' else 12)
        body_end = max(body_end, x0 + B) if g['fam'] == 'mini' else B if not adjuster else B
        body_end = B
        sh.rect(X(x0), cy - R(d / 2), R(body_end - x0), R(d), THICK)
        xb = x0
    # thread minor-diameter lines (thin) over threaded length
    pitch = float(g['thread'].split('X')[-1]) if 'X' in g['thread'] else 1.5
    dm = d - 1.22 * pitch
    sh.line(X(xb), cy + R(dm / 2), X(body_end), cy + R(dm / 2), THIN); sh.line(X(xb), cy - R(dm / 2), X(body_end), cy - R(dm / 2), THIN)
    # two lock nuts (hex, across flats af, thickness nut) on the threaded body
    for i, xn in enumerate((xb + (body_end - xb) * 0.32, xb + (body_end - xb) * 0.32 + nut + 2)):
        sh.rect(X(xn), cy - R(af / 2), R(nut), R(af), THICK, fill=1.0)
        sh.rect(X(xn), cy - R(af / 2), R(nut), R(af), THICK)
        for yy in (af / 2 * 0.5, -af / 2 * 0.5): sh.line(X(xn), cy + R(yy), X(xn + nut), cy + R(yy), THIN)
    # rod and cap
    rod_end = A - cap
    sh.rect(X(body_end), cy - R(rod / 2), R(rod_end - body_end), R(rod), THICK)
    sh.rect(X(rod_end), cy - R(capD / 2), R(cap), R(capD), THICK)
    if g['fam'] == 'medium':   # external return spring between body and cap - drawn as zig-zag outline
        n = 6; x1 = body_end + 1; x2 = rod_end - 1; step = (x2 - x1) / n; rs = capD / 2 * 0.95
        for i in range(n):
            xa, xm, xc = x1 + i * step, x1 + (i + 0.5) * step, x1 + (i + 1) * step
            sh.line(X(xa), cy + R(rs), X(xm), cy - R(rs), THIN); sh.line(X(xm), cy - R(rs), X(xc), cy + R(rs), THIN)
    sh.centerline(X(-6), cy, X(A + 6), cy)
    sh.line(X(rod_end - S), cy - R(capD / 2) - 1, X(rod_end - S), cy + R(capD / 2) + 1, THIN, dash=(2, 1))
    # dims
    top = cy + R(Dmax / 2); bot = cy - R(Dmax / 2)
    sh.dim_h(X(rod_end - S), X(rod_end), top + 7, 'STROKE %g' % S, yfeat=(cy + R(capD / 2), cy + R(capD / 2)))
    sh.dim_h(X(x0), X(body_end), top + 13, '%g' % (body_end - x0), yfeat=(cy + R(d / 2), cy + R(d / 2)))
    sh.dim_h(X(0), X(A), top + 19, '%g' % A, yfeat=(cy + R(d / 2 if not (adjuster and C) else K / 2), cy + R(capD / 2)))
    if adjuster and C: sh.dim_h(X(0), X(C), bot - 7, '%g' % C, yfeat=(cy - R(K / 2), cy - R(K / 2)), txt_above=False)
    sh.dim_h(X(rod_end), X(A), bot - 7, '%g' % cap, yfeat=(cy - R(capD / 2), cy - R(capD / 2)), txt_above=False)
    sh.dim_v(cy - R(capD / 2), cy + R(capD / 2), X(A) + 6, 'Ø%g' % capD, xfeat=(X(A), X(A)))
    sh.leader(X(xb + (body_end - xb) * 0.75), cy + R(d / 2), X(xb + (body_end - xb) * 0.75) + 6, cy + R(d / 2) + 5.5, g['thread'].replace(' ', '').replace('X', ' x '))
    sh.leader(X(xb + (body_end - xb) * 0.32 + nut + 2 + nut / 2), cy - R(af / 2), X(body_end) + 4, bot - 4.5, '2 LOCK NUTS A/F %g' % af)
    if g['fam'] == 'large' and g['bodyD'] and plain > 2:
        sh.dim_v(cy - R(g['bodyD'] / 2), cy + R(g['bodyD'] / 2), X(0) - 6, 'Ø%g' % g['bodyD'], xfeat=(X(0), X(0)), txt_left=True)
    # end view from rod end: hex nut outline, thread circle, cap circle
    se = std_scale(max(af, capD), max(af, capD), 40, 40); ke = 1.0 / se; R2 = lambda r: r * ke
    ex = 285 - 16 - R2(af / 2) - 8; ey = cy
    import math
    rr = R2(af / 2) / math.cos(math.radians(30))
    pts = [(ex + rr * math.cos(math.radians(60 * i + 30)), ey + rr * math.sin(math.radians(60 * i + 30))) for i in range(6)]
    for i in range(6): sh.line(pts[i][0], pts[i][1], pts[(i + 1) % 6][0], pts[(i + 1) % 6][1], THICK)
    sh.circle(ex, ey, R2(d / 2), THICK); sh.circle(ex, ey, R2(dm / 2), THIN)
    sh.circle(ex, ey, R2(capD / 2), THICK); sh.circle(ex, ey, R2(rod / 2), THIN)
    sh.centerline(ex - rr - 4, ey, ex + rr + 4, ey); sh.centerline(ex, ey - rr - 4, ex, ey + rr + 4)
    sh.dim_h(ex - R2(af / 2), ex + R2(af / 2), ey - rr - 6, 'A/F %g' % af, yfeat=(ey - R2(af / 2) * 0.87, ey - R2(af / 2) * 0.87), txt_above=False)
    sh.text(ex, ey - rr - 13, 'VIEW FROM ROD END' + ('' if se == s else '  (SCALE 1:%g)' % se if se > 1 else '  (SCALE %g:1)' % (1 / se)), 2.3, bold=True, anchor='c')
    return s

def sheet_for(series, key, outdir, GEOM=None, PAC=None, PAD=None, date=None):
    GEOM = GEOM or dims(); PAC = PAC or perf_ac(); PAD = PAD or perf_ad()
    num = key.split(' ', 1)[1]                       # '42-50'
    g = GEOM[('ACX ' if series == 'ACX' else 'AC ') + num]
    body = int(num.split('-')[0]); adjuster = (series == 'AD' and body <= 36)
    model = '%s %s' % (series, num)
    p = PAD.get('AD ' + num) if series == 'AD' else PAC.get(model)
    if series == 'AD':
        params = [('Stroke', '%g' % g['S'], 'mm'), ('Thread', g['thread'], ''),
                  ('Energy capacity per cycle', '{:,}'.format(int(p['E'])) if p else '-', 'Nm'),
                  ('Energy capacity per hour', '{:,}'.format(int(p['EH'])) if p else '-', 'Nm/h'),
                  ('Effective mass range', '{:,} – {:,}'.format(int(p['me_min']), int(p['me_max'])) if p else '-', 'kg'),
                  ('Return spring force', p['spring'] if p else '-', 'N'),
                  ('Damping', 'Adjustable' + (' (rear adjuster)' if adjuster else ''), ''),
                  ('Rod end shown', 'PU cap (std)', ''), ('Weight (approx.)', '%g' % p['wt'] if p else '-', 'g')]
    else:
        params = [('Stroke', '%g' % g['S'], 'mm'), ('Thread', g['thread'], ''),
                  ('Energy capacity per cycle', '{:,}'.format(int(p['E'])) if p else '-', 'Nm'),
                  ('Energy capacity per hour', '{:,}'.format(int(p['EH'])) if p else '-', 'Nm/h'),
                  ('Effective mass range (all codes)', '{:,} – {:,}'.format(round(p['me_min'], 1), int(p['me_max'])) if p else '-', 'kg'),
                  ('Impact velocity range', '%g – %g' % (p['v_min'], p['v_max']) if p else '-', 'm/s'),
                  ('Return spring force', p['spring'] if p else '-', 'N'),
                  ('Damping codes', ', '.join('-%d' % c for c in sorted(p['codes'])) if p else '-', ''),
                  ('Rod end shown', 'PU cap (std)', ''), ('Weight (approx.)', '%g' % p['wt'] if p else '-', 'g')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker face at full stroke.',
             '3. Rod end options: N no cap (length A less cap projection %g), PU cap shown, MC metallic cap.' % g['cap'],
             '4. Two lock nuts supplied. Accessories on request: FM foot mount, FN / SF flange, SC stop collar' + (', CL clevis.' if body >= 42 else '.'),
             ('5. Self-compensating fixed damping - specify damping code at order; no rear adjuster.' if series != 'AD'
              else ('5. Damping set by rear adjuster at installation.' if adjuster else '5. Damping adjustable at installation.')),
             '6. Selection: impactcal.netlify.app  |  www.adonitech.co.in']
    sub = {'AC': 'SELF-COMPENSATING SHOCK ABSORBER - GA', 'ACX': 'EXTENDED-CAPACITY SHOCK ABSORBER - GA',
           'AD': 'ADJUSTABLE SHOCK ABSORBER - GA'}[series]
    meta = dict(title=model + '-M', subtitle=sub, dwgno='AT/GA/%s/%s-M' % (series, num), rev='A', finish='Black oxide',
                material='Alloy steel body, HCP rod', weight=('%g g' % p['wt']) if p else '')
    if date: meta['date'] = date
    fn = '%s-%s.pdf' % (series, num); path = os.path.join(outdir, fn)
    sh = Sheet(path, meta); s = draw_shock(sh, g, series, model, adjuster)
    sh.m['scale'] = ('1:%g' % s) if s >= 1 else ('%g:1' % (1 / s))
    sh.tech_table(14, 108, params, colw=(46, 30, 10)); sh.notes(104, 104.5, notes, title='NOTES')
    sh.frame(); sh.save(); protect(path)
    return path

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    G = dims(); PAC = perf_ac(); PAD = perf_ad()
    print(len(G), 'outlines', len(PAC), 'AC perf', len(PAD), 'AD perf')
    for a in sys.argv[2:]:
        series, num = a.split(':'); print(sheet_for(series, series + ' ' + num, out, G, PAC, PAD))
