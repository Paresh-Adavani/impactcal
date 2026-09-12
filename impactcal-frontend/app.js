'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const api = async (u, o) => { const r = await fetch(u, o); const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.error || r.statusText); return j; };
const fmt = (n, d = 0) => n == null || !isFinite(n) ? '—' :
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S = JSON.parse(localStorage.getItem('impactcal') || '{}');
const save = () => localStorage.setItem('impactcal', JSON.stringify(S));

let META = null, RESULT = null, CHOSEN = null, GROUP = 'crane', CASE = null, EXPANDED = false;
const TOP = 10;

/* ---------- what each picture shows, and which fields it needs ---------- */
const CASE_ART = {
  C1:['C1.png','Crane or wagon into a fixed stop','one buffer, travel drive still pushing'],
  C2:['C2.png','Into a fixed stop, buffers both ends','buffer on the crane and on the stop'],
  C3:['C3.png','Crane into crane, one side buffered','both moving, buffers on one only'],
  C4:['C4.png','Crane into crane, both buffered','buffers on both vehicles'],
  I1:['I1.png','Mass, no propelling force','carriage coasting, drive disengaged'],
  I2:['I2.png','Mass with propelling force','cylinder or drive still pushing'],
  I3:['I3.png','Mass with motor drive','motor stalls against the buffer'],
  I4:['I4.png','Mass on driven rollers','friction drive, roller conveyor'],
  I5:['I5.png','Free-falling mass','drop height H, gravity through the stroke'],
  I6:['I6.svg','Mass on an incline','gravity component plus friction'],
  I7:['I7.png','Swinging mass with propelling torque','pendulum or swing arm'],
  I8:['I8.png','Rotary index table','uniform weight about the axis'],
  I9:['I9.png','Swinging arm with propelling force','cylinder driving the arm'],
  I10:['I10.svg','Mass lowered under control','hoist overtravel, weight adds to the stroke'],
  I11:['I11.png','Swinging arm with propelling torque','uniform weight distribution'],
};
const CB_IMG = 'https://www.cranebuffer.com/wp-content/uploads/';
const AT_IMG = 'https://www.adonitech.co.in/wp-content/uploads/';
/* picture, what the family is, one line on how it works */
const SERIES_ART = {
  AC  :[AT_IMG+'2026/02/precision__3___1_-removebg-preview.png','Fixed damping',
        'Self-compensating. Damping set at the factory — pick the code 0–4 to suit the load.'],
  ACX :[AT_IMG+'2024/12/Industrial-Shock-Absorbers-2-300x200.png','Fixed damping, extended',
        'Self-compensating, more energy per cycle in the same thread size.'],
  AD  :[AT_IMG+'2025/03/DSC_2230-removebg-preview-1-1-212x300.png','Adjustable damping',
        'Damping set on installation by turning the adjustment ring.'],
  YSRA:[AT_IMG+'2025/01/industrial-shock-absorber-two-locknuts-221x300.jpg','Hydraulic, small bore',
        'Compact threaded hydraulic absorber, mounted with locknuts.'],
  AKHG:[CB_IMG+'2025/01/adonitech__7_-220x300.jpg','Hydraulic, nitrogen return',
        'Heavy crane buffer. A nitrogen chamber pushes the rod back out after impact.'],
  AKHS:[CB_IMG+'2025/02/adonitech__7___2_-removebg-preview.png','Hydraulic, spring return',
        'Heavy crane buffer. A return spring replaces the gas chamber.'],
  ED  :[CB_IMG+'2025/01/1-removebg-preview-300x200.png','Hydraulic crane buffer',
        'Heavy-duty buffer for crane and wagon end stops.'],
  EI  :[CB_IMG+'2025/01/adonitech__7_-1.jpg','Hydraulic crane buffer',
        'Industrial-duty buffer for travelling machinery.'],
  SB  :[CB_IMG+'2025/02/IMG-20250211-WA0009-221x300.jpg','Steel coil spring',
        'Spring buffer. Stores the energy and gives it back — efficiency 0.50.'],
  JHQC:[CB_IMG+'2026/01/1111-300x249.jpg','Polyurethane, non-metallic',
        'Bolted elastomer pad, no moving parts — efficiency 0.158.'],
};
const SERIES_MAX = 3;

const F = {
  m:['Mass','kg','the mass that actually reaches the buffer'],
  v:['Rated travel speed','m/min','the standard applies its own factor to this'],
  v_ms:['Impact velocity','m/s',''],
  m2:['Second mass','kg',''], v2:['Second speed','m/min',''],
  P:['Travel motor power','kW','leave blank if the drive is off at impact'],
  H_M:['Stall torque factor','–','normally 2.5'],
  F:['Propelling force','N','cylinder or drive force still acting during the stroke'],
  C:['Impacts per hour','1/h',''], n:['Buffers taking the impact','–',''],
  mu:['Friction coefficient','–',''], H:['Drop height','m',''],
  beta:['Incline angle','°',''], J:['Moment of inertia','kg·m²',''],
  omega:['Angular velocity','rad/s',''], M_t:['Torque','N·m',''],
  r:['Torque radius','m',''], R:['Buffer radius','m',''],
  temp_min:['Min. temperature','°C',''], temp_max:['Max. temperature','°C',''],
  max_stroke:['Available stroke','mm','leave blank if unconstrained'],
};
const CASE_FIELDS = {
  C1:['m','v','P','H_M','C','n'], C2:['m','v','P','H_M','C','n'],
  C3:['m','v','m2','v2','P','H_M','C','n'], C4:['m','v','m2','v2','P','H_M','C','n'],
  I1:['m','v_ms','C','n'], I2:['m','v_ms','F','C','n'], I3:['m','v_ms','P','H_M','C','n'],
  I4:['m','v_ms','mu','C','n'], I5:['m','H','C','n'], I6:['m','v_ms','beta','mu','C','n'],
  I7:['J','omega','M_t','r','R','C','n'], I8:['J','omega','m','v_ms','M_t','r','R','C','n'],
  I9:['m','v_ms','F','r','R','C','n'], I10:['m','v_ms','F','C','n'],
  I11:['m','v_ms','M_t','r','C','n'],
};
const DEF = { H_M:2.5, n:2, C:20, temp_min:-10, temp_max:60 };
const art = id => 'img/cases/' + (CASE_ART[id] ? CASE_ART[id][0] : 'I1.png');

/* ------------------------------ steps ------------------------------ */
function step(n) {
  $$('.step').forEach(s => s.classList.toggle('on', s.dataset.s == n));
  $$('[data-p]').forEach(p => p.classList.toggle('hidden', p.dataset.p != n));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- series picture menu (pick up to 3) ---------------- */
function selectedSeries() { return [...$('#series').selectedOptions].map(o => o.value); }
function setSeries(list) {
  const keep = [...new Set(list)].slice(0, SERIES_MAX);
  [...$('#series').options].forEach(o => { o.selected = keep.includes(o.value); });
  S.series = keep; save(); drawSeries();
}
function drawSeries() {
  const sel = selectedSeries(), full = sel.length >= SERIES_MAX;
  $('#seriesGrid').innerHTML = META.series.map(s => {
    const a = SERIES_ART[s.series] || ['', s.series, ''];
    const on = sel.includes(s.series);
    return `<button type="button" class="pick ${on ? 'on' : ''}" data-series="${esc(s.series)}"
      ${(!on && full) ? 'disabled' : ''}>
      <span class="thumb"><img src="${esc(a[0])}" alt="${esc(s.series)} buffer"
        loading="lazy" onerror="this.remove()"></span>
      <span class="code">${esc(s.series)}</span>
      <b>${esc(a[1])}</b><small>${esc(a[2])}</small>
      <span class="n">${s.n} models</span></button>`;
  }).join('');
  $$('#seriesGrid .pick').forEach(b => b.onclick = () => {
    const c = b.dataset.series, cur = selectedSeries();
    setSeries(cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c]);
  });
  $('#seriesCount').innerHTML = sel.length
    ? `<b>${sel.length} of ${SERIES_MAX}</b> picked — only ${sel.map(esc).join(', ')} will be offered.`
    : `Nothing picked — the whole catalogue is searched. You can pick up to ${SERIES_MAX} series.`;
}

function drawPicker() {
  const cs = META.cases.filter(c => c.group === GROUP);
  $('#caseGrid').innerHTML = cs.map(c => {
    const a = CASE_ART[c.id] || [null, c.title, ''];
    return `<button class="pick ${c.id === CASE ? 'on' : ''}" data-case="${c.id}">
      <span class="thumb"><img src="${art(c.id)}" alt="${esc(a[1])}" loading="lazy"></span>
      <b>${esc(a[1] || c.title)}</b><small>${esc(a[2] || '')}</small></button>`;
  }).join('');
  $$('#caseGrid .pick').forEach(b => b.onclick = () => { CASE = b.dataset.case; S.case = CASE; save();
    drawPicker(); fields(); });
}

function fields() {
  const a = CASE_ART[CASE] || [null, '', ''];
  $('#dutyTitle').textContent = a[1] || '';
  $('#dutyPic').src = art(CASE);
  const keys = [...(CASE_FIELDS[CASE] || ['m','v_ms','C','n']), 'temp_min','temp_max','max_stroke'];
  $('#dutyFields').innerHTML = keys.map(k => {
    const [lab, unit, hint] = F[k];
    const v = S['d_' + k] ?? DEF[k] ?? '';
    return `<div><label>${lab} <span class="muted">${unit}</span></label>
      <input id="d_${k}" data-k="${k}" type="number" step="any" value="${v}">
      ${hint ? `<div class="muted" style="margin-top:3px">${hint}</div>` : ''}</div>`;
  }).join('');
  $$('#dutyFields input').forEach(i => i.addEventListener('input',
    () => { S['d_' + i.dataset.k] = i.value; save(); }));
}

function duty() {
  const g = k => { const e = $('#d_' + k); return e && e.value !== '' ? Number(e.value) : undefined; };
  const d = { n:g('n') || 1, C:g('C') || 0, H_M:g('H_M') ?? 2.5,
              temp_min:g('temp_min') ?? -10, temp_max:g('temp_max') ?? 60 };
  for (const k of ['m','m2','F','mu','H','J','omega','M_t','r','R']) { const v = g(k); if (v !== undefined) d[k] = v; }
  if (g('v')  !== undefined) d.v  = g('v') / 60;
  if (g('v2') !== undefined) d.v2 = g('v2') / 60;
  if (g('v_ms') !== undefined) d.v = g('v_ms');
  if (g('P') !== undefined) d.P = g('P') * 1000;
  if (g('beta') !== undefined) d.beta = g('beta') * Math.PI / 180;
  return d;
}

/* ------------------------------ boot ------------------------------ */
async function boot() {
  META = await api('/api/meta');
  $('#standard').innerHTML = META.standards.map(s =>
    `<option value="${s.code}">${esc(s.name)}</option>`).join('');
  $('#series').innerHTML = META.series.map(s => `<option value="${s.series}">${s.series} (${s.n})</option>`).join('');
  $('#series').onchange = () => setSeries(selectedSeries());
  $('#seriesClear').onclick = () => setSeries([]);
  setSeries(Array.isArray(S.series) ? S.series : []);
  $('#rmount').innerHTML = '<option value="">—</option>' +
    META.accessories.filter(a => a.kind === 'mounting').map(a => `<option>${esc(a.name)}</option>`).join('');
  $('#rcap').innerHTML = '<option value="">—</option>' +
    META.accessories.filter(a => a.kind === 'cap').map(a => `<option>${esc(a.name)}</option>`).join('');
  const c = META.company;
  $('#rAddr').innerHTML = `${esc(c.addr1 || '')}, ${esc(c.addr2 || '')}<br>${esc(c.city || '')} ${esc(c.pincode || '')} · ${esc(c.state_name || '')}, India<br>
    ${esc(c.tel || '')} · ${esc(c.phone || '')} · ${esc(c.email || '')}<br><b>GSTIN ${esc(c.gstin || '')}</b>`;
  setGroup(S.group || 'crane');
  for (const k of ['pname','pcust','pcontact','pref','pequip','pby','pemail','pphone','pgstin'])
    if (S[k]) $('#' + k).value = S[k];
  $$('.card input, .card textarea').forEach(i => i.addEventListener('input', () => { S[i.id] = i.value; save(); }));
}
function setGroup(g) {
  GROUP = g; S.group = g; save();
  $('#tabCrane').classList.toggle('on', g === 'crane');
  $('#tabInd').classList.toggle('on', g === 'industrial');
  const cs = META.cases.filter(c => c.group === g);
  if (!cs.some(c => c.id === CASE)) CASE = cs[0].id;
  $('#standard').value = g === 'crane' ? 'IS3177' : 'NONE';
  drawPicker(); fields(); stdNote();
}
function stdNote() {
  const s = META.standards.find(x => x.code === $('#standard').value);
  $('#stdNote').innerHTML = `<b>${esc(s.name)}</b> — design speed ${(s.speed_factor * 100).toFixed(0)}% of rated`
    + (s.decel_limit ? `, deceleration limit ${s.decel_limit} m/s²` : ', no deceleration limit')
    + `.<br><span class="muted">${esc(s.note)}</span>`;
}

/* ------------------------------ calculate ------------------------------ */
async function calculate() {
  const body = { duty:duty(), case_id:CASE, standard:$('#standard').value,
    series:selectedSeries(), limit:200 };
  const ms = $('#d_max_stroke'); if (ms && ms.value) body.max_stroke_mm = Number(ms.value);
  RESULT = await api('/api/select', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
  CHOSEN = null; EXPANDED = false;
  $('#toRfq').disabled = $('#printReport').disabled = true;
  const d = RESULT.duty_applied;
  $('#dutyOut').innerHTML = !d
    ? `<div class="note bad">Nothing in the catalogue satisfies this duty. Try a longer stroke, more buffers, or relax the standard.</div>`
    : `<div class="note ok"><b>${RESULT.count} models pass every check.</b>
      Design velocity <b>${d.v.toFixed(3)} m/s</b> · kinetic energy per buffer <b>${fmt(d.E_k)} Nm</b>
      <br><span class="muted">${esc(RESULT.standard.name)} · ${esc(RESULT.case.title)}.
      Total energy, energy per hour and effective mass depend on the stroke — a drive still pushing adds F&times;S —
      so they are shown per model below.</span></div>`;
  $('#picks').innerHTML = RESULT.candidates.filter(c => c.picks.length)
    .map(c => `<span class="pill brand" style="margin-left:6px">${esc(c.picks[0])}: ${esc(c.model)}</span>`).join('');
  renderRows();
  step(4);
}

function renderRows() {
  const all = RESULT.candidates;
  const rows = EXPANDED ? all : all.slice(0, TOP);
  $('#resTbl tbody').innerHTML = rows.map((c, i) => `<tr data-i="${i}">
    <td><input type="radio" name="pick"></td>
    <td><b>${esc(c.model)}</b>${c.picks.map(p => ` <span class="pill brand">${esc(p)}</span>`).join('')}</td>
    <td>${esc(c.series)}</td><td class="n">${fmt(c.stroke_mm)}</td><td class="n">${fmt(c.nm_per_cycle)}</td>
    <td class="n">${fmt(c.nm_per_hour)}</td><td class="n">${(c.u_stroke*100).toFixed(0)}%</td>
    <td class="n">${(c.u_hour*100).toFixed(0)}%</td><td class="n">${c.a.toFixed(2)}</td>
    <td class="n">${(c.F_s/1000).toFixed(1)}</td><td class="n">${fmt(c.m_e)}</td>
    <td>${c.flags.map(f => `<span class="pill warn">${esc(f)}</span>`).join(' ') || '<span class="pill ok">clear</span>'}</td></tr>`).join('');
  $$('#resTbl tbody tr').forEach(tr => tr.onclick = () => {
    $$('#resTbl tbody tr').forEach(x => x.classList.remove('sel'));
    tr.classList.add('sel'); tr.querySelector('input').checked = true;
    CHOSEN = rows[tr.dataset.i];
    $('#toRfq').disabled = $('#printReport').disabled = false;
  });
  const more = all.length - TOP;
  const b = $('#showMore');
  b.hidden = more <= 0;
  b.textContent = EXPANDED ? `Show only the best ${TOP}` : `Show ${more} more model${more === 1 ? '' : 's'}`;
}
$('#showMore').onclick = () => { EXPANDED = !EXPANDED; renderRows(); };

/* ------------------------------ A4 report ------------------------------ */
function buildReport() {
  if (!CHOSEN) return;
  const kv = (rows, el) => $(el).innerHTML = rows.filter(r => r[1] !== '' && r[1] != null)
    .map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('');
  const now = new Date();
  const stamp = now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  $('#rMeta').innerHTML = `Date ${stamp}<br>${$('#pref').value ? 'Ref ' + esc($('#pref').value) + '<br>' : ''}
    <span class="mono">${esc(CHOSEN.model)}</span>`;
  kv([['Project', $('#pname').value], ['Customer', $('#pcust').value], ['Contact', $('#pcontact').value],
      ['Equipment', $('#pequip').value], ['Reference', $('#pref').value]], '#rProject');
  const std = RESULT.standard;
  kv([['Impact case', RESULT.case.title], ['Standard', std.name],
      ['Design speed', (std.speed_factor*100).toFixed(0) + '% of rated'],
      ['Deceleration limit', std.decel_limit ? std.decel_limit + ' m/s²' : 'not set by this standard']], '#rApp');
  $('#rPic').src = art(CASE);
  const g = k => { const e = $('#d_' + k); return e && e.value !== '' ? e.value : null; };
  const inputs = (CASE_FIELDS[CASE] || []).concat(['temp_min','temp_max','max_stroke'])
    .map(k => g(k) == null ? null : [F[k][0], `${g(k)} ${F[k][1] === '–' ? '' : F[k][1]}`.trim()]).filter(Boolean);
  kv(inputs, '#rInputs');
  const d = RESULT.duty_applied, c = CHOSEN;
  kv([['Design velocity', d.v.toFixed(3) + ' m/s'],
      ['Kinetic energy Ek', fmt(c.E_k) + ' Nm'],
      ['Propelling energy Ew', fmt(c.E_w) + ' Nm'],
      ['Total energy Et', fmt(c.E_t) + ' Nm'],
      ['Energy per hour Etc', fmt(c.E_tc) + ' Nm/h'],
      ['Effective mass Me = 2·Et/v²', fmt(c.m_e) + ' kg'],
      ['Reaction force Fs = Et/(η·S)', (c.F_s/1000).toFixed(1) + ' kN'],
      ['Deceleration a = v²/(2·η·S)', c.a.toFixed(2) + ' m/s²'],
      ['Stopping time t', (c.t*1000).toFixed(0) + ' ms']], '#rCalc');
  $('#rModel').innerHTML = `<thead><tr><th>Model</th><th>Series</th><th class="n">Stroke</th>
      <th class="n">Rated Nm/cycle</th><th class="n">Rated Nm/h</th><th class="n">Utilisation</th></tr></thead>
    <tbody><tr><td><b>${esc(c.model)}</b></td><td>${esc(c.series)}</td><td class="n">${fmt(c.stroke_mm)} mm</td>
      <td class="n">${fmt(c.nm_per_cycle)}</td><td class="n">${fmt(c.nm_per_hour)}</td>
      <td class="n">${(c.u_stroke*100).toFixed(0)}% / stroke, ${(c.u_hour*100).toFixed(0)}% / hour</td></tr></tbody>`;
  $('#rFlags').innerHTML = c.flags.length
    ? `<div style="margin-top:6pt;font-size:9pt;color:#B7791F"><b>Notes:</b> ${c.flags.map(esc).join(' · ')}</div>` : '';
  $('#rBy').textContent = $('#pby').value || '—';
  $('#rNote').innerHTML = `Damping efficiency η = ${CHOSEN.series === 'SB' ? '0.50 (spring)' :
    CHOSEN.series === 'JHQC' ? '0.158 (polyurethane)' : '0.80 (hydraulic)'}.
    Effective mass from Me = 2·Et/v². Selection is subject to confirmation of the application data above.
    E &amp; O E.`;
  $('#report').hidden = false;
}
$('#printReport').onclick = () => { buildReport(); setTimeout(() => window.print(), 60); };
window.addEventListener('afterprint', () => { $('#report').hidden = true; });

/* ------------------------------ RFQ ------------------------------ */
function overlay(state, title, msg, closable) {
  const o = $('#sentOverlay'), box = o.querySelector('.plane');
  o.hidden = false;
  box.classList.remove('sending','done','failed'); void box.offsetWidth;
  box.classList.add(state);
  $('#sentTitle').textContent = title;
  $('#sentMsg').textContent = msg || '';
  $('#sentClose').hidden = !closable;
}
$('#sentClose').onclick = () => { $('#sentOverlay').hidden = true; };

async function sendRfq() {
  if (!CHOSEN) return;
  const cust = { name:$('#pcust').value || $('#pname').value || 'Enquiry', contact:$('#pcontact').value,
    email:$('#pemail').value, phone:$('#pphone').value, gstin:$('#pgstin').value };
  if (!cust.email || !cust.phone) {
    $('#rfqOut').innerHTML = `<div class="note bad">Email and phone are required so we can send the drawings and quotation.</div>`;
    return;
  }
  overlay('sending', 'Sending your request…', 'Attaching your calculation.');
  // hold the animation long enough to read, even though the server answers instantly
  const held = new Promise(r => setTimeout(r, 900));
  try {
    const proj = await api('/api/project', { method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ name:$('#pname').value || 'Untitled', reference:$('#pref').value,
        equipment:$('#pequip').value, prepared_by:$('#pby').value }) });
    const sel = await api('/api/selection', { method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ project_id:proj.id, line:GROUP, case_id:CASE, standard:RESULT.standard.code,
        inputs:duty(), results:{ duty:RESULT.duty_applied, chosen:CHOSEN,
          case_title:RESULT.case.title, standard_name:RESULT.standard.name }, chosen_bk:CHOSEN.bk }) });
    const r = await api('/api/rfq', { method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({ customer:cust, project_id:proj.id, selection_id:sel.id,
        formats:[...$('#rfmt').selectedOptions].map(o => o.value), message:$('#rmsg').value,
        items:[{ bk:CHOSEN.bk, model:CHOSEN.model, qty:Number($('#rqty').value) || 1,
                 mounting:$('#rmount').value, cap:$('#rcap').value }] }) });
    await held;
    const mailed = r.mail && r.mail.ok;
    overlay('done', `Request ${r.number} sent`,
      mailed ? 'A copy is on its way to your inbox. We normally reply within one working day.'
             : 'We have it. Our engineer will come back to you, normally within one working day.', true);
    $('#rfqOut').innerHTML = `<div class="note ok"><b>Request ${esc(r.number)} received.</b>
      ${mailed ? 'A confirmation has been emailed to you. ' : ''}Your calculation is attached to it.</div>`;
    setTimeout(() => { $('#sentOverlay').hidden = true; }, 4200);
  } catch (e) {
    await held;
    overlay('failed', 'Could not send', e.message, true);
  }
}

/* ------------------------------ wiring ------------------------------ */
document.addEventListener('click', e => {
  const g = e.target.dataset && e.target.dataset.go; if (g) step(g);
});
$$('.step').forEach(s => s.addEventListener('click', () => step(s.dataset.s)));
$('#tabCrane').onclick = () => setGroup('crane');
$('#tabInd').onclick   = () => setGroup('industrial');
$('#standard').onchange = stdNote;
$('#calc').onclick = () => calculate().catch(e => alert(e.message));
$('#toRfq').onclick = () => {
  $('#rfqLines').innerHTML = `<div class="note blue" style="display:flex;gap:14px;align-items:center">
    <img src="${art(CASE)}" alt="" style="max-height:64px">
    <span><b>${esc(CHOSEN.model)}</b> — ${fmt(CHOSEN.stroke_mm)} mm stroke, ${fmt(CHOSEN.nm_per_cycle)} Nm/cycle
    <br><span class="muted">${esc(RESULT.case.title)} · ${esc(RESULT.standard.name)}</span></span></div>`;
  step(5);
};
$('#sendRfq').onclick = () => sendRfq();
$('#loadExample').onclick = () => {
  Object.assign(S, { pname:'Bay 3 gantry — end stops', pcust:'Example Engineering Ltd.',
    pcontact:'R. Kulkarni', pequip:'20 t EOT crane, 22 m span', pby:'P. Adavani',
    d_m:20000, d_v:40, d_P:15, d_C:20, d_n:2, group:'crane', case:'C1' });
  save(); location.reload();
};
$('#pgstin').addEventListener('blur', async () => {
  const g = $('#pgstin').value.trim(); if (!g) { $('#gstinMsg').innerHTML = ''; return; }
  const v = await api('/api/gstin/' + encodeURIComponent(g));
  $('#gstinMsg').innerHTML = v.ok
    ? `<div class="note ok">Valid — ${esc(v.state_name)} (state code ${v.state_code}), PAN ${esc(v.pan)}</div>`
    : `<div class="note bad">Not a valid GSTIN: ${esc(v.reason)}.` +
      (v.suggestions && v.suggestions.length ? ` Did you mean <b>${esc(v.suggestions[0])}</b>?` : '') + `</div>`;
});
CASE = S.case || null;
boot().catch(e => document.body.insertAdjacentHTML('afterbegin', `<div class="note bad">${esc(e.message)}</div>`));
