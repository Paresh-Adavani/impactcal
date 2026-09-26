'use strict';
/**
 * INR -> USD for export quotations.
 *   live rate  : open.er-api.com (no key, updated daily), cached 24 h in the store
 *   uplift     : settings fx.uplift_pct, applied on top of the plain conversion
 *   fallback   : settings fx.fallback_inr_per_usd when the fetch fails
 */
const store = require('./store');

async function inrPerUsd(settings) {
  const cached = await store.getJSON('fx/usd');
  if (cached && Date.now() - cached.at < 24 * 3600 * 1000) return cached;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const rate = j && j.rates && j.rates.INR;
    if (rate > 0) { const rec = { rate, at: Date.now(), source: 'open.er-api.com', date: j.time_last_update_utc }; await store.setJSON('fx/usd', rec); return rec; }
    throw new Error('no INR in response');
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    return { rate: Number(settings['fx.fallback_inr_per_usd'] || 88), at: Date.now(), source: 'fallback (settings)', fallback: true };
  }
}

/** Convert an INR unit price to a quoted USD unit price. */
function toUsd(inr, fx, settings) {
  const uplift = Number(settings['fx.uplift_pct'] || 0) / 100;
  const roundTo = Number(settings['fx.round_usd_to'] || 1);
  const usd = (Number(inr) / fx.rate) * (1 + uplift);
  return Math.ceil(usd / roundTo) * roundTo;
}

module.exports = { inrPerUsd, toUsd };
