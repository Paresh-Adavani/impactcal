#!/usr/bin/env python3
"""
Builds site/wri/index.html from the AWRI selector (Rev2, index-WITH-PRICES.html):
  * product table + prices come from /api/wri/data (CSV database, prices only for sales logins);
    the original inline table stays as an offline fallback WITHOUT prices
  * the RFQ goes to /api/rfq (approval workflow) instead of formsubmit.co
  * a Country field is added (drives INR / USD on the quotation)
  * service worker removed (it cached old versions), link back to ImpactCal added
Run from the project root:  python3 tools/patch_wri.py [path/to/index-WITH-PRICES.html]
"""
import re, sys, os, json, shutil

SRC = sys.argv[1] if len(sys.argv) > 1 else '_legacy/awri-selector/index-WITH-PRICES.html'
DST = 'site/wri/index.html'
t = open(SRC, encoding='utf8').read()
orig_len = len(t)

# 1. DATA -> fallback (no prices) + live data from the API
m = re.search(r'const DATA = (\{.*?\});\n', t, re.S)
assert m, 'DATA block not found'
d = json.loads(m.group(1))
d['prices'] = {}
fallback = json.dumps(d, separators=(',', ':'))
live = r'''const DATA_FALLBACK = %s;
/* ImpactCal: live product table + prices (sales logins only) from the CSV database */
const DATA = (function(){
  try {
    var tok=''; try{ tok=localStorage.getItem('ic_token')||''; }catch(e){}
    var x=new XMLHttpRequest(); x.open('GET','/api/wri/data',false); if(tok) x.setRequestHeader('authorization','Bearer '+tok); x.send();
    if(x.status===200){ var j=JSON.parse(x.responseText); if(j.awri&&j.awri.length) return Object.assign({}, DATA_FALLBACK, {awri:j.awri, prices:j.prices||{}, fx:j.fx, prices_visible:!!j.prices_visible}); }
  } catch(e) { console.warn('wri data', e); }
  return Object.assign({}, DATA_FALLBACK, {prices:{}, prices_visible:false});
})();
''' % fallback
t = t[:m.start()] + live + t[m.end():]

# 2. RFQ -> ImpactCal API
m = re.search(r'async function postLead\(payload\)\{.*?\n\}\n', t, re.S)
assert m, 'postLead not found'
post = r'''async function postLead(payload){
  /* ImpactCal: create the RFQ in the approval workflow (server prices it and alerts the approver) */
  try{
    const B=window.__wriBest||{}, best=B.best||{}, inp=B.inp||{};
    const tok=(function(){try{return localStorage.getItem('ic_token')||'';}catch(e){return '';}})();
    const summary={}; for(const k of ['Application','Standard','Mounting','Recommended','Results','Vibration','Shock','Verdict']) if(payload[k]) summary[k]=payload[k];
    const body={ line:'wri', customer:{ company:payload.Customer||payload.Project||'Enquiry', contact:payload.Contact, email:payload.Email, phone:payload.Phone, country:(document.getElementById('p_country')||{}).value||'India' },
      project:{ name:payload.Project, equipment:payload.Equipment, prepared_by:(document.getElementById('p_eng')||{}).value||'' },
      selection:{ case_id:'WRI', standard:S.std, inputs:{ app:S.app, mnt:S.mnt, mass:inp.mass, N:inp.N, Ns:inp.Ns, frag:inp.frag, gv:inp.gv, gh:inp.gh, tau:inp.tau }, chosen:best.m, summary },
      formats:['PDF'], message:payload.RFQ||'',
      items:[{ table:'wire_rope_isolators', key:best.m, model:best.m, qty:(typeof rfqQty==='function'?rfqQty():inp.N)||1, remark:(payload.RFQ||'').replace(/^.*?· /,'') }] };
    const r=await fetch('/api/rfq',{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{authorization:'Bearer '+tok}:{}),body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.ok){ if(typeof toast==='function') toast('Request '+j.number+' sent — quotation follows after approval ✓'); return true; }
    if(typeof toast==='function') toast('Could not send: '+(j.error||r.statusText)); return false;
  }catch(e){ return false; }
}
'''
t = t[:m.start()] + post + t[m.end():]
t = t.replace('function sendLeadCopy(best,inp){\n', 'function sendLeadCopy(best,inp){\n  window.__wriBest={best:best,inp:inp};\n', 1)
t = t.replace("const MAIL_TO=['adonitech@gmail.com','sales@adonitech.co.in'];", "const MAIL_TO=[]; /* mail now goes through the ImpactCal API */")

# 3. country field after phone
t = t.replace('<div class="f"><label>Phone / WhatsApp</label><input id="p_phone" placeholder="e.g. +91 98xxx xxxxx"></div>',
  '<div class="f"><label>Phone / WhatsApp</label><input id="p_phone" placeholder="e.g. +91 98xxx xxxxx"></div>\n      <div class="f"><label>Country <span class="qm" title="Indian customers are quoted in INR with GST; all others in USD (export).">?</span></label><select id="p_country">' +
  ''.join('<option>%s</option>' % c for c in ['India','United States','Germany','United Kingdom','France','Spain','Italy','Netherlands','Korea, Republic of','Japan','Singapore','Malaysia','Thailand','Vietnam','Australia','United Arab Emirates','Saudi Arabia','Qatar','Egypt','South Africa','Brazil','Canada','Turkey','Other']) + '</select></div>', 1)

# 4. no service worker, link back home, relative asset paths stay (icons copied alongside)
t = re.sub(r"navigator\.serviceWorker\.register\([^)]*\)[^;]*;", "/* sw disabled by ImpactCal */", t)
t = t.replace('<a href="knowledge.html">Knowledge Base</a>', '<a href="../index.html">← ImpactCal home</a>\n  <a href="knowledge.html">Knowledge Base</a>', 1)
t = t.replace('<link rel="canonical" href="https://awri-selector.netlify.app/">', '<link rel="canonical" href="https://impactcal.netlify.app/wri/">')

os.makedirs('site/wri', exist_ok=True)
open(DST, 'w', encoding='utf8').write(t)
print('wrote', DST, len(t), 'bytes (source', orig_len, ')  awri models in fallback:', len(d['awri']))
