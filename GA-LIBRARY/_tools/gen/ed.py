"""ED heavy-duty hydraulic buffer GA sheets (catalogue ED SERIES.pdf). Standard unit only - no bladder accumulator."""
import os, re, sys, json
from buffer import buffer_sheet
from frame import protect
HERE = os.path.dirname(os.path.abspath(__file__))
# body / rod / cap diameters by bore (inch): 1.5 from catalogue outline, 3.0 & 4.0 from the clevis-mount table (B, D, E);
# 2.0 and 3.5 interpolated. Flange: square 1.5 x body, 4 holes 0.25 x body on 0.8 x square, thickness 20-40 (indicative).
BORE = {'1.5': dict(body=80, rod=32, capD=55, t=20), '2.0': dict(body=100, rod=32, capD=70, t=25),
        '3.0': dict(body=130, rod=38, capD=90, t=30), '3.5': dict(body=165, rod=50, capD=115, t=35),
        '4.0': dict(body=200, rod=65, capD=140, t=40)}
def num(s): return float(s.replace(',', '').replace(' ', ''))
def parse():
    rows = {}; clevis = False
    for ln in open(os.path.join(HERE, '..', 'data', 'ed.txt'), encoding='utf-8'):
        if 'Clevis Mount' in ln: clevis = True
        if clevis: continue                       # clevis-mount dimension table uses the same model names
        if not re.match(r'\s*ED \d\.\d x \d+', ln): continue
        m = re.match(r'\s*(ED \d\.\d x \d+)\s+(.*)$', ln.rstrip())
        if not m: continue
        model = m.group(1); bore = model.split()[1]
        parts = re.split(r'\s{2,}', m.group(2).strip())
        if len(parts) < 12: continue
        def clean(p):
            toks = p.split()
            if any('/' in t for t in toks):
                toks = toks[:[i for i, t in enumerate(toks) if '/' in t][0]]
            return num(' '.join(toks))
        try:
            S, ET, ETC, FP, retBA, ret, A, F, Y, Z = [clean(p) for p in parts[0:10]]
        except ValueError: continue
        wt = num(parts[-1])
        rows[model] = dict(bore=bore, S=S, ET=ET, ETC=ETC, FP=FP, ret=ret, A=A, F=F, Y=Y, Z=Z, wt=wt)
    return rows
def sheet_for(model, outdir, rows=None, date=None):
    r = (rows or parse())[model]; b = BORE[r['bore']]
    S, A, Y, Z = r['S'], r['A'], r['Y'], r['Z']
    body, rod, capD, t = b['body'], b['rod'], b['capD'], b['t']
    Fsq = round(body * 1.5 / 5) * 5; P = round(Fsq * 0.8 / 5) * 5; dh = round(body * 0.25 / 2) * 2
    cap = round(capD * 0.4); gap = max(3, Z - S - cap)
    g = dict(D=body, L=A, S=S, C=A - (Y - t), F=Fsq, P=P, dh=dh, t=t, cap=cap, rod=rod, capD=capD, gap=gap, label='FRONT FLANGE MOUNT  (FF)')
    params = [('Stroke', '%g' % S, 'mm'), ('Energy capacity per cycle', '{:,}'.format(int(r['ET'])), 'Nm'),
              ('Energy capacity per hour', '{:,}'.format(int(r['ETC'])), 'Nm/h'), ('Max. shock force', '{:,}'.format(int(r['FP'])), 'N'),
              ('Nominal return force', '{:,}'.format(int(r['ret'])), 'N'), ('Max. cycle rate', '30', 'cycles/h'),
              ('Body length Y / rod projection Z', '%g / %g' % (Y, Z), 'mm'), ('Operating temperature', '-10 to +60', '°C'),
              ('Weight (approx.)', '%g' % r['wt'], 'kg')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker face at full stroke. Internal air/oil accumulator return.',
             '3. Front flange (FF) shown. Also: FR rear flange (not for strokes > 300 mm), TF both flanges, TM, FM foot, CM clevis.',
             '4. Flange and rod-end dimensions indicative - confirm with ADONI TECH before fixing the interface.',
             '5. Custom-orificed: full application data required at order. Bellows, safety cable, sensor on request.',
             '6. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    code = model.replace(' ', '').replace('x', 'x')            # ED1.5x2
    meta = dict(title=model, subtitle='HEAVY-DUTY HYDRAULIC BUFFER - GA', dwgno='AT/GA/ED/' + code[2:].upper(),
                rev='A', finish='Painted', material='Steel body, hard-chrome rod', weight='%g kg' % r['wt'])
    if date: meta['date'] = date
    fn = 'ED-%s.pdf' % code[2:].replace('x', 'x'); path = os.path.join(outdir, fn)
    buffer_sheet(path, meta, g, 'FS', params, notes, model); protect(path)
    return path
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    rows = parse(); print(len(rows), 'models')
    man = []
    for m in rows:
        p = sheet_for(m, out, rows)
        bk = 'ED' + m.split()[1] + 'X' + m.split()[3]
        man.append(dict(series='ED', bk=bk, model=m, mounting='FF', filename=os.path.basename(p), path='ED/' + os.path.basename(p), source='generated from ED catalogue (flange indicative)', rev='A'))
    json.dump(man, open(os.path.join(out, '_generated.json'), 'w'), indent=1)
