"""AT-RCM cylindrical rubber mounts -> data/rubber_mounts.csv + data/costing.csv

Source: supplier catalogue tables (pages 2-3 of the cylindrical-mount catalogue kept in Drive),
transcribed 25-Sep-2026. The supplier part number is kept only in the internal `source`
column as a cross-reference for purchasing; nothing customer-facing names the supplier.

Style codes
  SU  stud one end, plain rubber face other end          (unilateral stud)
  SS  studs both ends                                    (bilateral studs)
  SF  stud one end, tapped hole other end                (mixed)
  FF  tapped holes both ends                             (double screw hole)
  F0  tapped hole one end, plain rubber face other end   (one-end threaded hole)

Engineering values (MKS)
  rated compression load  daN -> N = x10 ; load_max_kg = N / 9.81
  static stiffness        k = rated load / deflection at rated load  (secant, N/mm)
  natural frequency       fn = (1/2pi) sqrt(g / d)  at rated load
  shear (radial) rating   kept in the note, k_shear = shear load / shear deflection

Price: local moulding cost build-up exactly as pricing/price_model.py (rubber compound,
moulding per shot + per kg, hardware, mould amortised over 50 pcs, +50 %), with a solid
cylinder volume. Check: 20x15 M8 SS and 12x10 M5 SS come out at the Rs 450 file price.

Run:  python3 tools/build_rcm.py      (idempotent - replaces all AT-RCM rows)
"""
import csv, math, io, os

B = os.path.join(os.path.dirname(__file__), '..', 'data')
G = 9.81

# (style, D, thread, G_stud, H_hole, [(B, load_daN, defl_mm, shear_daN, shear_mm, supplier_part), ...])
T = [
 # ---------------- SU unilateral stud (compression only published)
 ('SU', 12.5, 'M5', 10, None, [(10, 12, 2, None, None, '511110'), (13.5, 11, 2.5, None, None, '511128'), (15, 10, 3, None, None, '511115'), (20, 8, 3.5, None, None, '511125')]),
 ('SU', 16, 'M4', 10, None, [(10, 20, 2, None, None, '511150'), (15, 20, 3, None, None, '511151')]),
 ('SU', 16, 'M5', 12, None, [(10, 20, 2, None, None, '511292'), (15, 20, 3, None, None, '511294'), (20, 15, 4, None, None, '511296'), (25, 15, 5, None, None, '511298')]),
 ('SU', 20, 'M6', 10, None, [(5, 77, 0.6, None, None, '511206'), (8.5, 40, 1.5, None, None, '511200/11')]),
 ('SU', 20, 'M6', 16.5, None, [(8.5, 40, 1.5, None, None, '511200'), (15, 35, 4, None, None, '511215'), (20, 30, 5, None, None, '511220'), (25, 30, 5.5, None, None, '511225'), (30, 25, 7, None, None, '511230')]),
 ('SU', 25.5, 'M6', 18, None, [(10, 80, 2, None, None, '511158'), (15, 60, 3.5, None, None, '511155'), (20, 50, 5, None, None, '511159'), (30, 50, 8, None, None, '511160')]),
 ('SU', 25.5, 'M8', 20, None, [(5, 82, 0.6, None, None, '511265/50'), (10, 80, 2, None, None, '511265'), (15, 60, 3.5, None, None, '511270')]),
 ('SU', 25.5, 'M8', 12, None, [(15, 60, 3.5, None, None, '311270/13')]),
 ('SU', 25.5, 'M8', 20, None, [(19, 55, 4.5, None, None, '511251'), (22, 50, 5.5, None, None, '511275'), (25, 50, 6, None, None, '511280'), (30, 50, 8, None, None, '511285'), (40, 50, 10, None, None, '511290')]),
 ('SU', 30, 'M8', 25, None, [(15, 90, 3.5, None, None, '511308'), (22, 80, 6, None, None, '511310'), (30, 70, 8, None, None, '511312'), (40, 60, 9, None, None, '511314')]),
 ('SU', 40, 'M8', 20, None, [(30, 120, 7, None, None, '511157'), (40, 120, 10, None, None, '511161')]),
 ('SU', 40, 'M10', 25, None, [(20, 160, 5, None, None, '511450'), (25, 150, 6, None, None, '511401'), (35, 120, 8, None, None, '511452'), (40, 120, 10, None, None, '511454'), (45, 120, 11, None, None, '511456')]),
 ('SU', 50, 'M10', 25, None, [(25, 300, 6, None, None, '511525'), (35, 250, 9, None, None, '511535'), (45, 190, 11, None, None, '511545')]),
 ('SU', 60, 'M10', 25, None, [(22, 350, 3, None, None, '513601'), (25, 400, 6, None, None, '511625'), (36, 300, 9, None, None, '511635'), (45, 250, 11, None, None, '511645')]),
 ('SU', 70, 'M10', 25, None, [(35, 450, 9, None, None, '511735'), (50, 350, 12, None, None, '511750'), (70, 300, 14, None, None, '511770')]),
 ('SU', 80, 'M14', 45, None, [(25, 1100, 6, None, None, '513801')]),
 ('SU', 80, 'M14', 35, None, [(30, 950, 8, None, None, '511830'), (40, 600, 10, None, None, '511840'), (70, 500, 17, None, None, '511870'), (80, 450, 19, None, None, '511880')]),
 # ---------------- SS bilateral studs
 ('SS', 10, 'M3', 6, None, [(8, 10, 1.6, 1.25, 0.9, '')]),
 ('SS', 12, 'M3', 6, None, [(8, 12, 1.2, 1.5, 0.75, '')]),
 ('SS', 12.5, 'M5', 10, None, [(10, 12, 2, 1.5, 1.5, '521293'), (15, 10, 3, 2.5, 2, '521128'), (20, 8, 3.5, 2.5, 4, '521295')]),
 ('SS', 16, 'M4', 10, None, [(10, 20, 1.5, 2.5, 1.5, '521650'), (15, 20, 3, 2.5, 2, '521651')]),
 ('SS', 16, 'M5', 12, None, [(10, 20, 1.5, 2.5, 1.5, '521292'), (15, 20, 3, 2.5, 2, '521294'), (20, 15, 4, 2.5, 4, '521296'), (25, 15, 5, 2, 5, '521298')]),
 ('SS', 20, 'M6', 16.5, None, [(8.5, 40, 0.6, 5, 1, '521178'), (15, 35, 3, 5, 2.5, '521249'), (20, 30, 4.5, 5, 3.5, '521297'), (25, 30, 5.5, 4.5, 4.5, '521299'), (30, 25, 7, 4.5, 4.5, '521319')]),
 ('SS', 25.5, 'M6', 18, None, [(10, 80, 1.5, 8, 1.5, '521655'), (15, 60, 2.5, 8, 2.5, '521656'), (20, 50, 2, 8, 4, '521652'), (30, 50, 7.5, 8, 6, '521653')]),
 ('SS', 25.5, 'M8', 20, None, [(10, 80, 1.5, 8, 1.5, '521340'), (15, 60, 2.5, 8, 2.5, '521341'), (22, 50, 4, 8, 4, '521251'), (25, 50, 5.5, 8, 4.5, '521342'), (30, 50, 7.5, 8, 6, '521343'), (40, 50, 10, 6.5, 6, '521344')]),
 ('SS', 30, 'M8', 25, None, [(15, 90, 3, 11, 2.5, '521308'), (22, 80, 5, 11, 4, '521310'), (30, 70, 8, 11, 6, '521312'), (40, 60, 9, 11, 7.5, '521314')]),
 ('SS', 40, 'M8', 20, None, [(30, 150, 6, 20, 5.5, '521181'), (40, 120, 10, 20, 7.5, '521657')]),
 ('SS', 40, 'M10', 25, None, [(20, 160, 4, 20, 3, '521450'), (28, 150, 6, 20, 5.5, '521401'), (35, 120, 8, 20, 6.5, '521452'), (40, 120, 10, 20, 7.5, '521454'), (45, 120, 11, 20, 9, '521456')]),
 ('SS', 50, 'M10', 25, None, [(25, 300, 6, 25, 4.5, '521580'), (35, 250, 8, 25, 7, '521581'), (45, 190, 11, 25, 9, '521582')]),
 ('SS', 50, 'M10', 15, None, [(45, 190, 11, 25, 9, '521582/15')]),
 ('SS', 60, 'M10', 25, None, [(25, 400, 5, 30, 4.5, '521601'), (36, 300, 8, 30, 7, '521603'), (45, 250, 11, 30, 9, '521641')]),
 ('SS', 70, 'M10', 25, None, [(35, 450, 8, 35, 6.5, '521705'), (50, 350, 11, 35, 11, '521710'), (70, 300, 14, 35, 15, '521711')]),
 ('SS', 80, 'M12', 28, None, [(40, 600, 9, 40, 7, '521658')]),
 ('SS', 80, 'M14', 45, None, [(30, 950, 7, 40, 5, '521803')]),
 ('SS', 80, 'M14', 35, None, [(30, 950, 7, 40, 5, '521840'), (40, 600, 9, 40, 7, '521841'), (70, 500, 17, 40, 15, '521842'), (80, 450, 19, 40, 17, '521843')]),
 ('SS', 100, 'M16', 47, None, [(40, 1100, 8, 60, 7, '521908'), (55, 900, 12, 60, 10, '521909'), (80, 750, 19, 60, 17, '521910')]),
 # ---------------- SF mixed: stud + tapped hole
 ('SF', 16, 'M4', 10, 2, [(10, 20, 1.5, 2.5, 1.5, '520053'), (15, 20, 3, 2.5, 2, '520054')]),
 ('SF', 16, 'M5', 12, 3, [(10, 20, 1.5, 2.5, 1.5, '520010'), (15, 20, 3, 2.5, 2, '520011'), (20, 15, 4, 2.5, 4, '520012'), (25, 15, 5, 2, 5, '520013')]),
 ('SF', 20, 'M6', 16.5, 4, [(15, 35, 2.5, 5, 2.5, '520015'), (20, 30, 4.5, 5, 5, '520016'), (25, 30, 5.5, 4.5, 4.5, '520017'), (30, 25, 7, 4.5, 4.5, '520018')]),
 ('SF', 25.5, 'M6', 18, 4, [(15, 60, 2.5, 8, 8.5, '520052'), (20, 50, 3.5, 8, 4, '520055'), (30, 50, 7.5, 8, 6, '520057')]),
 ('SF', 25.5, 'M8', 20, 6, [(22, 50, 3.5, 8, 4, '520021'), (25, 50, 5, 8, 4.5, '520022'), (30, 50, 7.5, 8, 6, '520023'), (40, 50, 10, 6, 6, '520024')]),
 ('SF', 30, 'M8', 25, 6, [(15, 90, 3, 11, 2.5, '520025'), (22, 80, 4.5, 11, 4, '520026'), (30, 70, 7.5, 11, 6, '520027'), (40, 60, 9, 11, 7.5, '520028')]),
 ('SF', 40, 'M8', 20, 6, [(30, 150, 4.5, 20, 5.5, '520056'), (40, 120, 10, 20, 7.5, '520058')]),
 ('SF', 40, 'M10', 25, 8, [(20, 160, 4, 20, 3, '520029'), (28, 150, 5, 20, 5.5, '520030'), (35, 120, 7.5, 20, 6.5, '520031'), (40, 120, 10, 20, 7.5, '520032'), (45, 120, 11, 20, 9, '520033')]),
 ('SF', 50, 'M10', 15, 8, [(45, 190, 11, 25, 9, '520036/15')]),
 ('SF', 50, 'M10', 25, 8, [(35, 250, 8, 25, 7, '520035'), (45, 190, 11, 25, 9, '520036')]),
 ('SF', 60, 'M10', 25, 8, [(36, 300, 8, 30, 7, '520038'), (45, 250, 10, 30, 9, '520039')]),
 ('SF', 70, 'M10', 25, 9, [(35, 450, 7.5, 35, 6.5, '520040'), (50, 350, 10, 35, 11, '520041'), (70, 300, 14, 35, 15, '520042')]),
 ('SF', 80, 'M12', 28, 10, [(40, 600, 8, 40, 7, '520059')]),
 ('SF', 80, 'M14', 35, 12, [(40, 600, 8, 40, 7, '520044'), (70, 500, 17, 40, 15, '520045'), (80, 450, 19, 40, 17, '520046')]),
 ('SF', 100, 'M16', 47, 14, [(40, 1100, 8, 60, 7, '520100'), (55, 900, 12, 60, 10, '520101'), (80, 750, 19, 60, 17, '520102'), (100, 600, 23, 60, 20, '520103')]),
 # ---------------- FF tapped holes both ends
 ('FF', 16, 'M4', None, 2.5, [(10, 20, 1.5, 2.5, 1.5, '520550'), (15, 20, 3, 2.5, 2, '520551')]),
 ('FF', 16, 'M5', None, 3, [(10, 20, 1.5, 2.5, 1.5, '520500'), (15, 20, 3, 2.5, 2, '520501'), (20, 15, 4, 2.5, 4, '520502'), (25, 15, 5, 2, 5, '520503')]),
 ('FF', 20, 'M6', None, 4, [(15, 35, 2.5, 5, 2.5, '520505'), (20, 30, 4.5, 5, 3.5, '520506'), (25, 30, 5.5, 4.5, 4.5, '520507'), (30, 25, 7, 4.5, 4.5, '520508')]),
 ('FF', 25.5, 'M6', None, 4, [(20, 50, 3, 8, 4, '520554'), (30, 50, 7.5, 8, 6, '520555')]),
 ('FF', 25.5, 'M8', None, 6, [(22, 50, 3, 8, 4, '520511'), (25, 50, 4.5, 8, 4.5, '520512'), (30, 50, 7.5, 8, 6, '520513'), (40, 50, 10, 6, 6, '520514')]),
 ('FF', 30, 'M8', None, 6, [(22, 80, 4, 11, 4, '520516'), (30, 70, 7.5, 11, 6, '520517'), (40, 60, 9, 11, 7.5, '520518')]),
 ('FF', 40, 'M8', None, 6, [(30, 150, 4.5, 20, 5.5, '520552'), (40, 120, 10, 20, 7.5, '520553')]),
 ('FF', 40, 'M10', None, 8, [(28, 150, 4.5, 20, 5.5, '520520'), (35, 120, 7, 20, 6.5, '520521'), (40, 120, 10, 20, 7.5, '520522'), (45, 120, 11, 20, 9, '520523')]),
 ('FF', 50, 'M10', None, 8, [(35, 250, 7, 25, 7, '520525'), (45, 190, 10, 25, 9, '520526')]),
 ('FF', 60, 'M10', None, 8, [(36, 300, 7, 30, 7, '520528'), (45, 250, 9, 30, 9, '520529')]),
 ('FF', 70, 'M10', None, 9, [(35, 450, 7, 35, 6.5, '520530'), (50, 350, 9, 35, 11, '520531'), (70, 300, 14, 35, 15, '520532')]),
 ('FF', 80, 'M12', None, 10, [(40, 600, 7, 40, 7.5, '520556')]),
 ('FF', 80, 'M14', None, 12, [(40, 600, 7, 40, 7, '520534'), (70, 500, 17, 40, 15, '520535'), (80, 450, 19, 40, 17, '520536')]),
 ('FF', 100, 'M16', None, 14, [(40, 1110, 8, 60, 7, '520541'), (55, 900, 12, 60, 10, '520542'), (60, 1100, 8, 180, 10, '520545'), (75, 600, 10, 140, 12, '520546'), (80, 750, 19, 60, 17, '520543'), (100, 600, 23, 60, 20, '520547')]),
 # ---------------- F0 one end tapped hole, plain face other end (compression only)
 ('F0', 16, 'M4', None, 2.5, [(10, 20, 2, None, None, '511152'), (15, 20, 3, None, None, '511153')]),
 ('F0', 20, 'M6', None, 4, [(15, 35, 4, None, None, '511154')]),
 ('F0', 25.5, 'M6', None, 4, [(15, 60, 3.5, None, None, '511164'), (20, 55, 5.5, None, None, '511162'), (30, 50, 8, None, None, '511163')]),
 ('F0', 30, 'M8', None, 6, [(22, 80, 6, None, None, '511156')]),
 ('F0', 50, 'M10', None, 10, [(20, 343, 3.4, None, None, '511168')]),
]

STYLE = {
 'SU': ('AT-RCM-SU cylindrical mount, stud one end', 'cylindrical rubber mount - male stud / plain face', 'img/mounts/RCM-SU.svg'),
 'SS': ('AT-RCM-SS cylindrical mount, studs both ends', 'cylindrical rubber mount - male / male', 'img/mounts/RCM-SS.svg'),
 'SF': ('AT-RCM-SF cylindrical mount, stud + tapped hole', 'cylindrical rubber mount - male / female', 'img/mounts/RCM-SF.svg'),
 'FF': ('AT-RCM-FF cylindrical mount, tapped holes both ends', 'cylindrical rubber mount - female / female', 'img/mounts/RCM-FF.svg'),
 'F0': ('AT-RCM-F0 cylindrical buffer, tapped hole one end', 'cylindrical rubber buffer - female / plain face', 'img/mounts/RCM-F0.svg'),
}

P = dict(rubber_rate=420.0, rubber_density=1.15, moulding_shot=180.0, moulding_per_kg=260.0, metal_rate=95.0,
         metal_per_kg_machining=140.0, mould_small=28000.0, mould_medium=45000.0, cav_small=8, cav_medium=4,
         mould_qty=50, hardware_min=35.0, margin=0.50, flash=1.10)
DEALER_DISC = 0.20
THREAD_D = {'M3': 3, 'M4': 4, 'M5': 5, 'M6': 6, 'M8': 8, 'M10': 10, 'M12': 12, 'M14': 14, 'M16': 16}


def rnd(p):
    step = 50 if p < 10000 else 100
    return int(math.ceil(p / step) * step)


def cost(style, D, h, thread, g, hh):
    vol = math.pi * (D / 2) ** 2 * h * P['flash']                       # mm3, solid cylinder + flash/sprue
    rub_kg = vol * P['rubber_density'] / 1e6
    rubber = rub_kg * P['rubber_rate']
    moulding = P['moulding_shot'] + rub_kg * P['moulding_per_kg']
    t = 1.5 if D <= 30 else 2.5                                           # bonded plate thickness
    plate = math.pi * ((D - 1) / 2) ** 2 * t                              # one plate
    d = THREAD_D[thread]
    stud = math.pi * (d / 2) ** 2 * (g or 0) * 1.3                        # stud incl. head
    nut = math.pi * ((d * 1.8) / 2) ** 2 * (hh or 0) * 0.6                # captive nut / boss
    plates = {'SU': 1, 'SS': 2, 'SF': 2, 'FF': 2, 'F0': 1}[style]
    studs = {'SU': 1, 'SS': 2, 'SF': 1, 'FF': 0, 'F0': 0}[style]
    nuts = {'SU': 0, 'SS': 0, 'SF': 1, 'FF': 2, 'F0': 1}[style]
    metal_kg = (plates * plate + studs * stud + nuts * nut) * 7.85e-6
    hardware = max(P['hardware_min'], metal_kg * (P['metal_rate'] + P['metal_per_kg_machining']))
    mould, cav = (P['mould_small'], P['cav_small']) if D <= 40 else (P['mould_medium'], P['cav_medium'])
    amort = mould / (P['mould_qty'] * cav)
    unit = rubber + moulding + hardware + amort
    return dict(cavities=cav, rubber_kg=round(rub_kg, 3), rubber_cost=round(rubber), moulding=round(moulding),
                metal_kg=round(metal_kg, 3), hardware=round(hardware), mould_cost=int(mould), mould_amort=round(amort),
                unit_cost=round(unit))


def fmt(x):
    return ('%g' % x) if x is not None else ''


def build():
    rows, cost_rows, seen = [], [], set()
    for style, D, thread, g, hh, items in T:
        fam, typ, img = STYLE[style]
        for (h, load, defl, sl, sd, part) in items:
            code = f'AT-RCM-{style}-{fmt(D)}x{fmt(h)}-{thread}'
            if code in seen:                       # same size, different stud length
                code += f'-G{fmt(g)}'
            assert code not in seen, code
            seen.add(code)
            N = load * 10.0
            k = N / defl
            fn = math.sqrt(G / (defl / 1000)) / (2 * math.pi)
            lmax = round(N / G, 1)
            lmin = round(lmax * 0.2, 1)
            c = cost(style, D, h, thread, g, hh)
            lst = rnd(c['unit_cost'] * (1 + P['margin']))
            dims = f'D{fmt(D)} x H{fmt(h)} mm, {thread}' + (f' stud {fmt(g)} mm' if g else '') + (f', tapped depth {fmt(hh)} mm' if hh else '')
            shear = f'; shear (radial) rating {fmt(sl)} daN at {fmt(sd)} mm, k_shear {sl * 10 / sd:.0f} N/mm' if sl else '; shear rating not published - compression use'
            note = f'{dims}; compression {fmt(load)} daN at {fmt(defl)} mm{shear}. Imported or moulded locally in India.'
            rows.append(dict(model=code, family=fam, type=typ, mount_style=style, load_min_kg=fmt(lmin), load_max_kg=fmt(lmax),
                             natural_freq_hz=f'{fn:.1f}', stiffness_n_mm=f'{k:.0f}', static_deflection_mm=fmt(defl),
                             height_mm=fmt(h), dia_mm=fmt(D), length_mm='', width_mm='', thread=thread,
                             material='Natural rubber, galvanised steel plates', hardness_shore='', temp_min_c='-30', temp_max_c='70',
                             weight_kg=f"{c['rubber_kg'] + c['metal_kg']:.2f}", hsn='40169990', gst_rate='18', uom='NOS', price_inr=str(lst), lead_time_days='21', status='active',
                             image=img, ga_pdf='', source='AT-RCM range (import / local moulding). Supplier ref ' + (part or 'n/a'),
                             note=note))
            cost_rows.append(dict(table='rubber_mounts', key=code, series=fam, model=code, basis='cost', file_price='', file_source='',
                                  estimate=c['unit_cost'], margin_pct='50.0', list_inr=lst, dealer_inr=rnd(lst * (1 - DEALER_DISC)),
                                  lead_time_days=21, note=f"local moulding: rubber {c['rubber_kg']} kg + moulding + hardware {c['metal_kg']} kg + mould {c['mould_cost']}/{P['mould_qty']}", **c))
    return rows, cost_rows


def replace(path, new_rows, is_ours):
    with open(path, encoding='utf-8-sig', newline='') as f:
        rd = csv.DictReader(f); header = rd.fieldnames; old = [r for r in rd if not is_ours(r)]
    out = io.StringIO(); w = csv.DictWriter(out, fieldnames=header, lineterminator='\r\n' if '\r\n' in open(path, encoding='utf-8-sig', newline='').read(300) else '\n')
    w.writeheader(); [w.writerow(r) for r in old]; [w.writerow({k: r.get(k, '') for k in header}) for r in new_rows]
    open(path, 'w', encoding='utf-8-sig', newline='').write(out.getvalue())
    return len(old), len(new_rows)


if __name__ == '__main__':
    rows, cost_rows = build()
    print('rubber_mounts: kept %d, AT-RCM %d' % replace(os.path.join(B, 'rubber_mounts.csv'), rows, lambda r: r['model'].startswith('AT-RCM-')))
    print('costing:       kept %d, AT-RCM %d' % replace(os.path.join(B, 'costing.csv'), cost_rows, lambda r: r['key'].startswith('AT-RCM-')))
    by = {}
    for r in rows: by.setdefault(r['mount_style'], []).append(int(r['price_inr']))
    for s, p in by.items(): print(f'  {s}: {len(p)} sizes, list Rs {min(p)} - {max(p)}')
    chk = {r['model']: r['price_inr'] for r in rows}
    print('  check vs file price Rs 450:', chk.get('AT-RCM-SS-20x15-M6'), '(20x15, M6 here; file was M8)', chk.get('AT-RCM-SS-12.5x10-M5'))
