'use strict';
/* Shared by every page: API helper, login state, language switcher, header. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 0) => n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, cur) => n == null ? '—' : (cur === 'USD' ? 'USD ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '₹ ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));

const AUTH = {
  get token() { try { return localStorage.getItem('ic_token') || ''; } catch { return ''; } },
  set token(v) { try { v ? localStorage.setItem('ic_token', v) : localStorage.removeItem('ic_token'); } catch {} },
  get user() { try { return JSON.parse(localStorage.getItem('ic_user') || 'null'); } catch { return null; } },
  set user(v) { try { v ? localStorage.setItem('ic_user', JSON.stringify(v)) : localStorage.removeItem('ic_user'); } catch {} },
  logout() { this.token = ''; this.user = null; location.href = 'index.html'; },
};
async function api(u, o = {}) {
  const h = { ...(o.headers || {}) };
  if (AUTH.token) h.authorization = 'Bearer ' + AUTH.token;
  if (o.body && typeof o.body !== 'string' && !(o.body instanceof FormData)) { o.body = JSON.stringify(o.body); h['content-type'] = 'application/json'; }
  const r = await fetch(u.startsWith('/') ? u : '/api/' + u, { ...o, headers: h });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && AUTH.token) { AUTH.token = ''; AUTH.user = null; }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

/* ---------- i18n: translations.csv -> /api/i18n ---------- */
const LANG_NAMES = { en: 'English', hi: 'हिन्दी', mr: 'मराठी', de: 'Deutsch', fr: 'Français', es: 'Español', ko: '한국어', ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', bn: 'বাংলা', gu: 'ગુજરાતી', ur: 'اردو', ar: 'العربية', th: 'ไทย', vi: 'Tiếng Việt' };
const I18N = { lang: 'en', dict: {}, langs: ['en'] };
function t(key, vars) {
  let s = (I18N.dict[key] && (I18N.dict[key][I18N.lang] || I18N.dict[key].en)) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
  return s;
}
function applyI18n(root = document) {
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  root.querySelectorAll('[data-t-ph]').forEach(el => { el.placeholder = t(el.dataset.tPh); });
  root.querySelectorAll('[data-t-html]').forEach(el => { el.innerHTML = t(el.dataset.tHtml); });
  document.documentElement.lang = I18N.lang;
  document.documentElement.dir = ['ar', 'ur'].includes(I18N.lang) ? 'rtl' : 'ltr';
}
async function loadI18n() {
  try {
    const j = await api('i18n');
    I18N.dict = j.dict; I18N.langs = j.languages;
    let l = ''; try { l = localStorage.getItem('ic_lang') || ''; } catch {}
    if (!l) l = (navigator.language || 'en').slice(0, 2);
    I18N.lang = I18N.langs.includes(l) ? l : (j.default || 'en');
  } catch (e) { console.warn('i18n', e.message); }
}
function setLang(l) { I18N.lang = l; try { localStorage.setItem('ic_lang', l); } catch {} applyI18n(); document.dispatchEvent(new CustomEvent('langchange')); }

/* ---------- Google tag (GA4): loads only when settings analytics.ga_id is set ---------- */
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
function track(name, params) { try { gtag('event', name, params || {}); } catch {} }
(async function loadGtag() {
  try {
    const c = await fetch('/api/public/config').then(r => r.json());
    if (!c.ga_id) return;
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(c.ga_id); document.head.appendChild(s);
    gtag('js', new Date()); gtag('config', c.ga_id);
  } catch {}
})();

/* ---------- header ---------- */
function renderHeader(active) {
  const u = AUTH.user;
  const links = [['index.html', 'nav_home'], ['selector.html', 'nav_shock'], ['wri/', 'nav_wri'], ['rubber.html', 'nav_rubber']];
  const el = document.querySelector('header .wrap');
  if (!el) return;
  el.innerHTML = `<a href="index.html"><img src="img/logo.png" alt="ADONI TECH" class="brandmark"></a>
    <div class="sub">ImpactCal<br><span data-t="tagline">Selection &amp; RFQ Suite</span></div>
    <nav>${links.map(([h, k]) => `<a href="${h}" class="${active === k ? 'on' : ''}" data-t="${k}"></a>`).join('')}
      ${!u || u.role === 'customer' ? `<a href="/dealers" class="dealer-cta ${active === 'nav_dealer' ? 'on' : ''}" data-t="nav_dealer" onclick="track('select_content',{content_type:'dealer_cta',item_id:'header'})"></a>` : ''}
      ${u && ['admin', 'sales', 'dealer'].includes(u.role) ? `<a href="portal.html" class="${active === 'nav_portal' ? 'on' : ''}" data-t="nav_portal"></a>` : ''}
      ${u && (u.role === 'admin' || u.role === 'sales') ? `<a href="admin.html" class="${active === 'nav_admin' ? 'on' : ''}" data-t="nav_admin"></a>` : ''}
      <select class="lang" id="langSel">${I18N.langs.map(l => `<option value="${l}" ${l === I18N.lang ? 'selected' : ''}>${LANG_NAMES[l] || l}</option>`).join('')}</select>
      ${u ? `<button id="logoutBtn" title="${esc(u.email)}"><span class="pill ${u.role === 'admin' ? 'brand' : u.role === 'dealer' ? 'ok' : ''}">${esc(u.role)}</span> ${esc(u.name || u.email.split('@')[0])} ✕</button>` : `<a href="login.html?next=${encodeURIComponent(location.pathname.split('/').pop() || 'index.html')}" data-t="nav_login"></a>`}
    </nav>`;
  $('#langSel').onchange = e => setLang(e.target.value);
  const lb = $('#logoutBtn'); if (lb) lb.onclick = () => AUTH.logout();
  applyI18n(el);
}
async function bootCommon(active) {
  await loadI18n();
  renderHeader(active);
  applyI18n();
  if (AUTH.token) { try { const me = await api('auth/me'); if (me.user) { AUTH.user = me.user; renderHeader(active); } else { AUTH.user = null; renderHeader(active); } } catch {} }
}
