'use strict';
/**
 * Rubber anti-vibration mount selection (single-degree-of-freedom, MKS).
 *
 * VIBRATION (optional when a bump is given)
 *   load per mount   W  = m / N  (kg), with a CG factor for uneven distribution
 *   required fn      from the disturbing frequency and the isolation wanted:
 *                    T = 1/(r²-1)  ->  r = sqrt(1 + 1/T),  fn = f / r
 *   static deflection d = g / (2π fn)²
 *
 * SHOCK / BUMP (optional)  peak A (g), duration τ (ms), shape half-sine | rectangular | sawtooth
 *   velocity change  Δv = 2Aτ/π (half-sine) · Aτ (rect) · Aτ/2 (terminal-peak sawtooth)
 *   transmissibility needed  T = fragility / A
 *   first estimate   fn ≤ T/(4τ)  (half-sine isolation region)
 *   travel needed    δ = Δv²/a_allowed (linear spring) · floor Δv²/(2·a_allowed) (ideal absorber)
 *   best possible in the sway space  a = Δv²/δ_available
 *   per mount: the pulse is run through the mount as a damped SDOF (RK4, ζ = 5 % natural rubber)
 *   -> transmitted peak acceleration and dynamic travel; checked against fragility, sway space
 *   and rubber strain (static + dynamic ≤ 25 % of the rubber height in compression, short term).
 *
 * A mount passes when W sits inside its load band and every requested check passes.
 */
const G = 9.81;

function required(inp) {
  const m = Number(inp.mass_kg), N = Math.max(1, Number(inp.mounts) || 4), f = Number(inp.disturbing_hz) || 0;
  const iso = Math.min(0.98, Math.max(0.5, Number(inp.isolation_pct || 90) / 100));
  const cg = Number(inp.cg_factor || 1);
  const W = m / N * cg;
  const out = { W_kg: W, rpm: f * 60, vibration: f > 0 };
  if (f > 0) {
    const T = 1 - iso;                                  // transmissibility allowed
    const r = Math.sqrt(1 + 1 / T);
    const fn = f / r;
    const d = G / Math.pow(2 * Math.PI * fn, 2) * 1000; // mm
    Object.assign(out, { T, r, fn_req_hz: fn, d_req_mm: d, k_req_n_mm: W * G / d });
  }
  const sh = shockInput(inp);
  if (sh) {
    out.shock = shockRequired(sh);
    const fnS = out.shock.fn_max_hz;
    if (fnS && (!out.fn_req_hz || fnS < out.fn_req_hz)) { out.fn_req_hz = fnS; out.d_req_mm = G / Math.pow(2 * Math.PI * fnS, 2) * 1000; out.k_req_n_mm = W * G / out.d_req_mm; out.fn_governed_by = 'shock'; }
  }
  return out;
}

/* ---------------------------------------------------------------- shock / bump */
const SHAPES = { 'half-sine': 'half-sine', halfsine: 'half-sine', rect: 'rectangular', rectangular: 'rectangular', sawtooth: 'sawtooth', tps: 'sawtooth' };
function shockInput(inp) {
  const s = inp.shock || {};
  const A = Number(s.peak_g), tau = Number(s.pulse_ms) / 1000;
  if (!(A > 0) || !(tau > 0)) return null;
  return { A, tau, shape: SHAPES[String(s.shape || 'half-sine').toLowerCase()] || 'half-sine',
    frag: Number(s.fragility_g) > 0 ? Number(s.fragility_g) : null, sway: Number(s.sway_mm) > 0 ? Number(s.sway_mm) : null,
    zeta: Number(s.damping) > 0 ? Math.min(0.3, Number(s.damping)) : 0.05 };
}
/** base acceleration in m/s² at time t (s) */
function pulse(sh, t) {
  if (t < 0 || t > sh.tau) return 0;
  const a = sh.A * G;
  if (sh.shape === 'rectangular') return a;
  if (sh.shape === 'sawtooth') return a * t / sh.tau;   // terminal-peak sawtooth
  return a * Math.sin(Math.PI * t / sh.tau);
}
function deltaV(sh) { const a = sh.A * G; return sh.shape === 'rectangular' ? a * sh.tau : sh.shape === 'sawtooth' ? a * sh.tau / 2 : 2 * a * sh.tau / Math.PI; }
function shockRequired(sh) {
  const dv = deltaV(sh);
  const o = { peak_g: sh.A, pulse_ms: sh.tau * 1000, shape: sh.shape, fragility_g: sh.frag, sway_mm: sh.sway, dv_m_s: dv, damping: sh.zeta };
  if (sh.frag) {
    const aAllow = sh.frag * G;
    o.T = sh.frag / sh.A;
    o.fn_max_hz = o.T < 1 ? o.T / (4 * sh.tau) : null;   // half-sine estimate, refined below for the actual shape
    if (o.fn_max_hz) o.fn_max_hz = refineFn(sh, o.fn_max_hz);   // exact for the chosen shape and damping
    o.stroke_linear_mm = dv * dv / aAllow * 1000;
    o.stroke_floor_mm = dv * dv / (2 * aAllow) * 1000;
    o.isolation_needed = o.T < 1;
  }
  if (sh.sway) { o.best_linear_g = dv * dv / (sh.sway / 1000) / G; o.best_ideal_g = dv * dv / (2 * sh.sway / 1000) / G; }
  o.feasible = !(sh.frag && sh.sway) || o.stroke_linear_mm <= sh.sway * 1.02 || o.T >= 1;
  o.verdict = !sh.frag ? 'no fragility limit given — transmitted g is reported only'
    : o.T >= 1 ? 'the component takes the bump rigidly mounted — a mount is not needed for this shock'
    : !sh.sway ? `needs about ${o.stroke_linear_mm.toFixed(0)} mm of free travel (ideal floor ${o.stroke_floor_mm.toFixed(0)} mm)`
    : o.feasible ? `possible: ${o.stroke_linear_mm.toFixed(0)} mm travel needed, ${sh.sway} mm available`
    : `not possible in ${sh.sway} mm: ${o.stroke_linear_mm.toFixed(0)} mm needed (ideal floor ${o.stroke_floor_mm.toFixed(0)} mm); the best a linear mount can do in ${sh.sway} mm is ${o.best_linear_g.toFixed(0)} g`;
  return o;
}
/** Damped SDOF under the base pulse (RK4). Returns the peak absolute acceleration (g) and peak relative travel (mm). */
function sdof(fn, sh) {
  const w = 2 * Math.PI * fn, z = sh.zeta;
  const Tn = 1 / fn, tEnd = sh.tau + 1.2 * Tn, dt = Math.min(sh.tau, Tn) / 400;
  let x = 0, v = 0, t = 0, amax = 0, xmax = 0;
  const f = (tt, xx, vv) => -pulse(sh, tt) - 2 * z * w * vv - w * w * xx;   // relative motion x'' = -a_base - 2ζωx' - ω²x
  while (t < tEnd) {
    const k1x = v, k1v = f(t, x, v);
    const k2x = v + k1v * dt / 2, k2v = f(t + dt / 2, x + k1x * dt / 2, v + k1v * dt / 2);
    const k3x = v + k2v * dt / 2, k3v = f(t + dt / 2, x + k2x * dt / 2, v + k2v * dt / 2);
    const k4x = v + k3v * dt, k4v = f(t + dt, x + k3x * dt, v + k3v * dt);
    x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x); v += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v); t += dt;
    const aAbs = Math.abs(2 * z * w * v + w * w * x);   // absolute acceleration of the supported mass
    if (aAbs > amax) amax = aAbs; if (Math.abs(x) > xmax) xmax = Math.abs(x);
  }
  return { a_out_g: amax / G, travel_mm: xmax * 1000 };
}
/** Highest fn that keeps the transmitted peak at the fragility limit (bisection on the simulation). */
function refineFn(sh, guess) {
  let lo = guess / 10, hi = guess * 5;
  if (sdof(lo, sh).a_out_g > sh.frag) return lo;
  if (sdof(hi, sh).a_out_g <= sh.frag) return hi;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (sdof(mid, sh).a_out_g > sh.frag) hi = mid; else lo = mid; }
  return lo;
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
  let r = 0, T = null, iso = null;
  if (req.vibration) {
    r = fn ? Number(inp.disturbing_hz) / fn : 0;
    T = r > 1 ? 1 / (r * r - 1) : Infinity;
    iso = r > Math.SQRT2 ? (1 - T) * 100 : 0;
    const fnVib = Number(inp.disturbing_hz) / Math.sqrt(1 + 1 / (1 - Math.min(0.98, Math.max(0.5, Number(inp.isolation_pct || 90) / 100))));
    if (fn > fnVib * 1.02) fatal.push(`natural frequency ${fn.toFixed(1)} Hz too high for ${(Number(inp.isolation_pct) || 90)}% isolation (need <= ${fnVib.toFixed(1)} Hz)`);
    if (r > 1 && r < Math.SQRT2) fatal.push('operating near resonance (r < 1.41) — amplification, not isolation');
  }
  const util = p.load_max_kg ? req.W_kg / p.load_max_kg : 0;
  if (util && util < 0.3) flags.push(`lightly loaded (${(util * 100).toFixed(0)}%) — a softer mount would isolate better`);
  if (p.mount_style === 'SU' || p.mount_style === 'F0') flags.push('plain rubber face one end - not bolted there; use where the load rests or add a locating cup');
  if (p.status === 'reference') flags.push('reference data (catalogue equivalent) — confirm with Adoni Tech');
  const d = k ? req.W_kg * G / k : null;
  // shock / bump through this mount
  let shock = null;
  const sh = shockInput(inp);
  if (sh && fn) {
    shock = sdof(fn, sh);
    const h = Number(p.height_mm) || null;
    shock.strain_pct = h ? ((d || 0) + shock.travel_mm) / h * 100 : null;
    if (sh.frag && shock.a_out_g > sh.frag * 1.02) fatal.push(`bump: ${shock.a_out_g.toFixed(1)} g reaches the equipment (limit ${sh.frag} g)`);
    if (sh.sway && shock.travel_mm > sh.sway) fatal.push(`bump: needs ${shock.travel_mm.toFixed(1)} mm travel, only ${sh.sway} mm free`);
    if (shock.strain_pct != null && shock.strain_pct > 25) (shock.strain_pct > 40 ? fatal : flags).push(`bump: rubber compressed ${shock.strain_pct.toFixed(0)} % of its height (keep ≤ 25 % short-term) — choose a taller mount or add a snubber`);
    if (!sh.frag && shock.a_out_g > sh.A) flags.push(`bump is amplified: ${shock.a_out_g.toFixed(1)} g out for ${sh.A} g in`);
  }
  const shockScore = shock && sh.frag ? Math.max(0, 1 - shock.a_out_g / sh.frag) : null;
  const base = req.vibration ? 0.6 * Math.min(1, iso / 100) : 0.6 * (shockScore ?? 0.5);
  const score = fatal.length ? 0 : (base + 0.4 * Math.exp(-Math.pow((util - 0.65) / 0.3, 2))) * (p.mount_style === 'SU' || p.mount_style === 'F0' ? 0.9 : 1) * (shockScore != null && req.vibration ? 0.8 + 0.2 * shockScore : 1);
  return { product: p, fn_hz: fn, r, T, isolation_pct: iso, util, static_deflection_mm: d, k_n_mm: k, shock, flags, fatal, score };
}

function select(products, inp) {
  const req = required(inp);
  if (!req.vibration && !req.shock) throw Object.assign(new Error('enter the running speed (vibration) or a bump (peak g and pulse duration)'), { status: 400 });
  const out = products.filter(p => p.status !== 'obsolete').map(p => evaluate(p, req, inp));
  const pass = out.filter(c => !c.fatal.length).sort((a, b) => b.score - a.score || (b.isolation_pct || 0) - (a.isolation_pct || 0));
  return { required: req, count: pass.length, candidates: pass.slice(0, 40), rejected: out.length - pass.length };
}

module.exports = { required, evaluate, select, sdof, shockRequired, deltaV };
