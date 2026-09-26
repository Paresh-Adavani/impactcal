'use strict';
/**
 * Dealers.
 *
 *   A dealer applies once (company, address, GSTIN, bank ...) after logging in with his e-mail.
 *   ADONI TECH approves him once; from then on his login has role "dealer":
 *     - sees list prices in every selector and in the quick-quote catalogue
 *     - makes quotations in HIS OWN name (his letterhead, GSTIN, bank, e-mail) to his customers,
 *       cc ADONI TECH, without per-quotation approval
 *     - may discount up to dealer.max_discount_pct (default 25 %) below list, or mark up freely
 *     - a deeper discount is a "special price" that ADONI TECH approves case by case
 *   ADONI TECH bills the dealer at list - dealer.discount_pct (default 25 %).
 *
 * Stored in the key/value store under dealers/index (one JSON map keyed by e-mail).
 */
const store = require('./store');
const gst = require('./gst');

const KEY = 'dealers/index';
const PROFILE_FIELDS = ['company', 'contact', 'phone', 'addr1', 'addr2', 'city', 'pincode', 'state_code', 'state_name', 'country', 'gstin', 'pan', 'iec', 'web', 'bank_beneficiary', 'bank_name', 'bank_branch', 'bank_account', 'bank_ifsc', 'bank_swift', 'quote_footer', 'territory', 'business_type', 'years', 'products', 'industries', 'message', 'source'];

async function all() { return (await store.getJSON(KEY)) || {}; }
async function saveAll(m) { await store.setJSON(KEY, m); }
async function get(email) { const m = await all(); return m[String(email || '').toLowerCase()] || null; }
async function list() { return Object.values(await all()).sort((a, b) => String(b.applied_at || '').localeCompare(String(a.applied_at || ''))); }
async function isApproved(email) { const d = await get(email); return !!(d && d.status === 'approved'); }

function clean(profile) {
  const out = {};
  for (const f of PROFILE_FIELDS) if (profile[f] !== undefined) out[f] = String(Array.isArray(profile[f]) ? profile[f].join(', ') : profile[f] ?? '').trim().slice(0, f === 'message' ? 1500 : 300);
  if (out.gstin) {
    out.gstin = out.gstin.toUpperCase();
    const v = gst.validateGstin(out.gstin);
    if (v.ok) { out.state_code = v.state_code; out.state_name = v.state_name; out.pan = out.pan || v.pan; out.gstin_ok = '1'; }
    else { out.gstin_ok = ''; out.gstin_warning = v.reason; const sc = out.gstin.slice(0, 2); if (gst.STATES[sc]) { out.state_code = sc; out.state_name = gst.STATES[sc]; } }
  }
  if (out.state_code && !out.state_name) out.state_name = gst.STATES[out.state_code] || '';
  if (!out.country) out.country = 'India';
  return out;
}
function codeFrom(company) {
  const w = String(company || 'DLR').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(x => x && !['PVT', 'LTD', 'PRIVATE', 'LIMITED', 'THE', 'AND', 'CO', 'LLP'].includes(x));
  const c = w.length >= 2 ? w.slice(0, 3).map(x => x[0]).join('') : (w[0] || 'DLR').slice(0, 3);
  return c.padEnd(3, 'X');
}

async function apply(email, profile) {
  const e = String(email).toLowerCase(); const m = await all(); const cur = m[e];
  const p = clean(profile);
  if (!p.company || !p.addr1 || !p.city || !p.phone) throw Object.assign(new Error('company, address, city and phone are required'), { status: 400 });
  if (p.country === 'India' && !p.gstin) throw Object.assign(new Error('GSTIN is required for an Indian dealer'), { status: 400 });
  m[e] = { ...(cur || {}), ...p, email: e, status: cur && cur.status === 'approved' ? 'approved' : 'pending', applied_at: (cur && cur.applied_at) || new Date().toISOString(), updated_at: new Date().toISOString() };
  await saveAll(m); return m[e];
}
async function decide(email, decision, by, opts = {}) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d) throw Object.assign(new Error('no such dealer'), { status: 404 });
  if (decision === 'approve') {
    const used = new Set(Object.values(m).filter(x => x.email !== e).map(x => x.code));
    let code = String(opts.code || d.code || codeFrom(d.company)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DLR';
    let n = 2; const base = code; while (used.has(code)) code = base + n++;
    Object.assign(d, { status: 'approved', code, approved_at: new Date().toISOString(), approved_by: by });
    if (opts.discount_pct !== undefined && opts.discount_pct !== '') { d.discount_pct = Number(opts.discount_pct); d.rules = { ...(d.rules || {}), discount_pct: d.discount_pct }; }
    if (opts.max_discount_pct !== undefined && opts.max_discount_pct !== '') { d.max_discount_pct = Number(opts.max_discount_pct); d.rules = { ...(d.rules || {}), max_discount_pct: d.max_discount_pct }; }
  } else if (decision === 'suspend') { d.status = 'suspended'; d.suspended_at = new Date().toISOString(); }
  else if (decision === 'reject') { d.status = 'rejected'; }
  else throw Object.assign(new Error('unknown decision'), { status: 400 });
  await saveAll(m); return d;
}
async function update(email, patch, byAdmin) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d) throw Object.assign(new Error('no such dealer'), { status: 404 });
  Object.assign(d, clean(patch));
  if (byAdmin) for (const k of ['code', 'discount_pct', 'max_discount_pct']) if (patch[k] !== undefined && patch[k] !== '') { d[k] = k === 'code' ? String(patch[k]).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : Number(patch[k]); if (k !== 'code') d.rules = { ...(d.rules || {}), [k]: d[k] }; }
  d.updated_at = new Date().toISOString(); await saveAll(m); return d;
}
/** Logo (PNG or JPEG, <= 400 kB) printed on the dealer's quotations. */
function sniff(buf) { if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'; if (buf[0] === 0xFF && buf[1] === 0xD8) return 'image/jpeg'; return null; }
async function setLogo(email, base64) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d) throw Object.assign(new Error('apply first'), { status: 404 });
  if (!base64) { await store.del('dealer-logo/' + e); d.logo = ''; await saveAll(m); return d; }
  const buf = Buffer.from(String(base64).replace(/^data:[^,]+,/, ''), 'base64');
  const type = sniff(buf); if (!type) throw Object.assign(new Error('logo must be a PNG or JPEG image'), { status: 400 });
  if (buf.length > 400 * 1024) throw Object.assign(new Error('logo too large - keep it under 400 kB'), { status: 400 });
  await store.set('dealer-logo/' + e, buf, { type }); d.logo = type; d.logo_at = new Date().toISOString(); await saveAll(m); return d;
}
async function logo(email) { try { return await store.getBuffer('dealer-logo/' + String(email).toLowerCase()); } catch { return null; } }

/**
 * Dealer rules (the pricing policy each dealer signs up to).
 * Standard values come from settings (dealer.*), so the commonly agreed rules are changed in one place;
 * a dealer can carry his own value for any rule in d.rules. Every rule is confirmed by ADONI TECH
 * (Admin -> Dealers -> Terms) before the policy letter is e-mailed; each confirmation is a new version.
 */
const num = (v, dflt) => (v != null && v !== '' && isFinite(Number(v)) ? Number(v) : dflt);
const RULES = [
  { k: 'discount_pct', type: 'number', unit: '%', label: 'Dealer discount — ADONI TECH bills you at list price less', std: s => num(s['dealer.discount_pct'], 25) },
  { k: 'max_discount_pct', type: 'number', unit: '% below list', label: 'Maximum discount you may give your customer without our approval', std: s => num(s['dealer.max_discount_pct'], 25) },
  { k: 'markup', type: 'text', label: 'Markup to your customer', std: s => s['dealer.markup'] || 'Free — as you decide' },
  { k: 'routes', type: 'select', options: { both: 'Resale and direct supply', resale: 'Resale only', direct: 'Direct supply only' }, label: 'Ways to sell', std: s => s['dealer.routes'] || 'both' },
  { k: 'resale', type: 'text', label: 'Resale (you buy and resell)', std: s => s['dealer.rule_resale'] || 'Quotation in your own name, letterhead, GSTIN and bank. ADONI TECH invoices you at list price less your dealer discount, plus packing & freight to your godown and GST.' },
  { k: 'commission', type: 'text', label: 'Direct supply (ADONI TECH supplies your customer)', std: s => s['dealer.rule_commission'] || 'Quotation on ADONI TECH letterhead with you as channel partner. Your commission = your dealer discount less the discount you pass on, on your quoted price (list or marked-up), on the basic value (no GST, no freight). Paid after the customer has paid ADONI TECH in full, against your commission invoice; TDS as per law. Only on quotations you issue yourself.' },
  { k: 'freight_rate', type: 'number', unit: 'Rs per kg of estimated product weight', label: 'Packing & freight (India)', std: s => num(s['freight.rate_per_kg'], 35) },
  { k: 'export', type: 'text', label: 'Supplies outside India', std: s => s['dealer.rule_export'] || 'Ex-works Satara, quoted in USD at the day\'s exchange rate; freight and insurance by the buyer.' },
  { k: 'payment_terms', type: 'text', label: 'Payment terms for your purchases', std: s => s['dealer.payment_terms'] || s['quote.terms_payment'] || '30% advance with PO, balance against proforma invoice before dispatch' },
  { k: 'price_list', type: 'text', label: 'Price list', std: s => s['dealer.rule_price_list'] || 'ADONI TECH list prices as shown in your portal, revised from time to time; the list price on the date of your order applies.' },
  { k: 'lead_time', type: 'text', label: 'Lead times', std: s => s['dealer.rule_lead_time'] || 'As shown per product in the portal and on each quotation, from receipt of a technically and commercially clear order.' },
  { k: 'territory', type: 'text', label: 'Territory', std: (s, d) => (d && d.territory) || s['dealer.rule_territory'] || 'Non-exclusive' },
  { k: 'special', type: 'text', label: 'Other agreed conditions', std: s => s['dealer.rule_special'] || '' },
];
/** Standard + per-dealer rules, with where each value came from. */
function rules(d, settings) {
  const own = (d && d.rules) || {};
  return RULES.map(r => {
    const std = r.std(settings, d);
    let v = own[r.k] !== undefined && own[r.k] !== '' ? own[r.k] : (r.k === 'discount_pct' || r.k === 'max_discount_pct') && d && d[r.k] != null && d[r.k] !== '' ? d[r.k] : std;
    if (r.type === 'number') v = num(v, std);
    return { k: r.k, label: r.label, type: r.type, unit: r.unit || '', options: r.options || null, value: v, standard: std, own: String(v) !== String(std) };
  });
}
/** Effective commercial terms for a dealer (per-dealer rule, else the standard in settings). */
function terms(d, settings) {
  const o = {}; for (const r of rules(d, settings)) o[r.k] = r.value;
  return { ...o, freight_rate: o.freight_rate, routes: o.routes, policy_version: d && d.policy ? d.policy.version : 0, policy_confirmed_at: d && d.policy ? d.policy.confirmed_at : null };
}
/** ADONI TECH confirms every rule for this dealer -> new policy version (snapshot kept). */
async function confirmPolicy(email, input, by, settings) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d) throw Object.assign(new Error('no such dealer'), { status: 404 });
  const values = input.rules || {}, confirmed = new Set(input.confirmed || []);
  const missing = RULES.filter(r => !confirmed.has(r.k)).map(r => r.label);
  if (missing.length) throw Object.assign(new Error('confirm every point with the dealer first — not ticked: ' + missing.join('; ')), { status: 400, missing });
  d.rules = {};
  for (const r of RULES) {
    if (values[r.k] === undefined) continue;
    let v = values[r.k]; const std = r.std(settings, d);
    if (r.type === 'number') { v = num(v, NaN); if (!isFinite(v) || v < 0 || v > 90) throw Object.assign(new Error(r.label + ': enter a number 0 - 90'), { status: 400 }); }
    else if (r.type === 'select') { if (!r.options[v]) throw Object.assign(new Error(r.label + ': invalid choice'), { status: 400 }); }
    else v = String(v).trim().slice(0, 1000);
    if (String(v) !== String(std)) d.rules[r.k] = v;
  }
  // legacy fields used by quotations
  d.discount_pct = d.rules.discount_pct !== undefined ? d.rules.discount_pct : '';
  d.max_discount_pct = d.rules.max_discount_pct !== undefined ? d.rules.max_discount_pct : '';
  const snap = rules(d, settings).map(r => ({ k: r.k, label: r.label, value: r.value, unit: r.unit, own: r.own, options: r.options }));
  const version = ((d.policy && d.policy.version) || 0) + 1;
  d.policy = { version, confirmed_at: new Date().toISOString(), confirmed_by: by, rules: snap, note: String(input.note || '').slice(0, 500) };
  d.policy_history = [...(d.policy_history || []), d.policy].slice(-20);
  d.updated_at = new Date().toISOString();
  await saveAll(m); return d;
}
async function markPolicySent(email, result) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d || !d.policy) return;
  d.policy.sent_at = new Date().toISOString(); d.policy.mail_ok = !!(result && result.ok); d.policy.mail_reason = result && result.reason;
  const h = (d.policy_history || []).find(x => x.version === d.policy.version); if (h) Object.assign(h, { sent_at: d.policy.sent_at, mail_ok: d.policy.mail_ok });
  await saveAll(m);
}

module.exports = { setLogo, logo, get, list, all, apply, decide, update, isApproved, terms, rules, RULES, confirmPolicy, markPolicySent, codeFrom, PROFILE_FIELDS };
