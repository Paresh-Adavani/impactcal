'use strict';
/**
 * Rubber anti-vibration mount selection (single-degree-of-freedom, MKS).
 *   load per mount   W  = m / N  (kg), with a CG factor for uneven distribution
 *   required fn      from the disturbing frequency and the isolation wanted:
 *                    T = 1/(r²-1)  ->  r = sqrt(1 + 1/T),  fn = f / r
 *   static deflection d = g / (2π fn)²
 * A mount passes when W sits inside its load band and its fn at that load <= required fn.
 */
const G = 9.81;

function required(inp) {
  const m = Number(inp.mass_kg), N = Math.max(1, Number(inp.mounts) || 4), f = Number(inp.disturbing_hz);
  const iso = Math.min(0.98, Math.max(0.5, Number(inp.isolation_pct || 90) / 100));
  const cg = Number(inp.cg_factor || 1);
  const W = m / N * cg;
  const T = 1 - iso;                                  // transmissibility allowed
  const r = Math.sqrt(1 + 1 / T);
  const fn = f / r;
  const d = G / Math.pow(2 * Math.PI * fn, 2) * 1000; // mm
  const k = W * G / d;                                // N/mm
  return { W_kg: W, T, r, fn_req_hz: fn, d_req_mm: d, k_req_n_mm: k, rpm: f * 60 };
}

function evaluate(p, req, inp) {
  const flags = [], fatal = [];
  if (p.load_max_kg != null && req.W_kg > p.load_max_kg) fatal.push(`load ${req.W_kg.toFixed(1)} kg above max ${p.load_max_kg} kg`);
  if (p.load_min_kg != null && req.W_kg < p.load_min_kg) fatal.push(`load ${req.W_kg.toFixed(1)} kg below min ${p.load_min_kg} kg`);
  // fn at actual load: k from catalogue (or from fn at max load), fn = (1/2π) sqrt(k/m)
  let k = p.stiffness_n_mm;
  if (!k && p.natural_freq_hz && p.load_max_kg) k = p.load_max_kg * Math.pow(2 * Math.PI * p.natural_freq_hz, 2) / 1000;
  const fn = k ? (1 / (2 * Math.PI)) * Math.sqrt(k * 1000 / req.W_kg) : p.natural_freq_hz;
  if (!fn) fatal.push('no stiffness or natural-frequency data for this mount — ask ADONI TECH');
  const r = fn ? Number(inp.disturbing_hz) / fn : 0;
  const T = r > 1 ? 1 / (r * r - 1) : Infinity;
  const iso = r > Math.SQRT2 ? (1 - T) * 100 : 0;
  if (fn > req.fn_req_hz * 1.02) fatal.push(`natural frequency ${fn.toFixed(1)} Hz too high for ${(Number(inp.isolation_pct) || 90)}% isolation (need <= ${req.fn_req_hz.toFixed(1)} Hz)`);
  if (r > 1 && r < Math.SQRT2) fatal.push('operating near resonance (r < 1.41) — amplification, not isolation');
  const util = p.load_max_kg ? req.W_kg / p.load_max_kg : 0;
  if (util && util < 0.3) flags.push(`lightly loaded (${(util * 100).toFixed(0)}%) — a softer mount would isolate better`);
  if (p.mount_style === 'SU' || p.mount_style === 'F0') flags.push('plain rubber face one end - not bolted there; use where the load rests or add a locating cup');
  if (p.status === 'reference') flags.push('reference data (catalogue equivalent) — confirm with Adoni Tech');
  const d = k ? req.W_kg * G / k : null;
  const score = fatal.length ? 0 : (0.6 * Math.min(1, iso / 100) + 0.4 * Math.exp(-Math.pow((util - 0.65) / 0.3, 2))) * (p.mount_style === 'SU' || p.mount_style === 'F0' ? 0.9 : 1);
  return { product: p, fn_hz: fn, r, T, isolation_pct: iso, util, static_deflection_mm: d, k_n_mm: k, flags, fatal, score };
}

function select(products, inp) {
  const req = required(inp);
  const out = products.filter(p => p.status !== 'obsolete').map(p => evaluate(p, req, inp));
  const pass = out.filter(c => !c.fatal.length).sort((a, b) => b.score - a.score || b.isolation_pct - a.isolation_pct);
  return { required: req, count: pass.length, candidates: pass.slice(0, 40), rejected: out.length - pass.length };
}

module.exports = { required, evaluate, select };
