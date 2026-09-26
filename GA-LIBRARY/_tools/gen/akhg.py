"""AKHG hydraulic crane buffer GA sheets from the AKHG catalogue tables."""
import re, os, json, sys
from buffer import buffer_sheet
from frame import protect

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = os.path.join(HERE, '..', 'data', 'akhg.txt')

# per-series flange geometry (mm): body dia D, flange square F, hole pitch P, hole dia dh, flange thk t,
# striker cap length. Rod dia = 0.75 x body (49 on the 65 family per Adoni drawings), not dimensioned.  65/100/130/140/180 from existing Adoni GA drawings; 120 from catalogue
# outline drawing (220 sq / 170 / 4xØ18 / 30); 85 and 150 interpolated - flagged in index notes.
GEOM = {
    65:  dict(F=112, P=80,  dh=16, t=15, cap=26,  src='existing drawings'),
    85:  dict(F=120, P=88,  dh=18, t=16, cap=30,  src='interpolated - confirm'),
    100: dict(F=130, P=95,  dh=22, t=18, cap=32,  src='existing drawings'),
    120: dict(F=220, P=170, dh=26.5, t=30, cap=32, src='catalogue (EI 120 flange 220 sq / 170 / M24)'),
    130: dict(F=150, P=130, dh=22, t=30, cap=32,  src='existing drawings'),
    140: dict(F=160, P=140, dh=22, t=35, cap=38,  src='existing drawings'),
    150: dict(F=180, P=150, dh=26, t=38, cap=40,  src='interpolated - confirm'),
    180: dict(F=220, P=180, dh=26, t=40, cap=42,  src='existing drawings'),
}

def num(s): return float(s.replace(',', ''))

def parse():
    txt = open(TXT, encoding='utf-8').read().splitlines()
    series = {}; cur = None; mode = None; ext = None
    for ln in txt:
        m = re.match(r'\s*AKHG (\d+) Series', ln)
        if m:
            cur = int(m.group(1)); series[cur] = {'eng': {}, 'dim': {}}; mode = 'eng'; ext = None; continue
        if cur is None: continue
        if re.search(r'Rear Type', ln): mode = 'dim'; continue
        s = ln.strip()
        if not s: continue
        toks = s.replace('AKHG', ' ').split()
        toks = [t for t in toks if t not in ('AKHG',)]
        # standalone recoil-ext value (merged cell)
        if mode == 'eng' and len(toks) == 1 and re.match(r'^\d+(\.\d+)?$', toks[0]):
            ext = float(toks[0]); continue
        # row starts with model or -stroke
        m = re.match(r'^(?:AKHG\s*)?(\d+)?\s*-\s*(\d+)\s+(.*)$', s.replace('AKHG', '').strip())
        if not m: continue
        stroke = int(m.group(2)); rest = m.group(3).split()
        try:
            vals = [num(v) if re.match(r'^-?[\d,]*\.?\d+$', v) else None for v in rest]
        except ValueError:
            continue
        if mode == 'eng':
            if len(vals) < 5: continue
            S, ET, ETC, FS = vals[0], vals[1], vals[2], vals[3]
            tail = vals[4:]
            if len(tail) >= 5: e, comp, ra, fa, wt = tail[:5]
            elif len(tail) == 4: comp, ra, fa, wt = tail; e = None
            else: continue
            series[cur]['eng'][stroke] = dict(S=S, ET=ET, ETC=ETC, FS=FS, ext=e, comp=comp, ra=ra, fa=fa, wt=wt)
        else:
            if len(vals) < 3: continue
            S = vals[0]; A = vals[1]; B = vals[2]; C = vals[3] if len(vals) > 3 else None
            series[cur]['dim'][stroke] = dict(A=A, B=B, C=C)
    for k, v in series.items():
        exts = [r['ext'] for r in v['eng'].values() if r['ext'] is not None]
        # merged-cell ext: use the standalone value found in this series block
        pass
    return series

# recoil-extension merged-cell values read from the catalogue by hand (kN)
EXT = {65: 2.4, 85: 1.5, 100: 2.4, 120: 3.5, 130: 3.5, 140: 5.5, 150: 6, 180: 8}

def sheet_for(size, stroke, mount, outdir, series=None, date=None):
    series = series or parse()
    e = series[size]['eng'][stroke]; d = series[size]['dim'][stroke]
    L = d['A'] if mount == 'RS' else d['B']
    if L is None or L != L:
        raise ValueError('no %s length for AKHG %d-%d' % (mount, size, stroke))
    gm = GEOM[size]
    g = dict(D=size, L=L, S=stroke, C=d['C'] or 0, F=gm['F'], P=gm['P'], dh=gm['dh'], t=gm['t'], cap=gm['cap'], rod=round(0.75 * size))
    model = 'AKHG %d-%d' % (size, stroke)
    ext = e['ext'] if e['ext'] is not None else EXT[size]
    params = [('Stroke', '%g' % stroke, 'mm'),
              ('Energy capacity per cycle', '%g' % e['ET'], 'kJ'),
              ('Energy capacity per hour', '{:,}'.format(int(e['ETC'])), 'kJ/h'),
              ('Max. buffer force', '%g' % e['FS'], 'kN'),
              ('Recoil force (extension)', '%g' % ext, 'kN'),
              ('Recoil force (compression)', '%g' % e['comp'], 'kN'),
              ('Permitted side-load angle', '%g' % (e['ra'] if mount == 'RS' else e['fa']), '°'),
              ('Nitrogen charging pressure', '10', 'bar'),
              ('Working temperature', '10 to 50', '°C'),
              ('Weight (approx.)', '%g' % e['wt'], 'kg')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker cap face at full stroke.',
             '3. Mounting: %s shown. Also available: %s, SS both flanges, RC rod clevis, TM, FM.' % (
                 ('RS rear flange', 'FS front flange') if mount == 'RS' else ('FS front flange', 'RS rear flange')),
             '4. Optional accessories: B rubber bellow over rod, U urethane striker cap.',
             '5. Working temperature 10 to 50 °C; SS construction and sensors on request.',
             '6. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    meta = dict(title=model + '-' + mount, subtitle='HYDRAULIC CRANE BUFFER - GENERAL ARRANGEMENT',
                dwgno='AT/GA/AKHG/%d-%d-%s' % (size, stroke, mount), rev='A', finish='Painted yellow',
                material='Steel body, hard-chrome rod', weight='%g kg' % e['wt'])
    if date: meta['date'] = date
    fn = 'AKHG-%d-%d-%s.pdf' % (size, stroke, mount)
    path = os.path.join(outdir, fn)
    s = buffer_sheet(path, meta, g, mount, params, notes, model)
    protect(path)
    return path, gm['src']

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    ser = parse()
    for k in sorted(ser): print(k, 'eng', sorted(ser[k]['eng']), 'dim', sorted(ser[k]['dim']))
