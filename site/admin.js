'use strict';
/* Admin panel. Everything here is behind an admin (or sales, read-only parts) login. */
let TAB = 'rfq';
const V = () => $('#view');
const say = (cls, m) => `<div class="note ${cls}">${m}</div>`;
const dt = s => s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

async function boot() {
  await bootCommon('nav_admin');
  const u = AUTH.user;
  if (!u || (u.role !== 'admin' && u.role !== 'sales')) { location.href = 'login.html?next=admin.html'; return; }
  if (u.role === 'sales') $$('#tabs button').forEach(b => { if (!['rfq', 'quotes'].includes(b.dataset.tab)) b.remove(); });
  $$('#tabs button').forEach(b => b.onclick = () => { TAB = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); show().catch(err); });
  await show();
}
const err = e => { V().insertAdjacentHTML('afterbegin', say('bad', esc(e.message))); };
async function show() { V().innerHTML = '<div class="card muted">Loading…</div>'; await ({ rfq, quotes, db, settings, drawings, users, tools })[TAB](); }

/* ---------------- RFQ queue ---------------- */
async function rfq() {
  const rows = await api('admin/rfqs');
  const by = s => rows.filter(r => r.status === s).length;
  V().innerHTML = `<div class="stat"><div><b>${rows.length}</b><span>requests</span></div><div><b>${by('new') + by('draft')}</b><span>awaiting approval</span></div><div><b>${by('quoted')}</b><span>quoted</span></div><div><b>${rows.filter(r => r.country && r.country !== 'India').length}</b><span>export</span></div></div>
  <div class="card tbl-card"><div class="tw"><table><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Line</th><th>Items</th><th>Raised by</th><th>Status</th><th>Quotation</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td class="mono">${esc(r.number)}</td><td>${dt(r.created_at)}</td><td><b>${esc(r.customer || '')}</b><br><small class="muted">${esc(r.country || '')}</small></td><td>${esc(r.line)}</td><td class="n">${r.items}</td><td><small>${esc(r.raised_by || 'web')}</small></td><td><span class="pill ${r.status === 'quoted' ? 'ok' : r.status === 'lost' ? 'bad' : 'brand'}">${esc(r.status)}</span></td><td class="mono">${r.quotation_id ? r.quotation_id.replace(/-/g, '/') : '—'}</td>
    <td class="row">${r.quotation_id ? `<button class="btn sm" data-open="${esc(r.quotation_id)}">Open / approve</button>` : `<button class="btn sm navy" data-draft="${esc(r.id)}">Prepare quotation</button>`}<button class="btn sm ghost" data-view="${esc(r.id)}">Details</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">No requests yet.</td></tr>'}
  </tbody></table></div></div><div id="detail"></div>`;
  $$('[data-open]').forEach(b => b.onclick = async () => { const q = await api('admin/quotation/' + encodeURIComponent(b.dataset.open)); location.href = q.approve_url; });
  $$('[data-draft]').forEach(b => b.onclick = async () => { const r = await api('admin/rfq/' + encodeURIComponent(b.dataset.draft) + '/quote', { method: 'POST' }); location.href = r.approve_url; });
  $$('[data-view]').forEach(b => b.onclick = async () => { const r = await api('admin/rfq/' + encodeURIComponent(b.dataset.view)); $('#detail').innerHTML = `<div class="card"><div class="spread"><h3>${esc(r.number)}</h3><div class="row">${AUTH.user.role === 'admin' ? `<button class="btn sm ghost" id="resend">Re-send approval alert</button><select id="st" style="width:auto"><option>new</option><option>draft</option><option>quoted</option><option>closed</option><option>lost</option></select><button class="btn sm ghost" id="setst">Set status</button>` : ''}</div></div><pre class="log">${esc(JSON.stringify({ customer: r.customer, project: r.project, items: r.items, selection: r.selection && r.selection.summary, message: r.message, formats: r.formats, raised_by: r.raised_by, status: r.status, quotation_id: r.quotation_id }, null, 2))}</pre></div>`;
    if ($('#resend')) $('#resend').onclick = async () => { const x = await api('admin/rfq/' + encodeURIComponent(r.id) + '/resend-alert', { method: 'POST' }); alert(x.mail && x.mail.ok ? 'Alert sent to ' + x.mail.to : 'Mail failed: ' + (x.mail && x.mail.reason)); };
    if ($('#setst')) { $('#st').value = r.status; $('#setst').onclick = async () => { await api('admin/rfq/' + encodeURIComponent(r.id), { method: 'PATCH', body: { status: $('#st').value } }); show(); }; } });
}

/* ---------------- quotations ---------------- */
async function quotes() {
  const rows = await api('admin/quotations');
  V().innerHTML = `<div class="card tbl-card"><div class="spread"><h3>Quotations</h3><a class="btn sm ghost" href="/api/admin/export/quotations.csv?token=${encodeURIComponent(AUTH.token)}">Export CSV</a></div><div class="tw"><table><thead><tr><th>Number</th><th>Rev</th><th>Date</th><th>Customer</th><th>Cur</th><th class="n">Grand total</th><th>Status</th><th>Sent</th><th></th></tr></thead><tbody>
  ${rows.map(q => `<tr><td class="mono">${esc(q.number)}</td><td>${q.rev}</td><td>${q.date}</td><td>${esc(q.customer || '')}</td><td>${q.currency}</td><td class="n">${money(q.grand_total, q.currency)}</td><td><span class="pill ${q.status === 'sent' ? 'ok' : 'brand'}">${q.status}</span></td><td>${dt(q.sent_at)}</td>
    <td class="row"><button class="btn sm" data-open="${esc(q.id)}">Open</button><a class="btn sm ghost" href="/api/admin/quotation/${encodeURIComponent(q.id)}/pdf?token=${encodeURIComponent(AUTH.token)}" target="_blank">PDF</a></td></tr>`).join('') || '<tr><td colspan="9" class="muted">None yet.</td></tr>'}</tbody></table></div></div>`;
  $$('[data-open]').forEach(b => b.onclick = async () => { const q = await api('admin/quotation/' + encodeURIComponent(b.dataset.open)); location.href = q.approve_url; });
}

/* ---------------- CSV database ---------------- */
const TABLE_HELP = {
  shock_absorbers: 'Crane buffers & industrial shock absorbers. Key: bk. Edit price_inr, lead_time_days, status (active / obsolete / on_request), hsn, gst_rate, note. Technical columns feed the calculation — change only from catalogue data.',
  accessories: 'Mountings, caps and options quoted with a shock absorber. Key: code.',
  wire_rope_isolators: 'AWRI table used by the wire rope selector (loads, deflections, Kv/Ks per axis) plus price_inr, lead_time_days, enidine_equiv. Key: model.',
  rubber_mounts: 'Rubber mount catalogue (load band, fn, stiffness, dimensions, price, lead time). Rows with status=reference come from equivalent catalogues — replace with Adoni Tech data. Key: model.',
  settings: 'Company, bank, terms, FX uplift, mail routing, sales emails. Easier to edit on the Settings tab; the CSV is for bulk changes. Key: key.',
  translations: 'UI text in every language (one column per language; blank = English is shown). Fill a column in Excel to complete a language. Key: key.',
  ga_index: 'Index of GA drawing PDFs (path inside GA-LIBRARY). Regenerated on the PC by GA-LIBRARY/_tools/build.py. Key: path.',
};
async function db() {
  const list = await api('admin/csv');
  V().innerHTML = `<div class="card"><h3>CSV database</h3><p class="hint">Download a table, edit it in Excel (keep the key column, save as <b>CSV UTF-8</b>), then upload. The upload is checked first and applied only if there are no errors. <b>Revert</b> returns to the CSV shipped with the last deploy. To make an upload permanent for future deploys, also copy the file into <span class="mono">ImpactCal\\data\\</span> on the PC and re-deploy.</p></div>
  ${list.map(tb => `<div class="card tbl-card" id="t_${tb.table}"><div class="spread"><div><h3 style="margin:0">${tb.table}.csv <span class="pill">${tb.rows} rows</span> <span class="pill ${tb.source === 'upload' ? 'brand' : ''}">${tb.source === 'upload' ? 'uploaded ' + dt(tb.upload && tb.upload.uploaded_at) : 'from deploy'}</span></h3><small class="muted">${TABLE_HELP[tb.table] || ''}</small></div>
    <div class="row"><a class="btn sm ghost" href="/api/admin/csv/${tb.table}?token=${encodeURIComponent(AUTH.token)}">Download</a>${tb.source === 'upload' ? `<button class="btn sm ghost" data-revert="${tb.table}">Revert to deploy</button>` : ''}</div></div>
    <div class="drop" data-table="${tb.table}" style="margin-top:10px">Drop the revised <b>${tb.table}.csv</b> here or <label style="display:inline;color:var(--blue);cursor:pointer">choose a file<input type="file" accept=".csv,text/csv" hidden></label></div><div class="rep"></div></div>`).join('')}`;
  $$('.drop').forEach(d => {
    const inp = d.querySelector('input'); const table = d.dataset.table;
    const handle = async file => {
      const text = await file.text();
      const rep = d.parentElement.querySelector('.rep');
      rep.innerHTML = say('blue', 'Checking…');
      const v = await api('admin/csv/' + table + '?dry_run=1', { method: 'POST', headers: { 'content-type': 'text/csv' }, body: text });
      rep.innerHTML = `${v.errors.length ? say('bad', '<b>Errors — not applied:</b><br>' + v.errors.map(esc).join('<br>')) : say('ok', `<b>${v.count} rows ready.</b>`)}${v.warnings.length ? say('warn', v.warnings.map(esc).join('<br>')) : ''}${!v.errors.length ? `<button class="btn" id="apply_${table}">Apply ${v.count} rows to ${table}</button>` : ''}`;
      const ap = $('#apply_' + table); if (ap) ap.onclick = async () => { const r = await api('admin/csv/' + table, { method: 'POST', headers: { 'content-type': 'text/csv' }, body: text }); rep.innerHTML = say('ok', `Applied ${r.count} rows. ${r.warnings.map(esc).join('<br>')}`); setTimeout(show, 1200); };
    };
    inp.onchange = () => inp.files[0] && handle(inp.files[0]).catch(e => d.parentElement.querySelector('.rep').innerHTML = say('bad', esc(e.message)));
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) handle(f).catch(er => d.parentElement.querySelector('.rep').innerHTML = say('bad', esc(er.message))); };
  });
  $$('[data-revert]').forEach(b => b.onclick = async () => { if (confirm('Revert ' + b.dataset.revert + ' to the deployed CSV? The uploaded version is discarded.')) { await api('admin/csv/' + b.dataset.revert, { method: 'DELETE' }); show(); } });
}

/* ---------------- settings ---------------- */
const GROUPS = [['company.', 'Company (printed on quotations)'], ['bank.inr.', 'Bank — INR quotations (NEFT / RTGS)'], ['bank.usd.', 'Bank — USD export quotations (SWIFT)'], ['quote.', 'Quotation defaults & terms'], ['rfq.', 'RFQ numbering'], ['fx.', 'Exchange rate & export uplift'], ['mail.', 'Mail routing'], ['sales.', 'Sales team (who sees prices)'], ['drawings.', 'Drawings release'], ['ui.', 'Languages'], ['whatsapp.', 'WhatsApp alerts (phase 2)']];
async function settings() {
  const rows = await api('admin/settings');
  V().innerHTML = `<div class="card"><div class="spread"><h3>Settings</h3><button class="btn" id="saveS">Save all</button></div><p class="hint">These are the rows of settings.csv. Bank details print on every quotation — INR block for Indian customers, USD block for export.</p>
  ${GROUPS.map(([p, title]) => `<div class="sgrp"><h4>${title}</h4><div class="grid">${rows.filter(r => r.key.startsWith(p)).map(r => `<div><label>${esc(r.key.slice(p.length))}${r.note ? ` <span class="muted">— ${esc(r.note)}</span>` : ''}</label>${r.value.length > 60 ? `<textarea data-k="${esc(r.key)}" rows="2">${esc(r.value)}</textarea>` : `<input data-k="${esc(r.key)}" value="${esc(r.value)}">`}</div>`).join('')}</div></div>`).join('')}
  <div class="sgrp"><h4>Other</h4><div class="grid">${rows.filter(r => !GROUPS.some(([p]) => r.key.startsWith(p))).map(r => `<div><label>${esc(r.key)}</label><input data-k="${esc(r.key)}" value="${esc(r.value)}"></div>`).join('')}</div></div>
  <div class="row" style="margin-top:14px"><button class="btn" id="saveS2">Save all</button><span id="sOut"></span></div></div>`;
  const doSave = async () => { const o = {}; $$('[data-k]').forEach(i => { o[i.dataset.k] = i.value; }); await api('admin/settings', { method: 'PUT', body: o }); $('#sOut').innerHTML = '<span class="pill ok">saved</span>'; };
  $('#saveS').onclick = $('#saveS2').onclick = () => doSave().catch(err);
}

/* ---------------- drawings & drive ---------------- */
async function drawings() {
  const [ga, dr] = await Promise.all([api('admin/ga'), api('admin/drive/status')]);
  V().innerHTML = `<div class="stat"><div><b>${ga.indexed}</b><span>GA drawings indexed</span></div><div><b>${ga.uploaded}</b><span>available in the app</span></div><div><b>${ga.missing.length}</b><span>missing in the app</span></div></div>
  <div class="card"><div class="spread"><h3>Google Drive sync</h3><button class="btn" id="sync" ${dr.configured ? '' : 'disabled'}>Sync now</button></div>
    ${dr.configured ? say('ok', `Configured — service account <b>${esc(dr.service_account)}</b>, folder <span class="mono">${esc(dr.folder)}</span>. Runs nightly; pulls GA-LIBRARY PDFs into the app, pushes approved quotation PDFs, CSV uploads and RFQ/quotation exports to Drive.`) : say('warn', 'Not configured. Set <b>GOOGLE_SERVICE_ACCOUNT_B64</b> and <b>DRIVE_FOLDER_ID</b> in Netlify environment variables (see DEPLOY.md). Until then, upload GA PDFs below.')}
    ${dr.last ? `<div class="log">last run ${dt(dr.last.started)} → ${dr.last.ok ? 'ok' : 'FAILED'} · pulled ${dr.last.pulled} · unchanged ${dr.last.unchanged} · pushed ${dr.last.pushed}${dr.last.errors.length ? '\n' + dr.last.errors.map(esc).join('\n') : ''}</div>` : ''}<div id="syncOut"></div></div>
  <div class="card"><h3>Upload GA drawings directly</h3><p class="hint">Select PDFs from <span class="mono">GA-LIBRARY\\&lt;SERIES&gt;\\</span>. The file name must match the index (e.g. <span class="mono">AC-10-5.pdf</span>); the series folder is taken from the model prefix.</p>
    <input type="file" id="gaFiles" accept="application/pdf" multiple><div id="gaOut" style="margin-top:8px"></div></div>
  <div class="card"><h3>Missing in the app (${ga.missing.length})</h3><div class="log">${ga.missing.slice(0, 400).map(esc).join('\n') || 'none'}</div></div>`;
  $('#sync').onclick = async () => { $('#syncOut').innerHTML = say('blue', 'Syncing… (up to 25 s per run; large libraries finish over several runs)'); try { const r = await api('admin/drive/sync', { method: 'POST' }); $('#syncOut').innerHTML = say(r.ok ? 'ok' : 'bad', `pulled ${r.pulled}, unchanged ${r.unchanged}, pushed ${r.pushed}${r.errors.length ? '<br>' + r.errors.map(esc).join('<br>') : ''}`); } catch (e) { $('#syncOut').innerHTML = say('bad', esc(e.message)); } };
  $('#gaFiles').onchange = async () => {
    const idx = {}; (await api('admin/csv/ga_index?token=' + encodeURIComponent(AUTH.token)).catch(() => null));
    const out = []; for (const f of $('#gaFiles').files) {
      const series = f.name.split(/[-\s]/)[0].toUpperCase(); const path = `${series}/${f.name}`;
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f); });
      try { const r = await api('admin/ga', { method: 'POST', body: { path, base64: b64 } }); out.push(`✓ ${r.path} (${(r.bytes / 1024).toFixed(0)} kB)`); } catch (e) { out.push(`✗ ${f.name}: ${e.message}`); }
      $('#gaOut').innerHTML = `<div class="log">${out.map(esc).join('\n')}</div>`;
    }
  };
}

/* ---------------- users & activity ---------------- */
async function users() {
  const [us, au] = await Promise.all([api('admin/users'), api('admin/audit?days=14')]);
  V().innerHTML = `<div class="card tbl-card"><h3>Logins</h3><p class="hint">Roles come from settings: <b>sales.emails</b> / <b>sales.domains</b> see prices; admin addresses are set by the ADMIN_EMAILS environment variable.</p><div class="tw"><table><thead><tr><th>Email</th><th>Role</th><th>Logins</th><th>Last login</th></tr></thead><tbody>${us.map(u => `<tr><td>${esc(u.email)}</td><td><span class="pill ${u.role === 'admin' ? 'brand' : ''}">${u.role}</span></td><td class="n">${u.logins}</td><td>${dt(u.last_login)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">nobody yet</td></tr>'}</tbody></table></div></div>
  <div class="card tbl-card"><div class="spread"><h3>Activity (14 days)</h3><a class="btn sm ghost" href="/api/admin/export/rfqs.csv?token=${encodeURIComponent(AUTH.token)}">Export RFQs CSV</a></div><div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Ref</th><th>Detail</th></tr></thead><tbody>${au.map(a => `<tr><td>${dt(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td class="mono">${esc(a.ref)}</td><td><small>${esc(a.detail)}</small></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- tools ---------------- */
async function tools() {
  V().innerHTML = `<div class="card"><h3>Mail</h3><div class="row"><button class="btn ghost" id="mv">Verify SMTP</button><button class="btn ghost" id="mt">Send me a test mail</button></div><div id="mOut"></div></div>
  <div class="card"><h3>Exchange rate</h3><div class="row"><button class="btn ghost" id="fx">Show current</button><button class="btn ghost" id="fxr">Refresh from source</button></div><div id="fxOut"></div></div>
  <div class="card"><h3>Health</h3><div class="row"><button class="btn ghost" id="hl">Check</button></div><div id="hOut"></div></div>`;
  const put = (id, r) => $(id).innerHTML = `<div class="log">${esc(JSON.stringify(r, null, 2))}</div>`;
  $('#mv').onclick = async () => put('#mOut', await api('admin/mail/verify')); $('#mt').onclick = async () => put('#mOut', await api('admin/mail/test', { method: 'POST' }));
  $('#fx').onclick = async () => put('#fxOut', await api('admin/fx')); $('#fxr').onclick = async () => put('#fxOut', await api('admin/fx/refresh', { method: 'POST' }));
  $('#hl').onclick = async () => put('#hOut', await api('health'));
}
boot().catch(err);
