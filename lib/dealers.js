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
    if (opts.discount_pct !== undefined && opts.discount_pct !== '') d.discount_pct = Number(opts.discount_pct);
    if (opts.max_discount_pct !== undefined && opts.max_discount_pct !== '') d.max_discount_pct = Number(opts.max_discount_pct);
  } else if (decision === 'suspend') { d.status = 'suspended'; d.suspended_at = new Date().toISOString(); }
  else if (decision === 'reject') { d.status = 'rejected'; }
  else throw Object.assign(new Error('unknown decision'), { status: 400 });
  await saveAll(m); return d;
}
async function update(email, patch, byAdmin) {
  const e = String(email).toLowerCase(); const m = await all(); const d = m[e]; if (!d) throw Object.assign(new Error('no such dealer'), { status: 404 });
  Object.assign(d, clean(patch));
  if (byAdmin) for (const k of ['code', 'discount_pct', 'max_discount_pct']) if (patch[k] !== undefined && patch[k] !== '') d[k] = k === 'code' ? String(patch[k]).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : Number(patch[k]);
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

/** Effective commercial terms for a dealer (per-dealer override, else settings). */
function terms(d, settings) {
  return {
    discount_pct: Number(d && d.discount_pct != null && d.discount_pct !== '' ? d.discount_pct : settings['dealer.discount_pct'] || 25),
    max_discount_pct: Number(d && d.max_discount_pct != null && d.max_discount_pct !== '' ? d.max_discount_pct : settings['dealer.max_discount_pct'] || 25),
  };
}

module.exports = { setLogo, logo, get, list, all, apply, decide, update, isApproved, terms, codeFrom, PROFILE_FIELDS };
