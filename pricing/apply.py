import pandas as pd, csv, io, math, json, re
B='/home/claude/build/data/'
def rd(p): return list(csv.DictReader(open(B+p,encoding='utf-8-sig')))
def wr(p,rows,hdr): 
    out=io.StringIO(); w=csv.DictWriter(out,hdr,lineterminator='\n'); w.writeheader(); w.writerows(rows); open(B+p,'w',encoding='utf-8-sig').write(out.getvalue())
# 1. add the models that are priced in the files but missing from the catalogue (ratings interpolated from siblings, flagged)
sa=rd('shock_absorbers.csv'); hdr=list(sa[0].keys()); by={r['model']:r for r in sa}
def clone(src,model,bk,stroke=None,nm=None,note=''):
    r=dict(by[src]); r['model']=model; r['bk']=bk
    if stroke: 
        k=float(stroke)/float(r['stroke_mm']); r['stroke_mm']=f'{float(stroke):g}'
        r['nm_per_cycle']=f'{float(r["nm_per_cycle"])*k:g}'; r['nm_per_hour']=f'{float(r["nm_per_hour"])*k**0.7:g}'
        if r.get('me_max_kg'): r['me_max_kg']=f'{float(r["me_max_kg"])*k:g}'
    if nm: r['nm_per_cycle']=f'{nm:g}'
    r['status']='estimated'; r['note']=(note or f'ratings interpolated from {src}; confirm against drawing/test')+' '; r['confidence']='low'; r['price_inr']=''
    return r
add=[]
for bore,strokes in [('85',[300,400,500]),('130',[100,150,200,1000])]:
    for st in strokes:
        m=f'AKHG {bore}-{st}'
        if m in by: continue
        sib=sorted([r for r in sa if r['model'].startswith(f'AKHG {bore}-')],key=lambda r:abs(float(r['stroke_mm'])-st))[0]
        add.append(clone(sib['model'],m,f'AKHG{bore}{st}',stroke=st))
for src,m,bk,st,note in [('AC-20-20','AC-20-15','AC2015',15,''),('AD 20-20','AD 20-15','AD2015',15,''),('AC-26-25','AC-27-25','AC2725',None,'same ratings as AC-26-25 (M27x3 thread variant)'),('AD 26-25','AD 27-25','AD2725',None,'same ratings as AD 26-25 (M27x3 thread variant)'),('ACX-45-50','AD 45-50','AD4550',None,'adjustable version of ACX-45-50; ratings copied')]:
    if m not in by: add.append(clone(src,m,bk,stroke=st,note=note))
sa+=add; print('added',[r['model'] for r in add])
# 2. prices from costing
cost=pd.read_csv('costing_out.csv')
extra=[]
from price_model import rnd, MARGIN_EST, DEALER_DISC, best, norm
for r in add:
    k=norm(r['model']); fp=float(best.loc[k,'price']) if k in best.index else None
    lst=rnd(fp) if fp else None
    extra.append(dict(table='shock_absorbers',key=r['bk'],series=r['series'],model=r['model'],basis='file' if fp else 'model',file_price=fp or '',file_source=best.loc[k,'source'] if fp else '',estimate=fp or '',margin_pct=0,list_inr=lst,dealer_inr=rnd(lst*(1-DEALER_DISC)) if lst else '',lead_time_days=r['lead_time_days'],note='model added from price list; '+r['note']))
cost=pd.concat([cost,pd.DataFrame(extra)],ignore_index=True)
# owner-confirmed prices (win over files and estimates)
OVERRIDES={('wire_rope_isolators','AWRI-127-60'):(15500,'confirmed by Paresh 24-09-2026')}
for (t,k),(p,why) in OVERRIDES.items():
    m=(cost.table==t)&(cost.key.astype(str)==k)
    cost.loc[m,'list_inr']=p; cost.loc[m,'dealer_inr']=rnd(p*(1-DEALER_DISC)); cost.loc[m,'basis']='file'; cost.loc[m,'file_source']=why
pm={(r.table,str(r.key)):r for r in cost.itertuples()}
for r in sa:
    c=pm.get(('shock_absorbers',r['bk'])); 
    if c is not None and c.list_inr and not (isinstance(c.list_inr,float) and math.isnan(c.list_inr)): r['price_inr']=str(int(c.list_inr))
wr('shock_absorbers.csv',sa,hdr)
w=rd('wire_rope_isolators.csv')
for r in w:
    c=pm.get(('wire_rope_isolators',r['model']))
    if c is not None: r['price_inr']=str(int(c.list_inr))
wr('wire_rope_isolators.csv',w,list(w[0].keys()))
rm=rd('rubber_mounts.csv')
for r in rm:
    c=pm.get(('rubber_mounts',r['model']))
    if c is not None: r['price_inr']=str(int(c.list_inr))
wr('rubber_mounts.csv',rm,list(rm[0].keys()))
ac=rd('accessories.csv')
for r in ac:
    c=pm.get(('accessories',r['code']))
    if c is not None and c.list_inr: r['price_inr']=str(int(c.list_inr))
wr('accessories.csv',ac,list(ac[0].keys()))
# other products table
oth=cost[cost.table=='other_products']
wr('other_products.csv',[dict(code=r.key,name=r.model,hsn='84879000',gst_rate='18',uom='NOS',price_inr=int(r.list_inr),lead_time_days=int(r.lead_time_days),status='active',note=r.file_source) for r in oth.itertuples()],['code','name','hsn','gst_rate','uom','price_inr','lead_time_days','status','note'])
# costing table (the source of truth for the pricing panel)
cols=['table','key','series','model','basis','file_price','file_source','estimate','margin_pct','list_inr','dealer_inr','lead_time_days','cavities','rubber_kg','rubber_cost','moulding','metal_kg','hardware','mould_cost','mould_amort','unit_cost','note']
for c in cols: 
    if c not in cost.columns: cost[c]=''
cost=cost[cols].fillna('')
for c in ['file_price','estimate','list_inr','dealer_inr','lead_time_days','cavities','rubber_cost','moulding','hardware','mould_cost','mould_amort','unit_cost']:
    cost[c]=cost[c].map(lambda v: '' if v=='' else (int(float(v)) if float(v)==int(float(v)) else v))
cost.to_csv(B+'costing.csv',index=False,encoding='utf-8-sig')
print(cost.groupby('table').size().to_string())
print('unpriced shock rows:',sum(1 for r in sa if not r['price_inr']),'wri:',sum(1 for r in w if not r['price_inr']),'rubber:',sum(1 for r in rm if not r['price_inr']),'acc:',sum(1 for r in ac if not r['price_inr']))
