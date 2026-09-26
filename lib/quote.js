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
             rate_inr: p && p.price_inr != null ? p.price_inr : 0, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '' };
  }
  if (t === 'wire_rope_isolators') {
    const p = tables.wri.find(x => x.model === (item.key || item.model));
    return { description: [item.model, p ? `Ø${p.family_wire_mm} mm cable, ${p.c_load_n} N rated (compression)` : null, item.remark].filter(Boolean).join(' · '),
             hsn: p ? p.hsn : '84879000', uom: 'NOS', rate_inr: p && p.price_inr != null ? p.price_inr : 0, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '' };
  }
  if (t === 'rubber_mounts') {
    const p = tables.rubber.find(x => x.model === (item.key || item.model));
    return { description: [item.model, p ? `${p.load_min_kg || ''}–${p.load_max_kg} kg, ${p.natural_freq_hz} Hz` : null, item.remark].filter(Boolean).join(' · '),
             hsn: p ? p.hsn : '40169990', uom: 'NOS', rate_inr: p && p.price_inr != null ? p.price_inr : 0, gst_rate: p ? p.gst_rate : 18, lead_time_days: p ? p.lead_time_days : null, ga_pdf: p ? p.ga_pdf : '' };
  }
  if (t === 'accessories') {
    const a = tables.accessories.find(x => x.code === item.key || x.name === item.model);
    return { description: item.model + (item.for ? ' for ' + item.for : ''), hsn: a ? a.hsn : '84798999', uom: 'NOS',
             rate_inr: a && a.price_inr != null ? a.price_inr : 0, gst_rate: a ? a.gst_rate : 18, lead_time_days: a ? a.lead_time_days : null, ga_pdf: '' };
  }
  return { description: item.model, hsn: '84798999', uom: 'NOS', rate_inr: 0, gst_rate: 18, lead_time_days: null, ga_pdf: '' };
}

async function tables() {
  const [products, accessories, wri, rubber, settings, ga] = await Promise.all([data.products(), data.accessories(), data.wri(), data.rubber(), data.settings(), data.gaIndex()]);
  return { products, accessories, wri, rubber, settings, ga };
}

/** Build the draft quotation for an RFQ (idempotent: a second call makes a new revision). */
async function draftFromRfq(rfq) {
  const T = await tables();
  const s = T.settings;
  const country = (rfq.customer && rfq.customer.country) || 'India';
  const isIndia = /^india$/i.test(country.trim());
  const currency = isIndia ? 'INR' : 'USD';
  const supplierState = s['company.state_code'] || '27';
  const pos = (rfq.customer && rfq.customer.state_code) || supplierState;
  const supply_type = gst.supplyType(supplierState, pos, country);
  const rate = currency === 'USD' ? await fx.inrPerUsd(s) : null;

  const items = [];
  let seq = 0;
  for (const it of rfq.items || []) {
    const pr = await priceLine(it, T);
    const unit = currency === 'USD' ? fx.toUsd(pr.rate_inr, rate, s) : pr.rate_inr;
    items.push({ seq: ++seq, kind: 'product', table: it.table || 'shock_absorbers', key: it.key || it.bk || it.model, model: it.model,
      description: pr.description, hsn: pr.hsn, uom: pr.uom, qty: Number(it.qty) || 1, rate: unit, rate_inr: pr.rate_inr,
      discount_pct: 0, gst_rate: pr.gst_rate, lead_time_days: pr.lead_time_days, ga_pdf: pr.ga_pdf, mounting: it.mounting || '', cap: it.cap || '' });
    if (it.mounting) {
      const pa = await priceLine({ table: 'accessories', model: it.mounting, for: it.model }, T);
      items.push({ seq: ++seq, kind: 'accessory', table: 'accessories', key: it.mounting, model: it.mounting, description: pa.description,
        hsn: pa.hsn, uom: 'NOS', qty: Number(it.qty) || 1, rate: currency === 'USD' ? fx.toUsd(pa.rate_inr, rate, s) : pa.rate_inr, rate_inr: pa.rate_inr,
        discount_pct: 0, gst_rate: pa.gst_rate, lead_time_days: pa.lead_time_days, ga_pdf: '' });
    }
  }
  // a second draft for the same RFQ keeps the number and bumps the revision
  let number, rev = 0;
  const old = rfq.quotation_id ? await get(rfq.quotation_id) : null;
  if (old) { number = old.number; rev = old.rev + 1; } else number = await store.nextNumber('quotation', s['quote.prefix'] || 'AT/Q');
  const q = {
    id: idOf(number) + (rev ? '-R' + rev : ''), number, rev, rfq_id: rfq.id, rfq_number: rfq.number,
    date: new Date().toISOString().slice(0, 10), valid_days: Number(s['quote.valid_days'] || 30),
    currency, fx: rate ? { inr_per_usd: rate.rate, uplift_pct: Number(s['fx.uplift_pct'] || 0), source: rate.source, fallback: !!rate.fallback } : null,
    supply_type, place_of_supply_code: pos, place_of_supply_name: gst.STATES[pos] || (isIndia ? '' : country),
    customer: rfq.customer, project: rfq.project, raised_by: rfq.raised_by || null, line: rfq.line,
    items, freight: 0, freight_hsn: '996511', freight_gst: 18, packing: 0,
    terms: { payment: s['quote.terms_payment'], delivery: s['quote.terms_delivery'], warranty: s['quote.terms_warranty'],
             other: currency === 'USD' ? s['quote.terms_export'] : s['quote.terms_other'] },
    notes: '', drawings: [], status: 'draft', created_at: new Date().toISOString(),
  };
  q.totals = totals(q);
  q.lead_time_days = leadTime(q);
  await store.setJSON('quotation/' + q.id, q);
  return q;
}

function totals(q) {
  const lines = q.items.map(i => ({ ...i, gst_rate: q.supply_type === 'export' ? 0 : i.gst_rate }));
  if (Number(q.freight) > 0) lines.push({ qty: 1, rate: q.freight, discount_pct: 0, gst_rate: q.freight_gst, hsn: q.freight_hsn || '996511', uom: 'NOS', description: 'Freight', kind: 'freight' });
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

async function get(id) { return store.getJSON('quotation/' + id); }
async function save(q) { q.totals = totals(q); q.lead_time_days = leadTime(q); q.updated_at = new Date().toISOString(); await store.setJSON('quotation/' + q.id, q); return q; }
async function list() {
  const keys = await store.list('quotation/');
  const out = [];
  for (const k of keys) { const q = await store.getJSON(k); if (q) out.push({ id: q.id, number: q.number, rev: q.rev, date: q.date, status: q.status, currency: q.currency,
    customer: q.customer && (q.customer.company || q.customer.name), grand_total: q.totals && q.totals.grand_total, rfq_number: q.rfq_number, sent_at: q.sent_at }); }
  return out.sort((a, b) => (b.number + b.rev).localeCompare(a.number + a.rev));
}

module.exports = { draftFromRfq, totals, leadTime, get, save, list, idOf, tables };
