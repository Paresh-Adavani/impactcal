"""EI hydraulic crane buffer GA sheets (catalogue EI.pdf). FR = rear flange (A1), FF = front flange (A2, Z from
striker end to flange rear face). Flange SA sq / SB pitch / 4 x ØFC, body ØB, cap ØE, flange thk H."""
import os, re, sys, json
from buffer import buffer_sheet
from frame import protect
HERE = os.path.dirname(os.path.abspath(__file__))
def num(s):
    s = s.replace(',', '').replace(' ', '')
    return None if s in ('-', '') else float(s)
def parse():
    rows = {}
    for ln in open(os.path.join(HERE, '..', 'data', 'ei.txt'), encoding='utf-8'):
        ln = ln.replace('\u0395\u0399', 'EI').replace('El ', 'EI ')
        m = re.match(r'\s*(EI \d+ x \d+)\s+(.*)$', ln.rstrip())
        if not m: continue
        t = m.group(2).split()
        if len(t) < 14: continue
        tail = t[-7:]; t = t[:-7]                    # H, B, SA, SB, FC, bolt, E
        def take(join=True, maxpre=2):
            """one number that may be split as thousands ('1 345'), or '-'"""
            v = t.pop(0)
            if v == '-': return None
            if join and t and re.fullmatch(r'\d{3}', t[0]) and re.fullmatch(r'\d{1,%d}' % maxpre, v): v += t.pop(0)
            return float(v.replace('.', '').replace(',', '')) if re.fullmatch(r'[\d .,]+', v) and v.count('.') and len(v.split('.')[-1]) == 3 else float(v.replace(',', ''))
        try:
            S = take(False); ET = take(maxpre=3); FS = take(False); ext = float(t.pop(0)); comp = float(t.pop(0)); wt = float(t.pop(0))
            if t and t[0] == ('%g' % wt) or (t and re.fullmatch(r'\d+\.\d', t[0]) and float(t[0]) == wt): t.pop(0)
            A1 = take(); A2 = take(); Z = take()
            H, B, SA, SB, FC = [float(x) for x in tail[:5]]; bolt = tail[5]; E = float(tail[6])
        except (ValueError, IndexError): continue
        rows[m.group(1)] = dict(S=S, ET=ET, FS=FS, ext=ext, comp=comp, wt=wt, A1=A1, A2=A2, Z=Z, H=H, B=B, SA=SA, SB=SB, FC=FC, bolt=bolt, E=E)
    return rows
def sheet_for(model, mount, outdir, rows=None, date=None):
    r = (rows or parse())[model]
    L = r['A1'] if mount == 'FR' else r['A2']
    if L is None: return None
    size, stroke = model.split()[1], model.split()[3]
    g = dict(D=r['B'], L=L, S=r['S'], C=r['Z'] or 0, F=r['SA'], P=r['SB'], dh=r['FC'], t=r['H'], cap=round(r['E'] * 0.35),
             rod=round(r['B'] * 0.75), capD=r['E'], label='%s MOUNT  (%s)' % ('REAR FLANGE' if mount == 'FR' else 'FRONT FLANGE', mount))
    params = [('Stroke', '%g' % r['S'], 'mm'), ('Energy capacity per cycle', '{:,}'.format(int(r['ET'])), 'Nm'),
              ('Max. shock force', '%g' % r['FS'], 'kN'), ('Return force (extension)', '%g' % r['ext'], 'kN'),
              ('Return force (compression)', '%g' % r['comp'], 'kN'), ('Mounting bolts', '4 x %s' % r['bolt'], ''),
              ('Nitrogen charging pressure', '10', 'bar'), ('Working temperature', '10 to 50', '°C'),
              ('Weight (approx.)', '%g' % r['wt'], 'kg')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker cap face at full stroke.',
             '3. Mounting: %s shown. Also available: %s.' % (('FR rear flange', 'FF front flange') if mount == 'FR' else ('FF front flange', 'FR rear flange')),
             '4. Optional: B protective bellows over rod, C safety cable, rod position sensor.',
             '5. Nitrogen-charged return; working temperature 10 to 50 °C; SS construction on request.',
             '6. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    code = 'EI-%sX%s-%s' % (size, stroke, mount)
    meta = dict(title='EI %sx%s-%s' % (size, stroke, mount), subtitle='HYDRAULIC CRANE BUFFER - GENERAL ARRANGEMENT',
                dwgno='AT/GA/EI/%sX%s-%s' % (size, stroke, mount), rev='A', finish='Painted yellow',
                material='Steel body, hard-chrome rod', weight='%g kg' % r['wt'])
    if date: meta['date'] = date
    path = os.path.join(outdir, code + '.pdf')
    buffer_sheet(path, meta, g, 'RS' if mount == 'FR' else 'FS', params, notes, model); protect(path)
    return path
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    rows = parse(); print(len(rows), 'models'); man = []
    for m in rows:
        for mount in ('FR', 'FF'):
            p = sheet_for(m, mount, out, rows)
            if p: man.append(dict(series='EI', bk='EI%sX%s' % (m.split()[1], m.split()[3]), model=m, mounting=mount, filename=os.path.basename(p), path='EI/' + os.path.basename(p), source='generated from EI catalogue', rev='A'))
    json.dump(man, open(os.path.join(out, '_generated.json'), 'w'), indent=1); print(len(man), 'sheets')
