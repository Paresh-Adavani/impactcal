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
  if (u.role === 'sales') $$('#tabs button').forEach(b => { if (!['rfq', 'quotes', 'selections', 'pricing'].includes(b.dataset.tab)) b.remove(); });
  $$('#tabs button').forEach(b => b.onclick = () => { TAB = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); show().catch(err); });
  const h = (location.hash || '').replace('#', ''); if (['selections', 'quotes', 'drawings', 'tools', 'db', 'settings', 'users', 'pricing', 'dealers', 'dampa'].includes(h)) { TAB = h; $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === h)); }
  await show();
}
const err = e => { V().insertAdjacentHTML('afterbegin', say('bad', esc(e.message))); };
async function show() { V().innerHTML = '<div class="card muted">Loading…</div>'; await ({ rfq, quotes, selections, pricing, db, settings, drawings, users, tools, dealers: dealersTab, dampa: dampaTab })[TAB](); }

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


/* ---------------- report leads (selection reports downloaded without an RFQ) ---------------- */
async function selections() {
  const rows = await api('admin/selections');
  V().innerHTML = `<div class="stat"><div><b>${rows.length}</b><span>reports downloaded</span></div><div><b>${rows.filter(r => !r.rfq_number).length}</b><span>not yet converted</span></div><div><b>${rows.filter(r => r.quality && r.quality !== 'ok').length}</b><span>doubtful contacts</span></div><div><b>${rows.filter(r => r.crm).length}</b><span>in CRM</span></div></div>
  <p class="hint">Visitors who downloaded a selection report but did not send a request. Real-looking contacts were pushed to UnitePro; doubtful ones (dummy names, numbers, e-mails) were held back. "Convert to RFQ" creates the request, the draft quotation and the approval alert exactly as if the customer had pressed Send.</p>
  <div class="card tbl-card"><div class="tw"><table><thead><tr><th>Number</th><th>Date</th><th>Contact</th><th>Company</th><th>Line</th><th>Model</th><th>Qty</th><th>Quality</th><th>CRM</th><th>RFQ</th><th></th></tr></thead><tbody>
  ${rows.map(r => `<tr><td class="mono">${esc(r.number)}</td><td>${dt(r.created_at)}</td><td><b>${esc(r.contact || '')}</b><br><small class="muted">${esc(r.email || '')} · ${esc(r.phone || '')}</small></td><td>${esc(r.customer || '')}<br><small class="muted">${esc(r.country || '')}</small></td><td>${esc(r.line)}</td><td class="mono">${esc(r.model || '')}</td><td class="n">${r.qty || ''}</td><td><span class="pill ${r.quality === 'ok' ? 'ok' : 'bad'}">${esc(r.quality || '?')}</span></td><td>${r.crm ? '✓' : '—'}</td><td class="mono">${esc(r.rfq_number || '—')}</td>
    <td class="row">${r.rfq_number ? '' : `<button class="btn sm navy" data-conv="${esc(r.id)}">Convert to RFQ</button>`}<button class="btn sm ghost" data-sview="${esc(r.id)}">Details</button></td></tr>`).join('') || '<tr><td colspan="11" class="muted">No report downloads yet.</td></tr>'}
  </tbody></table></div></div><div id="detail"></div>`;
  $$('[data-conv]').forEach(b => b.onclick = async () => { if (!confirm('Create an RFQ + draft quotation from this report and send the approval alert?')) return; b.disabled = true; try { const r = await api('admin/selection/' + encodeURIComponent(b.dataset.conv) + '/to-rfq', { method: 'POST', body: {} }); alert(`Created ${r.number}${r.quotation ? ' and draft ' + r.quotation : ''}. Approval alert ${r.alert ? 'sent' : 'NOT sent'}.`); show(); } catch (e) { alert(e.message); b.disabled = false; } });
  $$('[data-sview]').forEach(b => b.onclick = async () => { const r = await api('admin/selection/' + encodeURIComponent(b.dataset.sview)); $('#detail').innerHTML = `<div class="card"><h3>${esc(r.number)}</h3><pre class="log">${esc(JSON.stringify({ customer: r.customer, project: r.project, items: r.items, selection: r.selection, raised_by: r.raised_by, status: r.status, rfq_number: r.rfq_number }, null, 2))}</pre></div>`; });
}


/* ---------------- dealers: approve once, then they quote in their own name ---------------- */
async function dealersTab() {
  const [rows, st, com] = await Promise.all([api('admin/dealers'), api('admin/settings'), api('admin/commissions').catch(() => ({ states: [], rows: [] }))]);
  const sv = k => ((st.find(r => r.key === k) || {}).value || '');
  const pill = s => `<span class="pill ${s === 'approved' ? 'ok' : s === 'pending' ? 'brand' : 'bad'}">${esc(s)}</span>`;
  V().innerHTML = `<div class="stat"><div><b>${rows.length}</b><span>dealers</span></div><div><b>${rows.filter(d => d.status === 'pending').length}</b><span>waiting for approval</span></div><div><b>${rows.filter(d => d.status === 'approved').length}</b><span>active</span></div></div>
  <div class="card"><div class="spread"><h3>Dealer sign-up page</h3><a class="btn sm ghost" href="/dealers" target="_blank">Open the page ↗</a></div>
    <p class="hint">Public page <b>impactcal.netlify.app/dealers</b> (also linked from the home page and every header). Cities listed here appear on it as "Where we are appointing dealers".</p>
    <label>Cities where you are seeking dealers (one per line or separated by ;)</label><textarea id="dCities" rows="4" placeholder="Nashik&#10;Aurangabad&#10;Ahmedabad">${esc(sv('dealer.cities').split(/\s*;\s*/).filter(Boolean).join('\n'))}</textarea>
    <div class="grid" style="margin-top:8px"><div><label>Line under the city list</label><input id="dNote" value="${esc(sv('dealer.cities_note'))}"></div><div><label>Google Analytics 4 ID (G-XXXXXXX) — tracks visits and dealer sign-ups on every page</label><input id="dGa" value="${esc(sv('analytics.ga_id'))}" placeholder="G-…"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" id="dSave">Save</button><span id="dSaved" class="muted"></span></div></div>
  <div class="card"><h3>Dealer terms</h3>
    <p class="hint"><b>Resale</b> — quotation on the dealer's letterhead; ADONI TECH bills him list − his dealer discount + packing &amp; freight to his godown. <b>Direct supply</b> — quotation on ADONI TECH letterhead with the dealer as channel partner; customer pays ADONI TECH; commission = dealer discount − discount passed on, × his quoted price (list or marked up), basic value only, paid after the customer pays in full. Packing &amp; freight = Rs/kg × estimated weight, India only (export ex-works). A different discount per dealer: the "Billing disc %" column below.</p>
    <div class="grid"><div><label>Standard dealer discount %</label><input id="tDisc" type="number" step="any" value="${esc(sv('dealer.discount_pct') || '25')}"></div><div><label>Max discount a dealer may give below list %</label><input id="tMax" type="number" step="any" value="${esc(sv('dealer.max_discount_pct') || '25')}"></div><div><label>Packing &amp; freight Rs per kg</label><input id="tFr" type="number" step="any" value="${esc(sv('freight.rate_per_kg') || '35')}"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" id="tSave">Save terms</button><span id="tSaved" class="muted"></span></div></div>
  <p class="hint">A dealer applies from the dealer sign-up page or the Quote portal after signing in (company, address, GSTIN, bank). Approve once: he then sees list prices, quotes his customers in his own name (cc you), may discount up to his limit or add markup, and you bill him at list − his dealer discount. Deeper discounts come to you as special-price requests. Each dealer gets his own terms at approval — e.g. a different structure for overseas dealers. Leave the % fields empty to use the standard values in Settings (dealer.discount_pct / dealer.max_discount_pct).</p>
  <div class="card tbl-card"><div class="tw"><table><thead><tr><th>Dealer</th><th>Contact</th><th>GSTIN</th><th>Status</th><th>Code</th><th>Billing disc %</th><th>Max disc %</th><th></th></tr></thead><tbody>
  ${rows.map(d => `<tr data-e="${esc(d.email)}"><td><b>${esc(d.company)}</b>${d.logo ? ' <span class="pill ok">logo</span>' : ''}${d.country && d.country !== 'India' ? ' <span class="pill brand">overseas</span>' : ''}<br><small class="muted">${esc([d.addr1, d.city, d.state_name, d.country].filter(Boolean).join(', '))}</small>${d.territory || d.business_type || d.products ? `<br><small><b>Covers:</b> ${esc(d.territory || '—')}${d.business_type ? ' · ' + esc(d.business_type) : ''}${d.years ? ' · ' + esc(d.years) + ' yrs' : ''}${d.products ? '<br><b>Wants:</b> ' + esc(d.products) : ''}${d.industries ? ' · ' + esc(d.industries) : ''}</small>` : ''}${d.message ? `<br><small class="muted">“${esc(d.message)}”</small>` : ''}</td><td>${esc(d.contact || '')}<br><small class="muted">${esc(d.email)} · ${esc(d.phone || '')}</small></td>
    <td class="mono">${esc(d.gstin || '—')}${d.gstin && d.gstin_ok !== '1' ? `<br><small class="lim" style="color:#c0392b">${esc(d.gstin_warning || 'check')}</small>` : ''}</td><td>${pill(d.status)}<br><small class="muted">${dt(d.approved_at || d.applied_at)}</small></td>
    <td><input data-f="code" value="${esc(d.code || '')}" style="width:80px" placeholder="auto"></td><td><input data-f="discount_pct" type="number" step="any" value="${d.discount_pct ?? ''}" placeholder="${d.terms.discount_pct}" style="width:70px"></td><td><input data-f="max_discount_pct" type="number" step="any" value="${d.max_discount_pct ?? ''}" placeholder="${d.terms.max_discount_pct}" style="width:70px"></td>
    <td class="row">${d.status !== 'approved' ? '<button class="btn sm" data-d="approve">Approve</button>' : '<button class="btn sm ghost" data-d="save">Save</button><button class="btn sm ghost" data-d="suspend">Suspend</button>'}${d.status === 'pending' ? '<button class="btn sm ghost" data-d="reject">Reject</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No dealer applications yet. Send dealers the link to the Quote portal (portal.html).</td></tr>'}
  </tbody></table></div></div>
  <div class="card tbl-card"><div class="spread" style="padding:12px 14px 0"><h3>Commission register — direct supply</h3><span class="muted">${com.rows.length} quotation(s) · due ${com.rows.filter(r => ['customer_paid', 'invoice_received'].includes(r.status)).reduce((a, r) => a + (r.commission || 0), 0).toLocaleString('en-IN')} INR</span></div>
  <div class="tw"><table><thead><tr><th>Quotation</th><th>Channel partner</th><th>Customer</th><th class="n">Customer value</th><th class="n">Commission</th><th class="n">ADONI net</th><th>Status</th><th></th></tr></thead><tbody>
  ${com.rows.map(r => `<tr data-q="${esc(r.id)}"><td class="mono"><a href="approve.html?id=${encodeURIComponent(r.id)}">${esc(r.number)}${r.rev ? ' R' + r.rev : ''}</a><br><small class="muted">${esc(r.date)}</small></td><td>${esc(r.dealer)} <span class="pill">${esc(r.dealer_code || '')}</span></td><td>${esc(r.customer || '')}</td>
    <td class="n">${money(r.customer_value, r.currency)}</td><td class="n"><b>${money(r.commission, r.currency)}</b></td><td class="n">${money(r.adoni_net, r.currency)}</td>
    <td><select data-cs>${['draft', ...com.states].map(x => `<option value="${x}" ${x === r.status ? 'selected' : ''} ${x === 'draft' ? 'disabled' : ''}>${x.replace(/_/g, ' ')}</option>`).join('')}</select><input data-cn value="${esc(r.note || '')}" placeholder="note (invoice no., UTR …)" style="margin-top:4px"></td>
    <td><button class="btn sm ghost" data-csave>Save</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">No direct-supply quotations yet. A dealer picks "Direct supply by ADONI TECH" when he creates a quotation in the Quote portal.</td></tr>'}
  </tbody></table></div></div>`;
  $('#tSave').onclick = async () => { await api('admin/settings', { method: 'PUT', body: { 'dealer.discount_pct': $('#tDisc').value, 'dealer.max_discount_pct': $('#tMax').value, 'freight.rate_per_kg': $('#tFr').value } }); $('#tSaved').textContent = 'Saved — applies to new quotations.'; };
  $$('[data-csave]').forEach(b => b.onclick = async () => { const tr = b.closest('tr');
    try { await api('admin/commission/' + encodeURIComponent(tr.dataset.q), { method: 'PATCH', body: { status: tr.querySelector('[data-cs]').value, note: tr.querySelector('[data-cn]').value } }); show(); } catch (e) { alert(e.message); } });
  $('#dSave').onclick = async () => { const ga = $('#dGa').value.trim(); if (ga && !/^G-[A-Z0-9]{4,}$/i.test(ga)) { alert('Google Analytics ID looks like G-ABC123XYZ'); return; }
    await api('admin/settings', { method: 'PUT', body: { 'dealer.cities': $('#dCities').value.split(/[\n;]+/).map(x => x.trim()).filter(Boolean).join('; '), 'dealer.cities_note': $('#dNote').value.trim(), 'analytics.ga_id': ga.toUpperCase() } });
    $('#dSaved').textContent = 'Saved — the page updates within 2 minutes.'; };
  $$('[data-d]').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr'), email = tr.dataset.e, f = {}; tr.querySelectorAll('[data-f]').forEach(i => { f[i.dataset.f] = i.value; });
    try {
      if (b.dataset.d === 'save') await api('admin/dealers/' + encodeURIComponent(email), { method: 'PUT', body: f });
      else { if (b.dataset.d !== 'approve' && !confirm(b.dataset.d + ' this dealer?')) return; const r = await api('admin/dealers/' + encodeURIComponent(email) + '/decide', { method: 'POST', body: { decision: b.dataset.d, ...f } }); if (b.dataset.d === 'approve') alert(`Approved as ${r.dealer.code}. ${r.mail ? 'The dealer has been e-mailed.' : 'The approval mail could not be sent — please tell him to sign in again.'}`); }
      show();
    } catch (e) { alert(e.message); }
  });
}

/* ---------------- DAMPA AI assistant: conversations, files, usage ---------------- */
async function dampaTab() {
  const [d, st] = await Promise.all([api('admin/assistant'), api('admin/settings')]);
  const sv = k => ((st.find(r => r.key === k) || {}).value || '');
  const c = d.config, u = d.usage;
  const status = c.enabled ? say('ok', `<b>${esc(c.name)}</b> is live on every page (model ${esc(c.model)}).`) : !c.key ? say('warn', `<b>${esc(c.name)}</b> is built but not connected: add the environment variable <b>ANTHROPIC_API_KEY</b> in Netlify (Site configuration → Environment variables), then redeploy. Until then only admin sees the chat button.`) : say('warn', `${esc(c.name)} is switched off in settings.`);
  V().innerHTML = `${status}
  <div class="stat"><div><b>$${(u.usd || 0).toFixed(2)}</b><span>API cost this month (cap $${c.monthly_usd})</span></div><div><b>${u.conversations || 0}</b><span>conversations this month</span></div><div><b>${u.messages || 0}</b><span>AI calls this month</span></div><div><b>${d.conversations.filter(x => x.rfq).length}</b><span>chats that became RFQs</span></div></div>
  <div class="card"><h3>Settings</h3><div class="grid">
    <div><label>Name</label><input id="aName" value="${esc(sv('assistant.name') || 'DAMPA')}"></div><div><label>Tagline</label><input id="aTag" value="${esc(sv('assistant.tagline'))}"></div>
    <div><label>Model</label><select id="aModel">${['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-5-5'].map(m => `<option ${m === c.model ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div><label>Monthly cap (USD)</label><input id="aCap" type="number" value="${esc(sv('assistant.monthly_cap_usd') || 40)}"></div>
    <div><label>Messages/day — visitor</label><input id="aVis" type="number" value="${esc(sv('assistant.daily_limit_visitor') || 25)}"></div><div><label>Messages/day — signed-in</label><input id="aUsr" type="number" value="${esc(sv('assistant.daily_limit_user') || 120)}"></div>
    <div><label>On / off</label><select id="aOn"><option value="1" ${sv('assistant.enabled') !== '0' ? 'selected' : ''}>On</option><option value="0" ${sv('assistant.enabled') === '0' ? 'selected' : ''}>Off</option></select></div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" id="aSave">Save</button><span id="aSaved" class="muted"></span></div>
    <p class="hint">Sonnet 5 gives the best engineering answers (~US$0.01 per message). Haiku 4.5 costs about half and answers faster. At the cap ${esc(c.name)} pauses until next month and points visitors to the selectors and sales@adonitech.co.in.</p></div>
  <div class="card tbl-card"><h3>Conversations</h3><div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>Page</th><th>First message</th><th class="n">Turns</th><th class="n">Files</th><th>RFQ</th><th class="n">Cost $</th><th></th></tr></thead><tbody>
    ${d.conversations.map(x => `<tr><td>${dt(x.updated_at || x.created_at)}</td><td><small>${esc(x.user || 'visitor')}</small></td><td><small>${esc(x.page || '')}</small></td><td>${esc(x.title || '')}</td><td class="n">${x.turns}</td><td class="n">${x.files || ''}</td><td class="mono">${esc(x.rfq || '')}</td><td class="n">${(x.usd || 0).toFixed(3)}</td><td><button class="btn sm ghost" data-cv="${esc(x.id)}">Open</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">No conversations yet.</td></tr>'}
  </tbody></table></div></div><div id="cvOut"></div>`;
  $('#aSave').onclick = async () => { await api('admin/settings', { method: 'PUT', body: { 'assistant.name': $('#aName').value.trim() || 'DAMPA', 'assistant.tagline': $('#aTag').value.trim(), 'assistant.model': $('#aModel').value, 'assistant.monthly_cap_usd': $('#aCap').value, 'assistant.daily_limit_visitor': $('#aVis').value, 'assistant.daily_limit_user': $('#aUsr').value, 'assistant.enabled': $('#aOn').value } }); $('#aSaved').textContent = 'Saved.'; };
  $$('[data-cv]').forEach(b => b.onclick = async () => {
    const cv = await api('admin/assistant/conv/' + encodeURIComponent(b.dataset.cv));
    $('#cvOut').innerHTML = `<div class="card"><div class="spread"><h3>${esc(cv.user ? cv.user.email : 'Visitor')} · ${dt(cv.created_at)}</h3><span class="muted">${esc(cv.page || '')}${cv.rfq_number ? ' · RFQ ' + esc(cv.rfq_number) : ''}</span></div>
      ${cv.files.length ? `<p><b>Files sent:</b> ${cv.files.map(f => `<a href="/api/admin/assistant/file?key=${encodeURIComponent(f.key)}&token=${encodeURIComponent(AUTH.token)}" target="_blank">${esc(f.name)}</a> <small class="muted">(${(f.bytes / 1024).toFixed(0)} kB)</small>`).join(' · ')}</p>` : ''}
      <div class="log" style="max-height:520px">${cv.transcript.map(m => `<b>${m.role === 'user' ? 'USER' : m.role === 'tool' ? '  ⚙ tool' : esc(c.name)}:</b> ${esc(m.text)}`).join('\n\n')}</div></div>`;
    $('#cvOut').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ---------------- pricing & costing (admin + settings pricing.users) ---------------- */
async function pricing() {
  let sum;
  try { sum = await api('admin/pricing/summary'); }
  catch (e) { V().innerHTML = say('warn', esc(e.message)); return; }
  V().innerHTML = `<div class="stat">${sum.map(t => `<div><b>${t.priced}/${t.rows}</b><span>${esc(t.name)} priced</span></div>`).join('')}</div>
  <div class="card"><div class="spread"><h3>Price &amp; costing workbook</h3><div class="row"><a class="btn" href="/api/admin/pricing/export.xlsx?token=${encodeURIComponent(AUTH.token)}">Download Excel (all tables)</a></div></div>
    <p class="hint">One sheet per product table: <b>price_inr</b> (list), <b>dealer_inr</b>, indicative USD, lead time, status, and the costing columns (basis, file price, estimate, margin, and for rubber mounts the moulding / hardware / mould build-up). Edit in Excel — keep the <b>key</b> column — then upload the same file here. Only price, lead time, status and the costing columns are taken from the upload; engineering data is never changed. Check first shows what would change without saving.</p>
    <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap"><input type="file" id="prFile" accept=".xlsx,.xls,.csv"><button class="btn ghost" id="prCheck">Check (no save)</button><button class="btn navy" id="prApply">Upload &amp; apply</button></div><div id="prOut" style="margin-top:10px"></div></div>
  <div class="card"><div class="spread"><h3>Browse</h3><select id="prTable" style="width:auto">${sum.map(t => `<option value="${t.table}">${esc(t.name)}</option>`).join('')}</select></div><div class="tw" id="prView"></div></div>`;
  const put = r => `<div class="log">${esc(JSON.stringify(r, null, 1))}</div>`;
  const send = async dry => {
    const f = $('#prFile').files[0]; if (!f) { alert('Choose the Excel or CSV file first'); return; }
    $('#prOut').innerHTML = say('blue', dry ? 'Checking…' : 'Uploading…');
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f); });
    try { const r = await api('admin/pricing/import', { method: 'POST', body: { filename: f.name, base64: b64, dry } });
      const lines = Object.entries(r.tables || {}).map(([t, x]) => `<b>${esc(t)}</b>: ${x.rows} rows read, ${x.changed} values ${dry ? 'would change' : 'changed'}${x.unknown.length ? ', ' + x.unknown.length + ' unknown keys ignored' : ''}${x.errors.length ? '<br><span style="color:#B42318">' + x.errors.map(esc).join('<br>') + '</span>' : ''}${x.warnings.length ? '<br><small class="muted">' + x.warnings.map(esc).join('<br>') + '</small>' : ''}`);
      $('#prOut').innerHTML = say(r.ok ? (dry ? 'blue' : 'ok') : 'bad', (r.errors || []).map(esc).join('<br>') + lines.join('<br>') + (r.ok && !dry ? '<br><b>Applied.</b> Prices are live immediately; the shipped CSVs on the PC are unchanged until the next revision is committed.' : ''));
      if (!dry && r.ok) show();
    } catch (e) { $('#prOut').innerHTML = say('bad', esc(e.message)); }
  };
  $('#prCheck').onclick = () => send(true); $('#prApply').onclick = () => send(false);
  const browse = async () => {
    const rows = await api('admin/pricing/table/' + $('#prTable').value);
    $('#prView').innerHTML = `<table><thead><tr><th>Key</th><th>Model</th><th>Series</th><th class="n">List ₹</th><th class="n">Dealer ₹</th><th class="n">Lead d</th><th>Basis</th><th class="n">File ₹</th><th class="n">Estimate ₹</th><th class="n">Margin %</th><th>Status</th><th>Note</th></tr></thead><tbody>${rows.map(r => `<tr><td class="mono">${esc(r.key)}</td><td>${esc(r.model)}</td><td><small>${esc(r.series)}</small></td><td class="n"><b>${fmt(Number(r.price_inr) || 0)}</b></td><td class="n">${r.dealer_inr ? fmt(Number(r.dealer_inr)) : '—'}</td><td class="n">${esc(r.lead_time_days)}</td><td><span class="pill ${r.basis === 'file' ? 'ok' : r.basis === 'cost' ? 'brand' : ''}">${esc(r.basis || '—')}</span></td><td class="n">${r.file_price ? fmt(Number(r.file_price)) : '—'}</td><td class="n">${r.estimate ? fmt(Number(r.estimate)) : '—'}</td><td class="n">${esc(r.margin_pct)}</td><td>${esc(r.status)}</td><td><small class="muted">${esc(String(r.note).slice(0, 90))}</small></td></tr>`).join('')}</tbody></table>`;
  };
  $('#prTable').onchange = browse; browse();
}

/* ---------------- quotations ---------------- */
async function quotes() {
  const rows = await api('admin/quotations');
  V().innerHTML = `<div class="card tbl-card"><div class="spread"><h3>Quotations</h3><a class="btn sm ghost" href="/api/admin/export/quotations.csv?token=${encodeURIComponent(AUTH.token)}">Export CSV</a></div><div class="tw"><table><thead><tr><th>Number</th><th>Rev</th><th>Date</th><th>Customer</th><th>Issued by</th><th>Cur</th><th class="n">Grand total</th><th>Status</th><th>Sent</th><th></th></tr></thead><tbody>
  ${rows.map(q => `<tr><td class="mono">${esc(q.number)}</td><td>${q.rev}</td><td>${q.date}</td><td>${esc(q.customer || '')}</td><td><small>${esc(String(q.issuer || 'adoni').replace(/^adoni:?/, 'ADONI TECH ').replace(/^dealer:/, 'Dealer: ').replace(/^direct:/, 'Direct via '))}</small>${q.special ? ` <span class="pill ${q.special === 'approved' ? 'ok' : q.special === 'pending' ? 'brand' : 'bad'}">special ${esc(q.special)}</span>` : ''}</td><td>${q.currency}</td><td class="n">${money(q.grand_total, q.currency)}</td><td><span class="pill ${q.status === 'sent' ? 'ok' : 'brand'}">${q.status}</span></td><td>${dt(q.sent_at)}</td>
    <td class="row"><button class="btn sm" data-open="${esc(q.id)}">Open</button><a class="btn sm ghost" href="/api/admin/quotation/${encodeURIComponent(q.id)}/pdf?token=${encodeURIComponent(AUTH.token)}" target="_blank">PDF</a></td></tr>`).join('') || '<tr><td colspan="10" class="muted">None yet.</td></tr>'}</tbody></table></div></div>`;
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
    <div class="row" style="gap:18px;align-items:center;flex-wrap:wrap"><label><b>Whole folder</b> (pick <span class="mono">GA-LIBRARY</span> once — all series are uploaded, only changed files are re-sent):<br><input type="file" id="gaFolder" webkitdirectory directory multiple></label>
    <label><b>Individual PDFs</b>:<br><input type="file" id="gaFiles" accept="application/pdf" multiple></label>
    <label><input type="checkbox" id="gaForce"> re-upload files that are already in the app (after a drawing revision)</label></div><div id="gaOut" style="margin-top:8px"></div></div>
  <div class="card"><h3>Missing in the app (${ga.missing.length})</h3><div class="log">${ga.missing.slice(0, 400).map(esc).join('\n') || 'none'}</div></div>`;
  $('#sync').onclick = async () => { $('#syncOut').innerHTML = say('blue', 'Syncing… (up to 25 s per run; large libraries finish over several runs)'); try { const r = await api('admin/drive/sync', { method: 'POST' }); $('#syncOut').innerHTML = say(r.ok ? 'ok' : 'bad', `pulled ${r.pulled}, unchanged ${r.unchanged}, pushed ${r.pushed}${r.errors.length ? '<br>' + r.errors.map(esc).join('<br>') : ''}`); } catch (e) { $('#syncOut').innerHTML = say('bad', esc(e.message)); } };
  const readB64 = blob => new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.onerror = () => j(fr.error); fr.readAsDataURL(blob); });
  const CHUNK = 3 * 1024 * 1024;   // raw bytes per request; base64 makes it ~4 MB, under the 6 MB function limit
  const sendOne = async (f, path) => {
    if (f.size <= CHUNK) return api('admin/ga', { method: 'POST', body: { path, base64: await readB64(f) } });
    const total = Math.ceil(f.size / CHUNK), id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); let r;
    for (let i = 0; i < total; i++) r = await api('admin/ga/chunk', { method: 'POST', body: { path, upload_id: id, index: i, total, base64: await readB64(f.slice(i * CHUNK, (i + 1) * CHUNK)) } });
    return r;
  };
  const uploadGa = async (files, pathOf) => {
    const have = new Set(ga.uploaded_paths || []); const force = $('#gaForce').checked;
    const all = [...files].filter(f => /\.pdf$/i.test(f.name));
    const excluded = all.filter(f => /(^|\/)_/.test(f.webkitRelativePath || '')), list = all.filter(f => !excluded.includes(f));
    const todo = list.filter(f => force || !have.has(pathOf(f)));
    const skipped = list.length - todo.length, out = []; let done = 0;
    const show = () => { $('#gaOut').innerHTML = `<div class="log">${done}/${todo.length} sent · ${skipped} already in the app · ${excluded.length} in _ folders ignored\n${out.slice(-40).map(esc).join('\n')}</div>`; };
    show();
    const queue = todo.slice();
    const worker = async () => { while (queue.length) { const f = queue.shift(), path = pathOf(f);
      let ok = false, err = '';
      for (let attempt = 0; attempt < 2 && !ok; attempt++) { try { const r = await sendOne(f, path); out.push(`✓ ${r.path} (${(r.bytes / 1024).toFixed(0)} kB${r.chunks ? ', ' + r.chunks + ' parts' : ''})`); ok = true; } catch (e) { err = e.message; } }
      if (!ok) out.push(`✗ ${path}: ${err}`);
      done++; show(); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    const failed = out.filter(x => x[0] === '✗');
    $('#gaOut').innerHTML = `<div class="log">Done: ${todo.length} sent, ${todo.length - failed.length} uploaded, ${failed.length} failed · ${skipped} already in the app · ${excluded.length} in _ folders ignored\n${failed.map(esc).join('\n')}</div><p><a href="#drawings" onclick="location.reload()">Refresh counts</a></p>`;
  };
  $('#gaFiles').onchange = () => uploadGa($('#gaFiles').files, f => `${f.name.split(/[-\s]/)[0].toUpperCase()}/${f.name}`);
  $('#gaFolder').onchange = () => uploadGa($('#gaFolder').files, f => { const parts = (f.webkitRelativePath || f.name).split('/'); return parts.length >= 2 ? parts.slice(-2).join('/') : `${f.name.split(/[-\s]/)[0].toUpperCase()}/${f.name}`; });
}

/* ---------------- users & activity ---------------- */
async function users() {
  const [us, au] = await Promise.all([api('admin/users'), api('admin/audit?days=14')]);
  V().innerHTML = `<div class="card tbl-card"><h3>Logins</h3><p class="hint">Roles come from settings: <b>sales.emails</b> / <b>sales.domains</b> see prices; admin addresses are set by the ADMIN_EMAILS environment variable.</p><div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Logins</th><th>Last login</th></tr></thead><tbody>${us.map(u => `<tr><td>${esc(u.name || '')}</td><td>${esc(u.email)}</td><td><span class="pill ${u.role === 'admin' ? 'brand' : ''}">${u.role}</span></td><td class="n">${u.logins}</td><td>${dt(u.last_login)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">nobody yet</td></tr>'}</tbody></table></div></div>
  <div class="card tbl-card"><div class="spread"><h3>Activity (14 days)</h3><a class="btn sm ghost" href="/api/admin/export/rfqs.csv?token=${encodeURIComponent(AUTH.token)}">Export RFQs CSV</a></div><div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Ref</th><th>Detail</th></tr></thead><tbody>${au.map(a => `<tr><td>${dt(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td class="mono">${esc(a.ref)}</td><td><small>${esc(a.detail)}</small></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- tools ---------------- */
async function tools() {
  V().innerHTML = `<div class="card"><h3>Mail</h3><div class="row"><button class="btn ghost" id="mv">Verify SMTP</button><button class="btn ghost" id="mt">Send me a test mail</button></div><div id="mOut"></div></div>
  <div class="card"><h3>CRM (UnitePro)</h3><p class="hint">Every RFQ is pushed as a lead when <b>crm.enabled=1</b> (Settings) and the env var <b>UNITEPRO_TOKEN</b> is set on Netlify.</p><div class="row"><button class="btn ghost" id="cs">Status</button><button class="btn ghost" id="cd">Preview test lead</button><button class="btn" id="ct">Push a test lead</button></div><div id="cOut"></div></div>
  <div class="card"><h3>Exchange rate</h3><div class="row"><button class="btn ghost" id="fx">Show current</button><button class="btn ghost" id="fxr">Refresh from source</button></div><div id="fxOut"></div></div>
  <div class="card"><h3>Health</h3><div class="row"><button class="btn ghost" id="hl">Check</button></div><div id="hOut"></div></div>`;
  const put = (id, r) => $(id).innerHTML = `<div class="log">${esc(JSON.stringify(r, null, 2))}</div>`;
  $('#mv').onclick = async () => put('#mOut', await api('admin/mail/verify')); $('#mt').onclick = async () => put('#mOut', await api('admin/mail/test', { method: 'POST' }));
  $('#cs').onclick = async () => put('#cOut', await api('admin/crm/status')); $('#cd').onclick = async () => put('#cOut', await api('admin/crm/test', { method: 'POST', body: { dry: true } })); $('#ct').onclick = async () => put('#cOut', await api('admin/crm/test', { method: 'POST', body: {} }));
  $('#fx').onclick = async () => put('#fxOut', await api('admin/fx')); $('#fxr').onclick = async () => put('#fxOut', await api('admin/fx/refresh', { method: 'POST' }));
  $('#hl').onclick = async () => put('#hOut', await api('health'));
}
boot().catch(err);
