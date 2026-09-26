/* DAMPA — ADONI TECH impact & vibration assistant. Self-contained chat widget for every ImpactCal page. */
(function () {
  'use strict';
  if (window.__dampa) return; window.__dampa = true;
  const LS = (() => { try { const s = window.sessionStorage; s.setItem('__d', '1'); s.removeItem('__d'); return s; } catch { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; } })();
  const tok = () => { try { return localStorage.getItem('ic_token') || ''; } catch { return ''; } };
  const me = () => { try { return JSON.parse(localStorage.getItem('ic_user') || 'null'); } catch { return null; } };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = async (u, body) => {
    const h = { 'content-type': 'application/json' }; if (tok()) h.authorization = 'Bearer ' + tok();
    const r = await fetch('/api/' + u, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status }); return j;
  };
  const track = (n, p) => { try { window.gtag && window.gtag('event', n, p || {}); } catch {} };

  /* ---------- tiny markdown: bold, code, lists, tables, paragraphs ---------- */
  function md(src) {
    const lines = String(src || '').split('\n'); let html = '', i = 0;
    const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const row = s => s.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(row(lines[i++]));
        html += `<div class="dp-tw"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue;
      }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
        const ord = /^\s*\d/.test(l); const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
        html += `<${ord ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`; continue;
      }
      if (/^#{1,4}\s/.test(l)) { html += `<p><b>${inline(l.replace(/^#+\s/, ''))}</b></p>`; i++; continue; }
      if (!l.trim()) { i++; continue; }
      const para = []; while (i < lines.length && lines[i].trim() && !/^\s*(\||[-*•]\s|\d+[.)]\s|#)/.test(lines[i])) para.push(lines[i++]);
      if (para.length) html += `<p>${para.map(inline).join('<br>')}</p>`; else html += `<p>${inline(lines[i++])}</p>`;
    }
    return html;
  }

  /* ---------- styles ---------- */
  const css = `
  .dp-btn{position:fixed;right:18px;bottom:18px;z-index:9990;display:flex;align-items:center;gap:10px;border:0;cursor:pointer;background:linear-gradient(135deg,#1B3160,#27457F);color:#fff;border-radius:40px;padding:8px 18px 8px 8px;box-shadow:0 10px 30px rgba(27,49,96,.35);font:600 15px Poppins,"Segoe UI",system-ui,sans-serif}
  .dp-btn .dp-av{width:44px;height:44px}.dp-btn small{display:block;font-weight:500;font-size:11px;color:#FFC38A;letter-spacing:.3px}
  .dp-btn:hover{transform:translateY(-2px)}.dp-btn .dp-ring{position:absolute;left:8px;top:8px;width:44px;height:44px;border-radius:50%;box-shadow:0 0 0 0 rgba(245,124,0,.6);animation:dpPulse 2.4s infinite}
  @keyframes dpPulse{0%{box-shadow:0 0 0 0 rgba(245,124,0,.55)}70%{box-shadow:0 0 0 14px rgba(245,124,0,0)}100%{box-shadow:0 0 0 0 rgba(245,124,0,0)}}
  .dp-av{border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}
  .dp-panel{position:fixed;right:18px;bottom:18px;z-index:9991;width:410px;max-width:calc(100vw - 24px);height:min(680px,calc(100vh - 36px));background:#F4F6F9;border-radius:18px;box-shadow:0 24px 70px rgba(15,30,60,.35);display:flex;flex-direction:column;overflow:hidden;font:14.5px/1.45 Poppins,"Segoe UI",system-ui,sans-serif;color:#1f2933}
  .dp-panel[hidden],.dp-btn[hidden]{display:none!important}
  @media(max-width:560px){.dp-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100dvh;border-radius:0}.dp-btn span.dp-lbl{display:none}.dp-btn{padding:8px}}
  .dp-hd{background:linear-gradient(135deg,#132447,#1B3160 60%,#27457F);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}
  .dp-hd .dp-av{width:40px;height:40px}.dp-hd b{font-size:16px;letter-spacing:.5px}.dp-hd small{display:block;color:#FFC38A;font-size:11.5px}
  .dp-hd button{margin-left:auto;background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:16px}.dp-hd button+button{margin-left:6px}
  .dp-body{flex:1;overflow:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px}
  .dp-m{max-width:88%;padding:9px 12px;border-radius:14px;word-wrap:break-word}.dp-m p{margin:0 0 6px}.dp-m p:last-child{margin:0}.dp-m ul,.dp-m ol{margin:4px 0 6px 18px;padding:0}
  .dp-m code{background:#EEF2F7;padding:1px 4px;border-radius:4px;font-size:13px}
  .dp-bot{background:#fff;border:1px solid #DDE3EA;align-self:flex-start;border-top-left-radius:4px}
  .dp-me{background:#FFF1E2;border:1px solid #F8D3AE;align-self:flex-end;border-top-right-radius:4px}
  .dp-err{background:#FDECEC;border:1px solid #F5BDBD;align-self:stretch;font-size:13.5px}
  .dp-tw{overflow-x:auto;margin:6px 0}.dp-tw table{border-collapse:collapse;font-size:12.5px;width:100%}.dp-tw th,.dp-tw td{border:1px solid #DDE3EA;padding:4px 6px;text-align:left}.dp-tw th{background:#F4F6F9}
  .dp-files{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.dp-files span{background:#EEF3FB;border:1px solid #CFDCF0;border-radius:12px;padding:2px 8px;font-size:12px}
  .dp-typing{display:flex;align-items:center;gap:8px;color:#5A6672;font-size:13px}.dp-dots span{display:inline-block;width:7px;height:7px;margin:0 1px;background:#F57C00;border-radius:50%;animation:dpB 1.2s infinite}.dp-dots span:nth-child(2){animation-delay:.2s}.dp-dots span:nth-child(3){animation-delay:.4s}
  @keyframes dpB{0%,80%,100%{transform:scale(.5);opacity:.5}40%{transform:scale(1);opacity:1}}
  .dp-sugg{display:flex;flex-wrap:wrap;gap:6px}.dp-sugg button{border:1px solid #CFDCF0;background:#fff;border-radius:16px;padding:6px 11px;cursor:pointer;font:inherit;font-size:13px;color:#1B3160}.dp-sugg button:hover{border-color:#F57C00}
  .dp-ft{border-top:1px solid #DDE3EA;background:#fff;padding:8px}
  .dp-att{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.dp-att span{background:#FFF4E8;border:1px solid #F8D3AE;border-radius:12px;padding:2px 8px;font-size:12px}.dp-att b{cursor:pointer;margin-left:4px}
  .dp-row{display:flex;gap:6px;align-items:flex-end}.dp-row textarea{flex:1;resize:none;border:1px solid #C7CFD9;border-radius:12px;padding:9px 10px;font:inherit;max-height:120px;min-height:42px}
  .dp-row button{border:0;border-radius:12px;height:42px;min-width:42px;cursor:pointer;font-size:18px}.dp-clip{background:#EEF2F7;color:#1B3160}.dp-send{background:#F57C00;color:#fff}
  .dp-note{font-size:10.5px;color:#8A96A3;text-align:center;margin-top:4px}
  .dp-rfq{background:#fff;border:2px solid #F57C00;border-radius:14px;padding:10px 12px;align-self:stretch}.dp-rfq h4{margin:0 0 6px;color:#1B3160;font-size:14px}
  .dp-rfq .g{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}.dp-rfq input{border:1px solid #C7CFD9;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;width:100%;box-sizing:border-box}
  .dp-rfq button{background:#1B3160;color:#fff;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;font:inherit;font-weight:600}
  .dp-drop{outline:3px dashed #F57C00;outline-offset:-8px}`;
  const avatar = `<svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true"><path d="M6 30 Q12 18 18 30 T30 30 T42 30" fill="none" stroke="#F57C00" stroke-width="3.2" stroke-linecap="round"/><path d="M6 21 Q12 13 18 21 T30 21 T42 21" fill="none" stroke="#1B3160" stroke-width="2.6" stroke-linecap="round" opacity=".85"/><circle cx="24" cy="36" r="2.6" fill="#1B3160"/></svg>`;

  let CFG = null, CONV = LS.getItem('dp_conv') || null, FILES = [], BUSY = false;
  const hist = () => { try { return JSON.parse(LS.getItem('dp_hist') || '[]'); } catch { return []; } };
  const saveHist = h => { try { LS.setItem('dp_hist', JSON.stringify(h.slice(-40))); } catch {} };

  function page() { const p = location.pathname.replace(/^\//, '') || 'index.html'; return p.startsWith('wri') ? 'wire rope isolator selector' : p.includes('selector') ? 'shock absorber / crane buffer selector' : p.includes('rubber') ? 'rubber mount selector' : p.includes('dealer') ? 'dealer page' : p.includes('portal') ? 'quote portal' : p.replace('.html', ''); }
  function context() { try { if (typeof window.IC_CONTEXT === 'function') return window.IC_CONTEXT(); } catch {} return null; }

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const btn = document.createElement('button'); btn.className = 'dp-btn'; btn.setAttribute('aria-label', 'Ask ' + CFG.name);
    btn.innerHTML = `<span class="dp-ring"></span><span class="dp-av">${avatar}</span><span class="dp-lbl">Ask ${esc(CFG.name)}<small>${esc(CFG.tagline)}</small></span>`;
    const p = document.createElement('div'); p.className = 'dp-panel'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', CFG.name + ' chat');
    p.innerHTML = `<div class="dp-hd"><span class="dp-av">${avatar}</span><div><b>${esc(CFG.name)}</b><small>${esc(CFG.tagline)} · ADONI TECH</small></div><button class="dp-new" title="New conversation">↺</button><button class="dp-x" title="Close">✕</button></div>
      <div class="dp-body"></div>
      <div class="dp-ft"><div class="dp-att"></div><div class="dp-row"><button class="dp-clip" title="Attach photo, drawing, PDF, Excel or CSV">📎</button><textarea rows="1" placeholder="Describe your application, or attach a photo / datasheet…"></textarea><button class="dp-send" title="Send">➤</button></div>
      <input type="file" class="dp-file" multiple accept="image/*,application/pdf,.pdf,.csv,.txt,.xlsx,.xls" hidden><div class="dp-note">${esc(CFG.name)} is an AI assistant; selections are confirmed by ADONI TECH engineers.</div></div>`;
    document.body.append(btn, p);
    const body = p.querySelector('.dp-body'), ta = p.querySelector('textarea'), fileIn = p.querySelector('.dp-file'), att = p.querySelector('.dp-att');
    const open = () => { p.hidden = false; btn.hidden = true; if (!body.children.length) render(); setTimeout(() => ta.focus(), 50); track('dampa_open', { page: page() }); };
    btn.onclick = open;
    window.DAMPA = { open, ask: t => { open(); ta.value = t; send(); } };
    document.querySelectorAll('[data-dampa-box]').forEach(el => { el.hidden = false; });
    document.querySelectorAll('[data-dampa-open]').forEach(el => { el.hidden = false; el.onclick = e => { e.preventDefault(); open(); }; });
    p.querySelector('.dp-x').onclick = () => { p.hidden = true; btn.hidden = false; };
    p.querySelector('.dp-new').onclick = () => { CONV = null; LS.removeItem('dp_conv'); saveHist([]); FILES = []; drawAtt(); render(); };
    p.querySelector('.dp-clip').onclick = () => fileIn.click();
    fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ''; };
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    p.querySelector('.dp-send').onclick = () => send();
    p.addEventListener('dragover', e => { e.preventDefault(); p.classList.add('dp-drop'); });
    p.addEventListener('dragleave', () => p.classList.remove('dp-drop'));
    p.addEventListener('drop', e => { e.preventDefault(); p.classList.remove('dp-drop'); addFiles(e.dataTransfer.files); });
    p.addEventListener('paste', e => { const f = [...(e.clipboardData && e.clipboardData.files || [])]; if (f.length) addFiles(f); });

    function drawAtt() { att.innerHTML = FILES.map((f, i) => `<span>${f.type.startsWith('image') ? '🖼' : '📄'} ${esc(f.name)} <b data-i="${i}">×</b></span>`).join(''); att.querySelectorAll('b').forEach(b => b.onclick = () => { FILES.splice(+b.dataset.i, 1); drawAtt(); }); }
    async function addFiles(list) {
      for (const f of [...list].slice(0, 5 - FILES.length)) {
        try {
          if (f.type.startsWith('image/')) FILES.push(await shrink(f));
          else { if (f.size > 4 * 1024 * 1024) { bubble('err', `${f.name} is over 4 MB — please send a smaller file or a photo of the relevant page.`); continue; } FILES.push({ name: f.name, type: f.type || guess(f.name), base64: await b64(f), size: f.size }); }
        } catch (e) { bubble('err', 'Could not read ' + f.name); }
      }
      drawAtt();
    }
    const guess = n => /\.pdf$/i.test(n) ? 'application/pdf' : /\.csv$/i.test(n) ? 'text/csv' : /\.xlsx?$/i.test(n) ? 'application/vnd.ms-excel' : 'text/plain';
    const b64 = f => new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.onerror = j; fr.readAsDataURL(f); });
    function shrink(f) {
      return new Promise((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => { const s = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); const d = c.toDataURL('image/jpeg', 0.85); resolve({ name: f.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', base64: d.split(',')[1], size: d.length * 0.75 }); };
        img.onerror = reject; img.src = url;
      });
    }
    function bubble(kind, html, files) {
      const d = document.createElement('div'); d.className = 'dp-m ' + (kind === 'me' ? 'dp-me' : kind === 'err' ? 'dp-err' : 'dp-bot');
      d.innerHTML = (kind === 'bot' ? md(html) : kind === 'me' ? esc(html).replace(/\n/g, '<br>') : html) + (files && files.length ? `<div class="dp-files">${files.map(n => `<span>📎 ${esc(n)}</span>`).join('')}</div>` : '');
      body.appendChild(d); body.scrollTop = body.scrollHeight; return d;
    }
    function render() {
      body.innerHTML = '';
      const h = hist();
      if (!h.length) {
        const u = me();
        bubble('bot', `Hello${u && u.name && !u.name.includes('@') ? ' ' + u.name.split(' ')[0] : ''}! I am **${CFG.name}**, ADONI TECH's impact & vibration engineer.\n\nTell me what you need to stop, protect or isolate — or attach a photo, drawing, datasheet or Excel sheet. I will pick out the data, ask for anything missing and run the selection for you.`);
        const s = document.createElement('div'); s.className = 'dp-sugg';
        const ideas = ['Crane buffer for a 20 t EOT crane', 'Isolate a 300 kg naval cabinet', 'Anti-vibration mounts for a 1,500 kg genset', 'Shock absorber for a pneumatic slide', 'I will upload my datasheet'];
        s.innerHTML = ideas.map(t => `<button>${esc(t)}</button>`).join(''); body.appendChild(s);
        s.querySelectorAll('button').forEach(b => b.onclick = () => { if (/upload/.test(b.textContent)) fileIn.click(); else { ta.value = b.textContent; send(); } });
      } else for (const m of h) bubble(m.r, m.t, m.f);
    }
    async function send() {
      if (BUSY) return;
      const text = ta.value.trim(); if (!text && !FILES.length) return;
      const files = FILES.slice(); FILES = []; drawAtt(); ta.value = ''; ta.style.height = 'auto';
      const s = body.querySelector('.dp-sugg'); if (s) s.remove();
      bubble('me', text || '(attachment)', files.map(f => f.name));
      const h = hist(); h.push({ r: 'me', t: text || '(attachment)', f: files.map(f => f.name) }); saveHist(h);
      const wait = document.createElement('div'); wait.className = 'dp-m dp-bot dp-typing';
      const steps = files.length ? ['Reading your file…', 'Extracting the data…', 'Checking what is missing…', 'Running the selection…'] : ['Thinking…', 'Checking the inputs…', 'Running the selection…', 'Writing the answer…'];
      let si = 0; wait.innerHTML = `<span class="dp-dots"><span></span><span></span><span></span></span><span class="t">${steps[0]}</span>`; body.appendChild(wait); body.scrollTop = body.scrollHeight;
      const tick = setInterval(() => { si = Math.min(si + 1, steps.length - 1); wait.querySelector('.t').textContent = steps[si]; }, 3500);
      BUSY = true; track('dampa_message', { page: page(), files: files.length });
      try {
        const r = await api('assistant/chat', { conversation_id: CONV, text, files: files.map(({ name, type, base64 }) => ({ name, type, base64 })), page: page(), context: context() });
        CONV = r.conversation_id; LS.setItem('dp_conv', CONV);
        wait.remove(); bubble('bot', r.reply);
        const h2 = hist(); h2.push({ r: 'bot', t: r.reply }); saveHist(h2);
        if (r.rfq) rfqCard(r.rfq);
      } catch (e) { wait.remove(); bubble('err', esc(e.message || 'Something went wrong. Please try again.')); }
      finally { clearInterval(tick); BUSY = false; }
    }
    function rfqCard(d) {
      const u = me() || {}; const c = document.createElement('div'); c.className = 'dp-rfq';
      const table = { crane: 'shock_absorbers', industrial: 'shock_absorbers', wri: 'wire_rope_isolators', rubber: 'rubber_mounts' }[d.line] || 'shock_absorbers';
      c.innerHTML = `<h4>Request a quotation</h4><div>${(d.items || []).map(i => `<div>• <b>${esc(i.model)}</b> × ${esc(i.qty)}${i.remark ? ' — ' + esc(i.remark) : ''}</div>`).join('')}</div>
        <div class="g"><input data-k="company" placeholder="Company" value="${esc(d.customer_company || '')}"><input data-k="contact" placeholder="Your name *" value="${esc(d.contact_name || (u.name && !u.name.includes('@') ? u.name : ''))}">
        <input data-k="email" placeholder="E-mail *" value="${esc(d.email || (u.role === 'customer' ? u.email : '') || '')}"><input data-k="phone" placeholder="Phone *" value="${esc(d.phone || '')}">
        <input data-k="country" placeholder="Country" value="India"><input data-k="gstin" placeholder="GSTIN (optional)"></div>
        <button>Send request</button> <span class="dp-rs" style="font-size:12.5px"></span>`;
      body.appendChild(c); body.scrollTop = body.scrollHeight;
      c.querySelector('button').onclick = async () => {
        const v = {}; c.querySelectorAll('input').forEach(i => v[i.dataset.k] = i.value.trim());
        if (!v.contact || !v.email || !v.phone) { c.querySelector('.dp-rs').textContent = 'Name, e-mail and phone are needed.'; return; }
        c.querySelector('button').disabled = true; c.querySelector('.dp-rs').textContent = 'Sending…';
        try {
          const r = await api('rfq', { line: d.line === 'crane' || d.line === 'industrial' ? d.line : d.line, lang: document.documentElement.lang || 'en', customer: { company: v.company || v.contact, contact: v.contact, email: v.email, phone: v.phone, country: v.country || 'India', gstin: v.gstin },
            project: { name: d.project || 'Enquiry via ' + CFG.name }, items: (d.items || []).map(i => ({ table, key: i.model, model: i.model, qty: Number(i.qty) || 1, remark: i.remark || '' })),
            selection: { case_id: CFG.name, summary: d.summary || {} }, formats: ['PDF'], message: 'Prepared with ' + CFG.name + ' (AI assistant).', assistant_conversation: CONV });
          c.innerHTML = `<h4>✅ Request ${esc(r.number)} sent</h4><div>${r.ack && r.ack.ok ? 'A copy is on its way to your inbox.' : 'We have it.'} ADONI TECH will reply with the quotation, normally within one working day.</div>`;
          track('generate_lead', { lead_source: 'dampa' });
          if (r.quotation_id && u.role && ['sales', 'dealer'].includes(u.role)) c.innerHTML += `<div style="margin-top:6px"><a href="/approve.html?id=${encodeURIComponent(r.quotation_id)}">Open your draft quotation →</a></div>`;
        } catch (e) { c.querySelector('button').disabled = false; c.querySelector('.dp-rs').textContent = e.message; }
      };
    }
    if (LS.getItem('dp_open') === '1') open();
  }

  async function init() {
    try { CFG = await api('assistant/config'); } catch { return; }
    const u = me();
    if (CFG.held) return;   // on hold: hidden for everyone
    if (!CFG.enabled && !(u && u.role === 'admin')) return;
    if (!CFG.enabled) CFG.tagline = 'not connected yet — add ANTHROPIC_API_KEY';
    build();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
