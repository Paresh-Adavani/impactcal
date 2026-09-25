'use strict';
/**
 * The ImpactCal API. One Express app, mounted at /api by the Netlify function and by the
 * local dev server alike. Every route is JSON except /d/:token (drawing download) and the
 * quotation PDF preview.
 */
const express = require('express');
const crypto = require('crypto');
const store = require('./store');
const data = require('./data');
const csv = require('./csv');
const engine = require('./engine');
const gst = require('./gst');
const auth = require('./auth');
const quote = require('./quote');
const pdf = require('./pdf');
const notify = require('./notify');
const crm = require('./crm');
const pricing = require('./pricing');
const mail = require('./mail');
const fx = require('./fx');
const drive = require('./drive');
const rubber = require('./rubber');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '12mb' }));

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { if (!e.status && !/^(unknown table|not found)/.test(e.message)) console.error(e); res.status(e.status || 400).json({ error: e.message }); });
const admin = auth.requireRole('admin');
const staff = auth.requireRole('admin', 'sales');
const idOf = quote.idOf;
const SERIES_INFO = {
  AC:   { title: 'AC — adjustable hydraulic shock absorber', group: 'industrial', icon: 'img/series/AC.svg' },
  ACX:  { title: 'ACX — self-compensating hydraulic', group: 'industrial', icon: 'img/series/ACX.svg' },
  AD:   { title: 'AD — adjustable, rear adjuster', group: 'industrial', icon: 'img/series/AD.svg' },
  ADX:  { title: 'ADX — self-compensating, large bore', group: 'industrial', icon: 'img/series/ADX.svg' },
  YSRA: { title: 'YSRA — heavy industrial (on request)', group: 'industrial', icon: 'img/series/YSRA.svg' },
  AKHG: { title: 'AKHG — hydraulic crane buffer, gas return', group: 'crane', icon: 'img/series/AKHG.svg' },
  AKHS: { title: 'AKHS — hydraulic crane buffer, spring return', group: 'crane', icon: 'img/series/AKHS.svg' },
  ED:   { title: 'ED — heavy hydraulic buffer', group: 'crane', icon: 'img/series/ED.svg' },
  EI:   { title: 'EI — heavy hydraulic buffer, flange', group: 'crane', icon: 'img/series/EI.svg' },
  SB:   { title: 'SB — spring buffer', group: 'crane', icon: 'img/series/SB.svg' },
  JHQC: { title: 'JHQC — polyurethane buffer', group: 'crane', icon: 'img/series/JHQC.svg' },
};

/* ------------------------------------------------------------------ reference */
app.get('/health', wrap(async (_q, r) => r.json({ ok: true, products: (await data.products()).length, ...store.status(), smtp: { user: mail.config().user.replace(/^(.{3}).*(@.*)$/, '$1…$2'), pass_len: mail.config().pass.length }, time: new Date().toISOString() })));

app.get('/meta', auth.optional, wrap(async (req, res) => {
  const [products, accessories, settings] = await Promise.all([data.products(), data.accessories(), data.settings()]);
  const series = {};
  for (const p of products) if (p.status === 'active' || p.status === 'on_request') { series[p.series] = series[p.series] || { series: p.series, n: 0, ...(SERIES_INFO[p.series] || { title: p.series, group: p.group || 'industrial', icon: p.image }) }; series[p.series].n++; }
  const pub = {};
  for (const [k, v] of Object.entries(settings)) if (/^(company|ui|analytics)\./.test(k)) pub[k] = v;
  res.json({
    cases: Object.entries(engine.CASES).map(([id, c]) => ({ id, title: c.title, group: c.group })),
    standards: Object.values(engine.STANDARDS), series: Object.values(series).sort((a, b) => a.series.localeCompare(b.series)),
    accessories: accessories.filter(a => a.status === 'active').map(({ price_inr, ...a }) => auth.canSeePrices(req.user) ? { ...a, price_inr } : a),
    states: gst.STATES, company: data.company(settings), settings: pub,
    languages: String(settings['ui.languages'] || 'en').split(','), user: req.user || null, prices: auth.canSeePrices(req.user),
    fx: auth.canSeePrices(req.user) ? await fx.inrPerUsd(settings) : null, uplift_pct: Number(settings['fx.uplift_pct'] || 0),
  });
}));

app.get('/i18n', wrap(async (_q, res) => {
  const [t, s] = await Promise.all([data.i18n(), data.settings()]);
  const enabled = String(s['ui.languages'] || 'en').split(',').map(x => x.trim()).filter(x => t.languages.includes(x));
  res.setHeader('cache-control', 'public, max-age=300');
  res.json({ dict: t.dict, languages: enabled.length ? enabled : ['en'], default: s['ui.default_language'] || 'en' });
}));

app.get('/gstin/:g', wrap((req, res) => { const v = gst.validateGstin(req.params.g); res.json(v.ok ? v : { ...v, suggestions: gst.repairGstin(req.params.g) }); }));

/* ------------------------------------------------------------------ selection: shock absorbers & crane buffers */
app.post('/select', auth.optional, wrap(async (req, res) => {
  const { duty = {}, case_id, standard = 'IS3177', series = null, max_stroke_mm = null, temp_derate = 1, limit = 40, include_rejected = false, currency = 'INR' } = req.body || {};
  if (!engine.CASES[case_id]) return res.status(400).json({ error: 'unknown case ' + case_id });
  const settings = await data.settings();
  const products = (await data.products()).filter(p => p.status === 'active');
  const all = engine.select(duty, case_id, products, { standard, series: series && series.length ? series : null, maxStrokeMm: max_stroke_mm, tempDerate: temp_derate, includeRejected: include_rejected, shareDriveWork: settings['engine.share_drive_work'] === '1' });
  const showPrice = auth.canSeePrices(req.user);
  const rate = showPrice && currency === 'USD' ? await fx.inrPerUsd(settings) : null;
  const shape = c => ({
    bk: c.product.bk, model: c.product.model, series: c.product.series, technology: c.product.technology, image: c.product.image, ga_pdf: c.product.ga_pdf,
    stroke_mm: c.product.stroke_mm, nm_per_cycle: c.product.nm_per_cycle, nm_per_hour: c.product.nm_per_hour, fs_max_n: c.product.fs_max_n, damping_codes: c.product.damping_codes,
    lead_time_days: c.product.lead_time_days, status: c.product.status,
    price: showPrice ? (rate ? fx.toUsd(c.product.price_inr, rate, settings) : c.product.price_inr) : undefined,
    E_k: c.E_k, E_w: c.E_w, E_t: c.E_t, E_tc: c.E_tc, m_e: c.m_e, F_s: c.F_s, a: c.a, t: c.t, u_stroke: c.u_stroke, u_hour: c.u_hour, u: c.u, flags: c.flags, fatal: c.fatal, picks: c.picks,
  });
  const first = all[0];
  const ref = all.find(c => c.picks.includes('best-centred utilisation')) || first;
  const head = all.slice(0, limit); for (const c of all) if (c.picks.length && !head.includes(c)) head.push(c);
  res.json({ standard: engine.STANDARDS[standard], case: { id: case_id, ...engine.CASES[case_id] }, currency: rate ? 'USD' : 'INR',
    duty_applied: first ? { v: first.v, v_e: first.v_e, E_k: first.E_k, stroke_dependent: true, reference_model: ref ? ref.product.model : null, E_t: ref ? ref.E_t : null, E_tc: ref ? ref.E_tc : null, m_e: ref ? ref.m_e : null } : null,
    count: all.length, candidates: head.map(shape) });
}));

app.get('/products', auth.optional, wrap(async (req, res) => {
  const { series, q } = req.query;
  let rows = await data.products();
  if (series) rows = rows.filter(r => r.series === series);
  if (q) rows = rows.filter(r => (r.model + r.bk).toLowerCase().includes(String(q).toLowerCase()));
  res.json(rows.map(({ price_inr, ...r }) => auth.canSeePrices(req.user) ? { ...r, price_inr } : r));
}));

/* ------------------------------------------------------------------ wire rope isolators (engine runs in the browser, data + prices from here) */
app.get('/wri/data', auth.optional, wrap(async (req, res) => {
  const rows = await data.wri();
  const settings = await data.settings();
  const show = auth.canSeePrices(req.user);
  const rate = show ? await fx.inrPerUsd(settings) : null;
  const awri = rows.filter(r => r.status !== 'obsolete').map(r => ({ m: r.model, fam: r.family_wire_mm, h: r.height_mm, w: r.width_mm, wt: r.weight_kg, hole: r.hole_mm, thr: r.thread,
    C: { L: r.c_load_n, D: r.c_defl_mm, kv: r.c_kv_n_mm, ks: r.c_ks_n_mm }, R: { L: r.r_load_n, D: r.r_defl_mm, kv: r.r_kv_n_mm, ks: r.r_ks_n_mm }, S: { L: r.s_load_n, D: r.s_defl_mm, kv: r.s_kv_n_mm, ks: r.s_ks_n_mm },
    lead: r.lead_time_days, ga: r.ga_pdf, status: r.status }));
  const prices = {};
  if (show) for (const r of rows) if (r.price_inr != null) prices[r.model] = { price: r.price_inr, usd: rate ? fx.toUsd(r.price_inr, rate, settings) : null, enidEq: r.enidine_equiv, lead: r.lead_time_days };
  res.json({ awri, prices, prices_visible: show, fx: rate ? { inr_per_usd: rate.rate, uplift_pct: Number(settings['fx.uplift_pct'] || 0) } : null });
}));

/* ------------------------------------------------------------------ rubber mounts */
app.get('/rubber/data', auth.optional, wrap(async (req, res) => {
  const rows = await data.rubber();
  res.json(rows.map(({ price_inr, ...r }) => auth.canSeePrices(req.user) ? { ...r, price_inr } : r));
}));
app.post('/rubber/select', auth.optional, wrap(async (req, res) => {
  const rows = await data.rubber();
  const out = rubber.select(rows, req.body || {});
  const show = auth.canSeePrices(req.user);
  out.candidates = out.candidates.map(c => ({ ...c, product: show ? c.product : { ...c.product, price_inr: undefined } }));
  res.json(out);
}));

/* ------------------------------------------------------------------ auth */
app.post('/auth/request-otp', wrap(async (req, res) => {
  const { email } = req.body || {};
  const o = await auth.requestOtp(email);
  const m = await notify.otp(o.email, o.code);
  const dev = !store.onNetlify() && !mail.config().user;
  res.json({ ok: true, sent: m.ok, reason: m.ok ? undefined : m.reason, ...(dev ? { dev_code: o.code } : {}) });
}));
app.post('/auth/verify', wrap(async (req, res) => {
  const { email, code } = req.body || {};
  const settings = await data.settings();
  res.json(await auth.verifyOtp(email, code, settings));
}));
app.get('/auth/me', auth.optional, (req, res) => res.json({ user: req.user, prices: auth.canSeePrices(req.user) }));

/* ------------------------------------------------------------------ RFQ */
const quality = require('./quality');
const report = require('./report');

/** Normalise + quality-check the customer block. Throws a 400-style error for junk. */
function customerFrom(b, opts = {}) {
  const c = { ...(b.customer || {}) };
  if (!c.email || !c.phone || !(c.contact || c.name)) { const e = new Error('name, e-mail and phone are required'); e.status = 400; throw e; }
  c.contact = c.contact || c.name;
  const q = quality.check(c);
  if (q.level === 'reject' && !opts.staff) { const e = new Error(quality.message(q)); e.status = 400; e.quality = q; throw e; }
  c.quality = q.level; c.quality_reasons = q.reasons;
  if (c.gstin) { const v = gst.validateGstin(c.gstin); if (v.ok) { c.gstin = v.value; c.state_code = v.state_code; c.state_name = v.state_name; }
    else { c.gstin_warning = v.reason; const sc = String(c.gstin).trim().slice(0, 2); if (gst.STATES[sc]) { c.state_code = sc; c.state_name = gst.STATES[sc]; } } }   // mistyped GSTIN: still use the state prefix for place of supply
  c.country = c.country || 'India';
  return c;
}

/** Create an RFQ (+ mails, CRM lead, draft quotation, approval alert). Shared by POST /rfq, the portal quick quote and "convert selection to RFQ".
 *  The issuer decides whose quotation it becomes: ADONI TECH (Satara / Pune office) or an approved dealer (his letterhead). */
async function createRfq(b, user) {
  if (!b.items || !b.items.length) { const e = new Error('no items'); e.status = 400; throw e; }
  const settings = await data.settings();
  const c = customerFrom(b, { staff: !!user });
  const issuer = await quote.issuerFor(user, settings);
  const dealer = issuer.type === 'dealer';
  const number = await store.nextNumber('rfq', settings['rfq.prefix'] || 'AT/R');
  const rfq = { id: idOf(number), number, created_at: new Date().toISOString(), status: 'new', line: b.line || 'shock',
    customer: c, project: b.project || {}, raised_by: user ? { email: user.email, role: user.role, name: dealer ? (issuer.contact ? `${issuer.contact} (${issuer.company})` : issuer.company) : auth.displayName(user.email, settings) } : null,
    issuer, selection: b.selection || null, items: b.items.map(i => ({ table: i.table || 'shock_absorbers', key: i.key || i.bk || i.model, model: i.model, qty: Number(i.qty) || 1, mounting: i.mounting || '', cap: i.cap || '', damping_code: i.damping_code || '', remark: i.remark || '' })),
    formats: b.formats || ['PDF'], message: b.message || '', lang: b.lang || 'en', from_selection: b.from_selection || null, source: b.source || (b.selection ? 'selector' : 'portal') };
  await store.setJSON('rfq/' + rfq.id, rfq);
  await store.audit(user ? user.email : 'customer', 'rfq.create', number, rfq.line + (dealer ? ' · dealer ' + issuer.code : '') + (c.quality !== 'ok' ? ' · quality ' + c.quality : ''));
  const company = data.company(settings);
  // a dealer's customer is the dealer's: no ADONI TECH acknowledgement goes to him
  const mails = await notify.rfqReceived(rfq, settings, company, { noCustomer: dealer });
  // CRM lead (UnitePro) - never blocks the RFQ; suspect-quality entries are kept out of the CRM
  let lead = null;
  if (c.quality === 'ok' || user) {
    try { lead = await crm.rfqCreated(rfq, settings, notify.PUBLIC_URL()); if (lead.ok) { rfq.crm = { pushed_at: new Date().toISOString(), response: lead.response }; await store.setJSON('rfq/' + rfq.id, rfq); } }
    catch (e) { console.error('crm failed', e); lead = { ok: false, reason: e.message }; }
  } else { lead = { ok: false, reason: 'held back from CRM: contact details look doubtful (' + c.quality_reasons.join(', ') + ')' }; await store.audit('system', 'crm.held', number, lead.reason); }
  // the draft: dealer / sales person gets "draft ready"; ADONI TECH gets the approval alert (not for dealer quotations)
  let q = null, alert = null, draft = null;
  try {
    q = await quote.draftFromRfq(rfq);
    rfq.quotation_id = q.id; rfq.status = 'draft'; await store.setJSON('rfq/' + rfq.id, rfq);
    if (user && (dealer || user.role === 'sales')) draft = await notify.draftReady(q, user.email);
    if (!dealer) {
      const url = `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}&t=${auth.actionLink('approve', q.id)}`;
      alert = await notify.approvalRequested(q, settings, url);
    }
  } catch (e) { console.error('draft failed', e); await store.audit('system', 'quotation.draft_failed', number, e.message); }
  if (b.assistant_conversation) { try { await assistant.linkRfq(String(b.assistant_conversation), number); } catch (e) { console.error(e); } }
  return { id: rfq.id, number, mail: mails.sales, ack: mails.customer, quotation: q ? q.number : null, quotation_id: q ? q.id : null, issuer: issuer.type, alert: alert && alert.mail ? alert.mail.ok : false, draft_mail: draft ? draft.ok : null, crm: lead ? { ok: lead.ok, reason: lead.reason, status: lead.status } : null, quality: c.quality };
}
app.post('/rfq', auth.optional, wrap(async (req, res) => {
  try { res.json(await createRfq(req.body || {}, req.user)); }
  catch (e) { if (e.status) return res.status(e.status).json({ error: e.message, quality: e.quality && e.quality.reasons }); throw e; }
}));

/* ------------------------------------------------------------------ selection report download (gated: name, e-mail, phone) */
app.post('/selection', auth.optional, wrap(async (req, res) => {
  const b = req.body || {};
  const settings = await data.settings();
  let c;
  try { c = customerFrom(b, { staff: !!req.user }); }
  catch (e) { if (e.status) return res.status(e.status).json({ error: e.message, quality: e.quality && e.quality.reasons }); throw e; }
  const number = await store.nextNumber('selection', settings['selection.prefix'] || 'AT/S');
  const sel = { id: idOf(number), number, created_at: new Date().toISOString(), status: 'downloaded', line: b.line || 'shock', customer: c, project: b.project || {},
    raised_by: req.user ? { email: req.user.email, role: req.user.role, name: auth.displayName(req.user.email, settings) } : null,
    selection: b.selection || null, items: (b.items || []).map(i => ({ table: i.table || 'shock_absorbers', key: i.key || i.bk || i.model, model: i.model, qty: Number(i.qty) || 1 })), lang: b.lang || 'en' };
  await store.setJSON('selection/' + sel.id, sel);
  await store.audit(req.user ? req.user.email : 'customer', 'selection.download', number, (sel.items[0] || {}).model + (c.quality !== 'ok' ? ' · quality ' + c.quality : ''));
  const company = data.company(settings);
  const pdf = await report.render(sel, company);
  const mails = await notify.selectionDownloaded(sel, settings, company, pdf);
  let lead = null;
  if (c.quality === 'ok' || req.user) { try { lead = await crm.selectionDownloaded(sel, settings, notify.PUBLIC_URL()); } catch (e) { lead = { ok: false, reason: e.message }; } }
  else { lead = { ok: false, reason: 'held back from CRM' }; await store.audit('system', 'crm.held', number, c.quality_reasons.join(', ')); }
  if (lead && lead.ok) { sel.crm = { pushed_at: new Date().toISOString() }; await store.setJSON('selection/' + sel.id, sel); }
  res.json({ id: sel.id, number, mail: mails.customer, sales: mails.sales, crm: lead ? { ok: lead.ok, reason: lead.reason } : null, pdf_b64: pdf.toString('base64'), filename: `Selection-${number.replace(/\//g, '-')}.pdf` });
}));

/* ------------------------------------------------------------------ quotation page
 *   admin  : signed link (phone, no login) or admin login - everything, incl. drawings and special-price decisions
 *   sales  : ADONI TECH quotations; may send within quote.max_discount_pct (25 %), deeper = special-price request
 *   dealer : only his own quotations (approved dealer); within his max discount, deeper = special-price request */
const dealers = require('./dealers');
const approveAuth = async (req, res, next) => {
  try {
    const t = req.query.t || req.get('x-approve-token');
    const p = auth.verifyAction(t, 'approve');
    if (p && p.ref === req.params.id) { req.access = 'admin'; req.actor = null; return next(); }
    auth.optional(req, res, () => {});
    const u = req.user;
    if (!u) return res.status(401).json({ error: 'please sign in to open this quotation', login: true });
    const settings = await data.settings();
    if (u.role === 'admin') { req.access = 'admin'; req.actor = { email: u.email, name: auth.displayName(u.email, settings) }; return next(); }
    const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
    const is = q.issuer || { type: 'adoni' };
    if (u.role === 'sales' && is.type !== 'dealer') { req.access = 'sales'; req.actor = { email: u.email, name: auth.displayName(u.email, settings) }; return next(); }
    if (u.role === 'dealer' && is.type === 'dealer' && is.dealer === u.email) {
      const d = await dealers.get(u.email);
      if (!d || d.status !== 'approved') return res.status(403).json({ error: 'your dealer account is not active - contact ADONI TECH' });
      req.access = 'dealer'; req.actor = { email: u.email, name: d.contact || d.company }; return next();
    }
    res.status(403).json({ error: 'this quotation belongs to someone else' });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
/** Letterhead + bank for the PDF, with the dealer's logo when he uploaded one. */
async function partiesFor(q, settings) {
  const pp = quote.docParties(q, settings);
  if (q.issuer && q.issuer.type === 'dealer') { const b = await dealers.logo(q.issuer.dealer); if (b) pp.company.logo_buffer = b; }
  return pp;
}
/** Sales (ADONI TECH quotations): within 25 % below list, no markup - else approval. Dealers: discount limit only. */
const limitFor = (q, access) => quote.limitCheck(q, null, { markup: access === 'sales' });
const approveUrl = (q, withToken) => `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}${withToken ? '&t=' + auth.actionLink('approve', q.id) : ''}`;

app.get('/approve/:id', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const rfq = await store.getJSON('rfq/' + q.rfq_id);
  const settings = await data.settings();
  let drawings = [];
  if (req.access === 'admin') {
    const ga = await data.gaIndex();
    const keys = new Set(q.items.map(i => i.key));
    const models = new Set(q.items.map(i => i.model));
    drawings = ga.filter(g => keys.has(g.bk) || models.has(g.model)).map(g => ({ path: g.path, filename: g.filename, model: g.model, mounting: g.mounting, accessory: g.accessory, status: g.status }));
    const available = new Set(await store.list('ga/'));
    drawings.forEach(d => { d.available = available.has('ga/' + d.path); });
  }
  const parties = quote.docParties(q, settings);
  const is = q.issuer || { type: 'adoni' };
  const offices = is.type === 'dealer' ? [] : Object.values(quote.offices(settings)).map(o => ({ id: o.id, label: o.label || o.id, ready: !!o.addr1 }));
  res.json({ quotation: q, rfq, drawings, bank: parties.bank, company: parties.company, drawings_mode: settings['drawings.mode'] || 'attach',
    access: req.access, actor: req.actor, limit: limitFor(q, req.access), billing: req.access !== 'sales' ? quote.dealerBilling(q) : null, offices,
    sales_self_send: settings['quote.sales_self_send'] !== '0' });
}));
app.put('/approve/:id', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const settings = await data.settings();
  const isAdmin = req.access === 'admin';
  for (const k of ['valid_days', 'freight', 'freight_hsn', 'freight_gst', 'packing', 'notes', 'place_of_supply_code', 'supply_type', 'lead_time_override']) if (b[k] !== undefined) q[k] = b[k];
  if (b.terms) q.terms = { ...q.terms, ...b.terms };
  if (b.office && q.issuer && q.issuer.type !== 'dealer' && quote.offices(settings)[b.office]) q.issuer.office = b.office;
  const supplierState = (q.issuer && q.issuer.type === 'dealer' && q.issuer.state_code) || settings['company.state_code'] || '27';
  if (b.place_of_supply_code !== undefined && b.supply_type === undefined) { q.place_of_supply_name = gst.STATES[b.place_of_supply_code] || ''; q.supply_type = gst.supplyType(supplierState, b.place_of_supply_code, q.customer && q.customer.country); }
  if (Array.isArray(b.items)) {
    q.items = b.items.map((i, n) => {
      const old = q.items.find(x => x.seq === i.seq);
      const o = { ...(old || {}), ...i };
      if (!isAdmin) {   // list prices and product identity come from the database, never from the page
        if (old) for (const k of ['kind', 'table', 'key', 'model', 'list_rate', 'rate_inr', 'hsn', 'gst_rate']) o[k] = old[k];
        else { o.kind = 'extra'; o.list_rate = null; }
      }
      return { ...o, seq: n + 1, qty: Number(o.qty) || 0, rate: Number(o.rate) || 0, discount_pct: Number(o.discount_pct) || 0, gst_rate: Number(o.gst_rate) || 0, lead_time_days: o.lead_time_days === '' ? null : (o.lead_time_days != null ? Number(o.lead_time_days) : null) };
    });
  }
  if (Array.isArray(b.drawings) && isAdmin) q.drawings = b.drawings;
  await quote.save(q);
  res.json(q);
}));
app.get('/approve/:id/pdf', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const settings = await data.settings(); const pp = await partiesFor(q, settings);
  const buf = await pdf.render(q, pp.company, pp.bank);
  res.setHeader('content-type', 'application/pdf'); res.setHeader('content-disposition', `inline; filename="${q.id}.pdf"`); res.send(buf);
}));
app.post('/approve/:id/send', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const settings = await data.settings();
  const isAdmin = req.access === 'admin';
  if (req.access === 'sales' && settings['quote.sales_self_send'] === '0') return res.status(403).json({ error: 'quotations are sent after approval by ADONI TECH - the approval link has been mailed to Paresh' });
  if (!isAdmin) {
    const chk = limitFor(q, req.access);
    if (!chk.ok) { const mk = chk.violations.filter(v => v.kind === 'markup').map(v => v.model), dc = chk.violations.filter(v => v.kind !== 'markup').map(v => v.model);
      return res.status(403).json({ error: [dc.length ? `Discount beyond your limit of ${chk.max_pct} % on ${dc.join(', ')}.` : '', mk.length ? `Price above list on ${mk.join(', ')} needs approval.` : ''].filter(Boolean).join(' ') + ' Change the price or request approval from ADONI TECH.', limit: chk }); }
  }
  const pp = await partiesFor(q, settings); const company = pp.company;
  const by = isAdmin ? ((req.body && req.body.approved_by) || (req.actor && req.actor.name) || settings['quote.approver_name'] || 'Paresh Adavani') : req.actor.name;
  q.approved_by = by; q.approved_at = new Date().toISOString(); q.status = 'approved'; q.sent_by = req.actor ? req.actor.email : 'approval-link';
  const buf = await pdf.render(q, company, pp.bank);
  await store.set('quotation-pdf/' + q.id, buf, { number: q.number });
  // drawings are released by ADONI TECH only
  const mode = (req.body && req.body.drawings_mode) || settings['drawings.mode'] || 'attach';
  const attach = [], links = [], missing = [];
  for (const d of isAdmin ? (q.drawings || []) : []) {
    const b = await store.getBuffer('ga/' + d.path);
    if (!b) { missing.push(d.filename); continue; }
    const tooBigForLink = b.length > 4 * 1024 * 1024;   // a function response is limited to ~6 MB after encoding
    if ((mode === 'attach' || tooBigForLink) && attach.reduce((s, a) => s + a.buffer.length, 0) + b.length < 18 * 1024 * 1024) attach.push({ filename: d.filename, buffer: b });
    else {
      const tok = crypto.randomBytes(20).toString('hex');
      const days = Number(settings['drawings.release_days'] || 30);
      await store.setJSON('release/' + tok, { path: d.path, filename: d.filename, quotation: q.id, expires: Date.now() + days * 86400000, downloads: 0 });
      links.push({ filename: d.filename, url: `${notify.PUBLIC_URL()}/d/${tok}` });
    }
  }
  const selfSend = req.access === 'dealer' && req.body && req.body.self_send;
  const m = selfSend ? { ok: true, to: 'sent by the dealer from his own e-mail', self: true } : await notify.offerSent(q, settings, company, buf, attach, links);
  if (m.ok) { q.status = 'sent'; q.sent_at = new Date().toISOString(); q.sent_to = m.to; }
  q.send_result = m; q.drawings_missing = missing;
  const billing = quote.dealerBilling(q);
  if (billing) q.billing = billing;
  await quote.save(q);
  const rfq = await store.getJSON('rfq/' + q.rfq_id); if (rfq) { rfq.status = m.ok ? 'quoted' : 'approved'; rfq.quotation_id = q.id; await store.setJSON('rfq/' + rfq.id, rfq); }
  let internal = null;
  if (billing && m.ok) { try { internal = await notify.dealerQuoteInternal(q, settings, billing); } catch (e) { console.error(e); } }
  await store.audit(q.sent_by, 'quotation.send', q.number, (m.ok ? 'sent to ' + m.to : 'mail failed: ' + m.reason) + (billing ? ` · billing ${billing.currency} ${billing.billing_value}` : ''));
  res.json({ ok: m.ok, reason: m.reason, sent_to: m.to, attached: attach.map(a => a.filename), links, missing, billing: req.access !== 'sales' ? billing : null, internal: internal ? internal.ok : null });
}));
/* special price: beyond the 25 % limit, ADONI TECH decides case by case */
app.post('/approve/:id/special', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const settings = await data.settings();
  const prev = q.special; q.special = null;
  const chk = limitFor(q, req.access);
  if (!chk.violations.length) { q.special = prev; return res.status(400).json({ error: 'all lines are within your discount limit - no special price needed' }); }
  const who = req.actor || { email: 'approval-link', name: 'ADONI TECH' };
  q.special = { status: 'pending', reason: String((req.body && req.body.reason) || '').slice(0, 1000), requested_by: who.name, requested_email: who.email, requested_at: new Date().toISOString(), asked: chk.violations, markup: req.access === 'sales' };
  await quote.save(q);
  const m = await notify.specialRequested(q, settings, approveUrl(q, true), chk);
  await store.audit(who.email, 'special.request', q.number, chk.violations.map(v => `${v.model} ${v.discount_pct}%`).join(', '));
  res.json({ ok: true, mail: m.ok, special: q.special });
}));
app.post('/approve/:id/special/decide', approveAuth, wrap(async (req, res) => {
  if (req.access !== 'admin') return res.status(403).json({ error: 'only ADONI TECH can decide a special price' });
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  if (!q.special) return res.status(400).json({ error: 'no special-price request on this quotation' });
  const b = req.body || {}; const settings = await data.settings();
  const ok = b.decision === 'approve';
  const sp = q.special; q.special = null;
  const chk = quote.limitCheck(q, null, { markup: !!sp.markup });
  q.special = { ...sp, status: ok ? 'approved' : 'declined', decided_by: (req.actor && req.actor.name) || settings['quote.approver_name'] || 'Paresh Adavani', decided_at: new Date().toISOString(), decision_note: String(b.note || '').slice(0, 500),
    approved_nets: ok ? Object.fromEntries(chk.violations.map(v => [v.seq, v.net])) : {},
    billing_discount_pct: ok && q.issuer && q.issuer.type === 'dealer' && b.billing_discount_pct !== undefined && b.billing_discount_pct !== '' ? Math.max(0, Math.min(90, Number(b.billing_discount_pct))) : null };
  await quote.save(q);
  let m = null; if (sp.requested_email && sp.requested_email.includes('@')) m = await notify.specialDecided(q, sp.requested_email);
  await store.audit((req.actor && req.actor.email) || 'approval-link', 'special.' + (ok ? 'approve' : 'decline'), q.number, q.special.decision_note);
  res.json({ ok: true, special: q.special, mail: m ? m.ok : null });
}));

/* drawing download by expiring link */
app.get('/d/:token', wrap(async (req, res) => {
  const rel = await store.getJSON('release/' + req.params.token);
  if (!rel) return res.status(404).send('Link not found.');
  if (rel.expires < Date.now()) return res.status(410).send('This link has expired. Please ask ADONI TECH for a fresh copy.');
  const b = await store.getBuffer('ga/' + rel.path); if (!b) return res.status(404).send('Drawing not available.');
  rel.downloads++; await store.setJSON('release/' + req.params.token, rel);
  await store.audit('customer', 'drawing.download', rel.quotation, rel.filename);
  res.setHeader('content-type', 'application/pdf'); res.setHeader('content-disposition', `attachment; filename="${rel.filename}"`); res.send(b);
}));

/* ------------------------------------------------------------------ admin: RFQs & quotations */
app.get('/admin/rfqs', staff, wrap(async (req, res) => {
  const keys = await store.list('rfq/'); const out = [];
  for (const k of keys) { const r = await store.getJSON(k); if (!r) continue; if (req.user.role === 'sales' && r.raised_by && r.raised_by.email !== req.user.email && r.raised_by.role !== 'customer') { /* sales see own + web */ }
    out.push({ id: r.id, number: r.number, created_at: r.created_at, status: r.status, line: r.line, customer: r.customer && (r.customer.company || r.customer.name), country: r.customer && r.customer.country, items: r.items.length, quotation_id: r.quotation_id, raised_by: r.raised_by && (r.raised_by.name || r.raised_by.email) }); }
  res.json(out.sort((a, b) => b.number.localeCompare(a.number)));
}));
app.get('/admin/rfq/:id', staff, wrap(async (req, res) => { const r = await store.getJSON('rfq/' + req.params.id); r ? res.json(r) : res.status(404).json({ error: 'not found' }); }));
app.patch('/admin/rfq/:id', admin, wrap(async (req, res) => { const r = await store.getJSON('rfq/' + req.params.id); if (!r) return res.status(404).json({ error: 'not found' }); Object.assign(r, { status: req.body.status ?? r.status, admin_note: req.body.admin_note ?? r.admin_note }); await store.setJSON('rfq/' + r.id, r); res.json(r); }));
app.post('/admin/rfq/:id/quote', admin, wrap(async (req, res) => {
  const r = await store.getJSON('rfq/' + req.params.id); if (!r) return res.status(404).json({ error: 'not found' });
  const q = await quote.draftFromRfq(r); r.quotation_id = q.id; r.status = 'draft'; await store.setJSON('rfq/' + r.id, r);
  res.json({ quotation: q, approve_url: `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}&t=${auth.actionLink('approve', q.id)}` });
}));
app.post('/admin/rfq/:id/resend-alert', admin, wrap(async (req, res) => {
  const r = await store.getJSON('rfq/' + req.params.id); if (!r || !r.quotation_id) return res.status(404).json({ error: 'no draft yet' });
  const q = await quote.get(r.quotation_id); const settings = await data.settings();
  const url = `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}&t=${auth.actionLink('approve', q.id)}`;
  res.json(await notify.approvalRequested(q, settings, url));
}));
app.get('/admin/selections', staff, wrap(async (_q, res) => {
  const keys = await store.list('selection/'); const out = [];
  for (const k of keys) { const r = await store.getJSON(k); if (!r) continue;
    out.push({ id: r.id, number: r.number, created_at: r.created_at, status: r.status, line: r.line, customer: r.customer && (r.customer.company || r.customer.contact), contact: r.customer && r.customer.contact, email: r.customer && r.customer.email, phone: r.customer && r.customer.phone, country: r.customer && r.customer.country, quality: r.customer && r.customer.quality, model: (r.items[0] || {}).model, qty: (r.items[0] || {}).qty, rfq_number: r.rfq_number || null, crm: !!r.crm, raised_by: r.raised_by && (r.raised_by.name || r.raised_by.email) }); }
  res.json(out.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}));
app.get('/admin/selection/:id', staff, wrap(async (req, res) => { const r = await store.getJSON('selection/' + req.params.id); if (!r) return res.status(404).json({ error: 'not found' }); res.json(r); }));
app.post('/admin/selection/:id/to-rfq', staff, wrap(async (req, res) => {
  const r = await store.getJSON('selection/' + req.params.id); if (!r) return res.status(404).json({ error: 'not found' });
  if (r.rfq_number) return res.status(409).json({ error: 'already converted to ' + r.rfq_number });
  const out = await createRfq({ line: r.line, customer: r.customer, project: r.project, selection: r.selection, items: r.items, formats: ['PDF'], message: (req.body && req.body.message) || `Converted from selection report ${r.number}`, lang: r.lang, from_selection: r.number }, req.user);
  r.rfq_number = out.number; r.rfq_id = out.id; r.status = 'rfq'; await store.setJSON('selection/' + r.id, r);
  res.json(out);
}));
app.get('/admin/quotations', staff, wrap(async (_q, res) => res.json(await quote.list())));
app.get('/admin/quotation/:id', staff, wrap(async (req, res) => { const q = await quote.get(req.params.id); q ? res.json({ ...q, approve_url: approveUrl(q, req.user.role === 'admin') }) : res.status(404).json({ error: 'not found' }); }));
app.get('/admin/quotation/:id/pdf', staff, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const s = await data.settings(); const pp = await partiesFor(q, s); const buf = await pdf.render(q, pp.company, pp.bank);
  res.setHeader('content-type', 'application/pdf'); res.send(buf);
}));

/* ------------------------------------------------------------------ DAMPA assistant */
const assistant = require('./assistant');
const actorOf = req => req.user ? 'u-' + crypto.createHash('sha1').update(req.user.email).digest('hex').slice(0, 16)
  : 'v-' + crypto.createHash('sha1').update(String(req.get('x-nf-client-connection-ip') || req.get('x-forwarded-for') || req.ip || '') + '|' + String(req.get('user-agent') || '').slice(0, 60)).digest('hex').slice(0, 16);
app.get('/assistant/config', wrap(async (_q, res) => { const c = assistant.cfg(await data.settings()); res.json({ enabled: c.enabled, held: !c.switched_on, name: c.name, tagline: c.tagline }); }));
app.post('/assistant/chat', auth.optional, wrap(async (req, res) => {
  const b = req.body || {};
  try {
    res.json(await assistant.chat({ conversation_id: b.conversation_id, text: b.text, files: b.files, page: String(b.page || '').slice(0, 60), context: b.context, user: req.user, actor: actorOf(req) }));
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
}));
app.get('/admin/assistant', admin, wrap(async (_q, res) => {
  const s = await data.settings();
  res.json({ config: assistant.cfg(s), usage: await assistant.usage(), conversations: ((await store.getJSON('assistant/index')) || []).slice(0, 300) });
}));
app.get('/admin/assistant/conv/:id', admin, wrap(async (req, res) => {
  const c = await store.getJSON('assistant/conv/' + req.params.id); if (!c) return res.status(404).json({ error: 'not found' });
  res.json({ id: c.id, created_at: c.created_at, user: c.user, page: c.page, turns: c.turns, usd: c.usd, rfq_number: c.rfq_number || null, rfq_draft: c.rfq_draft || null, files: c.files.map(({ key, ...f }) => ({ ...f, key })), transcript: assistant.transcript(c) });
}));
app.get('/admin/assistant/file', admin, wrap(async (req, res) => {
  const k = String(req.query.key || ''); if (!k.startsWith('assistant/file/')) return res.status(400).json({ error: 'bad key' });
  const b = await store.getBuffer(k); if (!b) return res.status(404).json({ error: 'not found' });
  const name = k.split('/').pop().replace(/^[a-z0-9]+-/, '');
  res.setHeader('content-type', /\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : /\.(jpe?g)$/i.test(name) ? 'image/jpeg' : 'application/octet-stream');
  res.setHeader('content-disposition', `inline; filename="${name}"`); res.send(b);
}));

/* ------------------------------------------------------------------ public config for every page (Google tag) and the dealer sign-up page */
app.get('/public/config', wrap(async (_q, res) => { const s = await data.settings(); res.setHeader('cache-control', 'public, max-age=300'); res.json({ ga_id: /^G-[A-Z0-9]{4,}$/.test(s['analytics.ga_id'] || '') ? s['analytics.ga_id'] : null }); }));
app.get('/dealer/program', wrap(async (_q, res) => {
  const s = await data.settings();
  const cities = String(s['dealer.cities'] || '').split(/[;\n]+/).map(x => x.trim()).filter(Boolean);
  res.setHeader('cache-control', 'public, max-age=120');
  res.json({ cities, note: s['dealer.cities_note'] || '', company: s['company.name'] || 'ADONI TECH' });
}));

/* ------------------------------------------------------------------ dealers: apply once, ADONI TECH approves once */
const loggedIn = auth.requireRole();
app.post('/dealer/apply', loggedIn, wrap(async (req, res) => {
  if (req.user.role === 'admin' || req.user.role === 'sales') return res.status(400).json({ error: 'ADONI TECH staff do not need a dealer account' });
  const before = await dealers.get(req.user.email);
  const d = await dealers.apply(req.user.email, req.body || {});
  const settings = await data.settings();
  let m = null;
  if (!before || before.status !== 'approved') m = await notify.dealerApplied(d, settings, `${notify.PUBLIC_URL()}/admin.html#dealers`);
  await store.audit(req.user.email, before ? 'dealer.update' : 'dealer.apply', d.company, d.gstin || '');
  res.json({ ok: true, dealer: d, mail: m ? m.ok : null });
}));
app.get('/dealer/me', loggedIn, wrap(async (req, res) => {
  const d = await dealers.get(req.user.email); const settings = await data.settings();
  res.json({ dealer: d, terms: d ? dealers.terms(d, settings) : null, role: req.user.role, relogin: !!(d && d.status === 'approved' && req.user.role !== 'dealer') });
}));
app.put('/dealer/me', loggedIn, wrap(async (req, res) => {
  const d = await dealers.get(req.user.email); if (!d) return res.status(404).json({ error: 'apply first' });
  const out = await dealers.update(req.user.email, req.body || {}, false);
  await store.audit(req.user.email, 'dealer.profile', out.company, '');
  res.json(out);
}));

app.put('/dealer/me/logo', loggedIn, wrap(async (req, res) => {   // { base64 } ; empty = remove
  const d = await dealers.setLogo(req.user.email, (req.body || {}).base64);
  await store.audit(req.user.email, 'dealer.logo', d.company, d.logo || 'removed'); res.json({ ok: true, logo: d.logo });
}));
app.get('/dealer/me/logo', loggedIn, wrap(async (req, res) => { const b = await dealers.logo(req.user.email); if (!b) return res.status(404).json({ error: 'no logo' }); res.setHeader('content-type', b[0] === 0x89 ? 'image/png' : 'image/jpeg'); res.send(b); }));
app.put('/admin/dealers/:email/logo', admin, wrap(async (req, res) => { const d = await dealers.setLogo(req.params.email, (req.body || {}).base64); res.json({ ok: true, logo: d.logo }); }));
app.get('/admin/dealers/:email/logo', admin, wrap(async (req, res) => { const b = await dealers.logo(req.params.email); if (!b) return res.status(404).json({ error: 'no logo' }); res.setHeader('content-type', b[0] === 0x89 ? 'image/png' : 'image/jpeg'); res.send(b); }));

/* ------------------------------------------------------------------ portal: quick quotation without a selection (dealer / sales / admin) */
const portalUser = async (req, res, next) => {
  req.user = null; auth.optional(req, res, () => {});
  const u = req.user;
  if (!u) return res.status(401).json({ error: 'login required' });
  if (u.role === 'admin' || u.role === 'sales') return next();
  if (u.role === 'dealer' && await dealers.isApproved(u.email)) return next();
  res.status(403).json({ error: 'the quotation portal is for approved dealers and ADONI TECH sales' });
};
const CATALOGUE = {
  shock_absorbers: r => ({ key: r.bk, model: r.model, series: r.series, group: r.group === 'crane' ? 'Crane buffers' : 'Industrial shock absorbers', desc: [r.stroke_mm && `${r.stroke_mm} mm stroke`, r.nm_per_cycle && `${Number(r.nm_per_cycle).toLocaleString('en-IN')} Nm/cycle`, r.me_max_kg && `Me up to ${Number(r.me_max_kg).toLocaleString('en-IN')} kg`].filter(Boolean).join(' · ') }),
  wire_rope_isolators: r => ({ key: r.model, model: r.model, series: 'AWRI', group: 'Wire rope isolators', desc: [r.family_wire_mm && `Ø${r.family_wire_mm} mm cable`, r.c_load_n && `${r.c_load_n} N compression`, r.height_mm && `H ${r.height_mm} mm`].filter(Boolean).join(' · ') }),
  rubber_mounts: r => ({ key: r.model, model: r.model, series: r.family, group: 'Anti-vibration mounts', desc: [r.load_max_kg && `${r.load_min_kg ? r.load_min_kg + '–' : 'up to '}${r.load_max_kg} kg`, r.natural_freq_hz && `${r.natural_freq_hz} Hz`, r.thread].filter(Boolean).join(' · ') }),
  accessories: r => ({ key: r.code, model: r.name, series: r.kind, group: 'Accessories', desc: [r.code, r.applies_to].filter(Boolean).join(' · ') }),
  other_products: r => ({ key: r.code, model: r.code, series: 'Other', group: 'Other products', desc: r.name }),
};
app.get('/portal/catalogue', portalUser, wrap(async (_q, res) => {
  const out = [];
  for (const [table, fn] of Object.entries(CATALOGUE)) {
    let rows = []; try { rows = await data.rows(table); } catch { continue; }
    for (const r of rows) {
      if (/discontinued|obsolete|inactive/i.test(r.status || '')) continue;
      const p = Number(r.price_inr);
      out.push({ table, ...fn(r), price_inr: p > 0 ? p : null, lead_time_days: Number(r.lead_time_days) || null, uom: r.uom || 'NOS', status: r.status || '' });
    }
  }
  res.json(out);
}));
app.post('/portal/quote', portalUser, wrap(async (req, res) => {
  const b = req.body || {};
  const want = (b.items || []).filter(i => i && i.table && i.key && Number(i.qty) > 0).slice(0, 60);
  if (!want.length) return res.status(400).json({ error: 'add at least one product' });
  const items = [];
  for (const i of want) {
    const fn = CATALOGUE[i.table]; if (!fn) return res.status(400).json({ error: 'unknown table ' + i.table });
    const k = data.TABLES[i.table].key;
    const r = (await data.rows(i.table)).find(x => String(x[k]) === String(i.key));
    if (!r) return res.status(400).json({ error: 'not in the catalogue: ' + i.key });
    const c = fn(r);
    items.push({ table: i.table, key: c.key, model: c.model, qty: Number(i.qty), remark: String(i.remark || '').slice(0, 200) });
  }
  try {
    const out = await createRfq({ line: 'portal', customer: b.customer, project: b.project || {}, items, message: b.message || '', formats: [], source: 'portal' }, req.user);
    res.json(out);
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); throw e; }
}));
app.get('/portal/quotations', portalUser, wrap(async (req, res) => {
  const all = await quote.list(); const u = req.user;
  res.json(all.filter(q => u.role === 'admin' || (u.role === 'dealer' ? q.dealer === u.email : q.raised_by === u.email)));
}));

/* ------------------------------------------------------------------ admin: dealers */
app.get('/admin/dealers', admin, wrap(async (_q, res) => { const s = await data.settings(); res.json((await dealers.list()).map(d => ({ ...d, terms: dealers.terms(d, s) }))); }));
app.post('/admin/dealers/:email/decide', admin, wrap(async (req, res) => {
  const b = req.body || {}; const settings = await data.settings();
  const d = await dealers.decide(req.params.email, b.decision, req.user.email, b);
  let m = null; if (b.decision === 'approve') m = await notify.dealerApproved(d, dealers.terms(d, settings));
  await store.audit(req.user.email, 'dealer.' + b.decision, d.company, d.code || '');
  res.json({ ok: true, dealer: d, mail: m ? m.ok : null });
}));
app.put('/admin/dealers/:email', admin, wrap(async (req, res) => {
  const d = await dealers.update(req.params.email, req.body || {}, true);
  await store.audit(req.user.email, 'dealer.edit', d.company, '');
  res.json(d);
}));

/* ------------------------------------------------------------------ admin: CSV database */
app.get('/admin/csv', admin, wrap(async (_q, res) => {
  const out = [];
  for (const t of Object.keys(data.TABLES)) out.push({ table: t, rows: (await data.rows(t)).length, source: await data.source(t), upload: await data.uploadMeta(t), key: data.TABLES[t].key });
  res.json(out);
}));
app.get('/admin/csv/:table', admin, wrap(async (req, res) => {
  const text = await data.raw(req.params.table);
  res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', `attachment; filename="${req.params.table}.csv"`);
  res.send(text.startsWith('﻿') ? text : '﻿' + text);
}));
app.post('/admin/csv/:table', admin, wrap(async (req, res) => {
  const text = typeof req.body === 'string' ? req.body : (req.body && req.body.csv) || '';
  if (!text.trim()) return res.status(400).json({ error: 'empty upload' });
  const v = await data.validateUpload(req.params.table, text);
  const dry = String(req.query.dry_run || '') === '1';
  if (!v.ok || dry) return res.json({ applied: false, ...v, rows: undefined });
  await data.saveUpload(req.params.table, v.header, v.rows);
  await store.audit(req.user.email, 'csv.upload', req.params.table, v.count + ' rows');
  res.json({ applied: true, count: v.count, warnings: v.warnings });
}));
app.delete('/admin/csv/:table', admin, wrap(async (req, res) => { await data.resetUpload(req.params.table); await store.audit(req.user.email, 'csv.reset', req.params.table, ''); res.json({ ok: true }); }));

/* settings are one CSV too; this edits keys without a full upload */
app.get('/admin/settings', admin, wrap(async (_q, res) => res.json(await data.rows('settings'))));
app.put('/admin/settings', admin, wrap(async (req, res) => {
  const rows = await data.rows('settings'); const header = await data.header('settings');
  const byKey = new Map(rows.map(r => [r.key, r]));
  for (const [k, v] of Object.entries(req.body || {})) { if (byKey.has(k)) byKey.get(k).value = String(v); else { const r = { key: k, value: String(v), note: '' }; rows.push(r); byKey.set(k, r); } }
  await data.saveUpload('settings', header, rows);
  await store.audit(req.user.email, 'settings.update', '', Object.keys(req.body || {}).join(','));
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ admin: GA drawings in the app store */
app.get('/admin/ga', admin, wrap(async (_q, res) => {
  const idx = await data.gaIndex(); const have = new Set(await store.list('ga/'));
  const up = [...have].filter(k => k !== 'ga/_md5').map(k => k.slice(3));
  res.json({ indexed: idx.length, uploaded: up.length, uploaded_paths: up, missing: idx.filter(g => !have.has('ga/' + g.path)).map(g => g.path) });
}));
app.post('/admin/ga', admin, wrap(async (req, res) => {   // { path:"AC/AC-10-5.pdf", base64:"..." }
  const { path: p, base64 } = req.body || {};
  if (!p || !base64) return res.status(400).json({ error: 'path and base64 required' });
  const buf = Buffer.from(base64, 'base64');
  if (buf.slice(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'not a PDF' });
  await store.set('ga/' + p, buf, { name: p.split('/').pop(), md5: crypto.createHash('md5').update(buf).digest('hex') });
  res.json({ ok: true, path: p, bytes: buf.length });
}));

/* large PDFs (> ~4 MB) arrive in chunks: a Netlify function takes at most 6 MB per request */
app.post('/admin/ga/chunk', admin, wrap(async (req, res) => {   // { path, upload_id, index, total, base64 }
  const { path: p, upload_id: id, index, total, base64 } = req.body || {};
  const i = Number(index), n = Number(total);
  if (!p || !base64 || !/^[a-z0-9-]{8,40}$/i.test(id || '') || !(n >= 1 && n <= 40) || !(i >= 0 && i < n)) return res.status(400).json({ error: 'path, upload_id, index, total, base64 required' });
  await store.set(`ga-part/${id}/${i}`, Buffer.from(base64, 'base64'), { path: p });
  if (i < n - 1) return res.json({ ok: true, part: i + 1, of: n });
  const parts = [];
  for (let k = 0; k < n; k++) { const b = await store.getBuffer(`ga-part/${id}/${k}`); if (!b) return res.status(400).json({ error: `part ${k + 1} of ${n} missing - upload the file again` }); parts.push(b); }
  const buf = Buffer.concat(parts);
  for (let k = 0; k < n; k++) await store.del(`ga-part/${id}/${k}`);
  if (buf.slice(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'not a PDF' });
  await store.set('ga/' + p, buf, { name: p.split('/').pop(), md5: crypto.createHash('md5').update(buf).digest('hex') });
  res.json({ ok: true, path: p, bytes: buf.length, chunks: n });
}));

/* ------------------------------------------------------------------ admin: users, audit, mail, fx, drive, exports */
app.get('/admin/users', admin, wrap(async (_q, res) => res.json(Object.values((await store.getJSON('users/index')) || {}))));
app.get('/admin/audit', admin, wrap(async (req, res) => {
  const days = Number(req.query.days || 14); const out = [];
  for (let i = 0; i < days; i++) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const rows = await store.getJSON('audit/' + d); if (rows) out.push(...rows); }
  res.json(out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 500));
}));
app.get('/admin/crm/status', admin, wrap(async (_q, res) => res.json(crm.status(await data.settings()))));
app.post('/admin/crm/test', admin, wrap(async (req, res) => {
  const settings = await data.settings();
  const rfq = { id: 'TEST', number: 'AT/R/TEST/0000', created_at: new Date().toISOString(), line: 'shock', customer: { company: 'ImpactCal CRM test', contact: req.user.name || 'Admin', email: req.user.email, phone: '+910000000000', country: 'India' },
    project: { name: 'CRM integration test', equipment: 'Test' }, items: [{ model: 'AC-42-50', qty: 1 }], message: 'Test lead from ImpactCal admin panel - please ignore', selection: { summary: { 'Energy per impact': '336 Nm' } } };
  const lead = crm.leadFromRfq(rfq, settings, notify.PUBLIC_URL());
  if (req.body && req.body.dry) return res.json({ ok: true, dry: true, lead, status: crm.status(settings) });
  res.json({ ...(await crm.pushLead(lead, rfq.number)), lead });
}));
/* ------------------------------------------------------------------ pricing & costing panel (admin + settings pricing.users) */
const pricingAuth = async (req, res, next) => { if (!req.user) return res.status(401).json({ error: 'login required' }); const settings = await data.settings(); if (!pricing.canUsePricing(req.user, settings)) return res.status(403).json({ error: 'pricing panel is for admin and approved users (settings pricing.users)' }); next(); };
app.get('/admin/pricing/summary', auth.optional, pricingAuth, wrap(async (_q, res) => res.json(await pricing.summary())));
app.get('/admin/pricing/table/:table', auth.optional, pricingAuth, wrap(async (req, res) => { if (!pricing.SHEETS[req.params.table]) return res.status(404).json({ error: 'unknown table' }); res.json(await pricing.joined(req.params.table)); }));
app.get('/admin/pricing/export.xlsx', auth.optional, pricingAuth, wrap(async (req, res) => {
  const buf = await pricing.exportWorkbook(await data.settings());
  await store.audit(req.user.email, 'pricing.export', '', buf.length + ' bytes');
  res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('content-disposition', `attachment; filename="ImpactCal-pricing-${new Date().toISOString().slice(0, 10)}.xlsx"`); res.send(buf);
}));
app.post('/admin/pricing/import', auth.optional, pricingAuth, wrap(async (req, res) => {   // { filename, base64, dry }
  const b = req.body || {}; if (!b.base64) return res.status(400).json({ error: 'file missing' });
  const buf = Buffer.from(b.base64, 'base64');
  const rep = await pricing.importWorkbook(buf, b.filename || '', req.user, { dry: !!b.dry });
  if (!b.dry) await store.audit(req.user.email, rep.ok ? 'pricing.import' : 'pricing.import_failed', b.filename || '', JSON.stringify(Object.fromEntries(Object.entries(rep.tables || {}).map(([k, v]) => [k, v.changed]))));
  res.json(rep);
}));
app.get('/admin/mail/verify', admin, wrap(async (_q, res) => res.json(await mail.verifySmtp())));
app.post('/admin/mail/test', admin, wrap(async (req, res) => res.json(await mail.send({ to: req.user.email, subject: 'ImpactCal test mail', html: mail.shell('Test', '<p>SMTP works. This mail was sent from the ImpactCal admin panel.</p>') }))));
app.get('/admin/fx', admin, wrap(async (_q, res) => { const s = await data.settings(); const r = await fx.inrPerUsd(s); res.json({ ...r, uplift_pct: Number(s['fx.uplift_pct'] || 0), example_usd_for_10000_inr: fx.toUsd(10000, r, s) }); }));
app.post('/admin/fx/refresh', admin, wrap(async (_q, res) => { await store.del('fx/usd'); res.json(await fx.inrPerUsd(await data.settings())); }));
app.get('/admin/drive/status', admin, wrap(async (_q, res) => res.json({ configured: drive.configured(), service_account: (drive.creds() || {}).client_email || null, folder: process.env.DRIVE_FOLDER_ID || null, last: await store.getJSON('drive/_last') })));
app.post('/admin/drive/sync', admin, wrap(async (_q, res) => res.json(await drive.sync({ exports: await exportsCsv() }))));

async function exportsCsv() {
  const rfqs = []; for (const k of await store.list('rfq/')) { const r = await store.getJSON(k); if (r) rfqs.push({ number: r.number, date: r.created_at.slice(0, 10), status: r.status, line: r.line, customer: r.customer.company || r.customer.name, contact: r.customer.contact, email: r.customer.email, phone: r.customer.phone, gstin: r.customer.gstin, state: r.customer.state_name, country: r.customer.country, project: r.project && r.project.name, items: r.items.map(i => `${i.model} x${i.qty}`).join('; '), raised_by: r.raised_by && r.raised_by.email, quotation: r.quotation_id }); }
  const qs = (await quote.list()).map(q => ({ number: q.number, rev: q.rev, date: q.date, status: q.status, currency: q.currency, customer: q.customer, grand_total: q.grand_total, rfq: q.rfq_number, sent_at: q.sent_at }));
  return { 'rfqs.csv': csv.stringify(rfqs.sort((a, b) => b.number.localeCompare(a.number))), 'quotations.csv': csv.stringify(qs) };
}
app.get('/admin/export/:name', admin, wrap(async (req, res) => {
  const e = await exportsCsv(); const t = e[req.params.name]; if (!t) return res.status(404).json({ error: 'unknown export' });
  res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', `attachment; filename="${req.params.name}"`); res.send(t);
}));

app.use((req, res) => res.status(404).json({ error: 'no such API route: ' + req.method + ' ' + req.path }));
module.exports = { app, exportsCsv };
