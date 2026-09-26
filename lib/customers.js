'use strict';
/**
 * Customer master for the Quote portal.
 *
 *   ADONI TECH customers (made by sales / admin) are one shared team list and each new one is
 *   pushed to the CRM (UnitePro sendLeads) as a lead. A dealer's customers are his own list:
 *   only he sees them and they are never pushed to the ADONI TECH CRM.
 *
 *   store customers/index = { id: customer }   ids C-2627-0001 (ADONI TECH) or <dealer code>-C-2627-0001
 */
const store = require('./store');
const gst = require('./gst');

const KEY = 'customers/index';
const FIELDS = ['company', 'contact', 'designation', 'email', 'phone', 'alt_phone', 'gstin', 'addr1', 'addr2', 'city', 'pincode', 'country', 'industry', 'notes'];

async function all() { return (await store.getJSON(KEY)) || {}; }
const norm = v => String(v || '').trim().toLowerCase();

function clean(input) {
  const c = {};
  for (const f of FIELDS) if (input[f] !== undefined) c[f] = String(input[f] ?? '').trim().slice(0, f === 'notes' ? 1000 : 200);
  if (c.gstin) {
    c.gstin = c.gstin.toUpperCase();
    const v = gst.validateGstin(c.gstin);
    if (v.ok) { c.gstin = v.value; c.state_code = v.state_code; c.state_name = v.state_name; c.gstin_warning = ''; }
    else { c.gstin_warning = v.reason; const sc = c.gstin.slice(0, 2); if (gst.STATES[sc]) { c.state_code = sc; c.state_name = gst.STATES[sc]; } }
  }
  if (!c.country) c.country = 'India';
  return c;
}
/** Which list a user works in: 'adoni' for sales/admin, 'dealer:<email>' for a dealer. */
const scopeOf = u => (u.role === 'dealer' ? 'dealer:' + String(u.email).toLowerCase() : 'adoni');

async function list(user, q) {
  const s = scopeOf(user), qq = norm(q).replace(/[\s-]+/g, '');
  return Object.values(await all()).filter(c => c.scope === s)
    .filter(c => !qq || [c.id, c.company, c.contact, c.email, c.phone, c.gstin, c.city].join(' ').toLowerCase().replace(/[\s-]+/g, '').includes(qq))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}
async function get(user, id) { const c = (await all())[id]; return c && c.scope === scopeOf(user) ? c : null; }

/** Same customer already in this list? GSTIN, else e-mail, else phone. */
function duplicate(m, scope, c, exceptId) {
  const digits = v => String(v || '').replace(/\D/g, '').slice(-10);
  return Object.values(m).find(x => x.scope === scope && x.id !== exceptId && (
    (c.gstin && x.gstin && x.gstin === c.gstin) || (c.email && norm(x.email) === norm(c.email)) || (digits(c.phone).length === 10 && digits(x.phone) === digits(c.phone))));
}

async function create(user, input, prefix) {
  const c = clean(input);
  if (!(c.company || c.contact) || !c.email || !c.phone) throw Object.assign(new Error('company or contact person, e-mail and phone are required'), { status: 400 });
  const m = await all(); const scope = scopeOf(user);
  const dup = duplicate(m, scope, c);
  if (dup) throw Object.assign(new Error(`already in your customer list as ${dup.id} — ${dup.company || dup.contact}`), { status: 409, existing: dup });
  const n = await store.nextNumber('customer-' + scope, prefix);
  const id = n.replace(/\//g, '-');     // C-2627-0001 (counter restarts each financial year, so the year stays in the id)
  const now = new Date().toISOString();
  m[id] = { id, scope, ...c, owner: user.email, created_by: user.email, created_at: now, updated_at: now };
  await store.setJSON(KEY, m); return m[id];
}
async function update(user, id, input) {
  const m = await all(); const c = m[id];
  if (!c || c.scope !== scopeOf(user)) throw Object.assign(new Error('no such customer in your list'), { status: 404 });
  const p = clean(input); const dup = duplicate(m, c.scope, { ...c, ...p }, id);
  if (dup) throw Object.assign(new Error(`clashes with ${dup.id} — ${dup.company || dup.contact}`), { status: 409 });
  Object.assign(c, p, { updated_at: new Date().toISOString(), updated_by: user.email });
  await store.setJSON(KEY, m); return c;
}
async function mark(id, patch) { const m = await all(); if (!m[id]) return; Object.assign(m[id], patch); await store.setJSON(KEY, m); }

/** CRM lead for a new ADONI TECH customer (UnitePro sendLeads field map). */
function lead(c, settings, byName) {
  return {
    source: settings['crm.source_customer'] || (settings['crm.source'] || 'ImpactCal Web') + ' (sales)',
    client_name: (c.company || c.contact).slice(0, 120), brand_name: (c.contact || '').slice(0, 120), industry_type: (c.industry || '').slice(0, 120),
    phone: String(c.phone || '').replace(/[^\d+]/g, ''), alt_phone: String(c.alt_phone || '').replace(/[^\d+]/g, ''), email: c.email || '', alt_email: '',
    state: c.state_name || '', pincode: c.pincode || '', address_line_1: [c.addr1, c.country && c.country !== 'India' ? c.country : ''].filter(Boolean).join(', ') || c.country || 'India',
    address_line_2: [c.addr2, c.city].filter(Boolean).join(', '), area: c.city || '', landmark: '', gstin: c.gstin || '',
    remarks: [`Customer ${c.id} created in ImpactCal by ${byName || c.created_by}`, c.designation ? 'Designation: ' + c.designation : '', c.notes].filter(Boolean).join(' | ').slice(0, 1000),
    keywords: '', requirement: `New customer ${c.id}`.slice(0, 250),
  };
}

module.exports = { list, get, create, update, mark, lead, scopeOf, FIELDS };
