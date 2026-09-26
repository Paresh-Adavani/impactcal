'use strict';
/**
 * Google Drive sync with a service account - plain REST, no googleapis package (keeps the
 * function bundle small). Env:
 *   GOOGLE_SERVICE_ACCOUNT_B64  base64 of the service-account JSON key
 *   DRIVE_FOLDER_ID             the "ImpactCal" folder in Paresh's Drive, shared with the
 *                               service-account email as Editor
 *
 * Layout inside that folder (created on first sync):
 *   GA-LIBRARY/<SERIES>/<MODEL>.pdf   <- mirrored from the PC by Drive for Desktop; PULLED into the app
 *   QUOTATIONS/<number>.pdf           <- PUSHED by the app after every approval
 *   RFQ-EXPORTS/rfqs.csv, quotations.csv, audit.csv  <- PUSHED (rolling)
 *   DATA-UPLOADS/<table>.csv          <- PUSHED copy of every CSV uploaded from the admin panel
 */
const crypto = require('crypto');
const store = require('./store');

function creds() {
  const b = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b) return null;
  try { return JSON.parse(Buffer.from(b, 'base64').toString('utf8')); } catch { return null; }
}
const configured = () => !!(creds() && process.env.DRIVE_FOLDER_ID);

let tok = null;
async function token() {
  if (tok && tok.exp > Date.now() + 60000) return tok.value;
  const c = creds(); if (!c) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 not set');
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), c.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${sig}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('drive auth failed: ' + JSON.stringify(j));
  tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tok.value;
}
async function api(path, opts = {}) {
  const r = await fetch('https://www.googleapis.com' + path, { ...opts, headers: { authorization: 'Bearer ' + await token(), ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`drive ${opts.method || 'GET'} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r;
}
const q = s => encodeURIComponent(s);

async function list(parent, extra = '') {
  const out = []; let pageToken = '';
  do {
    const r = await api(`/drive/v3/files?q=${q(`'${parent}' in parents and trashed=false${extra}`)}&fields=nextPageToken,files(id,name,mimeType,md5Checksum,size,modifiedTime)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? '&pageToken=' + pageToken : ''}`);
    const j = await r.json(); out.push(...j.files); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
async function ensureFolder(name, parent) {
  const f = (await list(parent, ` and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder'`))[0];
  if (f) return f.id;
  const r = await api('/drive/v3/files?supportsAllDrives=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) });
  return (await r.json()).id;
}
async function upload(name, buffer, mime, parent) {
  const existing = (await list(parent, ` and name='${name.replace(/'/g, "\\'")}'`))[0];
  const boundary = 'impactcal' + Date.now();
  const meta = existing ? {} : { name, parents: [parent] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(existing ? { name } : meta)}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`),
    buffer, Buffer.from(`\r\n--${boundary}--`)]);
  const path = existing ? `/upload/drive/v3/files/${existing.id}?uploadType=multipart&supportsAllDrives=true` : '/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';
  const r = await api(path, { method: existing ? 'PATCH' : 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body });
  return r.json();
}
async function download(id) { return Buffer.from(await (await api(`/drive/v3/files/${id}?alt=media&supportsAllDrives=true`)).arrayBuffer()); }

/** Pull GA-LIBRARY PDFs (changed ones only, by md5) into the store; push quotations, exports, uploads. */
async function sync(opts = {}) {
  if (!configured()) return { ok: false, reason: 'Drive not configured (GOOGLE_SERVICE_ACCOUNT_B64 / DRIVE_FOLDER_ID)' };
  const root = process.env.DRIVE_FOLDER_ID;
  const report = { pulled: 0, unchanged: 0, pushed: 0, errors: [], started: new Date().toISOString() };
  const deadline = Date.now() + (opts.budgetMs || 20000);   // stay inside the function timeout; the nightly run finishes the rest
  try {
    /* ---- pull GA library ---- */
    const gaRoot = await ensureFolder('GA-LIBRARY', root);
    const known = (await store.getJSON('ga/_md5')) || {};
    for (const series of await list(gaRoot, " and mimeType='application/vnd.google-apps.folder'")) {
      for (const f of await list(series.id, " and mimeType='application/pdf'")) {
        const key = `${series.name}/${f.name}`;
        if (known[key] === f.md5Checksum) { report.unchanged++; continue; }
        if (Date.now() > deadline) { report.errors.push('time budget reached — remaining files on the next run'); break; }
        try { await store.set('ga/' + key, await download(f.id), { md5: f.md5Checksum, name: f.name }); known[key] = f.md5Checksum; report.pulled++; }
        catch (e) { report.errors.push(key + ': ' + e.message); }
      }
    }
    await store.setJSON('ga/_md5', known);
    /* ---- push quotations ---- */
    const qRoot = await ensureFolder('QUOTATIONS', root);
    const pushed = (await store.getJSON('drive/_pushed')) || {};
    for (const k of await store.list('quotation-pdf/')) {
      if (pushed[k] || Date.now() > deadline) continue;
      const buf = await store.getBuffer(k); if (!buf) continue;
      try { await upload(k.split('/').pop() + '.pdf', buf, 'application/pdf', qRoot); pushed[k] = Date.now(); report.pushed++; } catch (e) { report.errors.push(k + ': ' + e.message); }
    }
    await store.setJSON('drive/_pushed', pushed);
    /* ---- push CSV uploads + exports ---- */
    const uRoot = await ensureFolder('DATA-UPLOADS', root);
    for (const k of await store.list('csv/')) {
      if (!k.endsWith('.csv') || Date.now() > deadline) continue;
      try { await upload(k.split('/').pop(), Buffer.from(await store.getText(k), 'utf8'), 'text/csv', uRoot); report.pushed++; } catch (e) { report.errors.push(k + ': ' + e.message); }
    }
    if (opts.exports) {
      const eRoot = await ensureFolder('RFQ-EXPORTS', root);
      for (const [name, text] of Object.entries(opts.exports)) { try { await upload(name, Buffer.from(text, 'utf8'), 'text/csv', eRoot); report.pushed++; } catch (e) { report.errors.push(name + ': ' + e.message); } }
    }
    report.ok = true;
  } catch (e) { report.ok = false; report.errors.push(e.message); }
  report.finished = new Date().toISOString();
  await store.setJSON('drive/_last', report);
  return report;
}

module.exports = { configured, sync, creds };
