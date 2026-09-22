'use strict';
/**
 * Notifications to Adoni Tech (admin / sales) and to customers.
 *   email     : always (Gmail SMTP)
 *   whatsapp  : phase 2 - Meta WhatsApp Cloud API. Enabled with settings whatsapp.enabled=1 and
 *               env WHATSAPP_TOKEN + settings whatsapp.phone_id. Until then it is a no-op that logs.
 */
const mail = require('./mail');
const store = require('./store');
const { esc, shell, row, button } = mail;

const PUBLIC_URL = () => (process.env.PUBLIC_URL || process.env.URL || 'https://impactcal.netlify.app').replace(/\/$/, '');
const num = n => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** WhatsApp Cloud API template message with a URL button. Safe no-op when not configured. */
async function whatsapp(settings, text, url) {
  if (settings['whatsapp.enabled'] !== '1' || !process.env.WHATSAPP_TOKEN || !settings['whatsapp.phone_id']) {
    await store.audit('system', 'whatsapp.skipped', '', 'not configured (phase 2)');
    return { ok: false, reason: 'whatsapp not configured' };
  }
  try {
    const to = String(settings['whatsapp.to'] || '').replace(/\D/g, '');
    const r = await fetch(`https://graph.facebook.com/v20.0/${settings['whatsapp.phone_id']}/messages`, {
      method: 'POST', headers: { authorization: 'Bearer ' + process.env.WHATSAPP_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template',
        template: { name: settings['whatsapp.template'] || 'impactcal_approval', language: { code: 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text }] },
                       { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: url.split('/').pop() }] }] } }),
    });
    const j = await r.json();
    await store.audit('system', r.ok ? 'whatsapp.sent' : 'whatsapp.failed', '', JSON.stringify(j).slice(0, 300));
    return { ok: r.ok, response: j };
  } catch (e) { await store.audit('system', 'whatsapp.failed', '', e.message); return { ok: false, reason: e.message }; }
}

/** 1. New RFQ -> Adoni Tech sales inbox, and acknowledgement to the customer. */
async function rfqReceived(rfq, settings, company) {
  const sel = rfq.selection || {};
  const c = rfq.customer || {}, p = rfq.project || {};
  const items = rfq.items || [];
  const body = `<table>${row('Customer', c.company || c.name)}${row('Contact', [c.contact, c.email, c.phone].filter(Boolean).join(' · '))}
    ${row('GSTIN', c.gstin ? c.gstin + (c.state_name ? ` (${c.state_name})` : '') : '')}${row('Country', c.country)}${row('Project', p.name)}${row('Equipment', p.equipment)}
    ${row('Raised by', rfq.raised_by ? rfq.raised_by.email + ' (' + rfq.raised_by.role + ')' : 'customer (web)')}${row('Product line', rfq.line)}${row('Drawings wanted', (rfq.formats || []).join(', '))}</table>
    <h3 style="margin:16px 0 6px;font-size:15px">Requested</h3>
    <table style="border-collapse:collapse;width:100%"><tr style="background:#F3F4F6"><th align="left" style="padding:6px">Model</th><th align="right" style="padding:6px">Qty</th><th align="left" style="padding:6px">Mounting / options</th></tr>
    ${items.map(i => `<tr><td style="padding:6px;border-top:1px solid #E2E6EB"><b>${esc(i.model)}</b></td><td align="right" style="padding:6px;border-top:1px solid #E2E6EB">${i.qty}</td><td style="padding:6px;border-top:1px solid #E2E6EB">${esc([i.mounting, i.cap, i.remark].filter(Boolean).join(' · ') || '—')}</td></tr>`).join('')}</table>
    ${sel.summary ? `<h3 style="margin:16px 0 6px;font-size:15px">Their calculation</h3><table>${Object.entries(sel.summary).map(([k, v]) => row(k, v)).join('')}</table>` : ''}
    ${rfq.message ? `<h3 style="margin:16px 0 6px;font-size:15px">Message</h3><div style="background:#F3F4F6;padding:10px;border-radius:6px">${esc(rfq.message)}</div>` : ''}`;
  const to = String(settings['mail.rfq_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const r1 = await mail.send({ to, subject: `New request ${rfq.number} — ${c.company || c.name || 'enquiry'} (${rfq.line})`, html: shell('New request ' + rfq.number, body) });
  let r2 = null;
  if (c.email) {
    r2 = await mail.send({ to: c.email, subject: `${company.name || 'ADONI TECH'} — your request ${rfq.number}`,
      html: shell('Request received', `<p>Dear ${esc(c.contact || c.company || 'Sir/Madam')},</p><p>Thank you for your enquiry. We have received it as <b>${esc(rfq.number)}</b>:</p>
        <ul>${items.map(i => `<li><b>${esc(i.model)}</b> — ${i.qty} no.${i.mounting ? ', ' + esc(i.mounting) : ''}</li>`).join('')}</ul>
        <p>Our engineer will confirm the selection against your application data and send you a quotation, together with the drawings you asked for, normally within one working day.</p>
        <p>Regards,<br><b>${esc(company.name || 'ADONI TECH')}</b><br>${esc(company.email || '')} · ${esc(company.phone || '')}</p>`) });
  }
  return { sales: r1, customer: r2 };
}

/** 2. Draft quotation ready -> approver gets the alert (Gmail now, WhatsApp when enabled). */
async function approvalRequested(q, settings, approveUrl) {
  const c = q.customer || {};
  const body = `<p>A priced draft is ready for your approval.</p>
    <table>${row('Quotation', q.number + (q.rev ? ' rev ' + q.rev : ''))}${row('Customer', c.company || c.name)}${row('Contact', [c.contact, c.email, c.phone].filter(Boolean).join(' · '))}
    ${row('Country / currency', (c.country || 'India') + ' · ' + q.currency)}${row('Lines', q.items.length)}${row('Grand total', q.currency + ' ' + num(q.totals.grand_total))}
    ${row('Lead time', q.lead_time_days ? q.lead_time_days + ' days' : '—')}${row('Unpriced lines', q.items.filter(i => !i.rate).length || '')}</table>
    ${button(approveUrl, 'Review, edit & approve')}
    <p style="color:#5A6672;font-size:12px">The link works on your phone without logging in and stays valid for 14 days. Nothing is sent to the customer until you press <b>Approve &amp; send</b>.</p>`;
  const to = String(settings['mail.approver_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const m = await mail.send({ to, subject: `APPROVAL: ${q.number} — ${c.company || c.name || ''} — ${q.currency} ${num(q.totals.grand_total)}`, html: shell('Quotation approval', body) });
  const w = await whatsapp(settings, `${q.number} for ${c.company || c.name || 'customer'} — ${q.currency} ${num(q.totals.grand_total)} — ready for approval`, approveUrl);
  return { mail: m, whatsapp: w };
}

/** 3. Approved -> customer gets the offer (PDF + drawings), cc sales person + admin. */
async function offerSent(q, settings, company, pdfBuffer, drawings, links) {
  const c = q.customer || {};
  const cc = [q.raised_by && q.raised_by.email, ...String(settings['mail.cc_on_offer'] || '').split(/[,\s]+/)].filter(Boolean);
  const attachments = [{ filename: `${q.number.replace(/\//g, '-')}${q.rev ? '-R' + q.rev : ''}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
  for (const d of drawings || []) attachments.push({ filename: d.filename, content: d.buffer, contentType: 'application/pdf' });
  const body = `<p>Dear ${esc(c.contact || c.company || 'Sir/Madam')},</p>
    <p>Please find attached our quotation <b>${esc(q.number)}${q.rev ? ' rev ' + q.rev : ''}</b> against your request ${esc(q.rfq_number || '')}.</p>
    <table>${q.items.filter(i => i.kind === 'product').map(i => row(i.model, `${i.qty} ${i.uom} · ${q.currency} ${num(i.rate)} each · lead time ${i.lead_time_days || q.lead_time_days || '—'} days`)).join('')}
    ${row('Grand total', q.currency + ' ' + num(q.totals.grand_total) + (q.currency === 'INR' ? ' incl. GST' : ' (export, zero-rated)'))}${row('Validity', q.valid_days + ' days')}</table>
    ${(drawings && drawings.length) ? `<p>General arrangement drawings are attached: ${drawings.map(d => esc(d.filename)).join(', ')}.</p>` : ''}
    ${(links && links.length) ? `<p>Drawings (links valid ${settings['drawings.release_days'] || 30} days):<br>${links.map(l => `<a href="${l.url}">${esc(l.filename)}</a>`).join('<br>')}</p>` : ''}
    <p>${esc(q.notes || '')}</p>
    <p>Regards,<br><b>${esc(q.approved_by || company.name || 'ADONI TECH')}</b><br>${esc(company.name || '')}<br>${esc(company.email || '')} · ${esc(company.phone || '')} · ${esc(company.web || '')}</p>`;
  return mail.send({ to: c.email, cc, subject: `Quotation ${q.number}${q.rev ? ' rev ' + q.rev : ''} — ${company.name || 'ADONI TECH'}`, html: shell('Quotation ' + q.number, body), attachments });
}

async function otp(email, code) {
  return mail.send({ to: email, subject: `${code} is your ImpactCal login code`,
    html: shell('Login code', `<p>Your one-time code is</p><p style="font-size:32px;letter-spacing:6px;font-weight:700;color:#1B3160">${code}</p><p style="color:#5A6672">Valid for 10 minutes. If you did not request it, ignore this mail.</p>`) });
}

module.exports = { rfqReceived, approvalRequested, offerSent, otp, whatsapp, PUBLIC_URL };
