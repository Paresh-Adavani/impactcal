'use strict';
/**
 * Wire rope isolator selection on the server (same method as site/wri/index.html, MKS).
 * Used by the DAMPA assistant; the WRI page keeps its own copy for the charts.
 *
 *   static     : design load = sf × (m·g/N × cg) <= rated load of the gravity axis
 *   fn         : (1/2π)·√(k/m) per isolator (or system stiffness with stabilisers)
 *   sine       : worst dwell response over the standard's constant-displacement bands
 *   random     : Miles 3σ against fragility
 *   shock      : numerical SDOF half-sine, transmitted g and stroke vs rated deflection
 */
const G = 9.81;

const STDS = {
  JSS55555: { name: 'JSS 55555 (Tri-Service, India)', sine: [[5, 14, 1.25], [14, 23, 0.45], [23, 33, 0.125]], rand: { f1: 20, f2: 80, f3: 350, f4: 2000, psd: 0.02 }, shock: { gv: 20, gh: 20, tau: 11 } },
  BR3021: { name: 'BR 3021 naval shock, grade 2', sine: [[5, 14, 1.25], [14, 23, 0.45], [23, 33, 0.125]], rand: { f1: 20, f2: 80, f3: 350, f4: 2000, psd: 0.04 }, shock: { gv: 50, gh: 22, tau: 11 } },
  MILSTD810: { name: 'MIL-STD-810H', sine: [[5, 20, 1.0], [20, 33, 0.25]], rand: { f1: 15, f2: 80, f3: 350, f4: 2000, psd: 0.04 }, shock: { gv: 20, gh: 20, tau: 11 } },
  MILS901D: { name: 'MIL-S-901D navy high-impact shock', sine: [[4, 16, 1.0], [16, 25, 0.5], [25, 33, 0.25]], rand: { f1: 20, f2: 80, f3: 350, f4: 2000, psd: 0.02 }, shock: { gv: 60, gh: 30, tau: 11 } },
  MILSTD167: { name: 'MIL-STD-167-1A shipboard vibration', sine: [[4, 15, 1.25], [16, 25, 0.51], [26, 33, 0.25]], rand: { f1: 20, f2: 80, f3: 350, f4: 2000, psd: 0.02 }, shock: { gv: 20, gh: 20, tau: 11 } },
  ASTMD4169: { name: 'ASTM D4169 / ISTA road transport', sine: [[5, 20, 0.5]], rand: { f1: 10, f2: 40, f3: 200, f4: 500, psd: 0.015 }, shock: { gv: 30, gh: 15, tau: 11 } },
  AIRCARGO: { name: 'MIL-STD-810 air transport', sine: [[5, 20, 0.5]], rand: { f1: 15, f2: 100, f3: 500, f4: 2000, psd: 0.03 }, shock: { gv: 20, gh: 12, tau: 11 } },
  IEC60068: { name: 'IEC 60068-2 industrial', sine: [[10, 58, 0.35]], rand: { f1: 10, f2: 50, f3: 200, f4: 500, psd: 0.01 }, shock: { gv: 15, gh: 10, tau: 11 } },
};
const MOUNTS = {
  floor: { name: 'Floor mounted (gravity in compression)', ax: { v: 'C', h1: 'R', h2: 'S' }, stab: false },
  floorstab: { name: 'Floor + stabilisers', ax: { v: 'C', h1: 'R', h2: 'S' }, stab: true },
  wall: { name: 'Wall / bulkhead (gravity in shear-roll)', ax: { v: 'S', h1: 'C', h2: 'R' }, stab: false },
  ceiling: { name: 'Ceiling / suspended', ax: { v: 'C', h1: 'R', h2: 'S' }, stab: false },
  deg45: { name: '45° compression', ax: { v: 'R', h1: 'C', h2: 'S' }, stab: false },
};

const fnFromK = (k, m) => (1 / (2 * Math.PI)) * Math.sqrt(k * 1000 / m);
const trans = (r, z) => Math.sqrt((1 + Math.pow(2 * z * r, 2)) / (Math.pow(1 - r * r, 2) + Math.pow(2 * z * r, 2)));
function sineResponse(fn, zeta, bands) {
  let worst = { a: 0, f: 0 };
  for (const [f1, f2, X] of bands) {
    const fs = [f1, f2]; if (fn > f1 && fn < f2) fs.push(fn);
    for (let i = 0; i <= 20; i++) fs.push(f1 + (f2 - f1) * i / 20);
    for (const f of fs) { const a = Math.pow(2 * Math.PI * f, 2) * (trans(f / fn, zeta) * X / 1000) / G; if (a > worst.a) worst = { a, f }; }
  }
  return worst;
}
const psdAt = (f, r) => f <= 0 ? 0 : f < r.f2 ? r.psd * (f / r.f2) : f <= r.f3 ? r.psd : r.psd * (r.f3 / f);
const miles = (fn, zeta, r) => Math.sqrt((Math.PI / 2) * fn * (1 / (2 * zeta)) * psdAt(fn, r));
function shockNumeric(A_g, tau_ms, k, m, zeta) {
  const w = Math.sqrt(k * 1000 / m), tau = tau_ms / 1000, A = A_g * G, Tn = 2 * Math.PI / w;
  const dt = Math.min(tau / 300, Tn / 300), tEnd = tau + 4 * Tn;
  let x = 0, v = 0, t = 0, maxA = 0, maxX = 0;
  const ab = t => (t >= 0 && t <= tau) ? A * Math.sin(Math.PI * t / tau) : 0;
  const acc = (t, x, v) => -2 * zeta * w * v - w * w * x - ab(t);
  while (t < tEnd) {
    const k1v = acc(t, x, v), k1x = v;
    const k2v = acc(t + dt / 2, x + k1x * dt / 2, v + k1v * dt / 2), k2x = v + k1v * dt / 2;
    const k3v = acc(t + dt / 2, x + k2x * dt / 2, v + k2v * dt / 2), k3x = v + k2v * dt / 2;
    const k4v = acc(t + dt, x + k3x * dt, v + k3v * dt), k4x = v + k3v * dt;
    x += dt * (k1x + 2 * k2x + 2 * k3x + k4x) / 6; v += dt * (k1v + 2 * k2v + 2 * k3v + k4v) / 6; t += dt;
    maxA = Math.max(maxA, Math.abs(2 * zeta * w * v + w * w * x)); maxX = Math.max(maxX, Math.abs(x));
  }
  return { tg: maxA / G, stroke: maxX * 1000 };
}

/** rows = data.wri() rows */
function modelsFrom(rows) {
  return rows.filter(r => r.status !== 'obsolete').map(r => ({ m: r.model, h: r.height_mm, w: r.width_mm, price_inr: r.price_inr, lead: r.lead_time_days,
    C: { L: r.c_load_n, D: r.c_defl_mm, kv: r.c_kv_n_mm, ks: r.c_ks_n_mm }, R: { L: r.r_load_n, D: r.r_defl_mm, kv: r.r_kv_n_mm, ks: r.r_ks_n_mm }, S: { L: r.s_load_n, D: r.s_defl_mm, kv: r.s_kv_n_mm, ks: r.s_ks_n_mm } }));
}

function evalModel(md, inp) {
  const { mass, N, Ns, cgf, zeta, frag, sfrule, mnt, bands, rand, gv, gh, tau } = inp;
  const vert = md[mnt.ax.v], h1 = md[mnt.ax.h1], h2 = md[mnt.ax.h2];
  if (!vert || !vert.L || !vert.kv || !vert.ks || !h1 || !h2 || !h1.kv || !h2.kv) return null;
  const w = mass * G / N * cgf, wDesign = sfrule * w;
  const checks = [];
  checks.push({ k: 'static load', ok: wDesign <= vert.L, v: `${wDesign.toFixed(0)} N design vs ${vert.L} N rated` });
  let mV, kVv, kVs, kH1v, kH1s, kH2v, kH2s;
  if (mnt.stab && Ns > 0) {
    kVv = N * md.C.kv + Ns * md.S.kv; kVs = N * md.C.ks + Ns * md.S.ks;
    kH1v = N * md.R.kv + Ns * md.C.kv; kH1s = N * md.R.ks + Ns * md.C.ks;
    kH2v = N * md.S.kv + Ns * md.R.kv; kH2s = N * md.S.ks + Ns * md.R.ks; mV = mass;
  } else { mV = w / G; kVv = vert.kv; kVs = vert.ks; kH1v = h1.kv; kH1s = h1.ks; kH2v = h2.kv; kH2s = h2.ks; }
  const fnV = fnFromK(kVv, mV), fnH1 = fnFromK(kH1v, mV), fnH2 = fnFromK(kH2v, mV);
  const sV = sineResponse(fnV, zeta, bands), sH = sineResponse(Math.min(fnH1, fnH2), zeta, bands);
  checks.push({ k: 'sine dwell', ok: sV.a <= frag && sH.a <= frag, v: `vertical ${sV.a.toFixed(2)} g at ${sV.f.toFixed(1)} Hz, horizontal ${sH.a.toFixed(2)} g (limit ${frag} g)` });
  const rV = miles(fnV, zeta, rand), rH = Math.max(miles(fnH1, zeta, rand), miles(fnH2, zeta, rand));
  checks.push({ k: 'random 3σ (Miles)', ok: 3 * rV <= frag && 3 * rH <= frag, v: `vertical ${(3 * rV).toFixed(1)} g, horizontal ${(3 * rH).toFixed(1)} g (limit ${frag} g)` });
  const shV = shockNumeric(gv, tau, kVs, mV, zeta), shH1 = shockNumeric(gh, tau, kH1s, mV, zeta), shH2 = shockNumeric(gh, tau, kH2s, mV, zeta);
  const dV = mnt.stab ? Math.min(md.C.D, md.S.D) : vert.D, dH1 = mnt.stab ? Math.min(md.R.D, md.C.D) : h1.D, dH2 = mnt.stab ? Math.min(md.S.D, md.R.D) : h2.D;
  const sfV = dV / shV.stroke, sfH = Math.min(dH1 / shH1.stroke, dH2 / shH2.stroke);
  checks.push({ k: 'shock transmitted', ok: shV.tg <= frag && shH1.tg <= frag && shH2.tg <= frag, v: `vertical ${shV.tg.toFixed(1)} g, horizontal ${Math.max(shH1.tg, shH2.tg).toFixed(1)} g (limit ${frag} g)` });
  checks.push({ k: 'shock stroke', ok: sfV >= 1 && sfH >= 1, v: `vertical ${shV.stroke.toFixed(1)} of ${dV} mm (margin ${sfV.toFixed(2)}), horizontal margin ${sfH.toFixed(2)}` });
  if (inp.hmax && md.h > inp.hmax) checks.push({ k: 'height', ok: false, v: `${md.h} mm > ${inp.hmax} mm allowed` });
  const util = w / vert.L * 100;
  const pass = checks.every(c => c.ok);
  const score = (pass ? 0 : 1000) + (shV.tg / frag) * 40 + Math.abs(util - 45) * 0.35 + (sfV < 1.1 ? 25 : 0) + (md.h || 0) * 0.02;
  return { model: md.m, height_mm: md.h, pass, utilisation_pct: Math.round(util), load_per_isolator_n: Math.round(w), fn_vertical_hz: +fnV.toFixed(2), fn_horizontal_hz: +Math.min(fnH1, fnH2).toFixed(2),
    shock_transmitted_g: +shV.tg.toFixed(1), shock_stroke_mm: +shV.stroke.toFixed(1), rated_stroke_mm: dV, checks, score, price_inr: md.price_inr, lead_time_days: md.lead };
}

/** inp: { mass_kg, isolators, stabilisers, mounting, standard, fragility_g, shock_v_g, shock_h_g, pulse_ms, cg_factor, damping, safety_factor, max_height_mm } */
function select(rows, inp) {
  const std = STDS[inp.standard] || STDS.JSS55555;
  const mnt = MOUNTS[inp.mounting] || MOUNTS.floor;
  const i = {
    mass: Number(inp.mass_kg), N: Math.max(1, Number(inp.isolators) || 4), Ns: mnt.stab ? Math.max(0, Number(inp.stabilisers) || 0) : 0,
    cgf: Number(inp.cg_factor) || 1, zeta: Number(inp.damping) || 0.15, frag: Number(inp.fragility_g) || 20, sfrule: Number(inp.safety_factor) || 2,
    mnt, bands: std.sine, rand: std.rand, gv: Number(inp.shock_v_g) || std.shock.gv, gh: Number(inp.shock_h_g) || std.shock.gh, tau: Number(inp.pulse_ms) || std.shock.tau,
    hmax: Number(inp.max_height_mm) || null,
  };
  if (!(i.mass > 0)) throw Object.assign(new Error('mass_kg is required'), { status: 400 });
  const out = modelsFrom(rows).map(md => evalModel(md, i)).filter(r => r && r.utilisation_pct <= 250).sort((a, b) => a.score - b.score);
  return { standard: std.name, mounting: mnt.name, inputs_used: { mass_kg: i.mass, isolators: i.N, stabilisers: i.Ns, cg_factor: i.cgf, fragility_g: i.frag, shock_v_g: i.gv, shock_h_g: i.gh, pulse_ms: i.tau, damping: i.zeta, static_safety_factor: i.sfrule },
    passing: out.filter(r => r.pass).length, candidates: out.slice(0, 5) };
}

module.exports = { select, STDS, MOUNTS };
