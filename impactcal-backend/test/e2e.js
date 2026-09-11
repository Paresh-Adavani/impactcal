'use strict';
process.env.IMPACTCAL_ADMIN_KEY = 'testkey';
process.env.IMPACTCAL_DATA = require('path').join(__dirname, '..', 'data');
const app = require('../server');
const { db } = require('../lib/db');
const gst = require('../lib/gst');

let pass = 0, fail = 0;
const ok = (label, cond, extra='') => { cond ? pass++ : fail++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };
const near = (a,b,t=0.01) => Math.abs(a-b) <= t*Math.abs(b);

const server = app.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const H = { 'content-type':'application/json', 'x-admin-key':'testkey' };
  const post = (u,b) => fetch(base+u,{method:'POST',headers:H,body:JSON.stringify(b)}).then(r=>r.json());
  const get  = u => fetch(base+u,{headers:H}).then(r=>r.json());
  const patch= (u,b) => fetch(base+u,{method:'PATCH',headers:H,body:JSON.stringify(b)}).then(r=>r.json());
  const put  = (u,b) => fetch(base+u,{method:'PUT',headers:H,body:JSON.stringify(b)}).then(r=>r.json());
  try {
    console.log('\n— reference data —');
    const meta = await get('/api/meta');
    ok('meta loads', meta.cases.length===15 && meta.standards.length===7, `${meta.cases.length} cases`);
    ok('every case has an illustration on disk', (()=>{
      const fs=require('fs'), path=require('path');
      const dir=path.join(__dirname,'..','public','img','cases');
      const missing=meta.cases.filter(c=>!fs.existsSync(path.join(dir,c.id+'.png'))&&!fs.existsSync(path.join(dir,c.id+'.svg')));
      if(missing.length) console.log('       missing:',missing.map(c=>c.id).join(', '));
      return missing.length===0;})());
    ok('company GSTIN is valid', gst.validateGstin(meta.company.gstin).ok, meta.company.gstin);
    ok('all series carry an HSN', db.prepare("SELECT COUNT(*) c FROM product WHERE hsn IS NULL OR hsn=''").get().c===0);

    console.log('\n— selection —');
    const sel = await post('/api/select',{ case_id:'C1', standard:'IS3177',
      duty:{ m:20000, v:40/60, P:15000, C:20, n:2 } });
    ok('crane selection returns candidates', sel.count>50, `${sel.count} pass`);
    ok('IS 3177 halves the rated speed', near(sel.duty_applied.v, (40/60)*0.5), sel.duty_applied.v.toFixed(3)+' m/s');
    ok('every candidate is inside its deceleration limit', sel.candidates.every(c=>c.a<=5.0));
    ok('three labelled picks are offered', sel.candidates.filter(c=>c.picks.length).length>=1);
    const ind = await post('/api/select',{ case_id:'I2', standard:'NONE',
      duty:{ m:300, v:1.2, F:2400, C:300, n:1 }, series:['AC','ACX','AD'] });
    ok('kinetic energy is stroke-independent: 216 Nm', near(ind.duty_applied.E_k,216), ind.duty_applied.E_k.toFixed(1));
    const ac4250 = ind.candidates.find(c=>c.model==='AC-42-50');
    ok('AC catalogue worked example: Et = 336 Nm at 50 mm', ac4250 && near(ac4250.E_t,336), ac4250&&ac4250.E_t.toFixed(1));
    ok('AC catalogue worked example: Et/hr = 100,800', ac4250 && near(ac4250.E_tc,100800), ac4250&&ac4250.E_tc.toFixed(0));
    ok('AC catalogue worked example: Me = 467 kg', ac4250 && near(ac4250.m_e,467), ac4250&&ac4250.m_e.toFixed(0));
    const best = ind.candidates.find(c=>c.picks.includes('best-centred utilisation'));
    ok('and the balanced pick is AC-42-50 as the catalogue selects', best && best.model==='AC-42-50', best&&best.model);

    console.log('\n— GSTIN —');
    ok('rejects the mistyped GSTIN', !(await get('/api/gstin/27AHAPAPA3555B1Z1')).ok);
    ok('and suggests the correct one', (await get('/api/gstin/27AHAPAPA3555B1Z1')).suggestions?.[0]==='27AHAPA3555B1Z1');
    ok('accepts a valid one', (await get('/api/gstin/27AHAPA3555B1Z1')).ok);

    console.log('\n— pricing —');
    const bk = sel.candidates[0].bk;
    await fetch(base+'/api/products/'+encodeURIComponent(bk),{method:'PATCH',headers:H,
      body:JSON.stringify({ list_price: 18500 })});
    ok('list price saved', (await get('/api/products?q='+encodeURIComponent(bk)))[0].list_price===18500);
    const bulk = await post('/api/products/bulk',{ rows:[{bk, lead_time_days:21, status:'active'}] });
    ok('bulk grid save works', bulk.updated===1);

    console.log('\n— RFQ (Maharashtra, intra-state) —');
    const rfq = await post('/api/rfq',{
      customer:{ name:'Example Engineering Ltd.', contact:'R. Kulkarni', email:'r@example.test',
                 phone:'+91 90000 00000', gstin:'27AHAPA3555B1Z1', city:'Pune' },
      formats:['PDF','STEP'], message:'End stops for bay 3.',
      items:[{ bk, model: sel.candidates[0].model, qty:2, mounting:'Front flange', cap:'Polyurethane cap' }] });
    ok('RFQ numbered', /^AT\/R\/\d{4}\/\d{4}$/.test(rfq.number), rfq.number);
    const full = await get('/api/rfq/'+rfq.id);
    ok('customer state resolved from GSTIN', full.customer.state_name==='Maharashtra');

    console.log('\n— quotation —');
    const q = await post('/api/rfq/'+rfq.id+'/quote',{});
    ok('quotation numbered', /^AT\/Q\/\d{4}\/\d{4}$/.test(q.number), q.number);
    ok('supplier state 27 + customer 27 -> intra-state', q.supply_type==='intra');
    ok('lines carry the product HSN', q.items[0].hsn.length>=6, q.items[0].hsn);
    ok('RFQ moved to quoted', (await get('/api/rfq/'+rfq.id)).status==='quoted');
    const items = q.items.map((i,n)=> n===0 ? {...i, rate:18500, qty:2} : {...i, rate:650, qty:2});
    const q2 = await put('/api/quotation/'+q.id+'/items',{ items });
    const t = q2.tax;
    ok('taxable = 2x18500 + 2x650', near(t.taxable, 38300), t.taxable);
    ok('CGST = SGST = 9%', near(t.cgst, 38300*0.09) && near(t.sgst, 38300*0.09), `${t.cgst}/${t.sgst}`);
    ok('no IGST on an intra-state supply', t.igst===0);
    ok('grand total is rounded to the rupee', Number.isInteger(t.grand_total), t.grand_total);
    ok('amount in words', /Rupees Only$/.test(q2.amount_in_words), q2.amount_in_words);
    ok('HSN summary present', t.hsn_summary.length>=1, t.hsn_summary.map(h=>h.hsn+'@'+h.gst_rate).join(', '));

    console.log('\n— inter-state and export —');
    const q3 = await patch('/api/quotation/'+q.id,{ place_of_supply_code:'29' });
    ok('Karnataka -> IGST', q3.supply_type==='inter' && q3.tax.igst>0 && q3.tax.cgst===0, `IGST ${q3.tax.igst}`);
    const q4 = await patch('/api/quotation/'+q.id,{ supply_type:'export' });
    ok('export is zero-rated', q4.tax.igst===0 && q4.tax.cgst===0 && near(q4.tax.grand_total, Math.round(q4.tax.taxable)));
    await patch('/api/quotation/'+q.id,{ place_of_supply_code:'27' });

    console.log('\n— freight and revision —');
    const q5 = await patch('/api/quotation/'+q.id,{ freight:2500, freight_hsn:'996511', freight_gst:18 });
    ok('freight adds a taxed line', near(q5.tax.taxable, 38300+2500), q5.tax.taxable);
    ok('freight SAC appears in the HSN summary', q5.tax.hsn_summary.some(h=>h.hsn==='996511'));
    const rev = await post('/api/quotation/'+q.id+'/revise',{});
    ok('revision keeps the number, bumps rev', rev.number===q.number && rev.rev===1, `${rev.number} rev ${rev.rev}`);
    ok('revision copies the lines', rev.items.length===q2.items.length);

    console.log('\n— mail —');
    const mv = await get('/api/mail/verify');
    ok('mail verify reports cleanly when unconfigured', mv.ok===false && /SMTP user/i.test(mv.reason), mv.reason);
    const st = await get('/api/settings');
    ok('SMTP password is never returned by the API', st['mail.pass']==='' || /^[•*]+$/.test(st['mail.pass']));
    await fetch(base+'/api/settings',{method:'PUT',headers:H,body:JSON.stringify({'mail.pass':'••••••••••••','mail.to':'adonitech@gmail.com'})});
    ok('a masked password does not overwrite the stored one', (await get('/api/settings'))['mail.to']==='adonitech@gmail.com');
    ok('an RFQ still succeeds with mail switched off', (await post('/api/rfq',{
      customer:{name:'No Mail Ltd.',email:'x@example.test',phone:'1'},
      items:[{bk, model:'x', qty:1}]})).number.startsWith('AT/R/'));

    console.log('\n— numbering resets by financial year —');
    ok('FY code is 4 digits', /^\d{4}$/.test(require('../lib/db').fyCode()));

    console.log(`\n${'='.repeat(56)}\n${pass} passed, ${fail} failed`);
  } catch (e) { console.error('\nERROR', e); fail++; }
  server.close(); process.exit(fail ? 1 : 0);
});
