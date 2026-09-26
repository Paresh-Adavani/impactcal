"""Regenerate the whole GA library in one pass with sequential drawing dates:
first sheet drawn 20-02-2021, each next sheet +2 days, approval = drawn + 2 days (frame.py)."""
import os, sys, json, datetime, shutil
import akhg, akhs, ei, ed, sb, jhqc, shock
OUT = sys.argv[1] if len(sys.argv) > 1 else '../out/ALL'
START = datetime.date(2021, 2, 20); STEP = 2
jobs = []   # (series, bk, model, mounting, fn_callable)
# AKHG - every catalogue size, both mounts where the catalogue gives a length
ser = akhg.parse()
for size in sorted(ser):
    for st in sorted(ser[size]['dim']):
        if st not in ser[size]['eng']: continue
        d = ser[size]['dim'][st]
        for m in ('RS', 'FS'):
            if (d['A'] if m == 'RS' else d['B']) is None: continue
            jobs.append(('AKHG', 'AKHG%d%d' % (size, st), 'AKHG %d-%d' % (size, st), m,
                         lambda out, date, size=size, st=st, m=m: akhg.sheet_for(size, st, m, out, ser, date=date)[0]))
for mdl in akhs.DATA:
    jobs.append(('AKHS', mdl.replace(' ', '').replace('-', ''), mdl, 'RS', lambda out, date, mdl=mdl: akhs.sheet_for(mdl, out, date=date)))
eir = ei.parse()
for mdl in sorted(eir, key=lambda k: (int(k.split()[1]), int(k.split()[3]))):
    for m in ('FR', 'FF'):
        if (eir[mdl]['A1'] if m == 'FR' else eir[mdl]['A2']) is None: continue
        jobs.append(('EI', 'EI%sX%s' % (mdl.split()[1], mdl.split()[3]), mdl, m, lambda out, date, mdl=mdl, m=m: ei.sheet_for(mdl, m, out, eir, date=date)))
edr = ed.parse()
for mdl in sorted(edr, key=lambda k: (float(k.split()[1]), int(k.split()[3]))):
    jobs.append(('ED', 'ED%sX%s' % (mdl.split()[1], mdl.split()[3]), mdl, 'FF', lambda out, date, mdl=mdl: ed.sheet_for(mdl, out, edr, date=date)))
sbr = sb.parse()
for mdl in sbr: jobs.append(('SB', mdl.replace('-', ''), mdl, '', lambda out, date, mdl=mdl: sb.sheet_for(mdl, out, sbr, date=date)))
jr = jhqc.parse()
for mdl in sorted(jr, key=lambda k: int(k.split('-')[-1])): jobs.append(('JHQC', mdl.replace('-', ''), mdl, '', lambda out, date, mdl=mdl: jhqc.sheet_for(mdl, out, jr, date=date)))
G = shock.dims(); PAC = shock.perf_ac(); PAD = shock.perf_ad()
def body_key(k): n = k.split(' ', 1)[1]; return (int(n.split('-')[0]), int(n.split('-')[1]))
for series in ('AC', 'ACX', 'AD'):
    keys = [k for k in G if k.startswith('AC ')] if series in ('AC', 'AD') else [k for k in G if k.startswith('ACX ')]
    for k in sorted(keys, key=body_key):
        n = k.split(' ', 1)[1]
        if series == 'AD' and ('AD ' + n) not in PAD and n not in ('14-10', '16-13', '20-20', '20-50', '22-20', '25-25', '25-40', '26-25'): continue
        model = ('%s %s' % (series, n)) if series == 'AD' else ('%s-%s' % (series, n))
        jobs.append((series, series + n.replace('-', ''), model, '', lambda out, date, series=series, n=n: shock.sheet_for(series, series + ' ' + n, out, G, PAC, PAD, date=date)))
man = []
for i, (series, bk, model, mount, fn) in enumerate(jobs):
    date = (START + datetime.timedelta(days=STEP * i)).strftime('%d-%m-%y')
    d = os.path.join(OUT, series); os.makedirs(d, exist_ok=True)
    p = fn(d, date)
    man.append(dict(series=series, bk=bk, model=model, mounting=mount, filename=os.path.basename(p), path=series + '/' + os.path.basename(p),
                    source='generated from catalogue', rev='A', drawn=date))
json.dump(man, open(os.path.join(OUT, '_generated.json'), 'w'), indent=1)
from collections import Counter
print(len(man), 'sheets', Counter(m['series'] for m in man), 'last date', man[-1]['drawn'])
