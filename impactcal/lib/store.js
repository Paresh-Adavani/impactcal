'use strict';
/**
 * Key/value + file store.
 *
 *   On Netlify   -> Netlify Blobs (store "impactcal"), durable across deploys.
 *   Anywhere else-> a plain folder (IMPACTCAL_STORE, default ./data/_store) so the
 *                   same code runs on a laptop, in tests and on the office PC.
 *
 * Keys are path-like: "rfq/AT-R-2627-0001", "csv/products.csv", "ga/AC/AC-10-5.pdf".
 */
const fs = require('fs'), path = require('path');

let blobs = null, lastError = null;
function onNetlify() { return !!blobs; }

/** Legacy (v1) functions must hand the Lambda event to Blobs once per invocation. */
function connect(event) {
  const hint = !!(event && (event.blobs || event.headers && event.headers['x-nf-request-id'])) || !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV || process.env.SITE_ID || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!hint) return;
  try {
    const b = require('@netlify/blobs');
    if (event && b.connectLambda) b.connectLambda(event);
    blobs = b.getStore({ name: 'impactcal' });
    lastError = null;
  } catch (e) { lastError = e.message; console.error('blobs unavailable, falling back to disk:', e.message); blobs = null; }
}
function status() { return { store: blobs ? 'netlify-blobs' : 'disk', error: lastError, dir: blobs ? undefined : DIR }; }

const DIR = process.env.IMPACTCAL_STORE || (process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp/impactcal-store' : path.join(__dirname, '..', 'data', '_store'));
const fsPath = k => path.join(DIR, k.replace(/[^A-Za-z0-9_\-./]/g, '_'));

async function getJSON(key) {
  if (blobs) return (await blobs.get(key, { type: 'json' })) ?? null;
  const p = fsPath(key) + '.json';
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
async function setJSON(key, val) {
  if (blobs) return blobs.setJSON(key, val);
  const p = fsPath(key) + '.json'; fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(val, null, 1));
}
async function getText(key) {
  if (blobs) return (await blobs.get(key, { type: 'text' })) ?? null;
  const p = fsPath(key); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
async function getBuffer(key) {
  if (blobs) { const a = await blobs.get(key, { type: 'arrayBuffer' }); return a ? Buffer.from(a) : null; }
  const p = fsPath(key); return fs.existsSync(p) ? fs.readFileSync(p) : null;
}
async function set(key, data, meta) {
  if (blobs) return blobs.set(key, data, meta ? { metadata: meta } : undefined);
  const p = fsPath(key); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data);
  if (meta) fs.writeFileSync(p + '.meta.json', JSON.stringify(meta));
}
async function del(key) {
  if (blobs) return blobs.delete(key);
  for (const p of [fsPath(key), fsPath(key) + '.json', fsPath(key) + '.meta.json']) if (fs.existsSync(p)) fs.unlinkSync(p);
}
/** List keys under a prefix (no trailing data). */
async function list(prefix) {
  if (blobs) { const r = await blobs.list({ prefix }); return r.blobs.map(b => b.key); }
  const base = fsPath(prefix); const dir = fs.existsSync(base) && fs.statSync(base).isDirectory() ? base : path.dirname(base);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (!f.endsWith('.meta.json')) out.push(path.relative(DIR, p).split(path.sep).join('/').replace(/\.json$/, '')); } };
  walk(dir);
  return out.filter(k => k.startsWith(prefix));
}

/** Atomic-enough counter: documents are numbered AT/Q/<FY>/<0001>, resetting each 1 April. */
function fyCode(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth() + 1, start = m >= 4 ? y : y - 1;
  return String(start % 100).padStart(2, '0') + String((start + 1) % 100).padStart(2, '0');
}
async function nextNumber(name, prefix) {
  const fy = fyCode();
  const c = (await getJSON('counter/' + name)) || { fy, n: 0 };
  if (c.fy !== fy) { c.fy = fy; c.n = 0; }
  c.n += 1;
  await setJSON('counter/' + name, c);
  return `${prefix}/${fy}/${String(c.n).padStart(4, '0')}`;
}

async function audit(who, what, ref, detail = '') {
  const day = new Date().toISOString().slice(0, 10);
  const key = 'audit/' + day;
  const rows = (await getJSON(key)) || [];
  rows.push({ at: new Date().toISOString(), who, what, ref, detail });
  await setJSON(key, rows);
}

module.exports = { connect, onNetlify, status, getJSON, setJSON, getText, getBuffer, set, del, list, nextNumber, fyCode, audit, DIR };
