import os, re, csv, shutil, hashlib, datetime
from collections import defaultdict
HOME=os.path.expanduser('~')
SRC={'CB':f'{HOME}/mnt/all cranbuffer files','GA':f'{HOME}/mnt/GA DRAWINGS'}
PROD=f'{HOME}/mnt/claude/Projects/ImpactCal/data/products.csv'
OUT=f'{HOME}/mnt/claude/Projects/ImpactCal/GA-LIBRARY'
SUSPENDED_SERIES={'YSRA'}   # in products.csv but suspended (status on_request) - not part of the GA library
prods={r['bk']:r for r in csv.DictReader(open(PROD,encoding='utf-8-sig')) if r['series'] not in SUSPENDED_SERIES}
EXCLUDE=re.compile(r'SDH|Posco|11KVA|AC-42-20|AC-130-300',re.I)
PART=re.compile(r'BODY|ROD\b|CAP\b|PISTON|FLANG|PIPE|PLATE|BUSH|RIB|NRV|LOCK NUT|CYLINDER|RING|WASHER|LUG|\bS45|TC136|WR-20|NUT\b|floating|Operating-Mounting|distance',re.I)
MODEL=re.compile(r'\b(AKHG|AKHS|KHG|ACX|ADX|AC|AD|EI|SDH|MSB)\s*-?\s*(\d+)\s*[-X ]\s*(\d+)',re.I)
SBM=re.compile(r'\b(?:SB)?\s*-?\s*(1204|1220)\s*-?\s*([A-P])\b',re.I)
MOUNT=re.compile(r'[-\s](FS|RS|FF|FR|SS|RC|TM|FM)\b',re.I)
ACC=re.compile(r'\+\s*(MC|CL|S45|MF|JN|clevis-male)',re.I)
REV=re.compile(r'\b[rR](\d)\b')
def sha1(p):
    h=hashlib.sha1()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1<<16),b''): h.update(b)
    return h.hexdigest()
cands=[]
for tag,root in SRC.items():
    for dp,dn,fn in os.walk(root):
        for f in fn:
            if not f.lower().endswith('.pdf'): continue
            p=os.path.join(dp,f); rel=os.path.relpath(p,root)
            if PART.search(f) or EXCLUDE.search(f) or '/sdh/' in rel.replace(chr(92),'/').lower(): continue
            series=bk=model=''
            m=MODEL.search(f); s=SBM.search(f)
            if m:
                se=m.group(1).upper()
                if se=='KHG': se='AKHG'
                series=se; a,b=m.group(2),m.group(3)
                if se=='EI': model=f'EI {a} x {b}'; bk=f'EI{a}X{b}'
                elif se in('AKHG','AKHS','AD','ADX'): model=f'{se} {a}-{b}'; bk=f'{se}{a}{b}'
                else: model=f'{se}-{a}-{b}'; bk=f'{se}{a}{b}'
            elif s:
                series='SB'; a,b=s.group(1),s.group(2).upper()
                model=f'SB-{a}{b}' if a=='1204' else f'SB-{a}-{b}'; bk=f'SB{a}{b}'
            else: continue
            mt=MOUNT.search(f); mount=mt.group(1).upper() if mt else ''
            ac=ACC.search(f); acc=(ac.group(1).upper().replace('CLEVIS-MALE','CL')) if ac else ''
            rv=REV.search(f); rev=('R'+rv.group(1)) if rv else 'A'
            st=os.stat(p)
            cands.append(dict(src=tag,rel=rel,path=p,file=f,series=series,model=model,bk=bk,mount=mount,acc=acc,rev=rev,
                              mtime=st.st_mtime,bytes=st.st_size,sha=sha1(p),in_products=bk in prods))
# group by (bk,mount,acc); dedupe identical sha; pick newest as primary
groups=defaultdict(list)
for c in cands: groups[(c['bk'],c['mount'],c['acc'])].append(c)
import json
GENFILES=set(g['filename'] for g in json.load(open(os.path.join(OUT,'_generated.json')))) if os.path.exists(os.path.join(OUT,'_generated.json')) else set()
index=[]; dupes=[]
for key,lst in groups.items():
    seen=set(); uniq=[]
    for c in sorted(lst,key=lambda c:-c['mtime']):
        if c['sha'] in seen: continue
        seen.add(c['sha']); uniq.append(c)
    prim=uniq[0]; alts=uniq[1:]
    bk,mount,acc=key
    series=prim['series']
    name=bk if series not in('AKHG','AKHS','AD','ADX','AC','ACX','EI','SDH') else prim['model'].replace(' x ','X').replace(' ','-')
    name=prim['model'].replace(' x ','X').replace(' ','-')
    fn=name+(f'-{mount}' if mount else '')+(f'+{acc}' if acc else '')+'.pdf'
    d=os.path.join(OUT,series); os.makedirs(d,exist_ok=True)
    dst=os.path.join(d,fn)
    if fn in GENFILES: continue      # a generated sheet of the same name supersedes the old drawing
    shutil.copy2(prim['path'],dst)   # always refresh from source; protect.py re-applies watermark + password
    notes=[]
    if not prim['in_products']: notes.append('model not in products.csv')
    if alts: notes.append('older alternates: '+'; '.join(a['src']+':'+a['rel'] for a in alts))
    if re.search(r'assem|assly|\(1\)|supplied',prim['file'],re.I): notes.append('check: assembly-type sheet')
    index.append(dict(bk=bk,series=series,model=prim['model'],mounting=mount,accessory=acc,fmt='PDF',filename=fn,
        path=f'{series}/{fn}',rev=prim['rev'],source='existing',source_file=prim['src']+':'+prim['rel'],
        source_date=datetime.date.fromtimestamp(prim['mtime']).isoformat(),bytes=prim['bytes'],sha1=prim['sha'],
        status='review' if notes else 'ok',notes=' | '.join(notes)))
import json
genp=os.path.join(OUT,'_generated.json')
if os.path.exists(genp):
    gen=json.load(open(genp))
    keys={(r['bk'],r['mounting'],r['accessory']):i for i,r in enumerate(index)}
    for g in gen:
        key=(g['bk'],g.get('mounting',''),'')
        row=dict(bk=g['bk'],series=g['series'],model=g['model'],mounting=g.get('mounting',''),accessory='',fmt='PDF',
                 filename=g['filename'],path=g['path'],rev=g.get('rev','A'),source='generated',source_file=g.get('source',''),
                 source_date=datetime.date.today().isoformat(),bytes=os.path.getsize(os.path.join(OUT,g['path'])) if os.path.exists(os.path.join(OUT,g['path'])) else 0,
                 sha1='',status='generated',notes='' if g['bk'] in prods else 'model not in products.csv')
        if key in keys:
            old=index[keys[key]]
            if old['filename']!=row['filename']: row['notes']=(row['notes']+' | supersedes existing '+old['filename']).strip(' |')
            index[keys[key]]=row
        else:
            keys[key]=len(index); index.append(row)
index.sort(key=lambda r:(r['series'],r['model'],r['mounting'],r['accessory']))
cols=list(index[0].keys())
with open(f'{OUT}/ga_index.csv','w',newline='',encoding='utf-8') as fh:
    w=csv.DictWriter(fh,fieldnames=cols); w.writeheader(); w.writerows(index)
# gap report
have=set(r['bk'] for r in index)
by=defaultdict(list)
for bk,p in prods.items(): by[p['series']].append(p)
lines=[f'# GA library gap report — {datetime.date.today()}','',f'Index rows: {len(index)} files. products.csv: {len(prods)} models.','',
       '| Series | Models in products.csv | With GA PDF | Missing |','|---|---|---|---|']
missing={}
for se,lst in sorted(by.items()):
    got=[p for p in lst if p['bk'] in have]; miss=[p['model'] for p in lst if p['bk'] not in have]
    missing[se]=miss
    lines.append(f'| {se} | {len(lst)} | {len(got)} | {len(miss)} |')
lines+=['','## Missing models by series','']
for se,miss in sorted(missing.items()):
    if miss: lines.append(f'**{se}** ({len(miss)}): '+', '.join(miss)); lines.append('')
extra=sorted(set(r['model'] for r in index if r['bk'] not in prods))
lines+=['## Drawings found for models NOT in products.csv','',', '.join(extra),'']
open(f'{OUT}/GAP_REPORT.md','w').write('\n'.join(lines))
print('\n'.join(lines))
import subprocess; subprocess.run(['python3', os.path.join(OUT,'_tools','protect.py')])
