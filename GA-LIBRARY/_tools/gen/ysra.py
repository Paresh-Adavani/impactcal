"""YSRA fixed-damping single-acting shock absorbers (catalogue YSRA SERIES.pdf) - drawn with the shock outline."""
import os, sys, json
from frame import Sheet, protect
import shock
# model: thread, stroke, E Nm/stroke, EH Nm/h, B1 nut thk, D2 rod, D3, D4 cap dia, L1 overall, L2, L3, L4, L5, SW1 A/F
DATA = {'YSR-8-8':   ('M 12X1',   10, 5,  16000, 6, 4, 12, 10, 53, 51, 10, 15, 10, 19),
        'YSR-12-12': ('M 16X1',   13, 10, 34000, 6, 6, 12, 14, 66, 62, 13, 16, 11, 21),
        'YSR-16-20': ('M 22X1.5', 20, 50, 60000, 6, 6, 18, 20, 82, 78, 20, 22, 16, 27),
        'YSR-20-25': ('M 26X1.5', 25, 80, 90000, 7, 6, 18, 22, 106, 98, 25, 20, 16, 30)}
def sheet_for(model, outdir, date=None):
    thread, S, E, EH, B1, D2, D3, D4, L1, L2, L3, L4, L5, SW = DATA[model]
    d = int(thread.split()[1].split('X')[0]); cap = round(D4 * 0.5)
    g = dict(fam='mini', d=d, thread=thread, S=S, A=L1, B=L1 - S - cap - 2, capD=D4, rod=D2, cap=cap, af=SW, nut=B1, C=0, K=0, bodyD=None)
    params = [('Stroke', '%g' % S, 'mm'), ('Thread', thread, ''), ('Energy capacity per stroke', '%g' % E, 'Nm'),
              ('Energy capacity per hour', '{:,}'.format(EH), 'Nm/h'), ('Impact velocity', '0.1 – 2.5', 'm/s'),
              ('Temperature range', '-10 to +80', '°C'), ('Damping', 'Fixed, single acting', ''),
              ('Rod end shown', 'PU cap (std)', ''), ('Return', 'Internal spring', '')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker face at full stroke.',
             '3. Rod end options: MC metallic cap, PU cap (shown), NC no cap - order code YSR model + MC / PU / NC.',
             '4. Housing steel, anticorrosive black finish; PU seals; hard-chrome ground rod; built-in mechanical end stop.',
             '5. Body length and cap projection indicative - confirm with ADONI TECH before fixing the interface.',
             '6. Selection: impactcal.netlify.app  |  www.adonitech.co.in']
    meta = dict(title=model, subtitle='FIXED-DAMPING SHOCK ABSORBER - GA', dwgno='AT/GA/YSRA/' + model[4:], rev='A',
                finish='Black oxide', material='Steel housing, HCP rod')
    if date: meta['date'] = date
    path = os.path.join(outdir, model + '.pdf')
    sh = Sheet(path, meta); s = shock.draw_shock(sh, g, 'YSR', model, False)
    sh.m['scale'] = ('1:%g' % s) if s >= 1 else ('%g:1' % (1 / s))
    sh.tech_table(14, 108, params, colw=(46, 30, 10)); sh.notes(104, 104.5, notes, title='NOTES')
    sh.frame(); sh.save(); protect(path); return path
if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True); man = []
    for m in DATA:
        p = sheet_for(m, out); man.append(dict(series='YSRA', bk=m.replace('-', ''), model=m, mounting='', filename=os.path.basename(p), path='YSRA/' + os.path.basename(p), source='generated from YSRA catalogue (lengths indicative)', rev='A'))
    json.dump(man, open(os.path.join(out, '_generated.json'), 'w'), indent=1); print(len(man))
