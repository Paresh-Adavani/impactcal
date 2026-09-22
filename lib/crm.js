'use strict';
/**
 * CRM push - UnitePro (app.unitepro.in) "sendLeads" webhook.
 *
 *   Every RFQ is pushed as one lead. Enabled when settings crm.enabled=1 AND the env var
 *   UNITEPRO_TOKEN (the bearer token from UnitePro) is set on Netlify. The token is never
 *   stored in the CSVs or the repo. Failures never block the RFQ - they are audited.
 *
 *   Field map (UnitePro -> ImpactCal):
 *     source          settings crm.source            (default "ImpactCal Web")
 *     client_name     customer company               (or contact name)
 *     brand_name      contact person
 *     industry_type   project equipment / product line
 *     phone, email    customer
 *     state, gstin    from GSTIN (state name decoded by lib/gst)
 *     address_line_1  country
 *     keywords        models requested
 *     requirement     "RFQ <number>: <models x qty>"
 *     remarks         selection summary + customer message + link to admin
 */
const store = require('./store');

const URL = () => process.env.UNITEPRO_URL || 'https://app.unitepro.in/api/webhook/sendLeads';
const LINE = { shock: 'Shock absorbers / crane buffers', crane: 'Crane buffers', industrial: 'Industrial shock absorbers', wri: 'Wire rope isolators', rubber: 'Anti-vibration mounts' };

function configured(settings) { return settings['crm.enabled'] === '1' && !!process.env.UNITEPRO_TOKEN; }

function leadFromRfq(rfq, settings, publicUrl) {
  const c = rfq.customer || {}, p = rfq.project || {}, sel = rfq.selection || {};
  const items = (rfq.items || []).map(i => `${i.model} x ${i.qty}`).join(', ');
  const summary = sel.summary ? Object.entries(sel.summary).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
  const digits = String(c.phone || '').replace(/[^\d+]/g, '');
  return {
    source: settings['crm.source'] || 'ImpactCal Web',
    client_name: (c.company || c.name || c.contact || 'Web enquiry').slice(0, 120),
    brand_name: (c.contact || c.name || '').slice(0, 120),
    industry_type: (p.equipment || LINE[rfq.line] || rfq.line || '').slice(0, 120),
    phone: digits,
    alt_phone: '',
    email: c.email || '',
    alt_email: '',
    state: c.state_name || '',
    pincode: c.pincode || '',
    address_line_1: c.country || 'India',
    address_line_2: p.name && p.name !== 'Untitled' ? `Project: ${p.name}` : '',
    area: '',
    landmark: '',
    gstin: c.gstin || '',
    remarks: [`RFQ ${rfq.number}`, summary, rfq.message, rfq.raised_by ? `Raised by ${rfq.raised_by.name || rfq.raised_by.email}` : 'Raised by customer on web', publicUrl ? `${publicUrl}/admin.html#rfq=${rfq.id}` : ''].filter(Boolean).join(' | ').slice(0, 1000),
    keywords: [...new Set((rfq.items || []).map(i => i.model))].join(',').slice(0, 250),
    requirement: `RFQ ${rfq.number}: ${items}`.slice(0, 250),
  };
}

async function pushLead(lead, ref = '') {
  if (!process.env.UNITEPRO_TOKEN) { await store.audit('system', 'crm.skipped', ref, 'UNITEPRO_TOKEN not set'); return { ok: false, reason: 'CRM not configured (UNITEPRO_TOKEN missing)' }; }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(URL(), { method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer ' + process.env.UNITEPRO_TOKEN },
      body: JSON.stringify(lead) });
    clearTimeout(t);
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 300) }; }
    await store.audit('system', r.ok ? 'crm.pushed' : 'crm.failed', ref, `${r.status} ${text.slice(0, 300)}`);
    return { ok: r.ok, status: r.status, response: j };
  } catch (e) { await store.audit('system', 'crm.failed', ref, e.message); return { ok: false, reason: e.message }; }
}

/** Called from POST /rfq. Never throws. */
async function rfqCreated(rfq, settings, publicUrl) {
  if (settings['crm.enabled'] !== '1') { await store.audit('system', 'crm.skipped', rfq.number, 'crm.enabled is not 1'); return { ok: false, reason: 'CRM disabled in settings (crm.enabled)' }; }
  const lead = leadFromRfq(rfq, settings, publicUrl);
  const r = await pushLead(lead, rfq.number);
  return { ...r, lead };
}

function status(settings) {
  return { enabled: settings['crm.enabled'] === '1', token: !!process.env.UNITEPRO_TOKEN, url: URL(), source: settings['crm.source'] || 'ImpactCal Web', ready: configured(settings) };
}

module.exports = { rfqCreated, pushLead, leadFromRfq, status, configured };
