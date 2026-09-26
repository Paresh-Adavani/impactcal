'use strict';
/**
 * Outgoing mail through Gmail SMTP with an App Password.
 * Env: SMTP_USER, SMTP_PASS, SMTP_FROM (optional), SMTP_HOST/PORT (optional).
 * Nothing here ever throws into a request handler: callers get { ok, reason }.
 */
const nodemailer = require('nodemailer');
const store = require('./store');

function config() {
  return {
    user: (process.env.SMTP_USER || '').trim(), pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),   // Gmail app passwords are shown as 4 groups; spaces are ignored
    host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };
}
function transport(c) {
  return nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465,
    auth: { user: c.user, pass: c.pass }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000 });
}
async function verifySmtp() {
  const c = config();
  if (!c.user || !c.pass) return { ok: false, reason: 'SMTP_USER / SMTP_PASS not set in Netlify environment variables' };
  try { await transport(c).verify(); return { ok: true, user: c.user, host: c.host, port: c.port }; }
  catch (e) { return { ok: false, reason: e.message }; }
}

/** send({to, cc, subject, html, text, attachments:[{filename, content|path, contentType}]}) */
async function send(msg) {
  const c = config();
  const list = v => Array.isArray(v) ? v.filter(Boolean).join(', ') : (v || '');
  if (!c.user || !c.pass) {
    await store.audit('system', 'mail.skipped', msg.subject, 'SMTP not configured');
    return { ok: false, reason: 'SMTP not configured', to: list(msg.to) };
  }
  try {
    const info = await transport(c).sendMail({
      from: msg.from || `ADONI TECH <${c.from}>`, to: list(msg.to), cc: list(msg.cc), bcc: list(msg.bcc),
      replyTo: msg.replyTo || c.from, subject: msg.subject, html: msg.html, text: msg.text,
      attachments: msg.attachments || [],
    });
    await store.audit('system', 'mail.sent', msg.subject, list(msg.to));
    return { ok: true, id: info.messageId, to: list(msg.to) };
  } catch (e) {
    await store.audit('system', 'mail.failed', msg.subject, e.message);
    return { ok: false, reason: e.message, to: list(msg.to) };
  }
}

const esc = s => String(s ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
const shell = (title, body) => `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;max-width:680px;margin:auto">
  <div style="border-bottom:3px solid #F57C00;padding-bottom:8px;margin-bottom:14px">
    <span style="font-size:20px;font-weight:700;color:#1B3160">ADONI TECH</span>
    <span style="float:right;color:#5A6672">${esc(title)}</span></div>${body}
  <p style="margin-top:24px;color:#8B96A3;font-size:12px">ImpactCal · ADONI TECH · Satara MIDC, Maharashtra · GSTIN 27AHAPA3555B1Z1</p></div>`;
const row = (k, v) => v == null || v === '' ? '' : `<tr><td style="padding:4px 12px 4px 0;color:#5A6672;vertical-align:top">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`;
const button = (href, label, color = '#F57C00') => `<p style="margin:18px 0"><a href="${href}" style="background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

module.exports = { send, verifySmtp, esc, shell, row, button, config };
