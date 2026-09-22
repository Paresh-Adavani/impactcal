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
const mail = require('./mail');
const fx = require('./fx');
const drive = require('./drive');
const rubber = require('./rubber');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '12mb' }));

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { if (!/^(unknown table|not found)/.test(e.message)) console.error(e); res.status(e.status || 400).json({ error: e.message }); });
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
app.get('/health', wrap(async (_q, r) => r.json({ ok: true, products: (await data.products()).length, ...store.status(), time: new Date().toISOString() })));

app.get('/meta', auth.optional, wrap(async (req, res) => {
  const [products, accessories, settings] = await Promise.all([data.products(), data.accessories(), data.settings()]);
  const series = {};
  for (const p of products) if (p.status === 'active' || p.status === 'on_request') { series[p.series] = series[p.series] || { series: p.series, n: 0, ...(SERIES_INFO[p.series] || { title: p.series, group: p.group || 'industrial', icon: p.image }) }; series[p.series].n++; }
  const pub = {};
  for (const [k, v] of Object.entries(settings)) if (/^(company|ui)\./.test(k)) pub[k] = v;
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
app.post('/rfq', auth.optional, wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.items || !b.items.length) return res.status(400).json({ error: 'no items' });
  const c = b.customer || {};
  if (!c.email || !c.phone) return res.status(400).json({ error: 'email and phone are required' });
  if (c.gstin) { const v = gst.validateGstin(c.gstin); if (v.ok) { c.gstin = v.value; c.state_code = v.state_code; c.state_name = v.state_name; } else c.gstin_warning = v.reason; }
  c.country = c.country || 'India';
  const settings = await data.settings();
  const number = await store.nextNumber('rfq', settings['rfq.prefix'] || 'AT/R');
  const rfq = { id: idOf(number), number, created_at: new Date().toISOString(), status: 'new', line: b.line || 'shock',
    customer: c, project: b.project || {}, raised_by: req.user ? { email: req.user.email, role: req.user.role, name: auth.displayName(req.user.email, settings) } : null,
    selection: b.selection || null, items: b.items.map(i => ({ table: i.table || 'shock_absorbers', key: i.key || i.bk || i.model, model: i.model, qty: Number(i.qty) || 1, mounting: i.mounting || '', cap: i.cap || '', damping_code: i.damping_code || '', remark: i.remark || '' })),
    formats: b.formats || ['PDF'], message: b.message || '', lang: b.lang || 'en' };
  await store.setJSON('rfq/' + rfq.id, rfq);
  await store.audit(req.user ? req.user.email : 'customer', 'rfq.create', number, rfq.line);
  const company = data.company(settings);
  const mails = await notify.rfqReceived(rfq, settings, company);
  // CRM lead (UnitePro) - never blocks the RFQ
  let lead = null;
  try { lead = await crm.rfqCreated(rfq, settings, notify.PUBLIC_URL()); if (lead.ok) { rfq.crm = { pushed_at: new Date().toISOString(), response: lead.response }; await store.setJSON('rfq/' + rfq.id, rfq); } }
  catch (e) { console.error('crm failed', e); lead = { ok: false, reason: e.message }; }
  // the approval alert: priced draft + link to the phone-friendly approval page
  let q = null, alert = null;
  try {
    q = await quote.draftFromRfq(rfq);
    rfq.quotation_id = q.id; rfq.status = 'draft'; await store.setJSON('rfq/' + rfq.id, rfq);
    const url = `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}&t=${auth.actionLink('approve', q.id)}`;
    alert = await notify.approvalRequested(q, settings, url);
  } catch (e) { console.error('draft failed', e); await store.audit('system', 'quotation.draft_failed', number, e.message); }
  res.json({ id: rfq.id, number, mail: mails.sales, ack: mails.customer, quotation: q ? q.number : null, alert: alert && alert.mail ? alert.mail.ok : false, crm: lead ? { ok: lead.ok, reason: lead.reason, status: lead.status } : null });
}));

/* ------------------------------------------------------------------ approval page (signed link, works on a phone without login) */
const approveAuth = (req, res, next) => {
  const t = req.query.t || req.get('x-approve-token');
  const p = auth.verifyAction(t, 'approve');
  if (p && p.ref === req.params.id) return next();
  const u = auth.optional(req, res, () => {});
  if (req.user && req.user.role === 'admin') return next();
  res.status(401).json({ error: 'approval link invalid or expired — open the admin panel instead' });
};
app.get('/approve/:id', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const rfq = await store.getJSON('rfq/' + q.rfq_id);
  const ga = await data.gaIndex();
  const keys = new Set(q.items.map(i => i.key));
  const models = new Set(q.items.map(i => i.model));
  const drawings = ga.filter(g => keys.has(g.bk) || models.has(g.model)).map(g => ({ path: g.path, filename: g.filename, model: g.model, mounting: g.mounting, accessory: g.accessory, status: g.status }));
  const available = new Set(await store.list('ga/'));
  drawings.forEach(d => { d.available = available.has('ga/' + d.path); });
  const settings = await data.settings();
  res.json({ quotation: q, rfq, drawings, bank: data.bank(settings, q.currency), company: data.company(settings), drawings_mode: settings['drawings.mode'] || 'attach' });
}));
app.put('/approve/:id', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  for (const k of ['valid_days', 'freight', 'freight_hsn', 'freight_gst', 'packing', 'notes', 'place_of_supply_code', 'supply_type', 'lead_time_override']) if (b[k] !== undefined) q[k] = b[k];
  if (b.terms) q.terms = { ...q.terms, ...b.terms };
  if (b.place_of_supply_code !== undefined && b.supply_type === undefined) { q.place_of_supply_name = gst.STATES[b.place_of_supply_code] || ''; q.supply_type = gst.supplyType((await data.settings())['company.state_code'] || '27', b.place_of_supply_code, q.customer && q.customer.country); }
  if (Array.isArray(b.items)) q.items = b.items.map((i, n) => ({ ...(q.items.find(x => x.seq === i.seq) || {}), ...i, seq: n + 1, qty: Number(i.qty) || 0, rate: Number(i.rate) || 0, discount_pct: Number(i.discount_pct) || 0, gst_rate: Number(i.gst_rate) || 0, lead_time_days: i.lead_time_days === '' ? null : (i.lead_time_days != null ? Number(i.lead_time_days) : null) }));
  if (Array.isArray(b.drawings)) q.drawings = b.drawings;
  await quote.save(q);
  res.json(q);
}));
app.get('/approve/:id/pdf', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const settings = await data.settings();
  const buf = await pdf.render(q, data.company(settings), data.bank(settings, q.currency));
  res.setHeader('content-type', 'application/pdf'); res.setHeader('content-disposition', `inline; filename="${q.id}.pdf"`); res.send(buf);
}));
app.post('/approve/:id/send', approveAuth, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const settings = await data.settings(); const company = data.company(settings);
  const by = (req.body && req.body.approved_by) || 'Paresh Adavani';
  q.approved_by = by; q.approved_at = new Date().toISOString(); q.status = 'approved';
  const buf = await pdf.render(q, company, data.bank(settings, q.currency));
  await store.set('quotation-pdf/' + q.id, buf, { number: q.number });
  // drawings: attach or link
  const mode = (req.body && req.body.drawings_mode) || settings['drawings.mode'] || 'attach';
  const attach = [], links = [], missing = [];
  for (const d of q.drawings || []) {
    const b = await store.getBuffer('ga/' + d.path);
    if (!b) { missing.push(d.filename); continue; }
    if (mode === 'attach' && attach.reduce((s, a) => s + a.buffer.length, 0) + b.length < 18 * 1024 * 1024) attach.push({ filename: d.filename, buffer: b });
    else {
      const tok = crypto.randomBytes(20).toString('hex');
      const days = Number(settings['drawings.release_days'] || 30);
      await store.setJSON('release/' + tok, { path: d.path, filename: d.filename, quotation: q.id, expires: Date.now() + days * 86400000, downloads: 0 });
      links.push({ filename: d.filename, url: `${notify.PUBLIC_URL()}/d/${tok}` });
    }
  }
  const m = await notify.offerSent(q, settings, company, buf, attach, links);
  if (m.ok) { q.status = 'sent'; q.sent_at = new Date().toISOString(); q.sent_to = m.to; }
  q.send_result = m; q.drawings_missing = missing;
  await quote.save(q);
  const rfq = await store.getJSON('rfq/' + q.rfq_id); if (rfq) { rfq.status = m.ok ? 'quoted' : 'approved'; rfq.quotation_id = q.id; await store.setJSON('rfq/' + rfq.id, rfq); }
  await store.audit(by, 'quotation.approve', q.number, m.ok ? 'sent to ' + m.to : 'mail failed: ' + m.reason);
  res.json({ ok: m.ok, reason: m.reason, sent_to: m.to, attached: attach.map(a => a.filename), links, missing });
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
app.get('/admin/quotations', staff, wrap(async (_q, res) => res.json(await quote.list())));
app.get('/admin/quotation/:id', staff, wrap(async (req, res) => { const q = await quote.get(req.params.id); q ? res.json({ ...q, approve_url: `${notify.PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}&t=${auth.actionLink('approve', q.id)}` }) : res.status(404).json({ error: 'not found' }); }));
app.get('/admin/quotation/:id/pdf', staff, wrap(async (req, res) => {
  const q = await quote.get(req.params.id); if (!q) return res.status(404).json({ error: 'not found' });
  const s = await data.settings(); const buf = await pdf.render(q, data.company(s), data.bank(s, q.currency));
  res.setHeader('content-type', 'application/pdf'); res.send(buf);
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
  res.json({ indexed: idx.length, uploaded: [...have].filter(k => k !== 'ga/_md5').length, missing: idx.filter(g => !have.has('ga/' + g.path)).map(g => g.path) });
}));
app.post('/admin/ga', admin, wrap(async (req, res) => {   // { path:"AC/AC-10-5.pdf", base64:"..." }
  const { path: p, base64 } = req.body || {};
  if (!p || !base64) return res.status(400).json({ error: 'path and base64 required' });
  const buf = Buffer.from(base64, 'base64');
  if (buf.slice(0, 4).toString() !== '%PDF') return res.status(400).json({ error: 'not a PDF' });
  await store.set('ga/' + p, buf, { name: p.split('/').pop(), md5: crypto.createHash('md5').update(buf).digest('hex') });
  res.json({ ok: true, path: p, bytes: buf.length });
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
