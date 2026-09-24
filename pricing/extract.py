import pandas as pd, re, csv, json
U='/root/.claude/uploads/e4a4b361-8b52-551b-82b9-880172ffeb58/'
def norm(s):
    s=str(s).upper().strip()
    s=re.sub(r'\(.*?\)','',s)                      # (109*135), (M 27 X 3)
    s=s.replace('HYDRAUIIC BUFFER','').replace('HYDRAULIC BUFFER','').replace('WIRE ROPE ISOLATER','').replace('PU BUFFER','').replace('SHOCK ABSORBER','')
    s=re.sub(r'\bTHREADING.*$|\bTHREDAIN.*$|\bNON ADJUSTABLE.*$|\bSTROKE.*$','',s)
    s=re.sub(r'\bEN8 LUGS|C ?TYPE MOUNTING.*|\d+ LOOPS','',s)
    s=s.replace('--','-').replace('_','-')
    s=re.sub(r'\s*-\s*','-',s); s=re.sub(r'\s+','-',s.strip())
    s=s.replace('JCQ-C','JHQ-C').replace('IHO-C','JHQ-C').replace(',','')
    s=re.sub(r'^AWR-?(\d)',r'AWRI-\1',s); s=re.sub(r'^AWRI(\d)',r'AWRI-\1',s); s=re.sub(r'^AKHG(\d)',r'AKHG-\1',s); s=re.sub(r'^AKHS(\d)',r'AKHS-\1',s)
    s=re.sub(r'^YSR-?(\d+)-?(\d+)',r'YSR-\1-\2',s)
    s=re.sub(r'^(AC|AD|ACX|ADX)-?(\d+)-(\d+)(-1\.5|-M|-F|-U|-FR|F|M|U)*$',r'\1-\2-\3',s)
    s=re.sub(r'^(AC|AD)-?(\d+)-0?(\d+)',lambda m:f"{m.group(1)}-{m.group(2)}-{int(m.group(3))}",s)
    s=re.sub(r'^EI-?(\d+)-(\d+).*',r'EI-\1X\2',s); s=re.sub(r'^ED-?([\d.]+)-?X-?(\d+)',r'ED-\1X\2',s)
    s=re.sub(r'^AWRI-(\d+)-(\d+)(-\d+)?(-\w+)?$',r'AWRI-\1-\2',s)
    s=re.sub(r'^SB-1220-?([A-Z])$',r'SB-1220-\1',s)
    s=s.rstrip('-')
    return s
rows=[]
def add(model,price,src,note=''):
    try: p=float(str(price).replace('=00','').replace(',','').strip())
    except: return
    if p>0: rows.append({'raw':str(model).strip(),'model':norm(model),'price':p,'source':src,'note':note})
# product list
pl=pd.read_csv('/tmp/productlist.csv')
for _,r in pl.iterrows():
    nm=str(r['name'])
    for col in ['market','b2b','jindal']:
        add(nm, r[col], f'product_list:{col}', str(r['cat']))
# PU
d=pd.read_excel(U+'c2d68575-pu_buffer_pricelist.xlsx',header=None).iloc[7:,[4,18,19]]; d.columns=['model','usd','inr']
for _,r in d.iterrows():
    if pd.notna(r['model']): add(r['model'],r['inr'],'pu_pricelist:inr'); 
    if pd.notna(r['usd']): rows.append({'raw':str(r['model']),'model':norm(r['model']),'price':float(r['usd']),'source':'pu_pricelist:usd','note':'USD'})
# spring
d=pd.read_excel(U+'9aaa7c78-spring_buffer_pricelist.xlsx',header=None).iloc[5:,[0,3]]
for _,r in d.iterrows():
    if pd.notna(r[0]): add(r[0],r[3],'spring_pricelist')
# hydraulic
d=pd.read_excel(U+'209ef2bf-HYDRAULIC_BUFFER_PRICELIST.xlsx',header=None).iloc[1:,[1,2]]
for _,r in d.iterrows(): add(r[1],r[2],'hydraulic_pricelist')
d=pd.read_excel(U+'41954301-akhg_pricelist.xlsx',header=None).iloc[1:]
for _,r in d.iterrows(): add(f"{r[0]}-{int(r[1])}".replace('--','-'),r[2],'akhg_pricelist')
# TSC pdf
for m,p in [('TSC-15',6150),('TSC-25',6600),('TSC-50',9840),('TSC-75',14400),('TSC-100',16625)]: add(m,p,'tsc_pdf_2022')
df=pd.DataFrame(rows); df.to_csv('all_prices.csv',index=False)
print(len(df),'price rows;',df['model'].nunique(),'models')
print(df.groupby('source').size().to_string())
# show normalization oddities
odd=df[~df['model'].str.match(r'^(AC|ACX|AD|ADX|AKHG|AKHS|ED|EI|JHQ-C|SB|YSR|AWRI|TSC)-')]
print(odd[['raw','model','price','source']].drop_duplicates('model').to_string(index=False))
