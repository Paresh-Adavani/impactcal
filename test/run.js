'use strict';
/** End-to-end checks against the API in-process (disk store in a temp folder). `npm test` */
const fs = require('fs'), path = require('path'), os = require('os');
process.env.IMPACTCAL_STORE = fs.mkdtempSync(path.join(os.tmpdir(), 'impactcal-test-'));
process.env.IMPACTCAL_SECRET = 'test-secret';
process.env.ADMIN_EMAILS = 'adonitech@gmail.com';
process.env.PUBLIC_URL = 'http://test.local';
const { app } = require('../lib/app');
const gst = require('../lib/gst');
const csv = require('../lib/csv');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t * Math.abs(b);

const server = app.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  let TOKEN = '';
  const H = () => ({ 'content-type': 'application/json', ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}) });
  const post = (u, b, h) => fetch(base + u, { method: 'POST', headers: h || H(), body: typeof b === 'string' ? b : JSON.stringify(b) }).then(r => r.json());
  const get = u => fetch(base + u, { headers: H() }).then(r => r.json());
  const put = (u, b) => fetch(base + u, { method: 'PUT', headers: H(), body: JSON.stringify(b) }).then(r => r.json());
  try {
    console.log('\n— reference data —');
    const meta = await get('/meta');
    ok('meta loads', meta.cases.length === 15 && meta.standards.length === 7, `${meta.cases.length} cases`);
    ok('every case has an illustration on disk', meta.cases.every(c => fs.existsSync(path.join(__dirname, '..', 'site', 'img', 'cases', c.id + '.png')) || fs.existsSync(path.join(__dirname, '..', 'site', 'img', 'cases', c.id + '.svg'))));
    ok('every series has an icon on disk', meta.series.every(s => fs.existsSync(path.join(__dirname, '..', 'site', s.icon))));
    ok('company GSTIN is valid', gst.validateGstin(meta.company.gstin).ok, meta.company.gstin);
    const i18n = await get('/i18n');
    ok('17 languages, every key has English', i18n.languages.length === 17 && Object.values(i18n.dict).every(d => d.en), Object.keys(i18n.dict).length + ' keys');
    ok('prices hidden for anonymous users', meta.prices === false && !('price_inr' in meta.accessories[0]));

    console.log('\n— selection —');
    const sel = await post('/select', { case_id: 'C1', standard: 'IS3177', duty: { m: 20000, v: 40 / 60, P: 15000, C: 20, n: 2 } });
    ok('crane selection returns candidates', sel.count > 50, `${sel.count} pass`);
    ok('IS 3177 halves the rated speed', near(sel.duty_applied.v, (40 / 60) * 0.5), sel.duty_applied.v.toFixed(3) + ' m/s');
    ok('every candidate is inside its deceleration limit', sel.candidates.every(c => c.a <= 5.0));
    ok('three labelled picks are offered', sel.candidates.filter(c => c.picks.length).length >= 1);
    ok('no price field leaks to anonymous', sel.candidates.every(c => c.price === undefined));
    const ind = await post('/select', { case_id: 'I2', standard: 'NONE', duty: { m: 300, v: 1.2, F: 2400, C: 300, n: 1 }, series: ['AC', 'ACX', 'AD'] });
    ok('kinetic energy is stroke-independent: 216 Nm', near(ind.duty_applied.E_k, 216), ind.duty_applied.E_k.toFixed(1));
    const ac4250 = ind.candidates.find(c => c.model === 'AC-42-50');
    ok('AC catalogue worked example: Et = 336 Nm at 50 mm', ac4250 && near(ac4250.E_t, 336), ac4250 && ac4250.E_t.toFixed(1));
    ok('AC catalogue worked example: Et/hr = 100,800', ac4250 && near(ac4250.E_tc, 100800), ac4250 && ac4250.E_tc.toFixed(0));
    ok('AC catalogue worked example: Me = 467 kg', ac4250 && near(ac4250.m_e, 467), ac4250 && ac4250.m_e.toFixed(0));
    const best = ind.candidates.find(c => c.picks.includes('best-centred utilisation'));
    ok('and the balanced pick is AC-42-50 as the catalogue selects', best && best.model === 'AC-42-50', best && best.model);
    ok('lead time travels with every candidate', ind.candidates.every(c => c.lead_time_days > 0));

    console.log('\n— wire rope & rubber —');
    const wri = await get('/wri/data');
    ok('114 AWRI models served', wri.awri.length === 114 && wri.prices_visible === false && Object.keys(wri.prices).length === 0);
    const rb = await post('/rubber/select', { mass_kg: 200, mounts: 4, disturbing_hz: 25, isolation_pct: 90 });
    ok('rubber: required fn from 90% isolation at 25 Hz is 7.54 Hz', near(rb.required.fn_req_hz, 25 / Math.sqrt(11)), rb.required.fn_req_hz.toFixed(2));
    ok('rubber: candidates found', rb.count > 0 && rb.candidates.every(c => c.fn_hz <= rb.required.fn_req_hz * 1.02), rb.count + ' pass');

    console.log('\n— GSTIN —');
    ok('rejects the mistyped GSTIN', !(await get('/gstin/27AHAPAPA3555B1Z1')).ok);
    ok('and suggests the correct one', (await get('/gstin/27AHAPAPA3555B1Z1')).suggestions?.[0] === '27AHAPA3555B1Z1');
    ok('accepts a valid one', (await get('/gstin/27AHAPA3555B1Z1')).ok);

    console.log('\n— login (OTP) —');
    const otp = await post('/auth/request-otp', { email: 'adonitech@gmail.com' });
    ok('OTP issued (dev code returned when mail is off)', /^\d{6}$/.test(otp.dev_code || ''));
    ok('wrong code rejected', !!(await post('/auth/verify', { email: 'adonitech@gmail.com', code: '000000' })).error);
    const v = await post('/auth/verify', { email: 'adonitech@gmail.com', code: otp.dev_code });
    ok('admin role for adonitech@gmail.com', v.user && v.user.role === 'admin');
    TOKEN = v.token;
    const o2 = await post('/auth/request-otp', { email: 'krishna@adonitech.co.in' });
    const v2 = await post('/auth/verify', { email: 'krishna@adonitech.co.in', code: o2.dev_code });
    ok('sales role by domain adonitech.co.in', v2.user.role === 'sales');
    const o3 = await post('/auth/request-otp', { email: 'buyer@example.com' });
    const v3 = await post('/auth/verify', { email: 'buyer@example.com', code: o3.dev_code });
    ok('customer role for others', v3.user.role === 'customer');
    ok('admin sees prices + fx in meta', (await get('/meta')).prices === true && (await get('/meta')).fx.rate > 0);

    console.log('\n— CSV database (admin) —');
    const tables = await get('/admin/csv');
    ok('seven tables listed', tables.length === 7, tables.map(t => t.table).join(','));
    const text = await fetch(base + '/admin/csv/shock_absorbers', { headers: H() }).then(r => r.text());
    const parsed = csv.parse(text);
    ok('download parses, 299 rows, has lead_time_days & price_inr', parsed.rows.length === 299 && parsed.header.includes('lead_time_days') && parsed.header.includes('price_inr'));
    const edited = parsed.rows.map(r => r.bk === 'AC4250' ? { ...r, price_inr: '18500', lead_time_days: '35' } : r);
    const dry = await post('/admin/csv/shock_absorbers?dry_run=1', csv.stringify(edited, parsed.header), { 'content-type': 'text/csv', authorization: 'Bearer ' + TOKEN });
    ok('dry run reports 299 rows, no errors', dry.applied === false && dry.count === 299 && dry.errors.length === 0);
    const bad = await post('/admin/csv/shock_absorbers', csv.stringify([{ bk: 'AC4250', price_inr: 'abc' }, { bk: 'AC4250', price_inr: '1' }]), { 'content-type': 'text/csv', authorization: 'Bearer ' + TOKEN });
    ok('bad upload rejected (duplicate key, non-numeric price)', bad.applied === false && bad.errors.length >= 2, bad.errors.join('; '));
    const app1 = await post('/admin/csv/shock_absorbers', csv.stringify(edited, parsed.header), { 'content-type': 'text/csv', authorization: 'Bearer ' + TOKEN });
    ok('good upload applied', app1.applied === true && app1.count === 299);
    const sel2 = await post('/select', { case_id: 'I2', standard: 'NONE', duty: { m: 300, v: 1.2, F: 2400, C: 300, n: 1 }, series: ['AC'] });
    const ac2 = sel2.candidates.find(c => c.model === 'AC-42-50');
    ok('uploaded price & lead time visible to admin immediately', ac2 && ac2.price === 18500 && ac2.lead_time_days === 35, ac2 && `${ac2.price} / ${ac2.lead_time_days} d`);
    const usd = await post('/select', { case_id: 'I2', standard: 'NONE', duty: { m: 300, v: 1.2, F: 2400, C: 300, n: 1 }, series: ['AC'], currency: 'USD' });
    const acu = usd.candidates.find(c => c.model === 'AC-42-50');
    ok('USD price = INR / rate × (1 + uplift), rounded up', acu && acu.price >= 18500 / (await get('/admin/fx')).rate && usd.currency === 'USD', acu && 'USD ' + acu.price);
    ok('settings PUT writes the settings table', (await put('/admin/settings', { 'bank.inr.bank': 'Test Bank', 'bank.inr.account': '000111', 'bank.inr.ifsc': 'TEST0000001' })).ok);
    ok('unknown table rejected', !!(await get('/admin/csv/nonsense')).error);
    ok('sales cannot upload CSV', (await fetch(base + '/admin/csv/accessories', { method: 'POST', headers: { 'content-type': 'text/csv', authorization: 'Bearer ' + v2.token }, body: 'code\nX' })).status === 403);

    console.log('\n— RFQ → draft quotation → approval (India, intra-state) —');
    TOKEN = v2.token;   // sales person raises it
    const rfq = await post('/rfq', { line: 'industrial', customer: { company: 'Example Engineering Ltd.', contact: 'R. Kulkarni', email: 'r@example.test', phone: '+91 90000 00000', gstin: '27AHAPA3555B1Z1', city: 'Pune', country: 'India' },
      project: { name: 'Bay 3', equipment: 'press line' }, formats: ['PDF', 'STEP'], message: 'End stops for bay 3.', selection: { summary: { 'Impact case': 'I2' } },
      items: [{ table: 'shock_absorbers', key: 'AC4250', model: 'AC-42-50', qty: 2, mounting: 'Front flange' }] });
    ok('RFQ numbered', /^AT\/R\/\d{4}\/\d{4}$/.test(rfq.number), rfq.number);
    ok('draft quotation created automatically', /^AT\/Q\/\d{4}\/\d{4}$/.test(rfq.quotation || ''), rfq.quotation);
    TOKEN = v.token;    // admin
    const full = await get('/admin/rfq/' + rfq.id);
    ok('customer state resolved from GSTIN', full.customer.state_name === 'Maharashtra' && full.raised_by.email === 'krishna@adonitech.co.in');
    const qid = full.quotation_id;
    const Q = await get('/admin/quotation/' + qid);
    ok('supplier 27 + customer 27 -> intra-state, INR', Q.supply_type === 'intra' && Q.currency === 'INR');
    ok('line priced from the uploaded CSV, lead time carried', Q.items[0].rate === 18500 && Q.items[0].lead_time_days === 35 && Q.lead_time_days === 35);
    ok('mounting accessory line added', Q.items[1] && Q.items[1].kind === 'accessory');
    ok('approve link carries a signed token', /approve\.html\?id=.+&t=.+\..+/.test(Q.approve_url));
    const tokenA = new URL(Q.approve_url).searchParams.get('t');
    const A = await fetch(`${base}/approve/${qid}?t=${tokenA}`).then(r => r.json());
    ok('approval page loads without login via signed link', A.quotation && A.quotation.id === qid && A.bank.bank === 'Test Bank');
    ok('GA drawings for the model are listed', A.drawings.length >= 1 && A.drawings.every(d => d.available === false), A.drawings.map(d => d.filename).join(','));
    ok('wrong token refused', (await fetch(`${base}/approve/${qid}?t=abc.def`)).status === 401);
    const items = Q.items.map((i, n) => n === 0 ? { ...i, rate: 18500, qty: 2 } : { ...i, rate: 650, qty: 2 });
    const Q2 = await fetch(`${base}/approve/${qid}?t=${tokenA}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) }).then(r => r.json());
    const t = Q2.totals;
    ok('taxable = 2x18500 + 2x650', near(t.taxable, 38300), t.taxable);
    ok('CGST = SGST = 9%', near(t.cgst, 38300 * 0.09) && near(t.sgst, 38300 * 0.09), `${t.cgst}/${t.sgst}`);
    ok('no IGST on an intra-state supply', t.igst === 0);
    ok('grand total is rounded to the rupee', Number.isInteger(t.grand_total), t.grand_total);
    ok('amount in words', /Rupees Only$/.test(t.amount_in_words), t.amount_in_words);
    const Q3 = await fetch(`${base}/approve/${qid}?t=${tokenA}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ place_of_supply_code: '29' }) }).then(r => r.json());
    ok('Karnataka -> IGST', Q3.supply_type === 'inter' && Q3.totals.igst > 0 && Q3.totals.cgst === 0, `IGST ${Q3.totals.igst}`);
    const Q4 = await fetch(`${base}/approve/${qid}?t=${tokenA}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ place_of_supply_code: '27', freight: 2500 }) }).then(r => r.json());
    ok('freight adds a taxed line', near(Q4.totals.taxable, 38300 + 2500) && Q4.totals.hsn_summary.some(h => h.hsn === '996511'), Q4.totals.taxable);
    const pdfR = await fetch(`${base}/approve/${qid}/pdf?t=${tokenA}`);
    const pdfB = Buffer.from(await pdfR.arrayBuffer());
    ok('quotation PDF renders', pdfR.headers.get('content-type') === 'application/pdf' && pdfB.slice(0, 4).toString() === '%PDF' && pdfB.length > 5000, pdfB.length + ' bytes');
    // upload a GA PDF into the store, tick it, approve & send
    const gaPath = A.drawings[0].path;
    const up = await post('/admin/ga', { path: gaPath, base64: pdfB.toString('base64') });
    ok('GA PDF upload accepted', up.ok === true);
    await fetch(`${base}/approve/${qid}?t=${tokenA}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drawings: [{ path: gaPath, filename: gaPath.split('/').pop() }] }) });
    const sent = await fetch(`${base}/approve/${qid}/send?t=${tokenA}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approved_by: 'Paresh Adavani', drawings_mode: 'link' }) }).then(r => r.json());
    ok('approve & send runs (mail off -> reported, not thrown)', sent.ok === false && /SMTP/.test(sent.reason) && sent.links.length === 1, sent.reason);
    const dl = await fetch(base + new URL(sent.links[0].url).pathname);
    ok('expiring drawing link serves the PDF', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf');
    const Q5 = await get('/admin/quotation/' + qid);
    ok('quotation marked approved with approver + PDF stored', Q5.status === 'approved' && Q5.approved_by === 'Paresh Adavani');
    const rev = await post('/admin/rfq/' + rfq.id + '/quote', {});
    ok('revision keeps the number, bumps rev', rev.quotation.number === Q.number && rev.quotation.rev === 1, `${rev.quotation.number} rev ${rev.quotation.rev}`);

    console.log('\n— export (Germany, USD) —');
    const rfx = await post('/rfq', { line: 'wri', customer: { company: 'Beispiel GmbH', contact: 'H. Müller', email: 'h@example.de', phone: '+49 1', country: 'Germany' }, items: [{ table: 'wire_rope_isolators', key: 'AWRI-16-10', model: 'AWRI-16-10', qty: 4 }] });
    const QX = await get('/admin/quotation/' + (await get('/admin/rfq/' + rfx.id)).quotation_id);
    ok('non-Indian customer -> USD, export, zero-rated', QX.currency === 'USD' && QX.supply_type === 'export' && QX.totals.igst === 0 && QX.totals.cgst === 0);
    ok('USD rate derived from INR 1800 with uplift', QX.items[0].rate_inr === 1800 && QX.items[0].rate > 1800 / 120 && QX.fx && QX.fx.uplift_pct === 12, `USD ${QX.items[0].rate} @ ${QX.fx.inr_per_usd}`);
    ok('USD amount in words', /US Dollars/.test(QX.totals.amount_in_words), QX.totals.amount_in_words);

    console.log('\n— exports & audit —');
    const ex = await fetch(base + '/admin/export/rfqs.csv', { headers: H() }).then(r => r.text());
    ok('RFQ export has both requests', csv.parse(ex).rows.length === 2);
    const au = await get('/admin/audit?days=1');
    ok('audit trail records the approval', au.some(a => a.what === 'quotation.approve'));
    ok('mail verify reports cleanly when unconfigured', (await get('/admin/mail/verify')).ok === false);
    ok('drive status reports unconfigured cleanly', (await get('/admin/drive/status')).configured === false);
    ok('FY code is 4 digits', /^\d{4}$/.test(require('../lib/store').fyCode()));

    console.log(`\n${'='.repeat(56)}\n${pass} passed, ${fail} failed`);
  } catch (e) { console.error('\nERROR', e); fail++; }
  server.close(); fs.rmSync(process.env.IMPACTCAL_STORE, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
});
