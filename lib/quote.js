'use strict';
/**
 * RFQ -> draft quotation -> approval -> customer offer.
 * All prices come from the CSV database on the server; a client can never set one.
 * INR (with GST) for Indian customers, USD (zero-rated export) for everyone else.
 */
const store = require('./store');
const data = require('./data');
const gst = require('./gst');
const fx = require('./fx');

const idOf = number => number.replace(/\//g, '-');
const r2 = gst.r2;

/** Wire rope isolator lug options: settings wri.lug_options "EN8D + Arkor treated=0; Aluminium alloy=2; SS 304=5"
 *  (label = surcharge % on the list price; the first one is the standard build). */
function lugOptions(s) {
  const raw = String((s && s['wri.lug_options']) || 'EN8D + Arkor treated=0; Aluminium alloy=2; SS 304=5');
  const out = raw.split(/[;\n]+/).map(x => x.trim()).filter(Boolean).map((x, i) => { const m = x.match(/^(.*?)\s*=\s*(-?[\d.]+)\s*%?$/); return m ? { label: m[1].trim(), pct: Number(m[2]) } : { label: x, pct: 0 }; });
  out.forEach((o, i) => { o.default = i === 0; });
  return out;
}
function wireOptions(s) { return String((s && s['wri.wire_options']) || 'SS 304; SS 302; Galvanised steel').split(/[;\n]+/).map(x => x.trim()).filter(Boolean); }
const roundList = p => { const step = p < 10000 ? 50 : 100; return Math.ceil(p / step) * step; };

/** Every RFQ line is priced from its own table. Returns {description,hsn,uom,rate_inr,gst_rate,lead_time_days}. */
async function priceLine(item, tables) {
  const t = item.table || 'shock_absorbers';
  if (t === 'shock_absorbers') {
    const p = tables.products.find(x => x.bk === item.key || x.model === item.model);
    const bits = [item.model || (p && p.model)];
    if (item.damping_code) bits.push('damping code ' + item.damping_code);
    if (item.cap) bits.push(item.cap);
    if (p) bits.push(`${p.stroke_mm} mm stroke, ${Number(p.nm_per_cycle).toLocaleString('en-IN')} Nm/cycle`);
    return { description: bits.join(' · '), hsn: p ? p.hsn : '84798999', uom: p ? p.uom || 'NOS' : 'NOS',
             rate_inr: p && p.price_inr != null ? p.price_inr : 0, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '', weight_kg: p ? p.weight_kg : null };
  }
  if (t === 'wire_rope_isolators') {
    const p = tables.wri.find(x => x.model === (item.key || item.model));
    // lug material: standard EN8D + Arkor; other lugs carry the surcharge set in admin (price comes from the server, never the page)
    const lugs = lugOptions(tables.settings), lug = lugs.find(o => o.label === item.lug) || lugs[0];
    const wire = wireOptions(tables.settings).includes(item.wire) ? item.wire : wireOptions(tables.settings)[0];
    const base = p && p.price_inr != null ? Number(p.price_inr) : 0;
    const rate = base && lug.pct ? roundList(base * (1 + lug.pct / 100)) : base;
    const remark = String(item.remark || '').replace(/Lugs:[^·]*·?\s*|Wire:[^·]*·?\s*/g, '').trim();
    return { description: [item.model, p ? `Ø${p.family_wire_mm} mm cable, ${p.c_load_n} N rated (compression)` : null, `Lugs: ${lug.label} · Wire rope: ${wire}`, remark].filter(Boolean).join(' · '),
             lug: lug.label, lug_pct: lug.pct, wire,
             hsn: p ? p.hsn : '84879000', uom: 'NOS', rate_inr: rate, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '', weight_kg: p ? p.weight_kg : null };
  }
  if (t === 'rubber_mounts') {
    const p = tables.rubber.find(x => x.model === (item.key || item.model));
    return { description: [item.model, p ? `${p.load_min_kg || ''}–${p.load_max_kg} kg, ${p.natural_freq_hz} Hz` : null, item.remark].filter(Boolean).join(' · '),
             hsn: p ? p.hsn : '40169990', uom: 'NOS', rate_inr: p && p.price_inr != null ? p.price_inr : 0, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '', weight_kg: p ? p.weight_kg : null };
  }
  if (t === 'accessories') {
    const a = tables.accessories.find(x => x.code === item.key || x.name === item.model);
    return { description: item.model + (item.for ? ' for ' + item.for : ''), hsn: a ? a.hsn : '84798999', uom: 'NOS',
             rate_inr: a && a.price_inr != null ? a.price_inr : 0, gst_rate: a ? a.gst_rate : 18, lead_time_days: a ? a.lead_time_days : null, ga_pdf: '' };
  }
  if (t === 'other_products') {
    const o = (tables.other || []).find(x => x.code === item.key || x.name === item.model);
    return { description: o ? o.name : item.model, hsn: o ? o.hsn : '84798999', uom: o ? o.uom || 'NOS' : 'NOS',
             rate_inr: o && o.price_inr !== '' && o.price_inr != null ? Number(o.price_inr) : 0, gst_rate: o ? Number(o.gst_rate) || 18 : 18, lead_time_days: o ? Number(o.lead_time_days) || null : null, ga_pdf: '' };
  }
  return { description: item.model, hsn: '84798999', uom: 'NOS', rate_inr: 0, gst_rate: 18, lead_time_days: null, ga_pdf: '' };
}

async function tables() {
  const [products, accessories, wri, rubber, settings, ga, other] = await Promise.all([data.products(), data.accessories(), data.wri(), data.rubber(), data.settings(), data.gaIndex(), data.rows('other_products').catch(() => [])]);
  return { products, accessories, wri, rubber, settings, ga, other };
}

/** Build the draft quotation for an RFQ (idempotent: a second call makes a new revision). */
async function draftFromRfq(rfq) {
  const T = await tables();
  const s = T.settings;
  const country = (rfq.customer && rfq.customer.country) || 'India';
  const isIndia = /^india$/i.test(country.trim());
  const currency = isIndia ? 'INR' : 'USD';
  const issuer = rfq.issuer || { type: 'adoni', office: officeFor(null, s) };
  // dealer quotations: 'resale' = dealer's letterhead, he buys at list - his discount;
  //                    'direct' = ADONI TECH letterhead, customer buys from us, dealer earns commission
  const route = issuer.type === 'dealer' ? (rfq.route === 'direct' ? 'direct' : 'resale') : undefined;
  const direct = route === 'direct';
  const supplierState = (issuer.type === 'dealer' && !direct && issuer.state_code) || s['company.state_code'] || '27';
  const pos = (rfq.customer && rfq.customer.state_code) || supplierState;
  const supply_type = gst.supplyType(supplierState, pos, country);
  const rate = currency === 'USD' ? await fx.inrPerUsd(s) : null;

  const items = [];
  let seq = 0;
  for (const it of rfq.items || []) {
    const pr = await priceLine(it, T);
    const unit = currency === 'USD' ? fx.toUsd(pr.rate_inr, rate, s) : pr.rate_inr;
    items.push({ seq: ++seq, kind: 'product', table: it.table || 'shock_absorbers', key: it.key || it.bk || it.model, model: it.model,
      description: pr.description, hsn: pr.hsn, uom: pr.uom, qty: Number(it.qty) || 1, rate: unit, list_rate: unit, rate_inr: pr.rate_inr,
      discount_pct: 0, gst_rate: pr.gst_rate, lead_time_days: pr.lead_time_days, ga_pdf: pr.ga_pdf, ...(pr.lug ? { lug: pr.lug, lug_pct: pr.lug_pct, wire: pr.wire } : {}), weight_kg: pr.weight_kg != null && pr.weight_kg !== '' ? Number(pr.weight_kg) : null, mounting: it.mounting || '', cap: it.cap || '' });
    if (it.mounting) {
      const pa = await priceLine({ table: 'accessories', model: it.mounting, for: it.model }, T);
      items.push({ seq: ++seq, kind: 'accessory', table: 'accessories', key: it.mounting, model: it.mounting, description: pa.description,
        hsn: pa.hsn, uom: 'NOS', qty: Number(it.qty) || 1, rate: currency === 'USD' ? fx.toUsd(pa.rate_inr, rate, s) : pa.rate_inr, list_rate: currency === 'USD' ? fx.toUsd(pa.rate_inr, rate, s) : pa.rate_inr, rate_inr: pa.rate_inr,
        discount_pct: 0, gst_rate: pa.gst_rate, lead_time_days: pa.lead_time_days, ga_pdf: '' });
    }
  }
  // a second draft for the same RFQ keeps the number and bumps the revision
  let number, rev = 0;
  const old = rfq.quotation_id ? await get(rfq.quotation_id) : null;
  if (old) { number = old.number; rev = old.rev + 1; }
  else if (direct) number = await store.nextNumber('quotation-direct-' + issuer.code, (s['quote.prefix'] || 'AT/Q') + '/' + (issuer.code || 'DLR'));
  else if (issuer.type === 'dealer') number = await store.nextNumber('quotation-' + issuer.code, (issuer.code || 'DLR') + '/Q');
  else number = await store.nextNumber('quotation', s['quote.prefix'] || 'AT/Q');
  const q = {
    id: idOf(number) + (rev ? '-R' + rev : ''), number, rev, rfq_id: rfq.id, rfq_number: rfq.number,
    date: new Date().toISOString().slice(0, 10), valid_days: Number(s['quote.valid_days'] || 30),
    currency, fx: rate ? { inr_per_usd: rate.rate, uplift_pct: Number(s['fx.uplift_pct'] || 0), source: rate.source, fallback: !!rate.fallback } : null,
    supply_type, place_of_supply_code: pos, place_of_supply_name: gst.STATES[pos] || (isIndia ? '' : country),
    customer: rfq.customer, project: rfq.project, raised_by: rfq.raised_by || null, line: rfq.line, issuer, ...(route ? { route } : {}),
    items, freight: 0, freight_hsn: '996511', freight_gst: 18, packing: 0,
    terms: { payment: s['quote.terms_payment'], delivery: direct ? String(s['quote.terms_delivery_direct'] || 'Door delivery to your site; packing & freight as per the quotation line. Lead time as stated per line, from receipt of technically & commercially clear PO') : issuer.type === 'dealer' ? String(s['quote.terms_delivery'] || '').replace(/Ex-works Satara\.?\s*/i, 'Ex-works. ') : s['quote.terms_delivery'], warranty: s['quote.terms_warranty'],
             other: direct && currency === 'INR' ? String(s['quote.terms_other_direct'] || 'Prices include packing & freight to site as per the quotation line; transit insurance extra unless stated. Packing: standard export-worthy') : currency === 'USD' ? (issuer.type === 'dealer' && !direct ? String(s['quote.terms_export'] || '').replace(/EXW Satara/i, 'EXW') : s['quote.terms_export']) : s['quote.terms_other'] },
    notes: '', drawings: [], status: 'draft', created_at: new Date().toISOString(),
  };
  // packing & freight (India only): dealer quotations carry Rs/kg x estimated weight as a separate line
  if (issuer.type === 'dealer' && currency === 'INR') { const f = freightCalc(q, s); q.freight = f.amount; q.freight_label = f.label; q.freight_calc = f; }
  q.totals = totals(q);
  q.lead_time_days = leadTime(q);
  await store.setJSON('quotation/' + q.id, q);
  return q;
}

/** Packing & freight: settings freight.rate_per_kg (Rs 35) x estimated weight of the priced lines, whole kg, India only. */
function freightCalc(q, s) {
  const own = q.issuer && q.issuer.freight_rate;   // a dealer may have his own agreed rate
  const rate = Number(own != null && own !== '' ? own : (s && s['freight.rate_per_kg']) != null && s['freight.rate_per_kg'] !== '' ? s['freight.rate_per_kg'] : 35);
  let kg = 0; const missing = [];
  for (const i of q.items.filter(PRICED)) { const w = Number(i.weight_kg); if (w > 0) kg += w * (Number(i.qty) || 0); else missing.push(i.model); }
  const kgR = Math.ceil(kg);
  const amount = q.currency === 'INR' && kgR > 0 ? kgR * rate : 0;
  // direct supply prints the basis; on a dealer's own (resale) quotation it is just his freight line
  const label = q.route === 'direct' ? `Packing & freight to site — ${kgR} kg × Rs ${rate}/kg (estimated weight)` : 'Packing & freight';
  return { kg: Math.round(kg * 100) / 100, kg_charged: kgR, rate, amount, missing, label };
}

function totals(q) {
  const lines = q.items.map(i => ({ ...i, gst_rate: q.supply_type === 'export' ? 0 : i.gst_rate }));
  if (Number(q.freight) > 0) lines.push({ qty: 1, rate: q.freight, discount_pct: 0, gst_rate: q.freight_gst, hsn: q.freight_hsn || '996511', uom: 'NOS', description: q.freight_label || 'Freight', kind: 'freight' });
  if (Number(q.packing) > 0) lines.push({ qty: 1, rate: q.packing, discount_pct: 0, gst_rate: 18, hsn: q.items[0] ? q.items[0].hsn : '84798999', uom: 'NOS', description: 'Packing and forwarding', kind: 'freight' });
  const t = gst.computeTax(lines, q.supply_type, { round: q.currency === 'INR' });
  t.amount_in_words = q.currency === 'INR' ? gst.amountInWords(t.grand_total) : usdInWords(t.grand_total);
  return t;
}
function leadTime(q) { return q.items.reduce((m, i) => Math.max(m, Number(i.lead_time_days) || 0), 0) || null; }

function usdInWords(n) {
  const w = gst.amountInWords(n).replace(/ Rupees/, ' US Dollars').replace(/Paise/, 'Cents');
  return w;
}

/* ------------------------------------------------------------------ issuer, limits, dealer billing */
/** Which office a sales person bills from: settings sales.office "email=pune; email=satara". */
function officeFor(email, s) {
  const e = String(email || '').toLowerCase();
  for (const pair of String(s['sales.office'] || '').split(';')) { const [k, v] = pair.split('='); if (k && v && k.trim().toLowerCase() === e) return v.trim().toLowerCase(); }
  return String(s['quote.default_office'] || 'satara').toLowerCase();
}
function offices(s) {
  const out = {};
  for (const [k, v] of Object.entries(s)) { const m = k.match(/^office\.([a-z0-9_]+)\.(.+)$/); if (m) (out[m[1]] = out[m[1]] || { id: m[1] })[m[2]] = v; }
  return out;
}
/** Issuer block for an RFQ raised by this user. */
async function issuerFor(user, s) {
  if (user && user.role === 'dealer') {
    const d = await require('./dealers').get(user.email);
    if (d && d.status === 'approved') {
      const t = require('./dealers').terms(d, s);
      return { type: 'dealer', dealer: d.email, code: d.code, company: d.company, contact: d.contact, email: d.email, phone: d.phone, addr1: d.addr1, addr2: d.addr2, city: d.city, pincode: d.pincode,
        state_code: d.state_code, state_name: d.state_name, country: d.country, gstin: d.gstin, pan: d.pan, iec: d.iec, web: d.web, quote_footer: d.quote_footer,
        bank: { beneficiary: d.bank_beneficiary || d.company, bank: d.bank_name, branch: d.bank_branch, account: d.bank_account, ifsc: d.bank_ifsc, swift: d.bank_swift },
        max_discount_pct: t.max_discount_pct, billing_discount_pct: t.discount_pct, freight_rate: t.freight_rate, routes: t.routes, policy_version: t.policy_version };
    }
  }
  const person = user && (user.role === 'sales' || user.role === 'admin') ? { email: user.email, name: require('./auth').displayName(user.email, s) } : null;
  return { type: 'adoni', office: officeFor(user && user.email, s), person, max_discount_pct: Number(s['quote.max_discount_pct'] || 25) };
}
/** Company + bank as printed on the document. */
function docParties(q, s) {
  const data = require('./data');
  const is = q.issuer || { type: 'adoni', office: officeFor(null, s) };
  if (is.type === 'dealer' && q.route === 'direct') {
    const company = data.company(s);
    const off = offices(s)[String(s['quote.default_office'] || 'satara').toLowerCase()];
    if (off && off.addr1) Object.assign(company, { addr1: off.addr1, addr2: off.addr2 || '', city: off.city || company.city, pincode: off.pincode || company.pincode, phone: off.phone || company.phone, office_label: off.label || '' });
    company.channel_partner = { company: is.company, contact: is.contact, phone: is.phone, email: is.email, city: is.city };
    return { company, bank: data.bank(s, q.currency) };
  }
  if (is.type === 'dealer') {
    const company = { name: is.company, addr1: is.addr1, addr2: is.addr2, city: is.city, pincode: is.pincode, state_name: is.state_name, country: is.country, email: is.email, phone: is.phone, web: is.web, gstin: is.gstin, iec: is.iec, contact: is.contact,
      dealer: true, footer: is.quote_footer || '' };   // never name the manufacturer on a dealer's quotation
    return { company, bank: { beneficiary: is.bank.beneficiary, bank: is.bank.bank, branch: is.bank.branch, account: is.bank.account, ifsc: is.bank.ifsc, swift: is.bank.swift, ad_code: is.bank.ifsc } };
  }
  const company = data.company(s);
  const off = offices(s)[is.office || 'satara'];
  if (off && off.addr1) Object.assign(company, { addr1: off.addr1, addr2: off.addr2 || '', city: off.city || company.city, pincode: off.pincode || company.pincode, phone: off.phone || company.phone, office_label: off.label || '' });
  if (is.person) Object.assign(company, { person: is.person.name, person_email: is.person.email });
  return { company, bank: data.bank(s, q.currency) };
}
const PRICED = i => i.kind === 'product' || i.kind === 'accessory';
/** Discount limit: every priced line's net rate must stay >= list x (1 - max%). Markup is free. */
function limitCheck(q, maxPct, opts = {}) {
  const max = Number(maxPct != null ? maxPct : (q.issuer && q.issuer.max_discount_pct) || 25);
  const v = [];
  for (const i of q.items.filter(PRICED)) {
    const list = Number(i.list_rate != null ? i.list_rate : i.rate) || 0; if (!list) continue;
    const net = Number(i.rate) * (1 - (Number(i.discount_pct) || 0) / 100);
    const eff = (1 - net / list) * 100;
    const r = { seq: i.seq, model: i.model, list, net: Math.round(net * 100) / 100, floor: Math.round(list * (1 - max / 100) * 100) / 100, discount_pct: Math.round(eff * 10) / 10 };
    const base = Math.max(Number(i.rate) || 0, list), passed = base ? (1 - net / base) * 100 : 0;
    if (eff > max + 0.01) v.push({ ...r, kind: 'discount' });
    else if (q.route === 'direct' && passed > dealerDisc(q) + 0.01) v.push({ ...r, discount_pct: Math.round(passed * 10) / 10, kind: 'commission' });
    else if (opts.markup && net > list + 0.01) v.push({ ...r, kind: 'markup' });   // ADONI TECH sales: above list needs approval too
  }
  const sp = q.special;
  const approved = sp && sp.status === 'approved' && v.every(x => { const a = (sp.approved_nets || {})[x.seq]; return a != null && (x.kind === 'markup' ? Math.abs(x.net - a) <= 0.01 : x.net >= a - 0.01); });
  return { ok: !v.length || !!approved, max_pct: max, violations: v, special_approved: !!approved };
}
function specialDisc(q) { return q.special && q.special.status === 'approved' && q.special.billing_discount_pct != null && q.special.billing_discount_pct !== '' ? Number(q.special.billing_discount_pct) : null; }
function dealerDisc(q) { const sp = specialDisc(q); return sp != null ? sp : Number((q.issuer && q.issuer.billing_discount_pct) || 25); }
/**
 * Dealer money on a quotation.
 *  resale: ADONI TECH bills the dealer list - his discount, plus packing & freight to his godown (India).
 *  direct: customer pays ADONI TECH; dealer earns commission per line =
 *          (dealer discount - discount he passed on) x his quoted price (list, or his marked-up price),
 *          on the basic value only (no GST, no freight). Example list 100, dealer 25 %:
 *          passes 10 % -> 15 % of 100 = 15; marks up to 125 and passes 10 % -> 15 % of 125 = 18.75.
 */
function dealerBilling(q, s) {
  const is = q.issuer || {}; if (is.type !== 'dealer') return null;
  const sp = specialDisc(q);
  const d = dealerDisc(q);
  if (q.route === 'direct') {
    let list = 0, customer = 0, base = 0, commission = 0; const lines = [];
    for (const i of q.items.filter(PRICED)) {
      const l = Number(i.list_rate != null ? i.list_rate : i.rate) || 0, qty = Number(i.qty) || 0;
      const b = Math.max(Number(i.rate) || 0, l), net = Number(i.rate) * (1 - (Number(i.discount_pct) || 0) / 100);
      const passed = b ? (1 - net / b) * 100 : 0, pct = Math.max(0, d - passed), c = pct / 100 * b * qty;
      list += l * qty; customer += net * qty; base += b * qty; commission += c;
      lines.push({ seq: i.seq, model: i.model, qty, list: l, quoted: b, passed_pct: Math.round(passed * 100) / 100, commission_pct: Math.round(pct * 100) / 100, commission: Math.round(c * 100) / 100 });
    }
    const r = x => Math.round(x * 100) / 100;
    return { route: 'direct', list_value: r(list), quoted_value: r(base), customer_value: r(customer), billing_discount_pct: d, commission_value: r(commission), adoni_net: r(customer - commission),
      freight: q.freight_calc ? { ...q.freight_calc, amount: Number(q.freight) || 0 } : null, lines, currency: q.currency, special_billing: sp != null };
  }
  let list = 0, customer = 0;
  for (const i of q.items.filter(PRICED)) { const l = Number(i.list_rate != null ? i.list_rate : i.rate) || 0; list += l * i.qty; customer += Number(i.rate) * (1 - (Number(i.discount_pct) || 0) / 100) * i.qty; }
  const billing = Math.round(list * (1 - d / 100) * 100) / 100;
  const f = q.currency === 'INR' ? freightCalc(q, s) : null;
  return { route: 'resale', freight: f, billing_total: Math.round((billing + (f ? f.amount : 0)) * 100) / 100, list_value: Math.round(list * 100) / 100, customer_value: Math.round(customer * 100) / 100, billing_discount_pct: d, billing_value: billing, dealer_margin: Math.round((customer - billing) * 100) / 100, currency: q.currency, special_billing: sp != null };
}

async function get(id) { return store.getJSON('quotation/' + id); }
async function save(q, s) {
  if (q.issuer && q.issuer.type === 'dealer' && q.route === 'direct' && q.currency === 'INR' && !q.freight_locked) {
    const f = freightCalc(q, s || await data.settings()); q.freight = f.amount; q.freight_label = f.label; q.freight_calc = f;
  }
  q.totals = totals(q); q.lead_time_days = leadTime(q); q.updated_at = new Date().toISOString(); await store.setJSON('quotation/' + q.id, q); return q; }
async function list() {
  const keys = await store.list('quotation/');
  const out = [];
  for (const k of keys) { const q = await store.getJSON(k); if (q) out.push({ id: q.id, number: q.number, rev: q.rev, date: q.date, status: q.status, currency: q.currency,
    customer: q.customer && (q.customer.company || q.customer.name), grand_total: q.totals && q.totals.grand_total, rfq_number: q.rfq_number, sent_at: q.sent_at,
    route: q.route || null, commission: q.billing && q.billing.route === 'direct' ? q.billing.commission_value : null, commission_status: q.commission ? q.commission.status : null, issuer: q.issuer ? (q.issuer.type === 'dealer' ? (q.route === 'direct' ? 'direct:' : 'dealer:') + q.issuer.company : 'adoni:' + (q.issuer.office || '')) : 'adoni', dealer: q.issuer && q.issuer.type === 'dealer' ? q.issuer.dealer : null, raised_by: q.raised_by && q.raised_by.email, special: q.special && q.special.status }); }
  return out.sort((a, b) => (b.number + b.rev).localeCompare(a.number + a.rev));
}

module.exports = { lugOptions, wireOptions, freightCalc, draftFromRfq, totals, leadTime, get, save, list, idOf, tables, issuerFor, docParties, limitCheck, dealerBilling, offices, officeFor };
