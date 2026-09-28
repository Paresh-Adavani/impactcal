/* ImpactCal — thumbs-up feedback.
 *   ICThumbs.busy('Calculating…')          -> small animated thumbs while work runs; returns done()
 *   ICThumbs.done('Request AT/R/… sent', 'We reply within one working day', ms)  -> big animated thumbs-up card
 * Self-contained (own CSS), used by every selector, the portal and the quotation page. */
(function () {
  if (window.ICThumbs) return;
  const css = `
  .ict-busy{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:10050;background:#1B3160;color:#fff;border-radius:40px;padding:9px 18px 9px 12px;display:flex;gap:10px;align-items:center;font:600 14px/1.2 Poppins,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .2s}
  .ict-busy.on{opacity:1}
  .ict-busy .t{font-size:24px;display:inline-block;animation:ictNod .9s ease-in-out infinite;transform-origin:60% 80%}
  .ict-veil{position:fixed;inset:0;z-index:10060;background:rgba(27,49,96,.62);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s}
  .ict-veil.on{opacity:1}
  .ict-card{background:#fff;border-radius:18px;padding:26px 34px 24px;max-width:420px;margin:16px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.35);font-family:Poppins,Arial,sans-serif;transform:scale(.85);transition:transform .35s cubic-bezier(.2,1.4,.4,1)}
  .ict-veil.on .ict-card{transform:scale(1)}
  .ict-card .big{font-size:64px;line-height:1;display:inline-block;animation:ictPop .7s cubic-bezier(.2,1.6,.4,1) both, ictNod 1.1s .7s ease-in-out 2;transform-origin:60% 85%}
  .ict-card h3{margin:10px 0 6px;color:#1B3160;font-size:19px}
  .ict-card p{margin:0;color:#5A6672;font-size:14px;line-height:1.5}
  .ict-card .spark{position:relative;height:0}
  .ict-card .spark i{position:absolute;left:50%;top:-40px;width:8px;height:8px;border-radius:50%;background:#F57C00;opacity:0;animation:ictSpark .9s ease-out forwards}
  @keyframes ictPop{0%{transform:scale(0) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
  @keyframes ictNod{0%,100%{transform:rotate(0)}40%{transform:rotate(-16deg)}70%{transform:rotate(6deg)}}
  @keyframes ictSpark{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}
  @media (prefers-reduced-motion:reduce){.ict-busy .t,.ict-card .big,.ict-card .spark i{animation:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  let busyEl = null, busyN = 0;
  function busy(msg) {
    busyN++;
    if (!busyEl) { busyEl = document.createElement('div'); busyEl.className = 'ict-busy'; busyEl.setAttribute('role', 'status'); busyEl.innerHTML = '<span class="t" aria-hidden="true">👍</span><span class="m"></span>'; document.body.appendChild(busyEl); }
    busyEl.querySelector('.m').textContent = msg || 'Working on it…';
    requestAnimationFrame(() => busyEl.classList.add('on'));
    const t0 = Date.now(); let closed = false;
    return function done() { if (closed) return; closed = true; const wait = Math.max(0, 500 - (Date.now() - t0));
      setTimeout(() => { busyN = Math.max(0, busyN - 1); if (!busyN && busyEl) busyEl.classList.remove('on'); }, wait); };
  }
  function done(title, msg, ms) {
    const v = document.createElement('div'); v.className = 'ict-veil'; v.setAttribute('role', 'alertdialog');
    const sparks = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<i style="--dx:${Math.round(Math.cos(a) * 70)}px;--dy:${Math.round(Math.sin(a) * 60)}px;animation-delay:${0.25 + i * 0.02}s;background:${i % 2 ? '#1B3160' : '#F57C00'}"></i>`; }).join('');
    v.innerHTML = `<div class="ict-card"><div class="spark">${sparks}</div><div class="big" aria-hidden="true">👍</div><h3></h3><p></p></div>`;
    v.querySelector('h3').textContent = title || 'Done'; v.querySelector('p').textContent = msg || '';
    document.body.appendChild(v); requestAnimationFrame(() => v.classList.add('on'));
    const close = () => { v.classList.remove('on'); setTimeout(() => v.remove(), 300); };
    v.addEventListener('click', close); setTimeout(close, ms || 3200);
    return close;
  }
  window.ICThumbs = { busy, done };
})();
