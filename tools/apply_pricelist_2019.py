"""Apply 'Price List India 2022-23.pdf' (list WEF 13-03-2019 + additional models 14-03-2018)
and Paresh's confirmation AWRI-127-60 = Rs 15,500 (from the WR costing sheets), 25-Sep-2026.

Policy (claude/ImpactCal-pricing-policy.md): a price found in a file beats an estimate; the highest
file price wins. Variant rule used here: the catalogue model is the plain body, so the M price is used
where M/F/U variants are listed (F = flange, charged as an accessory).

Held back (reported, not applied):
  AD 85-150  file 30,550 (2018) is below AD 85-125 at 40,000 (newer list)  -> keep estimate
  AC-8-6 / AC-10-5 / AC-12-10  only F-variant prices listed (3,200 / 2,900 / 1,800) -> keep M prices
"""
import csv, io, math, os
B = os.path.join(os.path.dirname(__file__), '..', 'data')
SRC = 'price list 2019 (Price List India 2022-23.pdf)'
SRC18 = 'additional models 2018 (Price List India 2022-23.pdf)'
NEW = {  # key: (file price, source)
    'AD1410': (1400, SRC), 'AD1613': (2400, SRC), 'AC1410': (1100, SRC),
    'YSR88': (2500, SRC), 'YSR1212': (2200, SRC),
    'AC6450': (11000, SRC18), 'AC64100': (12500, SRC18),
    'AD4225': (8500, SRC18), 'AD4250': (11800, SRC18), 'AD4275': (12000, SRC18),
    'AD6450': (15000, SRC18), 'AD64100': (17500, SRC18),
    'AD115150': (44000, SRC18), 'AD115200': (50000, SRC18), 'AD115250': (55000, SRC18),
}
WRI = {'AWRI-127-60': (15500, 'Paresh 25-09-2026, from WR costing sheets')}


def rnd(p):
    step = 50 if p < 10000 else 100
    return int(math.ceil(p / step) * step)


def load(p):
    raw = open(p, encoding='utf-8-sig', newline='').read()
    nl = '\r\n' if '\r\n' in raw[:500] else '\n'
    rd = csv.DictReader(io.StringIO(raw)); return rd.fieldnames, list(rd), nl


def save(p, hdr, rows, nl):
    out = io.StringIO(); w = csv.DictWriter(out, hdr, lineterminator=nl); w.writeheader(); w.writerows(rows)
    open(p, 'w', encoding='utf-8-sig', newline='').write(out.getvalue())


cp = os.path.join(B, 'costing.csv'); hdr, cost, nl = load(cp)
changes = []
for r in cost:
    tgt = NEW.get(r['key']) if r['table'] == 'shock_absorbers' else WRI.get(r['key']) if r['table'] == 'wire_rope_isolators' else None
    if not tgt: continue
    p, src = tgt; old = r['list_inr']
    r.update(basis='file', file_price=str(p), file_source=src, margin_pct='0.0', list_inr=str(rnd(p)), dealer_inr=str(rnd(rnd(p) * 0.8)))
    changes.append((r['model'], old, r['list_inr']))
save(cp, hdr, cost, nl)
lists = {(r['table'], r['key']): r['list_inr'] for r in cost}

sp = os.path.join(B, 'shock_absorbers.csv'); h, sa, n2 = load(sp)
for r in sa:
    if r['bk'] in NEW: r['price_inr'] = lists[('shock_absorbers', r['bk'])]
save(sp, h, sa, n2)
wp = os.path.join(B, 'wire_rope_isolators.csv'); h, w, n3 = load(wp)
for r in w:
    if r['model'] in WRI: r['price_inr'] = lists[('wire_rope_isolators', r['model'])]
save(wp, h, w, n3)
for m, o, nw in changes: print(f'{m:14} {o:>7} -> {nw:>7}')
