import pandas as pd, numpy as np, csv, re, json, math
from extract import norm
B='/home/claude/build/data/'
MARGIN_EST=0.25          # on estimated prices (negotiation / dealer margin)
DEALER_DISC=0.20         # dealer price = list x (1-0.20)
def rnd(p):
    if p is None or not np.isfinite(p): return None
    step=50 if p<10000 else 100
    return int(math.ceil(p/step)*step)
prices=pd.read_csv('all_prices.csv'); prices=prices[prices.note!='USD']
best=prices.sort_values('price',ascending=False).groupby('model').first()
def file_price(model):
    k=norm(model); 
    if k in best.index: return float(best.loc[k,'price']), best.loc[k,'source']
    return None,None
# ---------------- shock absorbers
sa=pd.DataFrame(list(csv.DictReader(open(B+'shock_absorbers.csv',encoding='utf-8-sig'))))
for c in ['stroke_mm','nm_per_cycle','fs_max_N','price_inr']: sa[c]=pd.to_numeric(sa[c],errors='coerce')
sa['bore']=sa.model.str.extract(r'[-\s](\d+(?:\.\d+)?)\s*[-x]')[0].astype(float)
# alias: AC-45-xx in files = ACX-45-xx in catalogue
alias={'ACX-45-50':'AC-45-50','ACX-45-25':'AC-45-25','ACX-45-75':'AC-45-75'}
fp=[]; 
for _,r in sa.iterrows():
    p,s=file_price(alias.get(r.model,r.model)); fp.append((p,s))
sa['file_price']=[x[0] for x in fp]; sa['file_src']=[x[1] for x in fp]
# cost models: crane hydraulic (AKHG/AKHS/ED/EI): log p = a + b log Fs + c log stroke ; industrial (AC/AD/ACX/YSR): log p = a + b log Fs + c log stroke + series offset
def fit(g,cols):
    X=np.c_[np.ones(len(g)),np.log(g[cols].values.astype(float))]; y=np.log(g.file_price.values)
    coef=np.linalg.lstsq(X,y,rcond=None)[0]; pred=np.exp(X@coef); err=np.abs(pred/g.file_price-1)
    return coef, float(np.median(err)), float(err.max())
def predict(coef,row,cols): return float(np.exp(coef[0]+sum(coef[i+1]*math.log(float(row[c])) for i,c in enumerate(cols))))
crane=sa[sa.series.isin(['AKHG','AKHS','ED','EI'])]; ind=sa[sa.series.isin(['AC','AD','ACX','YSRA'])]
cc,cmed,cmax=fit(crane[crane.file_price.notna()],['fs_max_N','stroke_mm'])
ic,imed,imax=fit(ind[ind.file_price.notna()],['fs_max_N','stroke_mm'])
print(f'crane model: exp({cc[0]:.2f}) Fs^{cc[1]:.2f} s^{cc[2]:.2f}  median err {cmed:.0%} max {cmax:.0%}')
print(f'industrial model: exp({ic[0]:.2f}) Fs^{ic[1]:.2f} s^{ic[2]:.2f}  median err {imed:.0%} max {imax:.0%}')
# series offsets (ratio actual/pred) for priced series
sa['model_pred']=[predict(cc if r.series in ('AKHG','AKHS','ED','EI') else ic, r, ['fs_max_N','stroke_mm']) for _,r in sa.iterrows()]
off={}
for s,g in sa[sa.file_price.notna()].groupby('series'): off[s]=float(np.median(g.file_price/g.model_pred))
# unpriced series get offset of nearest priced family: ED,EI ~ AKHG(1.0); ACX ~ AC; AKHS ~ AKHG*1.05 (spring return, external spring)
for s,d in {'ED':off.get('AKHG',1),'EI':off.get('AKHG',1),'ACX':off.get('AC',1)*1.15,'AKHS':off.get('AKHG',1)*1.05}.items(): off.setdefault(s,d)
print('series offsets',{k:round(v,2) for k,v in off.items()})
loc={}
for (se,bo),g in sa[sa.file_price.notna()].groupby(['series','bore']): loc[(se,bo)]=float(np.median(g.file_price/g.model_pred))
rows=[]
for _,r in sa.iterrows():
    est=r.model_pred*loc.get((r.series,r.bore),off[r.series])
    if pd.notna(r.file_price): basis='file'; base=r.file_price; lst=rnd(base)
    else: basis='model'; base=est; lst=rnd(base*(1+MARGIN_EST))
    rows.append(dict(table='shock_absorbers',key=r.bk,series=r.series,model=r.model,basis=basis,file_price=r.file_price if pd.notna(r.file_price) else '',file_source=r.file_src or '',estimate=round(est),margin_pct=0 if basis=='file' else MARGIN_EST*100,list_inr=lst,dealer_inr=rnd(lst*(1-DEALER_DISC)),lead_time_days=r.lead_time_days,note=f'stroke {r.stroke_mm:g} mm, Fs {r.fs_max_N:g} N'))
# ---------------- wire rope isolators
w=pd.DataFrame(list(csv.DictReader(open(B+'wire_rope_isolators.csv',encoding='utf-8-sig'))))
w['fam_txt']=w.family_wire_mm.astype(str)
w['family_wire_mm']=pd.to_numeric(w.family_wire_mm.astype(str).str.replace('AC',''),errors='coerce')
for c in ['price_inr','c_load_n','height_mm','width_mm','weight_kg']: w[c]=pd.to_numeric(w[c],errors='coerce')
w['file_price']=[max([x for x in [file_price(m)[0], cur] if x is not None], default=None) for m,cur in zip(w.model,w.price_inr)]
g=w[w.file_price.notna()&w.height_mm.notna()&w.width_mm.notna()]
X=np.c_[np.ones(len(g)),np.log(g.family_wire_mm),np.log(g.height_mm*g.width_mm)]; y=np.log(g.file_price); wc=np.linalg.lstsq(X,y,rcond=None)[0]
werr=np.abs(np.exp(X@wc)/g.file_price-1); print(f'WRI model median err {np.median(werr):.0%} max {werr.max():.0%}')
for _,r in w.iterrows():
    est=float(np.exp(wc[0]+wc[1]*math.log(r.family_wire_mm)+wc[2]*math.log(r.height_mm*r.width_mm))) if pd.notna(r.height_mm) and pd.notna(r.width_mm) and pd.notna(r.family_wire_mm) else float('nan')
    if r.fam_txt.startswith('AC') and np.isfinite(est): est*=0.85   # compact ACWRI: smaller lugs
    if pd.notna(r.file_price): basis='file'; lst=rnd(r.file_price)
    else: basis='model'; lst=rnd(est*(1+MARGIN_EST))
    rows.append(dict(table='wire_rope_isolators',key=r.model,series=('ACWRI-' if r.fam_txt.startswith('AC') else 'AWRI-')+f'{r.family_wire_mm:g}',model=r.model,basis=basis,file_price=r.file_price if pd.notna(r.file_price) else '',file_source='product list / AWRI selector' if pd.notna(r.file_price) else '',estimate=round(est) if np.isfinite(est) else '',margin_pct=0 if basis=='file' else MARGIN_EST*100,list_inr=lst,dealer_inr=rnd(lst*(1-DEALER_DISC)),lead_time_days=r.lead_time_days,note=f'{r.height_mm:g}x{r.width_mm:g} mm'))
# ---------------- rubber mounts: moulding cost + hardware + mould/50, +50 % margin
rm=pd.DataFrame(list(csv.DictReader(open(B+'rubber_mounts.csv',encoding='utf-8-sig'))))
for c in ['load_max_kg','height_mm','dia_mm','length_mm','width_mm']: rm[c]=pd.to_numeric(rm[c],errors='coerce')
P=dict(rubber_rate=420.0, rubber_density=1.15, moulding_shot=180.0, moulding_per_kg=260.0, metal_rate=95.0, metal_per_kg_machining=140.0, mould_small=28000.0, mould_medium=45000.0, mould_large=80000.0, cav_small=8, cav_medium=4, cav_large=1, mould_qty=50, hardware_min=35.0, margin=0.50)
def fill_dims(rm):
    for fam,g in rm.groupby('family'):
        ref=g[g.dia_mm.notna()&g.height_mm.notna()].sort_values('load_max_kg')
        if not len(ref): continue
        big=ref.iloc[-1]
        for i,r in g.iterrows():
            if pd.isna(r.dia_mm) or pd.isna(r.height_mm):
                k=(r.load_max_kg/big.load_max_kg)**(1/3) if pd.notna(r.load_max_kg) and big.load_max_kg else 1.0
                rm.loc[i,'dia_mm']=big.dia_mm*k; rm.loc[i,'height_mm']=big.height_mm*k; rm.loc[i,'length_mm']=(big.length_mm if pd.notna(big.length_mm) else big.dia_mm)*k
fill_dims(rm)
def rubber_cost(r):
    d=r.dia_mm if pd.notna(r.dia_mm) else (r.width_mm if pd.notna(r.width_mm) else 60.0); h=r.height_mm if pd.notna(r.height_mm) else 50.0; L=r.length_mm if pd.notna(r.length_mm) else d
    vol=math.pi*(d/2)**2*h*0.55/1000  # cm3, 55 % fill of the envelope
    if 'OVTX' in r.family or 'OVTN' in r.family: vol*=0.7
    rub_kg=vol*P['rubber_density']/1000
    rubber=rub_kg*P['rubber_rate']
    moulding=P['moulding_shot']+rub_kg*P['moulding_per_kg']
    metal_kg=max(0.03,(d*L*2*3/1e6)*7.85)   # two plates ~3 mm + studs
    if 'OVTX' in r.family: metal_kg*=3.5      # all-metal mesh
    hardware=max(P['hardware_min'],metal_kg*(P['metal_rate']+P['metal_per_kg_machining']))
    mould,cav=(P['mould_small'],P['cav_small']) if d<=80 else (P['mould_medium'],P['cav_medium']) if d<=160 else (P['mould_large'],P['cav_large'])
    amort=mould/(P['mould_qty']*cav)
    cost=rubber+moulding+hardware+amort
    return dict(cavities=cav,rubber_kg=round(rub_kg,3),rubber_cost=round(rubber),moulding=round(moulding),metal_kg=round(metal_kg,3),hardware=round(hardware),mould_cost=mould,mould_amort=round(amort),unit_cost=round(cost))
rub_file={'AT-SH-500':(25000.0,'product list: SH 500 rubber vibration isolater')}
for _,r in rm.iterrows():
    c=rubber_cost(r); fp=rub_file.get(r.model)
    fam_anchor=[(m,p) for m,(p,_) in rub_file.items() if m in set(rm[rm.family==r.family].model)]
    if fp: basis='file'; lst=rnd(fp[0]); est=c['unit_cost']
    elif fam_anchor:
        am,ap=fam_anchor[0]; aload=float(rm[rm.model==am].load_max_kg.iloc[0]); est=ap/(1+P['margin'])*(r.load_max_kg/aload)**0.7; basis='model'; lst=rnd(est*(1+P['margin']))
    else: basis='cost'; est=c['unit_cost']; lst=rnd(est*(1+P['margin']))
    rows.append(dict(table='rubber_mounts',key=r.model,series=r.family,model=r.model,basis=basis,file_price=fp[0] if fp else '',file_source=fp[1] if fp else '',estimate=round(est),margin_pct=0 if basis=='file' else P['margin']*100,list_inr=lst,dealer_inr=rnd(lst*(1-DEALER_DISC)),lead_time_days=r.lead_time_days,note=(f"scaled from {fam_anchor[0][0]} by load^0.7" if basis=='model' else f"rubber {c['rubber_kg']} kg + moulding + hardware {c['metal_kg']} kg + mould {c['mould_cost']:g}/{P['mould_qty']}"),**c))
# ---------------- accessories (no file prices; simple estimates flagged)
ac=pd.DataFrame(list(csv.DictReader(open(B+'accessories.csv',encoding='utf-8-sig'))))
acc_est={'FF':1200,'RF':1200,'FRF':2200,'FM':1500,'RFFF':2600,'CM':1800,'SC':450,'SLA':2400,'BEL':900,'LN':250,'NC':0,'PU':350,'MC':600,'MCPU':900,'SS':0,'SENS':6500,'RECON':0}
for _,r in ac.iterrows():
    e=acc_est.get(r.code,0); lst=rnd(e*(1+MARGIN_EST)) if e else 0
    rows.append(dict(table='accessories',key=r.code,series='accessory',model=r.name,basis='model' if e else 'on request',file_price='',file_source='',estimate=e,margin_pct=MARGIN_EST*100 if e else 0,list_inr=lst,dealer_inr=rnd(lst*(1-DEALER_DISC)) if lst else 0,lead_time_days=r.lead_time_days,note='typical size AC-25..AC-64; SS and reconditioning quoted case by case; NC free'))
# ---------------- other products priced in files but not in the selectors
other=[('TSC-15','Hydraulic feed-rate controller TSC-15',6150),('TSC-25','Hydraulic feed-rate controller TSC-25, stroke 30',6600),('TSC-50','Hydraulic feed-rate controller TSC-50, stroke 60',9840),('TSC-75','Hydraulic feed-rate controller TSC-75, stroke 80',14400),('TSC-100','Hydraulic feed-rate controller TSC-100, stroke 100',16625),
 ('ACWRI-40-10','Compact wire rope isolator ACWRI 40-10',3100),('HHSS20','Half-helical wire rope isolator HHSS20',16500),('VIBSOL-45W','Vibsol 45 W rubber isolator',30000),('SH-500','SH 500 rubber vibration isolator',25000),('AVM-530603','Diamond shaped anti-vibration mount 530603',450),('AVM-20x15-M8','Anti-vibration mount, bilateral bolt 20x15 M8',450),('AVM-12x10-M5','Anti-vibration mount, bilateral bolt 12x10 M5',450),('EM125140M','Evidgom EM125140M mount',16200),('KP-125-800','Hydraulic buffer KP 125-800',69400)]
for code,name,p in other: rows.append(dict(table='other_products',key=code,series='other',model=name,basis='file',file_price=p,file_source='product list / TSC pdf',estimate=p,margin_pct=0,list_inr=rnd(p),dealer_inr=rnd(rnd(p)*(1-DEALER_DISC)),lead_time_days=21,note=''))
df=pd.DataFrame(rows)
# list prices must not fall as the size grows: within series+bore by stroke (shock absorbers), within family by load (rubber)
sa_idx=sa.set_index('model')
def bump(group_keys, order_col):
    for _,g in df[df.table=='shock_absorbers'].groupby(group_keys):
        g=g.copy(); g['_o']=[order_col(m) for m in g.model]; g=g.sort_values('_o'); hi=0
        idx=list(g.index)
        for n,i in enumerate(idx):
            r=df.loc[i]
            if r.basis!='file':
                # cap: never above the next larger sibling that has a real file price
                caps=[int(df.loc[j,'list_inr']) for j in idx[n+1:] if df.loc[j,'basis']=='file']
                v=int(r.list_inr)
                if caps and v>caps[0]: v=caps[0]; df.loc[i,'note']=str(df.loc[i,'note'])+' · capped at the next larger priced model'
                if v<hi: v=hi; df.loc[i,'note']=str(df.loc[i,'note'])+' · raised to keep price rising with stroke'
                df.loc[i,'list_inr']=v; df.loc[i,'dealer_inr']=rnd(v*(1-DEALER_DISC))
            hi=max(hi,int(df.loc[i,'list_inr']))
df['bore']=df.model.map(lambda m: sa_idx.bore.get(m,np.nan))
bump(['series','bore'], lambda m: float(sa_idx.stroke_mm.get(m,0)))
df=df.drop(columns=['bore'])
df.to_csv('costing_out.csv',index=False)
print(df.groupby(['table','basis']).size().to_string())
print(df[df.table=='shock_absorbers'].groupby('series').apply(lambda g: f"{(g.basis=='file').sum()} file / {(g.basis=='model').sum()} est  list {g.list_inr.min()}–{g.list_inr.max()}").to_string())
print(df[(df.table=='shock_absorbers')&(df.series.isin(['ED','EI','AKHS','ACX']))][['model','estimate','list_inr']].head(12).to_string(index=False))
print(df[df.table=='rubber_mounts'][['model','rubber_kg','hardware','mould_amort','unit_cost','list_inr']].head(8).to_string(index=False))
print('WRI est sample'); print(df[(df.table=='wire_rope_isolators')&(df.basis=='model')][['model','estimate','list_inr']].head(8).to_string(index=False))
json.dump(dict(crane=list(cc),industrial=list(ic),wri=list(wc),offsets=off,rubber=P),open('model_params.json','w'),indent=1)
