'use strict';
/**
 * Outgoing mail. Credentials live in the settings table on this machine and are
 * entered through the admin console — they are never in the source.
 * Gmail needs an App Password (Google blocks plain account passwords for SMTP).
 */
const nodemailer = require('nodemailer');
const { db, getSetting, audit } = require('./db');

function config() {
  return {
    enabled : getSetting('mail.enabled', '0') === '1',
    host    : getSetting('mail.host', 'smtp.gmail.com'),
    port    : Number(getSetting('mail.port', 465)),
    secure  : getSetting('mail.secure', '1') === '1',
    user    : getSetting('mail.user', ''),
    pass    : getSetting('mail.pass', ''),
    from    : getSetting('mail.from', '') || getSetting('mail.user', ''),
    to      : getSetting('mail.to', 'adonitech@gmail.com'),
    replyTo : getSetting('company.email', ''),
  };
}

function transport(c) {
  return nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000,
  });
}

async function verify() {
  const c = config();
  if (!c.user) return { ok:false, reason:'No SMTP user set. Fill in the mail settings first.' };
  try { await transport(c).verify(); return { ok:true, host:c.host, port:c.port, user:c.user }; }
  catch (e) { return { ok:false, reason:e.message }; }
}

const esc = s => String(s ?? '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
const num = n => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 });

/** Build the notification for a new RFQ. */
function rfqBody(rfq, customer, project, items, sel) {
  const d = sel && sel.duty || {};
  const c = sel && sel.chosen || {};
  const row = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#5A6672">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#333;max-width:640px">
  <div style="border-bottom:3px solid #F57C00;padding-bottom:8px;margin-bottom:14px">
    <span style="font-size:20px;font-weight:700;color:#1B3160">ADONI TECH</span>
    <span style="float:right;color:#5A6672">New request ${esc(rfq.number)}</span></div>
  <table>
    ${row('Customer', customer?.name)}
    ${row('Contact', [customer?.contact, customer?.email, customer?.phone].filter(Boolean).join(' · '))}
    ${customer?.gstin ? row('GSTIN', customer.gstin + (customer.state_name ? ` (${customer.state_name})` : '')) : ''}
    ${project?.name ? row('Project', project.name) : ''}
    ${project?.equipment ? row('Equipment', project.equipment) : ''}
    ${rfq.formats ? row('Drawings wanted', rfq.formats) : ''}
  </table>
  <h3 style="margin:18px 0 6px;font-size:15px">Requested</h3>
  <table style="border-collapse:collapse;width:100%">
    <tr style="background:#F3F4F6"><th align="left" style="padding:6px">Model</th><th align="right" style="padding:6px">Qty</th>
      <th align="left" style="padding:6px">Mounting</th><th align="left" style="padding:6px">Rod end</th></tr>
    ${items.map(i => `<tr><td style="padding:6px;border-top:1px solid #E2E6EB"><b>${esc(i.model)}</b></td>
      <td align="right" style="padding:6px;border-top:1px solid #E2E6EB">${i.qty}</td>
      <td style="padding:6px;border-top:1px solid #E2E6EB">${esc(i.mounting || '—')}</td>
      <td style="padding:6px;border-top:1px solid #E2E6EB">${esc(i.cap || '—')}</td></tr>`).join('')}
  </table>
  ${sel ? `<h3 style="margin:18px 0 6px;font-size:15px">Their calculation</h3>
  <table>
    ${row('Impact case', sel.case_title || sel.case_id)}
    ${row('Standard', sel.standard_name || sel.standard)}
    ${row('Design velocity', (d.v != null ? d.v.toFixed(3) : '—') + ' m/s')}
    ${row('Energy per impact', num(c.E_t) + ' Nm')}
    ${row('Energy per hour', num(c.E_tc) + ' Nm/h')}
    ${row('Effective mass', num(c.m_e) + ' kg')}
    ${row('Deceleration', (c.a != null ? c.a.toFixed(2) : '—') + ' m/s²')}
    ${row('Utilisation', c.u_stroke != null ? (c.u_stroke*100).toFixed(0) + '% per stroke, ' + (c.u_hour*100).toFixed(0) + '% per hour' : '—')}
  </table>` : ''}
  ${rfq.message ? `<h3 style="margin:18px 0 6px;font-size:15px">Message</h3>
    <div style="background:#F3F4F6;padding:10px;border-radius:6px">${esc(rfq.message)}</div>` : ''}
  <p style="margin-top:20px;color:#8B96A3;font-size:12px">
    Open the admin console to price it: <b>RFQ queue → ${esc(rfq.number)} → Prepare quotation</b>.</p>
</div>`;
}

/** Short acknowledgement to the customer. */
function ackBody(rfq, customer, items, company) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#333;max-width:600px">
  <div style="border-bottom:3px solid #F57C00;padding-bottom:8px;margin-bottom:14px">
    <span style="font-size:20px;font-weight:700;color:#1B3160">ADONI TECH</span></div>
  <p>Dear ${esc(customer?.contact || customer?.name || 'Sir/Madam')},</p>
  <p>Thank you for your enquiry. We have received it as <b>${esc(rfq.number)}</b>:</p>
  <ul>${items.map(i => `<li><b>${esc(i.model)}</b> — ${i.qty} no.${i.mounting ? ', ' + esc(i.mounting) : ''}</li>`).join('')}</ul>
  <p>Our engineer will confirm the selection against your application data and send you a quotation,
     together with the drawings you asked for, normally within one working day.</p>
  <p style="margin-top:20px">Regards,<br><b>${esc(company.name || 'ADONI TECH')}</b><br>
    ${esc(company.email || '')} · ${esc(company.phone || '')}<br>
    <span style="color:#8B96A3">${esc(company.web || '')}</span></p>
</div>`;
}

/** Fire and forget: an RFQ must never fail because the mail server is down. */
async function sendRfq(rfqId) {
  const c = config();
  const rfq = db.prepare('SELECT * FROM rfq WHERE id=?').get(rfqId);
  if (!rfq) return { ok:false, reason:'RFQ not found' };
  const customer = rfq.customer_id ? db.prepare('SELECT * FROM customer WHERE id=?').get(rfq.customer_id) : null;
  const project  = rfq.project_id  ? db.prepare('SELECT * FROM project  WHERE id=?').get(rfq.project_id)  : null;
  const items    = db.prepare('SELECT * FROM rfq_item WHERE rfq_id=? ORDER BY id').all(rfqId);
  let sel = null;
  if (rfq.selection_id) {
    const s = db.prepare('SELECT * FROM selection WHERE id=?').get(rfq.selection_id);
    if (s) { try { sel = { ...JSON.parse(s.results || '{}'), case_id:s.case_id, standard:s.standard }; } catch {} }
  }
  const company = Object.fromEntries(db.prepare("SELECT k,v FROM setting WHERE k LIKE 'company.%'").all()
                    .map(r => [r.k.replace('company.',''), r.v]));
  if (!c.enabled || !c.user) {
    audit('system','mail.skipped', rfq.number, 'mail not configured');
    return { ok:false, reason:'mail not configured' };
  }
  const t = transport(c);
  const out = { ok:true, sent:[] };
  try {
    await t.sendMail({ from:`"${company.name || 'ADONI TECH'}" <${c.from}>`, to:c.to, replyTo:customer?.email || c.replyTo,
      subject:`New RFQ ${rfq.number} — ${customer?.name || 'enquiry'}${items[0] ? ' — ' + items[0].model : ''}`,
      html: rfqBody(rfq, customer, project, items, sel) });
    out.sent.push(c.to);
    if (customer?.email) {
      await t.sendMail({ from:`"${company.name || 'ADONI TECH'}" <${c.from}>`, to:customer.email, replyTo:c.to,
        subject:`ADONI TECH — your enquiry ${rfq.number}`, html: ackBody(rfq, customer, items, company) });
      out.sent.push(customer.email);
    }
    audit('system','mail.sent', rfq.number, out.sent.join(', '));
  } catch (e) {
    audit('system','mail.failed', rfq.number, e.message);
    return { ok:false, reason:e.message };
  }
  return out;
}

module.exports = { config, verify, sendRfq };
