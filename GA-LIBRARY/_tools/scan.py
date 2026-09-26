import os, re, csv, sys, json
HOME=os.path.expanduser('~')
SRC={'CB':f'{HOME}/mnt/all cranbuffer files','GA':f'{HOME}/mnt/GA DRAWINGS'}
PROD=f'{HOME}/mnt/claude/Projects/ImpactCal/data/products.csv'
OUT=f'{HOME}/mnt/claude/Projects/ImpactCal/GA-LIBRARY'
prods={}
for r in csv.DictReader(open(PROD,encoding='utf-8-sig')):
    prods[r['bk']]=r
def norm(s):  # -> bk-like key
    s=s.upper().replace('X','-').replace(' ','').replace('_','-')
    s=re.sub(r'-+','-',s)
    return s.replace('-','')
PART=re.compile(r'BODY|ROD|CAP|PISTON|FLANG|PIPE|PLATE|BUSH|RIB|NRV|LOCK NUT|CYLINDER|RING|WASHER|LUG|S45|TC136|WR-20|NUT|floating',re.I)
MODEL=re.compile(r'(AKHG|AKHS|KHG|ACX|ADX|AC|AD|EI|SB|JHQ-?C|SDH|MSB)\s*-?\s*(\d+)\s*[-X ]\s*(\d+)',re.I)
MOUNT=re.compile(r'[-\s](FS|RS|FF|FR|SS|RC|TM|FM|MC|CL|PU|JN|MF)\b',re.I)
rows=[]
for tag,root in SRC.items():
    for dp,dn,fn in os.walk(root):
        for f in fn:
            if not f.lower().endswith('.pdf'): continue
            rel=os.path.relpath(os.path.join(dp,f),root)
            m=MODEL.search(f)
            kind='part' if PART.search(f) else ('ga' if m else 'other')
            series=model=bk=''
            if m:
                s=m.group(1).upper().replace('KHG','AKHG').replace('AAKHG','AKHG').replace('JHQC','JHQ-C')
                if s=='JHQ-C': s='JHQC'
                series=s; model=f"{s} {m.group(2)}-{m.group(3)}"
                bk=f"{s}{m.group(2)}{m.group(3)}"
                # SB has letter variants; EI uses x
                if s=='EI': bk=f"EI{m.group(2)}X{m.group(3)}"
            mt=MOUNT.search(f); mount=mt.group(1).upper() if mt else ''
            rows.append(dict(src=tag,rel=rel,file=f,kind=kind,series=series,model=model,bk=bk,mount=mount,
                             in_products='Y' if bk in prods else ('' if not bk else 'N'),bytes=os.path.getsize(os.path.join(dp,f))))
with open(f'{OUT}/_tools/scan_result.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
ga=[r for r in rows if r['kind']=='ga']
print('pdfs',len(rows),'ga-like',len(ga),'parts',sum(r['kind']=='part' for r in rows),'other',sum(r['kind']=='other' for r in rows))
have=set(r['bk'] for r in ga if r['in_products']=='Y')
from collections import Counter
print('products by series:',Counter(p['series'] for p in prods.values()))
print('covered by series:',Counter(prods[b]['series'] for b in have))
print('GA-like not in products.csv:',sorted(set(r['bk'] for r in ga if r['in_products']=='N')))
print('OTHER:',[r['file'] for r in rows if r['kind']=='other'])
