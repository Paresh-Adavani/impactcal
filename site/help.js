/* ImpactCal — field help.
 * When someone hovers over or types in a technical input, a side panel explains the field:
 * a small picture of what is meant, the unit (MKS), typical values and a plain-language note.
 * Desktop: floating panel on the right. Phone: a slim sheet at the bottom (tap ✕ to close).
 * Works on dynamically drawn fields (event delegation on the input's id). */
(function () {
  if (window.ICHelp) return;
  const N = '#1B3160', O = '#F57C00', L = '#C9D3E0', F = '#EEF3F9';
  const svg = b => `<svg viewBox="0 0 240 140" width="100%" height="140" fill="none" stroke="${N}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${b}</svg>`;
  const c = (on, what) => (on === what ? O : N);
  const arrow = (x1, y1, x2, y2, col) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 8; return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${col}" stroke-width="3"/><path d="M${x2} ${y2} L${x2 - h * Math.cos(a - .45)} ${y2 - h * Math.sin(a - .45)} M${x2} ${y2} L${x2 - h * Math.cos(a + .45)} ${y2 - h * Math.sin(a + .45)}" stroke="${col}" stroke-width="3"/>`; };
  const txt = (x, y, t, col, sz) => `<text x="${x}" y="${y}" fill="${col || N}" stroke="none" font-size="${sz || 12}" font-family="Arial" font-weight="700" text-anchor="middle">${t}</text>`;
  const buffer = (x, y, col) => `<rect x="${x}" y="${y}" width="34" height="18" rx="3" fill="${F}" stroke="${col || N}"/><rect x="${x + 34}" y="${y + 6}" width="18" height="6" fill="${col || N}" stroke="none"/>`;
  const PICS = {
    /* moving mass hitting buffers on an end stop */
    impact: hl => svg(`<path d="M10 118 H230" stroke="${L}"/><rect x="206" y="40" width="14" height="78" fill="${F}"/>
      ${buffer(152, 60, c(hl, 'n'))}${hl === 'n' ? buffer(152, 88, O) : ''}
      <rect x="44" y="52" width="80" height="54" rx="4" fill="${hl === 'm' ? '#FFE6CC' : F}" stroke="${c(hl, 'm')}" stroke-width="${hl === 'm' ? 3 : 2}"/><circle cx="62" cy="112" r="6"/><circle cx="106" cy="112" r="6"/>
      ${txt(84, 84, 'm  kg', c(hl, 'm'))}${arrow(40, 34, 110, 34, c(hl, 'v'))}${txt(75, 26, 'v', c(hl, 'v'))}
      ${hl === 'stroke' ? `<path d="M186 50 V40 M206 50 V40" stroke="${O}"/>${arrow(188, 44, 204, 44, O)}${txt(196, 34, 'stroke', O, 11)}` : ''}${hl === 'n' ? txt(170, 126, 'n buffers', O, 11) : ''}${hl === 'm2' ? `<rect x="170" y="4" width="0" height="0"/>` : ''}`),
    two: hl => svg(`<path d="M10 110 H230" stroke="${L}"/><rect x="20" y="52" width="70" height="46" rx="4" fill="${F}" stroke="${c(hl, 'm')}"/>${txt(55, 80, 'm1', c(hl, 'm'))}${arrow(40, 36, 86, 36, c(hl, 'v'))}
      <rect x="150" y="52" width="70" height="46" rx="4" fill="${hl === 'm2' ? '#FFE6CC' : F}" stroke="${c(hl, 'm2')}"/>${txt(185, 80, 'm2', c(hl, 'm2'))}${arrow(200, 36, 154, 36, c(hl, 'v2'))}${buffer(96, 66, N)}`),
    motor: hl => svg(`<path d="M10 118 H230" stroke="${L}"/><rect x="40" y="50" width="100" height="56" rx="4" fill="${F}"/><rect x="60" y="24" width="44" height="26" rx="4" fill="#FFE6CC" stroke="${O}"/>${txt(82, 42, 'M', O)}
      <path d="M104 37 q14 -14 26 0" stroke="${O}"/>${txt(170, 34, hl === 'H_M' ? 'stall torque ×' : 'motor kW', O, 12)}<circle cx="60" cy="112" r="6"/><circle cx="120" cy="112" r="6"/>${buffer(160, 68, N)}<rect x="212" y="40" width="12" height="78" fill="${F}"/>`),
    force: () => svg(`<path d="M10 118 H230" stroke="${L}"/><rect x="18" y="62" width="70" height="26" rx="3" fill="#FFE6CC" stroke="${O}"/><path d="M88 75 H120" stroke="${O}" stroke-width="5"/>
      <rect x="120" y="50" width="56" height="50" rx="4" fill="${F}"/>${arrow(96, 42, 150, 42, O)}${txt(122, 34, 'F  N', O)}${buffer(180, 66, N)}`),
    clock: () => svg(`<circle cx="120" cy="70" r="46" fill="${F}"/><path d="M120 70 V38 M120 70 L144 82" stroke="${O}" stroke-width="3"/>${txt(120, 134, 'impacts per hour', O)}`),
    drop: () => svg(`<path d="M20 124 H220" stroke="${L}"/><rect x="92" y="10" width="56" height="34" rx="4" fill="${F}"/>${txt(120, 32, 'm')}${buffer(103, 104, N)}<path d="M60 44 V100" stroke="${O}" stroke-dasharray="4 4"/>${arrow(60, 60, 60, 100, O)}${txt(46, 76, 'H', O, 14)}`),
    incline: hl => svg(`<path d="M20 120 L220 120 L220 40 Z" fill="${F}" stroke="${L}"/><g transform="rotate(-21.8 120 80)"><rect x="96" y="60" width="50" height="30" rx="3" fill="${F}" stroke="${N}"/></g>
      ${txt(60, 112, 'β', c(hl, 'beta'), 14)}${hl === 'mu' ? txt(150, 136, 'friction μ', O, 12) : ''}`),
    rotary: hl => svg(`<circle cx="70" cy="80" r="10" fill="${N}"/><path d="M70 80 L190 50" stroke="${N}" stroke-width="8"/><path d="M40 60 A40 40 0 0 1 100 46" stroke="${c(hl, 'omega')}" stroke-width="3"/>${txt(58, 38, hl === 'M_t' ? 'M  N·m' : 'ω  rad/s', O)}
      ${buffer(186, 70, N)}${hl === 'R' || hl === 'r' ? `<path d="M70 96 L190 96" stroke="${O}" stroke-dasharray="4 3"/>${txt(130, 114, hl === 'R' ? 'R (buffer)' : 'r (torque)', O)}` : ''}${hl === 'J' ? txt(130, 34, 'J  kg·m²', O) : ''}`),
    temp: () => svg(`<rect x="108" y="16" width="24" height="84" rx="12" fill="${F}"/><circle cx="120" cy="108" r="18" fill="#FFE6CC" stroke="${O}"/><path d="M120 100 V44" stroke="${O}" stroke-width="6"/>${txt(170, 60, '°C', O, 16)}`),
    mounts: hl => svg(`<path d="M10 124 H230" stroke="${L}"/><rect x="40" y="30" width="160" height="66" rx="4" fill="${hl === 'mass' ? '#FFE6CC' : F}" stroke="${c(hl, 'mass')}"/>${txt(120, 58, hl === 'mass' ? 'mass  kg' : 'machine', c(hl, 'mass'))}
      ${[56, 104, 152, 184].map(x => `<rect x="${x - 8}" y="96" width="18" height="18" rx="3" fill="${hl === 'mounts' ? '#FFE6CC' : '#333'}" stroke="${c(hl, 'mounts')}"/>`).join('')}
      <circle cx="${hl === 'cg' ? 150 : 120}" cy="${hl === 'hcg' ? 50 : 66}" r="6" fill="${O}" stroke="none"/>${hl === 'cg' ? txt(150, 88, 'CG off-centre', O, 11) : ''}
      ${hl === 'hcg' ? `<path d="M214 50 V114" stroke="${O}"/>${txt(214, 42, 'h', O)}` : ''}${hl === 'pitch' ? `<path d="M56 132 H184" stroke="${O}"/>${txt(120, 128, 'pitch mm', O, 11)}` : ''}${hl === 'mounts' ? txt(120, 136, 'N mounts', O, 11) : ''}${hl === 'hmax' ? `<path d="M26 30 V124" stroke="${O}"/>${txt(26, 22, 'max H', O, 11)}` : ''}`),
    rpm: () => svg(`<circle cx="70" cy="70" r="38" fill="${F}"/><path d="M70 70 L96 50" stroke="${O}" stroke-width="4"/><path d="M36 40 A46 46 0 0 1 104 34" stroke="${O}" stroke-width="3"/>${txt(70, 128, 'rpm ÷ 60 = Hz', O)}
      <path d="M130 70 q10 -30 20 0 t20 0 t20 0 t20 0" stroke="${N}"/>`),
    isolation: () => svg(`<path d="M30 118 H220 M30 118 V14" stroke="${L}"/><path d="M30 96 C70 96 84 18 96 18 C110 18 118 90 140 104 S200 114 220 116" stroke="${N}" stroke-width="3"/><path d="M30 96 H220" stroke="${L}" stroke-dasharray="4 4"/>
      <rect x="150" y="100" width="70" height="18" fill="#FFE6CC" stroke="none" opacity=".8"/>${txt(185, 94, 'isolation', O, 11)}${txt(96, 12, 'resonance', N, 10)}`),
    pulse: hl => svg(`<path d="M20 118 H224 M20 118 V14" stroke="${L}"/>${hl === 'rect' ? `<path d="M50 118 V30 H150 V118" stroke="${O}" stroke-width="3"/>` : hl === 'saw' ? `<path d="M50 118 L150 30 V118" stroke="${O}" stroke-width="3"/>` : `<path d="M50 118 C60 20 140 20 150 118" stroke="${O}" stroke-width="3"/>`}
      ${hl === 'peak' ? `<path d="M26 30 H100" stroke="${O}" stroke-dasharray="4 3"/>${txt(60, 24, 'peak g', O)}` : ''}${hl === 'dur' ? `<path d="M50 130 H150" stroke="${O}"/>${txt(100, 128, 'duration ms', O, 11)}` : ''}`),
    fragility: () => svg(`<rect x="70" y="30" width="100" height="74" rx="6" fill="${F}"/><rect x="88" y="46" width="64" height="30" rx="3" fill="#FFE6CC" stroke="${O}"/>${txt(120, 66, 'max g', O)}<path d="M84 104 v14 M156 104 v14" stroke="#333" stroke-width="6"/>${txt(120, 134, 'what the equipment survives', N, 11)}`),
    sway: () => svg(`<rect x="20" y="16" width="200" height="110" rx="6" stroke="${L}"/><rect x="70" y="46" width="100" height="50" rx="4" fill="${F}"/>${arrow(70, 71, 26, 71, O)}${arrow(170, 71, 214, 71, O)}${arrow(120, 46, 120, 20, O)}${txt(120, 116, 'free space all round', O, 11)}`),
    psd: hl => svg(`<path d="M24 118 H226 M24 118 V14" stroke="${L}"/><path d="M40 110 L90 40 H170 L214 104" stroke="${O}" stroke-width="3"/>
      ${txt(40, 132, 'f1', c(hl, 'r_f1'), 11)}${txt(90, 132, 'f2', c(hl, 'r_f2'), 11)}${txt(170, 132, 'f3', c(hl, 'r_f3'), 11)}${txt(214, 132, 'f4', c(hl, 'r_f4'), 11)}${txt(130, 32, 'PSD g²/Hz', c(hl, 'r_psd'), 11)}`),
    ship: hl => svg(`<path d="M10 104 q30 -12 60 0 t60 0 t60 0 t60 0" stroke="${L}"/><g transform="rotate(${hl === 'pitch' ? 0 : -10} 120 80)"><path d="M50 70 H190 L174 98 H66 Z" fill="${F}"/><rect x="104" y="44" width="40" height="26" fill="${F}"/></g>${txt(120, 24, hl === 'pitch' ? 'pitch ±°' : 'roll ±°', O, 13)}`),
    damping: () => svg(`<path d="M20 70 H226" stroke="${L}"/><path d="M20 70 C30 10 40 10 50 70 S70 120 80 70 S100 34 110 70 S130 96 140 70 S160 56 170 70 S190 78 200 70" stroke="${O}" stroke-width="3"/>${txt(120, 132, 'ζ = how fast it settles', N, 11)}`),
    wri: hl => svg(`<rect x="40" y="18" width="160" height="16" rx="3" fill="${hl === 'lug' ? '#FFE6CC' : F}" stroke="${c(hl, 'lug')}" stroke-width="${hl === 'lug' ? 3 : 2}"/><rect x="40" y="106" width="160" height="16" rx="3" fill="${hl === 'lug' ? '#FFE6CC' : F}" stroke="${c(hl, 'lug')}" stroke-width="${hl === 'lug' ? 3 : 2}"/>
      ${[70, 100, 130, 160].map(x => `<ellipse cx="${x}" cy="70" rx="14" ry="36" stroke="${c(hl, 'wire')}" stroke-width="${hl === 'wire' ? 4 : 3}"/>`).join('')}${txt(220, 30, hl === 'wire' ? '' : 'lugs', c(hl, 'lug'), 11)}${hl === 'wire' ? txt(120, 136, 'wire rope', O, 11) : ''}`),
    qty: () => svg(`${[0, 1, 2, 3].map(i => `<rect x="${40 + i * 44}" y="50" width="34" height="40" rx="4" fill="${F}"/>`).join('')}${txt(120, 116, 'pieces to quote', O, 12)}`),
  };
  /* key -> [title, unit, typical, note, picture, highlight] */
  const H = {
    // shock absorbers & crane buffers (selector.html, ids d_<k>)
    d_m: ['Mass', 'kg', 'crane: 5 000 – 200 000 kg · machine: 10 – 5 000 kg', 'The moving mass that actually reaches the buffer — for a crane, bridge + trolley share + load, divided by the buffers that act together.', 'impact', 'm'],
    d_v: ['Rated travel speed', 'm/min', 'EOT cranes 20 – 120 m/min', 'Nameplate travel speed. The chosen standard applies its own factor (e.g. IS 3177 takes a share of the rated speed).', 'impact', 'v'],
    d_v_ms: ['Impact velocity', 'm/s', '0.1 – 3 m/s', 'Speed of the mass at the moment it touches the shock absorber.', 'impact', 'v'],
    d_m2: ['Second mass', 'kg', '', 'For two moving masses hitting each other (e.g. two cranes on one runway).', 'two', 'm2'],
    d_v2: ['Second speed', 'm/min', '', 'Speed of the second mass, towards the first.', 'two', 'v2'],
    d_P: ['Travel motor power', 'kW', 'crane long travel 2 – 60 kW', 'Leave blank if the drive is switched off before impact. Used for the drive force that keeps pushing during the stroke.', 'motor', 'P'],
    d_H_M: ['Stall torque factor', '× (no unit)', 'normally 2.5', 'Motor stall torque ÷ rated torque — how much harder the motor can push than its nominal rating.', 'motor', 'H_M'],
    d_F: ['Propelling force', 'N', 'cylinder: area × pressure', 'A force still acting during the stroke — pneumatic / hydraulic cylinder or drive. 1 kN = 1 000 N.', 'force', 'F'],
    d_C: ['Impacts per hour', '1/h', 'crane end stop 1 – 5 · machine 60 – 2 000', 'How often the absorber is hit. Sets the heat load (Nm per hour).', 'clock', 'C'],
    d_n: ['Buffers taking the impact', 'pieces', '1 or 2', 'How many shock absorbers share this one impact at the same time.', 'impact', 'n'],
    d_mu: ['Friction coefficient', '– (no unit)', 'steel on steel 0.1 – 0.2 · rollers 0.02', 'Friction between the mass and its track.', 'incline', 'mu'],
    d_H: ['Drop height', 'm', '0.05 – 2 m', 'Height the mass falls before it touches the absorber.', 'drop', 'H'],
    d_beta: ['Incline angle', '°', '0 – 60°', 'Slope of the track the mass runs down.', 'incline', 'beta'],
    d_J: ['Moment of inertia', 'kg·m²', '', 'Rotating mass about the pivot (turntables, swinging arms, doors).', 'rotary', 'J'],
    d_omega: ['Angular velocity', 'rad/s', '1 rpm = 0.105 rad/s', 'Rotation speed at impact.', 'rotary', 'omega'],
    d_M_t: ['Drive torque', 'N·m', '', 'Torque still driving the rotation during the stroke.', 'rotary', 'M_t'],
    d_r: ['Torque radius', 'm', '', 'Radius at which the drive torque acts.', 'rotary', 'r'],
    d_R: ['Buffer radius', 'm', '', 'Distance from the pivot to the shock absorber.', 'rotary', 'R'],
    d_temp_min: ['Lowest ambient temperature', '°C', '-10 °C standard seals', 'Coldest temperature at the absorber in service.', 'temp'],
    d_temp_max: ['Highest ambient temperature', '°C', '+80 °C standard seals', 'Hottest temperature at the absorber in service (foundry, outdoor sun).', 'temp'],
    d_max_stroke: ['Available stroke', 'mm', 'leave blank if unconstrained', 'The most travel the buffer may have — e.g. space at the end stop.', 'impact', 'stroke'],
    // rubber mounts (rubber.html)
    mass: ['Supported mass', 'kg', '50 – 10 000 kg', 'Total mass resting on all the mounts (machine + base frame + fluids).', 'mounts', 'mass'],
    mounts: ['Number of mounts', 'pieces', '4 – 8', 'How many mounts carry the machine.', 'mounts', 'mounts'],
    rpm: ['Running speed', 'rpm', 'genset 1 500 · pump 2 900 · fan 960', 'Lowest running speed of the machine — gives the disturbing frequency (rpm ÷ 60 = Hz). Leave empty for a bump-only check.', 'rpm'],
    iso: ['Isolation wanted', '%', '80 – 95 %', 'How much of the vibration should not reach the floor. 90 % = only one tenth passes through.', 'isolation'],
    cg: ['CG load factor', '× (1.0 = central)', '1.0 – 1.3', 'Raise it when the centre of gravity is off-centre, so the most-loaded mount is checked.', 'mounts', 'cg'],
    bg: ['Bump peak', 'g (1 g = 9.81 m/s²)', 'road transport 5 – 15 g · ship 10 – 60 g', 'Highest acceleration of the bump the equipment must survive.', 'pulse', 'peak'],
    bms: ['Pulse duration', 'ms', '6 – 18 ms (test standards: 6, 11, 16 ms)', 'How long the bump lasts. Longer pulses need much more travel.', 'pulse', 'dur'],
    bshape: ['Pulse shape', '—', 'half-sine for most standards', 'Half-sine (IEC 60068-2-27, JSS 55555), rectangular or terminal-peak sawtooth (MIL-STD-810).', 'pulse', 'shape'],
    bfrag: ['Equipment can take', 'g', 'electronics 10 – 30 g', 'The most acceleration the equipment tolerates — from its datasheet or test.', 'fragility'],
    bsway: ['Free travel around it', 'mm', '10 – 50 mm', 'Clear space around the equipment in every direction the bump comes from.', 'sway'],
    // wire rope isolators (wri/index.html)
    l_mass: ['Equipment mass M', 'kg', '5 – 5 000 kg', 'Total mass carried by the isolators.', 'mounts', 'mass'],
    m_n: ['Number of isolators N', 'pieces', '4 – 8', 'Load-carrying isolators (stabilizers are counted separately).', 'mounts', 'mounts'],
    m_nstab: ['Stabilizers', 'pieces', '0 – 4', 'Extra side isolators that stop tall equipment from rocking.', 'mounts', 'mounts'],
    m_cgf: ['CG load factor', '× (1.0 = central)', '1.0 – 1.2', 'Raise it for an off-centre centre of gravity.', 'mounts', 'cg'],
    m_hcg: ['CG height above mounts', 'mm', '100 – 1 000 mm', 'Height of the centre of gravity above the mounting plane — checks rocking.', 'mounts', 'hcg'],
    m_pitch: ['Mount pitch / footprint', 'mm', '', 'Spacing between the isolators (the shorter side of the footprint).', 'mounts', 'pitch'],
    m_hmax: ['Height budget', 'mm', 'leave blank if free', 'Most height available for the isolator.', 'mounts', 'hmax'],
    l_frag: ['Fragility limit', 'g', 'electronics 10 – 30 g', 'The most acceleration the equipment tolerates.', 'fragility'],
    l_zeta: ['Damping ratio ζ', '– (no unit)', 'wire rope 0.10 – 0.20', 'How quickly the isolator settles after a disturbance.', 'damping'],
    l_sfrule: ['Static safety rule', '×', '2 × static load', 'How much margin the isolator rating must keep over the static load.', 'mounts', 'mass'],
    r_f1: ['Roll-on start', 'Hz', '10 – 20 Hz', 'Where the random-vibration spectrum starts rising.', 'psd', 'r_f1'],
    r_f2: ['Plateau start', 'Hz', '50 – 100 Hz', 'Where the flat part (plateau) of the spectrum starts.', 'psd', 'r_f2'],
    r_f3: ['Plateau end', 'Hz', '300 – 500 Hz', 'Where the plateau ends.', 'psd', 'r_f3'],
    r_f4: ['Roll-off end', 'Hz', '1 000 – 2 000 Hz', 'Where the spectrum ends.', 'psd', 'r_f4'],
    r_psd: ['Plateau PSD', 'g²/Hz', '0.01 – 0.1 g²/Hz', 'Level of the plateau (power spectral density) from the test standard.', 'psd', 'r_psd'],
    s_gv: ['Vertical shock', 'g', '15 – 60 g', 'Peak of the vertical shock pulse from the standard.', 'pulse', 'peak'],
    s_gh: ['Horizontal shock', 'g', '10 – 30 g', 'Peak of the horizontal shock pulse.', 'pulse', 'peak'],
    s_tau: ['Pulse duration τ', 'ms', '6 – 11 ms', 'Length of the half-sine shock pulse.', 'pulse', 'dur'],
    sh_roll: ['Roll', '± degrees', 'ships 10 – 40°', 'Side-to-side ship motion — checks the isolators under inclined load.', 'ship', 'roll'],
    sh_pitch: ['Pitch', '± degrees', 'ships 2 – 10°', 'Bow-to-stern ship motion.', 'ship', 'pitch'],
    o_lugs: ['Lugs / retainer material', '—', 'standard: EN8D + Arkor treated', 'Material of the two metal bars that hold the cable. SS 304 / SS 316 for marine and open deck.', 'wri', 'lug'],
    x_lugs: ['Lugs / retainer material', '—', 'standard: EN8D + Arkor treated', 'Material of the two metal bars that hold the cable.', 'wri', 'lug'],
    o_wire: ['Wire rope', '—', 'standard: SS 304', 'Cable material. Stainless for marine duty.', 'wri', 'wire'],
    x_wire: ['Wire rope', '—', 'standard: SS 304', 'Cable material.', 'wri', 'wire'],
    o_qty: ['RFQ quantity', 'pieces', 'N + stabilizers + spares', 'How many isolators to quote.', 'qty'],
  };
  const css = `.ich{position:fixed;right:18px;bottom:18px;width:300px;z-index:9500;background:#fff;color:#1F2A37;border:1px solid #D8E0EA;border-radius:14px;box-shadow:0 16px 40px rgba(15,25,45,.22);padding:12px 14px 12px;font:13.5px/1.45 Poppins,Arial,sans-serif;opacity:0;transform:translateY(10px);transition:opacity .18s,transform .18s;pointer-events:none}
  .ich.on{opacity:1;transform:none;pointer-events:auto}
  .ich h4{margin:0 22px 2px 0;font-size:15px;color:${N}}.ich .u{display:inline-block;background:#FFF1E3;color:#B85C00;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:600;margin-bottom:4px}
  .ich .pic{background:#F7F9FC;border-radius:10px;margin:6px 0 8px}.ich p{margin:0 0 4px}.ich .ty{color:#5A6672;font-size:12.5px}.ich .x{position:absolute;right:10px;top:8px;border:0;background:none;font-size:18px;color:#8895A5;cursor:pointer}
  @media (max-width:760px){.ich{left:8px;right:8px;bottom:8px;width:auto;display:grid;grid-template-columns:110px 1fr;gap:0 10px;padding:10px}.ich .pic{grid-row:1/5;margin:0;align-self:center}.ich .pic svg{height:90px}}`;
  let box = null, hideT = null, cur = null;
  function ensure() {
    if (box) return box;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    box = document.createElement('aside'); box.className = 'ich'; box.setAttribute('role', 'note'); box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<button class="x" aria-label="Close help">×</button><div class="pic"></div><h4></h4><span class="u"></span><p class="d"></p><p class="ty"></p>';
    box.querySelector('.x').onclick = () => hide(true);
    box.addEventListener('mouseenter', () => clearTimeout(hideT)); box.addEventListener('mouseleave', () => hide());
    document.body.appendChild(box); return box;
  }
  let muted = false;
  function show(id) {
    const h = H[id]; if (!h || muted) return; clearTimeout(hideT); ensure();
    if (cur !== id) { const [title, unit, typ, note, pic, hl] = h;
      box.querySelector('.pic').innerHTML = PICS[pic] ? PICS[pic](hl) : ''; box.querySelector('h4').textContent = title;
      box.querySelector('.u').textContent = 'Unit: ' + unit; box.querySelector('.d').textContent = note; box.querySelector('.ty').textContent = typ ? 'Typical: ' + typ : ''; cur = id; }
    box.classList.add('on');
  }
  function hide(now) { clearTimeout(hideT); hideT = setTimeout(() => { if (box) box.classList.remove('on'); cur = null; if (now === true) { muted = true; setTimeout(() => { muted = false; }, 4000); } }, now === true ? 0 : 350); }
  const key = el => (el && el.id && H[el.id] ? el.id : null);
  document.addEventListener('focusin', e => { const k = key(e.target); if (k) show(k); });
  document.addEventListener('focusout', e => { if (key(e.target)) hide(); });
  document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('input,select,label'); if (!el) return; const k = key(el.tagName === 'LABEL' ? (el.htmlFor ? document.getElementById(el.htmlFor) : el.parentElement && el.parentElement.querySelector('input,select')) : el); if (k && matchMedia('(hover:hover)').matches) show(k); });
  document.addEventListener('mouseout', e => { const el = e.target.closest && e.target.closest('input,select,label'); if (el && document.activeElement && !key(document.activeElement)) hide(); });
  window.ICHelp = { show, hide, fields: H };
})();
