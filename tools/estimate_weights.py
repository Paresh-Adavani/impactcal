"""Estimated unit weights (kg) for packing & freight (Rs/kg rule, settings freight.rate_per_kg).

  shock_absorbers  AKHG / AKHS crane buffers: ADONI TECH assembly weights from
                     "all crane buffers costing dec 2025.xlsx" (bores 65, 85, 130/140, 150, 180),
                     interpolated in stroke, and in bore (log) for 100 / 120 / 160 / 190.
                   PU buffers (JHQ-C): PU block sized from max force (5.5 MPa) and stroke (60 % compression) + base plate.
                   spring buffers (SB): spring steel energy density 1.55 MJ/m3, x2 for housing.
                   all other series: fit log W = a + b log E + c log S on the ACE + Enidine
                     reference catalogues (689 models with published weights), industrial and
                     crane fitted separately. Typical error +-35 %.
  rubber_mounts    rubber kg + metal kg from the costing build-up (data/costing.csv).
  wire_rope_isolators already carry weight_kg from the AWRI database.

Every value is an estimate - correct any figure in the CSV (Admin -> CSV database) and it is used as is.
Run: python3 tools/estimate_weights.py   (only fills blanks unless --all)
"""
import csv, io, math, os, re, sys
import numpy as np
B = os.path.join(os.path.dirname(__file__), '..', 'data'); R = os.path.join(B, 'reference')
ALL = '--all' in sys.argv

# ADONI TECH assembly weights, kg  {bore: {stroke: kg}}
AKHG = {
    65: {25: 6, 50: 7, 75: 8, 100: 9, 125: 10, 150: 11, 200: 12},
    85: {100: 12, 200: 15, 300: 18, 400: 20, 500: 22},
    130: {100: 60, 150: 72, 200: 85, 300: 110, 400: 135, 500: 150, 600: 160, 800: 185, 1000: 200},
    140: {100: 60, 150: 72, 200: 85, 300: 110, 400: 135, 500: 150, 600: 160, 800: 185, 1000: 200},
    150: {100: 77, 300: 135, 400: 146, 500: 166, 600: 176, 800: 220, 1000: 253},
    180: {100: 110, 200: 123, 250: 140, 400: 168, 500: 198, 600: 235, 800: 295},
}


def interp_stroke(tbl, s):
    xs = sorted(tbl); ys = [tbl[x] for x in xs]
    if s <= xs[0]: return ys[0] * (s / xs[0]) ** 0.35 if s < xs[0] else ys[0]
    if s >= xs[-1]: return ys[-1] + (ys[-1] - ys[-2]) / (xs[-1] - xs[-2]) * (s - xs[-1])
    return float(np.interp(s, xs, ys))


def akhg(bore, s):
    if bore in AKHG: return interp_stroke(AKHG[bore], s)
    bores = sorted(AKHG)
    lo = max([b for b in bores if b < bore], default=bores[0]); hi = min([b for b in bores if b > bore], default=bores[-1])
    if lo == hi: return interp_stroke(AKHG[lo], s) * (bore / lo) ** 2.5
    wl, wh = interp_stroke(AKHG[lo], s), interp_stroke(AKHG[hi], s)
    t = math.log(bore / lo) / math.log(hi / lo)
    return math.exp(math.log(wl) + t * (math.log(wh) - math.log(wl)))


def fit():
    import pandas as pd
    a = pd.concat([pd.read_csv(os.path.join(R, 'ace_industrial_shock_absorbers.csv')).assign(g='industrial'),
                   pd.read_csv(os.path.join(R, 'ace_crane_buffers.csv')).assign(g='crane'),
                   pd.read_csv(os.path.join(R, 'enidine_shock_absorbers.csv')).assign(g='industrial')])
    for c in ['stroke_mm', 'energy_per_cycle_nm', 'weight_kg']: a[c] = pd.to_numeric(a[c], errors='coerce')
    a = a.dropna(subset=['stroke_mm', 'energy_per_cycle_nm', 'weight_kg']); a = a[(a.weight_kg > 0) & (a.energy_per_cycle_nm > 0)]
    out = {}
    for g, d in a.groupby('g'):
        X = np.c_[np.ones(len(d)), np.log(d.energy_per_cycle_nm), np.log(d.stroke_mm)]
        out[g], *_ = np.linalg.lstsq(X, np.log(d.weight_kg), rcond=None)
    return out


def load(p):
    raw = open(p, encoding='utf-8-sig', newline='').read(); nl = '\r\n' if '\r\n' in raw[:500] else '\n'
    rd = csv.DictReader(io.StringIO(raw)); return list(rd.fieldnames), list(rd), nl


def save(p, hdr, rows, nl):
    out = io.StringIO(); w = csv.DictWriter(out, hdr, lineterminator=nl); w.writeheader(); w.writerows(rows)
    open(p, 'w', encoding='utf-8-sig', newline='').write(out.getvalue())


def kg(x):
    return f'{x:.2f}' if x < 10 else f'{x:.1f}' if x < 100 else f'{x:.0f}'


if __name__ == '__main__':
    C = fit()
    p = os.path.join(B, 'shock_absorbers.csv'); hdr, rows, nl = load(p)
    if 'weight_kg' not in hdr: hdr.insert(hdr.index('hsn'), 'weight_kg')
    n = 0
    for r in rows:
        if r.get('weight_kg') and not ALL: continue
        s = float(r['stroke_mm'] or 0); e = float(r['nm_per_cycle'] or 0)
        if r['series'] in ('AKHG', 'AKHS'):
            bore = int(re.findall(r'\d+', r['model'])[0]); w = akhg(bore, s) * (1.1 if r['series'] == 'AKHS' else 1)
        elif r['technology'] == 'pu' and s and r.get('fs_max_N'):
            # PU buffer: face area from max force at ~5.5 MPa, free height = stroke / 0.6, plus a 10 mm steel base plate
            D = math.sqrt(4 * float(r['fs_max_N']) / (math.pi * 5.5)); H = s / 0.6
            w = 1.2e-6 * math.pi / 4 * D * D * H + 7.85e-6 * (D + 20) ** 2 * 10
        elif r['technology'] == 'spring' and e:
            # spring buffer: spring steel stores ~1.55 MJ/m3 (tau 700 MPa); housing + plates double it
            w = max(1.5, 2.0 * e / 1.55e6 * 7850)
        elif s and e:
            c = C['crane' if r['group'] == 'crane' else 'industrial']; w = math.exp(c[0] + c[1] * math.log(e) + c[2] * math.log(s))
        else: continue
        r['weight_kg'] = kg(w); n += 1
    save(p, hdr, rows, nl); print('shock_absorbers weights set:', n)

    cost = {r['key']: r for r in csv.DictReader(open(os.path.join(B, 'costing.csv'), encoding='utf-8-sig')) if r['table'] == 'rubber_mounts'}
    p = os.path.join(B, 'rubber_mounts.csv'); hdr, rows, nl = load(p)
    if 'weight_kg' not in hdr: hdr.insert(hdr.index('hsn'), 'weight_kg')
    n = 0
    for r in rows:
        if r.get('weight_kg') and not ALL: continue
        c = cost.get(r['model'])
        if c and c.get('rubber_kg'): r['weight_kg'] = kg(float(c['rubber_kg'] or 0) + float(c['metal_kg'] or 0)); n += 1
    save(p, hdr, rows, nl); print('rubber_mounts weights set:', n)
