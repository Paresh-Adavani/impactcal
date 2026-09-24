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

/** Application inputs -> readable rows (labels/units from lib/report). */
function inputRows(sel) {
  const { INPUT_LABELS } = require('./report');
  const inputs = (sel && (sel.inputs || sel.duty)) || {};
  const f = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : Number(v.toPrecision(4)).toString()) : String(v ?? '');
  return Object.entries(inputs).map(([k, v]) => { const l = INPUT_LABELS[k] || [k, '']; return row(l[0], f(v) + (l[1] ? ' ' + l[1] : '')); }).join('');
}
function itemsTable(items) {
  return `<table style="border-collapse:collapse;width:100%"><tr style="background:#F3F4F6"><th align="left" style="padding:6px">Model</th><th align="right" style="padding:6px">Qty</th><th align="left" style="padding:6px">Mounting / options</th></tr>
    ${items.map(i => `<tr><td style="padding:6px;border-top:1px solid #E2E6EB"><b>${esc(i.model)}</b></td><td align="right" style="padding:6px;border-top:1px solid #E2E6EB">${i.qty}</td><td style="padding:6px;border-top:1px solid #E2E6EB">${esc([i.mounting, i.cap, i.remark].filter(Boolean).join(' · ') || '—')}</td></tr>`).join('')}</table>`;
}
const h3 = t => `<h3 style="margin:16px 0 6px;font-size:15px">${t}</h3>`;

/** 1. New RFQ -> Adoni Tech sales inbox, and a full copy (inputs + selection + RFQ details + PDF report) to the customer. */
async function rfqReceived(rfq, settings, company, opts = {}) {
  const sel = rfq.selection || {};
  const c = rfq.customer || {}, p = rfq.project || {};
  const items = rfq.items || [];
  let report = null;
  try { report = await require('./report').render(rfq, company); } catch (e) { console.error('report pdf failed', e); await store.audit('system', 'report.failed', rfq.number, e.message); }
  const attachments = report ? [{ filename: `Selection-${rfq.number.replace(/\//g, '-')}.pdf`, content: report, contentType: 'application/pdf' }] : [];
  const inputsHtml = inputRows(sel);
  const details = `${h3('Requested')}${itemsTable(items)}
    ${inputsHtml ? `${h3('Application data entered')}<table>${row('Impact case', sel.case_id)}${row('Standard', sel.standard)}${inputsHtml}</table>` : ''}
    ${sel.summary ? `${h3('Calculated result')}<table>${Object.entries(sel.summary).map(([k, v]) => row(k, v)).join('')}</table>` : ''}
    ${rfq.message ? `${h3('Message')}<div style="background:#F3F4F6;padding:10px;border-radius:6px">${esc(rfq.message)}</div>` : ''}`;
  const body = `<table>${row('Customer', c.company || c.name)}${row('Contact', [c.contact, c.email, c.phone].filter(Boolean).join(' · '))}
    ${row('GSTIN', c.gstin ? c.gstin + (c.state_name ? ` (${c.state_name})` : '') : '')}${row('Country', c.country)}${row('Project', p.name)}${row('Reference', p.reference)}${row('Equipment', p.equipment)}
    ${row('Raised by', rfq.raised_by ? (rfq.raised_by.name || rfq.raised_by.email) + ' <' + rfq.raised_by.email + '> (' + rfq.raised_by.role + ')' : 'customer (web)')}${row('Product line', rfq.line)}${row('Drawings wanted', (rfq.formats || []).join(', '))}</table>
    ${details}`;
  const to = String(settings['mail.rfq_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const cc = rfq.raised_by && rfq.raised_by.email && !to.includes(rfq.raised_by.email) ? [rfq.raised_by.email] : [];   // the sales person who raised it sees the copy
  const r1 = await mail.send({ to, cc, subject: `New request ${rfq.number} — ${c.company || c.name || 'enquiry'} (${rfq.line})`, html: shell('New request ' + rfq.number, body), attachments });
  let r2 = null;
  if (c.email && !opts.noCustomer) {
    r2 = await mail.send({ to: c.email, subject: `${company.name || 'ADONI TECH'} — your request ${rfq.number} (copy of your selection)`,
      html: shell('Request received', `<p>Dear ${esc(c.contact || c.company || 'Sir/Madam')},</p><p>Thank you for your enquiry. We have received it as <b>${esc(rfq.number)}</b>. Below is a copy of the data you entered and the preliminary selection; the same is attached as a PDF for your records.</p>
        <table>${row('Project', p.name)}${row('Reference', p.reference)}${row('Equipment', p.equipment)}${row('Company', c.company)}${row('Contact', c.contact)}${row('E-mail', c.email)}${row('Phone', c.phone)}${row('Country', c.country)}${row('Drawings requested', (rfq.formats || []).join(', '))}</table>
        ${details}
        <p>Our engineer will confirm the selection against your application data and send you a quotation, together with the drawings you asked for, normally within one working day.</p>
        <p>Regards,<br><b>${esc(company.name || 'ADONI TECH')}</b><br>${esc(company.email || '')} · ${esc(company.phone || '')}</p>`), attachments });
  }
  return { sales: r1, customer: r2 };
}


/** 1b. Selection report downloaded (no RFQ yet) -> customer gets the PDF, sales gets a short lead note. */
async function selectionDownloaded(sel, settings, company, pdf) {
  const c = sel.customer || {}, p = sel.project || {}, s = sel.selection || {};
  const items = sel.items || [];
  const attachments = [{ filename: `Selection-${sel.number.replace(/\//g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }];
  const inputsHtml = inputRows(s);
  const r1 = await mail.send({ to: c.email, subject: `${company.name || 'ADONI TECH'} — your selection report ${sel.number}`,
    html: shell('Your selection report', `<p>Dear ${esc(c.contact || c.company || 'Sir/Madam')},</p><p>Thank you for using ImpactCal. Your selection report <b>${esc(sel.number)}</b> is attached, and the main figures are repeated below.</p>
      ${h3('Selected')}${itemsTable(items)}
      ${inputsHtml ? `${h3('Application data entered')}<table>${row('Impact case', s.case_id)}${row('Standard', s.standard)}${inputsHtml}</table>` : ''}
      ${s.summary ? `${h3('Calculated result')}<table>${Object.entries(s.summary).map(([k, v]) => row(k, v)).join('')}</table>` : ''}
      <p>The selection is preliminary and subject to our engineer's confirmation against your application data. To receive a quotation and GA drawings, press <b>Request drawings &amp; quotation</b> in ImpactCal or simply reply to this mail.</p>
      <p>Regards,<br><b>${esc(company.name || 'ADONI TECH')}</b><br>${esc(company.email || '')} · ${esc(company.phone || '')}</p>`), attachments });
  const to = String(settings['mail.rfq_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const cc = sel.raised_by && sel.raised_by.email && !to.includes(sel.raised_by.email) ? [sel.raised_by.email] : [];
  const r2 = await mail.send({ to, cc, subject: `Report downloaded ${sel.number} — ${c.company || c.contact || 'enquiry'} — ${items.map(i => i.model).join(', ')}${c.quality && c.quality !== 'ok' ? ' [' + c.quality + ']' : ''}`,
    html: shell('Selection report downloaded ' + sel.number, `<p>A visitor downloaded a selection report (no request for quotation yet). ${c.quality && c.quality !== 'ok' ? `<b style="color:#B7791F">Contact details look doubtful (${esc((c.quality_reasons || []).join(', '))}) — not pushed to the CRM.</b>` : 'Pushed to the CRM as a lead.'}</p>
      <table>${row('Contact', [c.contact, c.email, c.phone].filter(Boolean).join(' · '))}${row('Company', c.company)}${row('Country', c.country)}${row('GSTIN', c.gstin)}${row('Project', p.name)}${row('Equipment', p.equipment)}${row('Raised by', sel.raised_by ? (sel.raised_by.name || sel.raised_by.email) : 'visitor (web)')}${row('Product line', sel.line)}</table>
      ${h3('Selected')}${itemsTable(items)}
      ${s.summary ? `${h3('Calculated result')}<table>${Object.entries(s.summary).map(([k, v]) => row(k, v)).join('')}</table>` : ''}
      ${button(`${PUBLIC_URL()}/admin.html#selections`, 'Open in admin → convert to RFQ')}`), attachments });
  return { customer: r1, sales: r2 };
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

/** 3. Approved / sent -> customer gets the offer (PDF + drawings).
 *   ADONI TECH quotation: from ADONI TECH, reply-to + cc the sales person, cc mail.cc_on_offer.
 *   Dealer quotation: sender name = dealer company, reply-to + cc the dealer, cc mail.dealer_cc (ADONI TECH). */
async function offerSent(q, settings, company, pdfBuffer, drawings, links) {
  const c = q.customer || {}; const is = q.issuer || {};
  const dealer = is.type === 'dealer';
  const person = !dealer && is.person && is.person.email ? is.person : null;
  const ccList = dealer ? [is.email, ...String(settings['mail.dealer_cc'] || settings['mail.approver_to'] || 'adonitech@gmail.com').split(/[,\s]+/)]
                        : [q.raised_by && q.raised_by.email, person && person.email, ...String(settings['mail.cc_on_offer'] || '').split(/[,\s]+/)];
  const cc = [...new Set(ccList.filter(Boolean).map(x => x.toLowerCase()))].filter(x => x !== String(c.email || '').toLowerCase());
  const attachments = [{ filename: `${q.number.replace(/\//g, '-')}${q.rev ? '-R' + q.rev : ''}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
  for (const d of drawings || []) attachments.push({ filename: d.filename, content: d.buffer, contentType: 'application/pdf' });
  const signName = dealer ? (q.approved_by || is.contact || is.company) : (q.approved_by || company.name || 'ADONI TECH');
  const signLines = dealer ? [is.company, [is.email, is.phone].filter(Boolean).join(' · '), is.web].filter(Boolean)
                           : [company.name, [person ? person.email : company.email, company.phone, company.web].filter(Boolean).join(' · ')].filter(Boolean);
  const body = `<p>Dear ${esc(c.contact || c.company || 'Sir/Madam')},</p>
    <p>Please find attached our quotation <b>${esc(q.number)}${q.rev ? ' rev ' + q.rev : ''}</b>${q.rfq_number && !dealer ? ` against your request ${esc(q.rfq_number)}` : ''}.</p>
    <table>${q.items.filter(i => i.kind === 'product').map(i => row(i.model, `${i.qty} ${i.uom} · ${q.currency} ${num(i.rate * (1 - (Number(i.discount_pct) || 0) / 100))} each · lead time ${i.lead_time_days || q.lead_time_days || '—'} days`)).join('')}
    ${row('Grand total', q.currency + ' ' + num(q.totals.grand_total) + (q.currency === 'INR' ? ' incl. GST' : ' (export, zero-rated)'))}${row('Validity', q.valid_days + ' days')}</table>
    ${(drawings && drawings.length) ? `<p>General arrangement drawings are attached: ${drawings.map(d => esc(d.filename)).join(', ')}.</p>` : ''}
    ${(links && links.length) ? `<p>Drawings (links valid ${settings['drawings.release_days'] || 30} days):<br>${links.map(l => `<a href="${l.url}">${esc(l.filename)}</a>`).join('<br>')}</p>` : ''}
    <p>${esc(q.notes || '')}</p>
    <p>Regards,<br><b>${esc(signName)}</b><br>${signLines.map(esc).join('<br>')}</p>`;
  const smtpFrom = (require('./mail').config().from) || '';
  const from = dealer ? `${String(is.company || 'Dealer').replace(/[<>"]/g, '')} <${smtpFrom}>` : undefined;
  const replyTo = dealer ? is.email : (person ? person.email : undefined);
  const brand = dealer ? is.company : (company.name || 'ADONI TECH');
  return mail.send({ to: c.email, cc, from, replyTo, subject: `Quotation ${q.number}${q.rev ? ' rev ' + q.rev : ''} — ${brand}`, html: dealer ? shellPlain('Quotation ' + q.number, body, is.company) : shell('Quotation ' + q.number, body), attachments });
}
/** A neutral mail frame for dealer quotations (no ADONI TECH branding in the header). */
function shellPlain(title, body, brand) {
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#222"><div style="border-bottom:3px solid #F57C00;padding:10px 0;font-size:18px;font-weight:700;color:#1B3160">${esc(brand || '')}</div><h2 style="font-size:17px;color:#1B3160">${esc(title)}</h2>${body}</div>`;
}

/** 3b. Dealer sent a quotation -> internal note to ADONI TECH with the billing value (list - dealer discount). */
async function dealerQuoteInternal(q, settings, billing) {
  const is = q.issuer || {}; const c = q.customer || {};
  const to = String(settings['mail.dealer_cc'] || settings['mail.approver_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const cur = q.currency;
  const body = `<p>Dealer <b>${esc(is.company)}</b> (${esc(is.email)}, code ${esc(is.code)}) sent quotation <b>${esc(q.number)}</b> to <b>${esc(c.company || c.contact || '')}</b> (${esc(c.email || '')}).</p>
    <table>${row('List value', cur + ' ' + num(billing.list_value))}${row('Dealer\'s price to customer', cur + ' ' + num(billing.customer_value) + ' (before GST)')}
    ${row(`Our billing to dealer (list − ${billing.billing_discount_pct} %)`, cur + ' ' + num(billing.billing_value) + ' + GST')}${row('Dealer margin', cur + ' ' + num(billing.dealer_margin))}
    ${q.special && q.special.status === 'approved' ? row('Special price', 'approved by ' + esc(q.special.decided_by || '')) : ''}</table>
    <table style="border-collapse:collapse;width:100%;margin-top:8px">${q.items.filter(i => i.kind === 'product' || i.kind === 'accessory').map(i => `<tr><td style="padding:4px;border-top:1px solid #E2E6EB"><b>${esc(i.model)}</b></td><td align="right" style="padding:4px;border-top:1px solid #E2E6EB">${i.qty}</td><td align="right" style="padding:4px;border-top:1px solid #E2E6EB">list ${num(i.list_rate)}</td><td align="right" style="padding:4px;border-top:1px solid #E2E6EB">customer ${num(i.rate * (1 - (Number(i.discount_pct) || 0) / 100))}</td></tr>`).join('')}</table>
    ${button(`${PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}`, 'Open in ImpactCal')}`;
  return mail.send({ to, subject: `Dealer quotation ${q.number} — ${is.company} → ${c.company || c.contact || ''} — billing ${cur} ${num(billing.billing_value)}`, html: shell('Dealer quotation ' + q.number, body) });
}

/** 3c. Draft ready for a dealer / sales person to review and send. */
async function draftReady(q, to, who) {
  const body = `<p>Your draft quotation <b>${esc(q.number)}</b> for <b>${esc((q.customer || {}).company || (q.customer || {}).contact || '')}</b> is ready. Open it, set the discount or markup, and send it to the customer.</p>
    <table>${row('Lines', q.items.length)}${row('List value', q.currency + ' ' + num(q.totals.grand_total))}${row('Your discount limit', (q.issuer && q.issuer.max_discount_pct) + ' % below list (markup is free)')}</table>
    ${button(`${PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}`, 'Open, edit & send')}
    <p style="color:#5A6672;font-size:12px">Sign in with ${esc(to)} if asked. A discount beyond your limit is sent to ADONI TECH as a special-price request.</p>`;
  return mail.send({ to, subject: `Draft quotation ${q.number} ready — ${(q.customer || {}).company || ''}`, html: shell('Draft quotation ' + q.number, body) });
}

/** 3d. Special price requested -> ADONI TECH (signed link, phone friendly). */
async function specialRequested(q, settings, url, check) {
  const is = q.issuer || {}; const c = q.customer || {};
  const to = String(settings['mail.approver_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const body = `<p><b>${esc(q.special.requested_by)}</b> asks for a special price on <b>${esc(q.number)}</b> for ${esc(c.company || c.contact || '')}${is.type === 'dealer' ? ` (dealer ${esc(is.company)})` : ''}.</p>
    ${q.special.reason ? `<div style="background:#F3F4F6;padding:10px;border-radius:6px">${esc(q.special.reason)}</div>` : ''}
    <table style="border-collapse:collapse;width:100%;margin-top:8px"><tr style="background:#F3F4F6"><th align="left" style="padding:6px">Model</th><th align="right" style="padding:6px">List</th><th align="right" style="padding:6px">Asked</th><th align="right" style="padding:6px">Discount</th></tr>
    ${check.violations.map(v => `<tr><td style="padding:6px;border-top:1px solid #E2E6EB">${esc(v.model)}</td><td align="right" style="padding:6px;border-top:1px solid #E2E6EB">${num(v.list)}</td><td align="right" style="padding:6px;border-top:1px solid #E2E6EB"><b>${num(v.net)}</b></td><td align="right" style="padding:6px;border-top:1px solid #E2E6EB">${v.discount_pct} % (limit ${check.max_pct} %)</td></tr>`).join('')}</table>
    ${button(url, 'Review & decide')}`;
  return mail.send({ to, subject: `SPECIAL PRICE: ${q.number} — ${is.type === 'dealer' ? is.company + ' → ' : ''}${c.company || ''}`, html: shell('Special price request', body) });
}
async function specialDecided(q, to) {
  const ok = q.special.status === 'approved';
  const body = `<p>Your special-price request on <b>${esc(q.number)}</b> was <b>${ok ? 'approved' : 'declined'}</b> by ${esc(q.special.decided_by || 'ADONI TECH')}.${q.special.decision_note ? '<br>' + esc(q.special.decision_note) : ''}</p>
    ${ok ? '<p>You can now send the quotation at the approved prices.</p>' : '<p>Please revise the prices to within your discount limit before sending.</p>'}${button(`${PUBLIC_URL()}/approve.html?id=${encodeURIComponent(q.id)}`, 'Open quotation')}`;
  return mail.send({ to, subject: `Special price ${ok ? 'approved' : 'declined'}: ${q.number}`, html: shell('Special price ' + (ok ? 'approved' : 'declined'), body) });
}

/** Dealer onboarding. */
async function dealerApplied(d, settings, url) {
  const to = String(settings['mail.approver_to'] || 'adonitech@gmail.com').split(/[,\s]+/).filter(Boolean);
  const body = `<p>New dealer application.</p><table>${row('Company', d.company)}${row('Contact', [d.contact, d.email, d.phone].filter(Boolean).join(' · '))}${row('Address', [d.addr1, d.addr2, d.city, d.pincode, d.state_name, d.country].filter(Boolean).join(', '))}${row('GSTIN', d.gstin + (d.gstin_warning ? ' — ' + d.gstin_warning : ''))}${row('Web', d.web)}</table>${button(url, 'Review in admin → Dealers')}`;
  return mail.send({ to, subject: `Dealer application — ${d.company}`, html: shell('Dealer application', body) });
}
async function dealerApproved(d, terms) {
  const body = `<p>Dear ${esc(d.contact || d.company)},</p><p>Your dealer account with ADONI TECH is approved (code <b>${esc(d.code)}</b>).</p>
    <table>${row('Your purchase price', `list − ${terms.discount_pct} %`)}${row('Discount you may give', `up to ${terms.max_discount_pct} % below list (deeper = special price, on request)`)}${row('Markup', 'free, as per your costs')}</table>
    <p>Sign out and sign in again at ImpactCal; you will then see list prices in the selectors and can make quotations in your own name from the portal.</p>${button(`${PUBLIC_URL()}/portal.html`, 'Open the dealer portal')}`;
  return mail.send({ to: d.email, subject: 'ADONI TECH dealer account approved', html: shell('Dealer account approved', body) });
}

async function otp(email, code) {
  return mail.send({ to: email, subject: `${code} is your ImpactCal login code`,
    html: shell('Login code', `<p>Your one-time code is</p><p style="font-size:32px;letter-spacing:6px;font-weight:700;color:#1B3160">${code}</p><p style="color:#5A6672">Valid for 10 minutes. If you did not request it, ignore this mail.</p>`) });
}

module.exports = { dealerQuoteInternal, draftReady, specialRequested, specialDecided, dealerApplied, dealerApproved, rfqReceived, selectionDownloaded, approvalRequested, offerSent, otp, whatsapp, PUBLIC_URL };
