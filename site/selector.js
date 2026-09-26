'use strict';
/* Crane buffer & industrial shock absorber selector — front-end. Calculation runs on the server (lib/engine.js). */
const S = (() => { try { return JSON.parse(localStorage.getItem('impactcal') || '{}'); } catch { return {}; } })();
const save = () => { try { localStorage.setItem('impactcal', JSON.stringify(S)); } catch {} };
let META = null, RESULT = null, CHOSEN = null, GROUP = 'crane', CASE = null, EXPANDED = false, SERIES = new Set();
const TOP = 10;

const CASE_ART = {
  C1: ['C1.png', 'case_C1', 'case_C1_sub'], C2: ['C2.png', 'case_C2', 'case_C2_sub'], C3: ['C3.png', 'case_C3', 'case_C3_sub'], C4: ['C4.png', 'case_C4', 'case_C4_sub'],
  I1: ['I1.png', 'case_I1', 'case_I1_sub'], I2: ['I2.png', 'case_I2', 'case_I2_sub'], I3: ['I3.png', 'case_I3', 'case_I3_sub'], I4: ['I4.png', 'case_I4', 'case_I4_sub'],
  I5: ['I5.png', 'case_I5', 'case_I5_sub'], I6: ['I6.svg', 'case_I6', 'case_I6_sub'], I7: ['I7.png', 'case_I7', 'case_I7_sub'], I8: ['I8.png', 'case_I8', 'case_I8_sub'],
  I9: ['I9.png', 'case_I9', 'case_I9_sub'], I10: ['I10.svg', 'case_I10', 'case_I10_sub'], I11: ['I11.png', 'case_I11', 'case_I11_sub'],
};
const F = { m: ['f_m', 'kg', 'h_m'], v: ['f_v', 'm/min', 'h_v'], v_ms: ['f_v_ms', 'm/s', ''], m2: ['f_m2', 'kg', ''], v2: ['f_v2', 'm/min', ''],
  P: ['f_P', 'kW', 'h_P'], H_M: ['f_H_M', '–', 'h_H_M'], F: ['f_F', 'N', 'h_F'], C: ['f_C', '1/h', ''], n: ['f_n', '–', ''], mu: ['f_mu', '–', ''], H: ['f_H', 'm', ''],
  beta: ['f_beta', '°', ''], J: ['f_J', 'kg·m²', ''], omega: ['f_omega', 'rad/s', ''], M_t: ['f_M_t', 'N·m', ''], r: ['f_r', 'm', ''], R: ['f_R', 'm', ''],
  temp_min: ['f_temp_min', '°C', ''], temp_max: ['f_temp_max', '°C', ''], max_stroke: ['f_max_stroke', 'mm', 'h_max_stroke'] };
const CASE_FIELDS = { C1: ['m', 'v', 'P', 'H_M', 'C', 'n'], C2: ['m', 'v', 'P', 'H_M', 'C', 'n'], C3: ['m', 'v', 'm2', 'v2', 'P', 'H_M', 'C', 'n'], C4: ['m', 'v', 'm2', 'v2', 'P', 'H_M', 'C', 'n'],
  I1: ['m', 'v_ms', 'C', 'n'], I2: ['m', 'v_ms', 'F', 'C', 'n'], I3: ['m', 'v_ms', 'P', 'H_M', 'C', 'n'], I4: ['m', 'v_ms', 'mu', 'C', 'n'], I5: ['m', 'H', 'C', 'n'], I6: ['m', 'v_ms', 'beta', 'mu', 'C', 'n'],
  I7: ['J', 'omega', 'M_t', 'r', 'R', 'C', 'n'], I8: ['J', 'omega', 'm', 'v_ms', 'M_t', 'r', 'R', 'C', 'n'], I9: ['m', 'v_ms', 'F', 'r', 'R', 'C', 'n'], I10: ['m', 'v_ms', 'F', 'C', 'n'], I11: ['m', 'v_ms', 'M_t', 'r', 'C', 'n'] };
const DEF = { H_M: 2.5, n: 2, C: 20, temp_min: -10, temp_max: 60 };
const art = id => 'img/cases/' + (CASE_ART[id] ? CASE_ART[id][0] : 'I1.png');
const COUNTRIES = ['India', 'United States', 'Germany', 'United Kingdom', 'France', 'Spain', 'Italy', 'Netherlands', 'Korea, Republic of', 'Japan', 'China', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Indonesia', 'Australia', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Brazil', 'Mexico', 'Canada', 'Turkey', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Other'];

function focusNext(sel) { const el = $(sel); if (!el) return; el.classList.remove('focus'); void el.offsetWidth; el.classList.add('focus'); setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); setTimeout(() => el.classList.remove('focus'), 2600); }
function step(n) { $$('.step').forEach(s => s.classList.toggle('on', s.dataset.s == n)); $$('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p != n)); window.scrollTo({ top: 0, behavior: 'smooth' }); }

let ROLLED = false;   // case grid rolled up after a pick so the next choices are in view
function drawPicker() {
  const cs = META.cases.filter(c => c.group === GROUP);
  const grid = $('#caseGrid');
  if (ROLLED && CASE && cs.some(c => c.id === CASE)) {
    const a = CASE_ART[CASE] || [null, '', ''];
    grid.classList.add('rolled');
    grid.innerHTML = `<div class="chosen-strip"><img src="${art(CASE)}" alt=""><span><small class="muted">${esc(t('chosen_case'))}</small><br><b>${esc(t(a[1]))}</b> <span class="muted">— ${esc(t(a[2]))}</span></span><button class="btn ghost small" id="changeCase">${esc(t('change_case'))}</button></div>`;
    $('#changeCase').onclick = () => { ROLLED = false; drawPicker(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  } else {
    grid.classList.remove('rolled');
    grid.innerHTML = cs.map(c => { const a = CASE_ART[c.id] || [null, c.title, '']; return `<button class="pick ${c.id === CASE ? 'on' : ''}" data-case="${c.id}"><span class="thumb"><img src="${art(c.id)}" alt="" loading="lazy"></span><b>${esc(t(a[1]))}</b><small>${esc(t(a[2]))}</small></button>`; }).join('');
    $$('#caseGrid .pick').forEach(b => b.onclick = () => { CASE = b.dataset.case; S.case = CASE; save(); ROLLED = true; drawPicker(); fields(); focusNext('#seriesBlock'); });
  }
  const ss = META.series.filter(s => s.group === GROUP);
  $('#seriesGrid').innerHTML = ss.map(s => `<button class="pick ${SERIES.has(s.series) ? 'on' : ''}" data-series="${s.series}"><span class="thumb"><img src="${s.icon}" alt=""></span><b>${esc(s.series)}</b><small>${esc(s.title.replace(/^[A-Z]+ — /, ''))} · ${s.n} ${t('models')}</small></button>`).join('');
  $$('#seriesGrid .pick').forEach(b => b.onclick = () => { const k = b.dataset.series; SERIES.has(k) ? SERIES.delete(k) : SERIES.add(k); S.series = [...SERIES]; save(); drawPicker(); });
}
function fields() {
  const a = CASE_ART[CASE] || [null, '', ''];
  $('#dutyTitle').textContent = t(a[1]); $('#dutyPic').src = art(CASE);
  const keys = [...(CASE_FIELDS[CASE] || ['m', 'v_ms', 'C', 'n']), 'temp_min', 'temp_max', 'max_stroke'];
  $('#dutyFields').innerHTML = keys.map(k => { const [lab, unit, hint] = F[k]; const v = S['d_' + k] ?? DEF[k] ?? '';
    return `<div><label>${esc(t(lab))} <span class="muted">${unit}</span></label><input id="d_${k}" data-k="${k}" type="number" step="any" inputmode="decimal" value="${v}">${hint ? `<div class="muted" style="margin-top:3px;font-size:12px">${esc(t(hint))}</div>` : ''}</div>`; }).join('');
  $$('#dutyFields input').forEach(i => i.addEventListener('input', () => { S['d_' + i.dataset.k] = i.value; save(); }));
}
function duty() {
  const g = k => { const e = $('#d_' + k); return e && e.value !== '' ? Number(e.value) : undefined; };
  const d = { n: g('n') || 1, C: g('C') || 0, H_M: g('H_M') ?? 2.5, temp_min: g('temp_min') ?? -10, temp_max: g('temp_max') ?? 60 };
  for (const k of ['m', 'm2', 'F', 'mu', 'H', 'J', 'omega', 'M_t', 'r', 'R']) { const v = g(k); if (v !== undefined) d[k] = v; }
  if (g('v') !== undefined) d.v = g('v') / 60; if (g('v2') !== undefined) d.v2 = g('v2') / 60; if (g('v_ms') !== undefined) d.v = g('v_ms');
  if (g('P') !== undefined) d.P = g('P') * 1000; if (g('beta') !== undefined) d.beta = g('beta') * Math.PI / 180;
  return d;
}

async function boot() {
  await bootCommon('nav_shock');
  META = await api('meta');
  $('#standard').innerHTML = META.standards.map(s => `<option value="${s.code}">${esc(s.name)}</option>`).join('');
  $('#rmount').innerHTML = '<option value="">—</option>' + META.accessories.filter(a => a.kind === 'mounting').map(a => `<option>${esc(a.name)}</option>`).join('');
  $('#rcap').innerHTML = '<option value="">—</option>' + META.accessories.filter(a => a.kind === 'cap').map(a => `<option>${esc(a.name)}</option>`).join('');
  $('#pcountry').innerHTML = COUNTRIES.map(c => `<option>${c}</option>`).join('');
  const c = META.company;
  $('#rAddr').innerHTML = `${esc(c.addr1 || '')}, ${esc(c.addr2 || '')}<br>${esc(c.city || '')} ${esc(c.pincode || '')} · ${esc(c.state_name || '')}, India<br>${esc(c.tel || '')} · ${esc(c.phone || '')} · ${esc(c.email || '')}<br><b>GSTIN ${esc(c.gstin || '')}</b>`;
  const qs = new URLSearchParams(location.search);
  SERIES = new Set(S.series || []);
  setGroup(qs.get('group') || S.group || 'crane');
  for (const k of ['pname', 'pcust', 'pcontact', 'pref', 'pequip', 'pby', 'pemail', 'pphone', 'pgstin', 'pcountry']) if (S[k]) $('#' + k).value = S[k];
  $$('.card input, .card textarea, .card select#pcountry').forEach(i => i.addEventListener('input', () => { S[i.id] = i.value; save(); }));
  $('#pcountry').addEventListener('change', countryUi); countryUi();
  if (META.prices) { $('#curSel').classList.remove('hidden'); $$('.price-col').forEach(e => e.classList.remove('hidden')); }
  document.addEventListener('langchange', () => { drawPicker(); fields(); stdNote(); if (RESULT) renderRows(); });
}
function countryUi() { const india = ($('#pcountry').value || 'India') === 'India'; $('#gstinBox').style.opacity = india ? 1 : .5; $('#pgstin').disabled = !india; if (META && META.prices) $('#curSel').value = india ? 'INR' : 'USD'; }
function setGroup(g) {
  GROUP = g; S.group = g; save();
  $('#tabCrane').classList.toggle('on', g === 'crane'); $('#tabInd').classList.toggle('on', g === 'industrial');
  const cs = META.cases.filter(c => c.group === g);
  if (!cs.some(c => c.id === CASE)) CASE = cs[0].id;
  $('#standard').value = g === 'crane' ? 'IS3177' : 'NONE';
  $('#rptTitle').textContent = g === 'crane' ? 'CRANE BUFFER SELECTION' : 'SHOCK ABSORBER SELECTION';
  drawPicker(); fields(); stdNote();
}
function stdNote() { const s = META.standards.find(x => x.code === $('#standard').value); $('#stdNote').innerHTML = `<b>${esc(s.name)}</b> — ${t('design_speed')} ${(s.speed_factor * 100).toFixed(0)}% ${t('of_rated')}` + (s.decel_limit ? `, ${t('decel_limit')} ${s.decel_limit} m/s²` : `, ${t('no_decel_limit')}`) + `.<br><span class="muted">${esc(s.note)}</span>`; }

async function calculate() {
  const body = { duty: duty(), case_id: CASE, standard: $('#standard').value, series: [...SERIES].filter(s => META.series.some(x => x.series === s && x.group === GROUP)), limit: 200, currency: $('#curSel').value };
  const ms = $('#d_max_stroke'); if (ms && ms.value) body.max_stroke_mm = Number(ms.value);
  RESULT = await api('select', { method: 'POST', body });
  CHOSEN = null; EXPANDED = false; $('#toRfq').disabled = $('#dlReport').disabled = true;
  const d = RESULT.duty_applied;
  $('#dutyOut').innerHTML = !d ? `<div class="note bad">${t('no_result')}</div>`
    : `<div class="note ok"><b>${RESULT.count} ${t('models_pass')}</b> ${t('design_velocity')} <b>${d.v.toFixed(3)} m/s</b> · ${t('ke_per_buffer')} <b>${fmt(d.E_k)} Nm</b><br><span class="muted">${esc(RESULT.standard.name)} · ${esc(t(CASE_ART[CASE][1]))}. ${t('stroke_dep_note')}</span></div>`;
  $('#picks').innerHTML = RESULT.candidates.filter(c => c.picks.length).map(c => `<span class="pill brand" style="margin-left:6px">${esc(t('pick_' + c.picks[0].replace(/[^a-z]/g, '_')))}: ${esc(c.model)}</span>`).join('');
  renderRows(); step(4);
}
function renderRows() {
  const all = RESULT.candidates, rows = EXPANDED ? all : all.slice(0, TOP), cur = RESULT.currency;
  $('#resTbl tbody').innerHTML = rows.map((c, i) => `<tr data-i="${i}"><td><input type="radio" name="pick"></td>
    <td><div class="row" style="gap:6px"><img src="${META.series.find(s => s.series === c.series)?.icon || ''}" alt="" style="height:26px"><b>${esc(c.model)}</b></div>${c.picks.map(p => ` <span class="pill brand">${esc(t('pick_' + p.replace(/[^a-z]/g, '_')))}</span>`).join('')}</td>
    <td>${esc(c.series)}</td><td class="n">${fmt(c.stroke_mm)}</td><td class="n">${fmt(c.nm_per_cycle)}</td><td class="n">${fmt(c.nm_per_hour)}</td><td class="n">${(c.u_stroke * 100).toFixed(0)}%</td><td class="n">${(c.u_hour * 100).toFixed(0)}%</td>
    <td class="n">${c.a.toFixed(2)}</td><td class="n">${(c.F_s / 1000).toFixed(1)}</td><td class="n">${fmt(c.m_e)}</td>
    ${META.prices ? `<td class="n price">${c.price != null ? money(c.price, cur) : '<span class="muted">—</span>'}</td><td class="n">${c.lead_time_days ? c.lead_time_days + ' d' : '—'}</td>` : ''}
    <td>${c.flags.map(f => `<span class="pill warn">${esc(f)}</span>`).join(' ') || `<span class="pill ok">${t('clear')}</span>`}</td></tr>`).join('');
  $$('#resTbl tbody tr').forEach(tr => tr.onclick = () => { $$('#resTbl tbody tr').forEach(x => x.classList.remove('sel')); tr.classList.add('sel'); tr.querySelector('input').checked = true; CHOSEN = rows[tr.dataset.i]; $('#toRfq').disabled = $('#dlReport').disabled = false; });
  const more = all.length - TOP, b = $('#showMore'); b.hidden = more <= 0; b.textContent = EXPANDED ? t('show_best', { n: TOP }) : t('show_more', { n: more });
}
$('#showMore').onclick = () => { EXPANDED = !EXPANDED; renderRows(); };

function buildReport() {
  if (!CHOSEN) return;
  const kv = (rows, el) => $(el).innerHTML = rows.filter(r => r[1] !== '' && r[1] != null).map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
  const stamp = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  $('#rMeta').innerHTML = `Date ${stamp}<br>${$('#pref').value ? 'Ref ' + esc($('#pref').value) + '<br>' : ''}<span class="mono">${esc(CHOSEN.model)}</span>`;
  kv([['Project', $('#pname').value], ['Customer', $('#pcust').value], ['Contact', $('#pcontact').value], ['Equipment', $('#pequip').value], ['Reference', $('#pref').value]], '#rProject');
  const std = RESULT.standard;
  kv([['Impact case', t(CASE_ART[CASE][1])], ['Standard', std.name], ['Design speed', (std.speed_factor * 100).toFixed(0) + '% of rated'], ['Deceleration limit', std.decel_limit ? std.decel_limit + ' m/s²' : 'not set by this standard']], '#rApp');
  $('#rPic').src = art(CASE);
  const g = k => { const e = $('#d_' + k); return e && e.value !== '' ? e.value : null; };
  kv((CASE_FIELDS[CASE] || []).concat(['temp_min', 'temp_max', 'max_stroke']).map(k => g(k) == null ? null : [t(F[k][0]), `${g(k)} ${F[k][1] === '–' ? '' : F[k][1]}`.trim()]).filter(Boolean), '#rInputs');
  const d = RESULT.duty_applied, c = CHOSEN;
  kv([['Design velocity', d.v.toFixed(3) + ' m/s'], ['Kinetic energy Ek', fmt(c.E_k) + ' Nm'], ['Propelling energy Ew', fmt(c.E_w) + ' Nm'], ['Total energy Et', fmt(c.E_t) + ' Nm'], ['Energy per hour Etc', fmt(c.E_tc) + ' Nm/h'],
      ['Effective mass Me = 2·Et/v²', fmt(c.m_e) + ' kg'], ['Reaction force Fs = Et/(η·S)', (c.F_s / 1000).toFixed(1) + ' kN'], ['Deceleration a = v²/(2·η·S)', c.a.toFixed(2) + ' m/s²'], ['Stopping time t', (c.t * 1000).toFixed(0) + ' ms']], '#rCalc');
  $('#rModel').innerHTML = `<thead><tr><th>Model</th><th>Type</th><th>Stroke</th><th>Rated Nm/cycle</th><th>Rated Nm/h</th><th>Utilisation</th>${META.prices ? '<th>Lead time</th>' : ''}</tr></thead><tbody><tr><td><b>${esc(c.model)}</b></td><td>${esc(c.series)}</td><td>${fmt(c.stroke_mm)} mm</td><td>${fmt(c.nm_per_cycle)}</td><td>${fmt(c.nm_per_hour)}</td><td>${(c.u_stroke * 100).toFixed(0)}% / stroke, ${(c.u_hour * 100).toFixed(0)}% / hour</td>${META.prices ? `<td>${c.lead_time_days || '—'} days</td>` : ''}</tr></tbody>`;
  $('#rFlags').innerHTML = c.flags.length ? `<div style="margin-top:6pt;font-size:9pt;color:#B7791F"><b>Notes:</b> ${c.flags.map(esc).join(' · ')}</div>` : '';
  $('#rBy').textContent = $('#pby').value || '—';
  $('#rNote').innerHTML = `Damping efficiency η = ${c.series === 'SB' ? '0.50 (spring)' : c.series === 'JHQC' ? '0.158 (polyurethane)' : '0.80 (hydraulic)'}. Effective mass from Me = 2·Et/v². Selection is subject to confirmation of the application data above. E &amp; O E.`;
  $('#report').hidden = false;
}
/* Report download is gated: name, e-mail and phone (company optional). Creates a "selection" on the server,
   mails the PDF to the customer, notifies sales and (for real-looking contacts) creates a CRM lead. */
function contactOk() {
  const miss = ['pcontact', 'pemail', 'pphone'].filter(id => !$('#' + id).value.trim());
  if (!miss.length) return true;
  step(1); miss.forEach(id => $('#' + id).classList.add('need'));
  $('#gstinMsg').innerHTML = `<div class="note bad">${esc(t('need_contact'))}</div>`;
  setTimeout(() => $('#' + miss[0]).focus(), 400);
  return false;
}
['pcontact', 'pemail', 'pphone'].forEach(id => $('#' + id).addEventListener('input', () => $('#' + id).classList.remove('need')));
async function downloadReport() {
  if (!CHOSEN || !RESULT) return;
  if (AUTH.user && !$('#pemail').value) { $('#pemail').value = AUTH.user.email; $('#pcontact').value = $('#pcontact').value || AUTH.user.name || ''; }
  if (!contactOk()) return;
  const d = RESULT.duty_applied, c = CHOSEN;
  $('#dlReport').disabled = true; $('#dlOut').textContent = t('dl_preparing');
  try {
    const r = await api('selection', { method: 'POST', body: { line: GROUP, lang: I18N.lang,
      customer: { company: $('#pcust').value, contact: $('#pcontact').value, email: $('#pemail').value, phone: $('#pphone').value, gstin: $('#pgstin').value, country: $('#pcountry').value || 'India' },
      project: { name: $('#pname').value || 'Untitled', reference: $('#pref').value, equipment: $('#pequip').value, prepared_by: $('#pby').value },
      selection: { case_id: CASE, standard: RESULT.standard.code, inputs: duty(), chosen_bk: c.bk,
        summary: { 'Impact case': t(CASE_ART[CASE][1]), 'Standard': RESULT.standard.name, 'Design velocity': d.v.toFixed(3) + ' m/s', 'Energy per impact': fmt(c.E_t) + ' Nm', 'Energy per hour': fmt(c.E_tc) + ' Nm/h', 'Effective mass': fmt(c.m_e) + ' kg', 'Deceleration': c.a.toFixed(2) + ' m/s²', 'Utilisation': `${(c.u_stroke * 100).toFixed(0)}% per stroke, ${(c.u_hour * 100).toFixed(0)}% per hour` } },
      items: [{ table: 'shock_absorbers', key: c.bk, model: c.model, qty: Number($('#d_n') && $('#d_n').value) || 1 }] } });
    const bytes = Uint8Array.from(atob(r.pdf_b64), ch => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = r.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('#dlOut').textContent = (r.mail && r.mail.ok) ? t('dl_done_mail', { n: r.number }) : t('dl_done', { n: r.number });
  } catch (e) { $('#dlOut').textContent = ''; $('#rfqOut').innerHTML = ''; alert(e.message); if (/name|e-mail|phone|contact/i.test(e.message)) { step(1); ['pcontact', 'pemail', 'pphone'].forEach(id => $('#' + id).classList.add('need')); } }
  finally { $('#dlReport').disabled = false; }
}
$('#dlReport').onclick = () => downloadReport();
/* after a request is sent: back to the first screen (contact details are kept), results cleared, message shown */
function startOver(number) {
  RESULT = null; CHOSEN = null; EXPANDED = false;
  $('#toRfq').disabled = $('#dlReport').disabled = true; $('#dlOut').textContent = ''; $('#rfqOut').innerHTML = ''; $('#rmsg').value = '';
  if ($('#resTbl')) $('#resTbl').innerHTML = ''; if ($('#resOut')) $('#resOut').innerHTML = ''; if ($('#rfqLines')) $('#rfqLines').innerHTML = '';
  step(1);
  $('#gstinMsg').innerHTML = `<div class="note ok"><b>${t('sent_title', { n: number })}</b> ${t('sent_back')}</div>`;
  setTimeout(() => { if ($('#gstinMsg').innerText.includes(number)) $('#gstinMsg').innerHTML = ''; }, 15000);
}
window.addEventListener('afterprint', () => { $('#report').hidden = true; });

function overlay(state, title, msg, closable) { const o = $('#sentOverlay'); o.hidden = false; $('#sentIcon').textContent = state === 'sending' ? '✉️' : state === 'done' ? '✅' : '⚠️'; $('#sentTitle').textContent = title; $('#sentMsg').textContent = msg || ''; $('#sentClose').hidden = !closable; }
$('#sentClose').onclick = () => { $('#sentOverlay').hidden = true; };

async function sendRfq() {
  if (!CHOSEN) return;
  const cust = { company: $('#pcust').value || $('#pname').value || 'Enquiry', contact: $('#pcontact').value, email: $('#pemail').value, phone: $('#pphone').value, gstin: $('#pgstin').value, country: $('#pcountry').value || 'India' };
  if (!cust.email || !cust.phone || !cust.contact) { $('#rfqOut').innerHTML = `<div class="note bad">${t('need_contact')}</div>`; contactOk(); return; }
  overlay('sending', t('sending'), t('sending_sub'));
  const held = new Promise(r => setTimeout(r, 900));
  try {
    const d = RESULT.duty_applied, c = CHOSEN;
    const r = await api('rfq', { method: 'POST', body: { line: GROUP, lang: I18N.lang, customer: cust,
      project: { name: $('#pname').value || 'Untitled', reference: $('#pref').value, equipment: $('#pequip').value, prepared_by: $('#pby').value },
      selection: { case_id: CASE, standard: RESULT.standard.code, inputs: duty(), chosen_bk: c.bk,
        summary: { 'Impact case': t(CASE_ART[CASE][1]), 'Standard': RESULT.standard.name, 'Design velocity': d.v.toFixed(3) + ' m/s', 'Energy per impact': fmt(c.E_t) + ' Nm', 'Energy per hour': fmt(c.E_tc) + ' Nm/h', 'Effective mass': fmt(c.m_e) + ' kg', 'Deceleration': c.a.toFixed(2) + ' m/s²', 'Utilisation': `${(c.u_stroke * 100).toFixed(0)}% per stroke, ${(c.u_hour * 100).toFixed(0)}% per hour` } },
      formats: [...$('#rfmt').selectedOptions].map(o => o.value), message: $('#rmsg').value,
      items: [{ table: 'shock_absorbers', key: c.bk, model: c.model, qty: Number($('#rqty').value) || 1, mounting: $('#rmount').value, cap: $('#rcap').value }] } });
    await held;
    overlay('done', t('sent_title', { n: r.number }), (r.ack && r.ack.ok) ? t('sent_ack') : t('sent_noack'), true);
    $('#rfqOut').innerHTML = `<div class="note ok"><b>${t('sent_title', { n: r.number })}</b> ${t('sent_note')}</div>`;
    setTimeout(() => { $('#sentOverlay').hidden = true; startOver(r.number); }, 4200);
  } catch (e) { await held; overlay('failed', t('send_failed'), e.message, true); }
}

document.addEventListener('click', e => { const g = e.target.dataset && e.target.dataset.go; if (g) step(g); });
$$('.step').forEach(s => s.addEventListener('click', () => step(s.dataset.s)));
$('#tabCrane').onclick = () => setGroup('crane'); $('#tabInd').onclick = () => setGroup('industrial');
$('#standard').onchange = stdNote; $('#curSel').onchange = () => { if (RESULT) calculate().catch(e => alert(e.message)); };
$('#calc').onclick = () => calculate().catch(e => alert(e.message));
$('#toRfq').onclick = () => { $('#rfqLines').innerHTML = `<div class="note blue" style="display:flex;gap:14px;align-items:center"><img src="${art(CASE)}" alt="" style="max-height:64px"><span><b>${esc(CHOSEN.model)}</b> — ${fmt(CHOSEN.stroke_mm)} mm, ${fmt(CHOSEN.nm_per_cycle)} Nm/cycle${META.prices && CHOSEN.price != null ? ` · <span class="price">${money(CHOSEN.price, RESULT.currency)}</span> · ${CHOSEN.lead_time_days || '—'} d` : ''}<br><span class="muted">${esc(t(CASE_ART[CASE][1]))} · ${esc(RESULT.standard.name)}</span></span></div>`; step(5); };
$('#sendRfq').onclick = () => sendRfq();
$('#loadExample').onclick = () => { Object.assign(S, { pname: 'Bay 3 gantry — end stops', pcust: 'Example Engineering Ltd.', pcontact: 'R. Kulkarni', pequip: '20 t EOT crane, 22 m span', pby: 'P. Adavani', d_m: 20000, d_v: 40, d_P: 15, d_C: 20, d_n: 2, group: 'crane', case: 'C1' }); save(); location.href = 'selector.html?group=crane'; };
$('#pgstin').addEventListener('blur', async () => { const g = $('#pgstin').value.trim(); if (!g) { $('#gstinMsg').innerHTML = ''; return; } const v = await api('gstin/' + encodeURIComponent(g));
  $('#gstinMsg').innerHTML = v.ok ? `<div class="note ok">${t('gstin_ok')} — ${esc(v.state_name)} (${v.state_code}), PAN ${esc(v.pan)}</div>` : `<div class="note bad">${t('gstin_bad')}: ${esc(v.reason)}.` + (v.suggestions && v.suggestions.length ? ` ${t('did_you_mean')} <b>${esc(v.suggestions[0])}</b>?` : '') + `</div>`; });
CASE = S.case || null;
boot().catch(e => document.body.insertAdjacentHTML('afterbegin', `<div class="note bad">${esc(e.message)}</div>`));
