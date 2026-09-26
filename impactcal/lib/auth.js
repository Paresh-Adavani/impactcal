'use strict';
/**
 * Passwordless login: 6-digit OTP by email, then a signed token (HMAC, no library).
 *
 * Roles
 *   admin    - ADMIN_EMAILS env (default adonitech@gmail.com); sees everything, approves quotations
 *   sales    - settings sales.emails / sales.domains; sees prices & lead times in the selectors
 *   dealer   - approved once by ADONI TECH (lib/dealers.js); sees list prices, quotes in his own name
 *   customer - anyone else who logs in (optional - the selectors work without login)
 *
 * Signed one-shot links (quotation approval from a phone) use the same HMAC.
 */
const crypto = require('crypto');
const store = require('./store');

const SECRET = process.env.IMPACTCAL_SECRET || 'dev-secret-change-me';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'adonitech@gmail.com').toLowerCase().split(/[,\s]+/).filter(Boolean);
const TOKEN_DAYS = Number(process.env.TOKEN_DAYS || 30);

const b64u = b => Buffer.from(b).toString('base64url');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

function sign(payload, ttlSec) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return body + '.' + hmac(body);
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = Buffer.from(hmac(body)), got = Buffer.from(sig || '');
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return p.exp > Date.now() / 1000 ? p : null; }
  catch { return null; }
}

/** settings sales.people = "email=Name; email=Name" */
function displayName(email, settings) {
  const e = String(email || '').toLowerCase().trim();
  for (const pair of String(settings['sales.people'] || '').split(';')) {
    const [k, v] = pair.split('='); if (k && v && k.trim().toLowerCase() === e) return v.trim();
  }
  return e.split('@')[0];
}
function roleFor(email, settings) {
  const e = String(email || '').toLowerCase().trim();
  if (!e) return 'customer';
  if (ADMIN_EMAILS.includes(e)) return 'admin';
  const extraAdmins = String(settings['admin.emails'] || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (extraAdmins.includes(e)) return 'admin';
  const sales = String(settings['sales.emails'] || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  const domains = String(settings['sales.domains'] || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (sales.includes(e) || domains.some(d => e.endsWith('@' + d))) return 'sales';
  return 'customer';
}

async function requestOtp(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('enter a valid email address');
  const code = String(crypto.randomInt(100000, 999999));
  await store.setJSON('otp/' + e, { code, exp: Date.now() + 10 * 60000, tries: 0 });
  return { email: e, code };
}
async function verifyOtp(email, code, settings) {
  const e = String(email || '').toLowerCase().trim();
  const rec = await store.getJSON('otp/' + e);
  if (!rec || rec.exp < Date.now()) throw new Error('code expired - request a new one');
  if (rec.tries >= 5) throw new Error('too many attempts - request a new code');
  if (String(code).trim() !== rec.code) { rec.tries++; await store.setJSON('otp/' + e, rec); throw new Error('wrong code'); }
  await store.del('otp/' + e);
  let role = roleFor(e, settings);
  let name = displayName(e, settings);
  if (role === 'customer') { const d = await require('./dealers').get(e); if (d && d.status === 'approved') { role = 'dealer'; name = d.contact ? `${d.contact} (${d.company})` : d.company; } }
  const user = { email: e, role, name };
  const users = (await store.getJSON('users/index')) || {};
  users[e] = { ...(users[e] || {}), email: e, role, name: user.name, last_login: new Date().toISOString(), logins: ((users[e] || {}).logins || 0) + 1 };
  await store.setJSON('users/index', users);
  return { token: sign({ u: e, r: role }, TOKEN_DAYS * 86400), user };
}

/** express middlewares */
function userFrom(req) {
  const h = req.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : (req.query.token || '');
  const p = verify(t);
  return p && p.u ? { email: p.u, role: p.r || 'customer' } : null;
}
const optional = (req, _res, next) => { req.user = userFrom(req); next(); };
const requireRole = (...roles) => (req, res, next) => {
  req.user = userFrom(req);
  if (!req.user) return res.status(401).json({ error: 'login required' });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'not allowed for role ' + req.user.role });
  next();
};
const canSeePrices = u => !!u && (u.role === 'admin' || u.role === 'sales' || u.role === 'dealer');

/** signed action links, e.g. approve a quotation from a phone without logging in */
const actionLink = (action, ref, days = 14) => sign({ a: action, ref }, days * 86400);
const verifyAction = (token, action) => { const p = verify(token); return p && p.a === action ? p : null; };

module.exports = { sign, verify, roleFor, displayName, requestOtp, verifyOtp, optional, requireRole, canSeePrices, actionLink, verifyAction, ADMIN_EMAILS };
