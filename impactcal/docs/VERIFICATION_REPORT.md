# Catalogue verification report

Generated 2026-09-22 by `npm run verify`. Reference: ACE Main Catalog 2018 (metric) worked examples p.11-13 and safety examples p.275; Enidine WR / EKD OVTW worksheet formulas.

| ex | quantity | catalogue | ImpactCal | result | note |
|---|---|---|---|---|---|
| 1 | E1 weight w/o propelling force | 113 | 113 | ok |  |
| 1 | E3 | 113 | 113 | ok |  |
| 1 | E4 /hr | 56,500 | 56,250 | ok |  |
| 1 | We | 100 | 100 | ok |  |
| 2 | E1 with propelling force | 40.5 | 40.5 | ok |  |
| 2 | E2 = F·s | 10 | 10 | ok |  |
| 2 | E3 | 51 | 50.5 | ok |  |
| 2 | E4 | 51,000 | 50,500 | ok |  |
| 2 | We = 2E3/v² | 45 | 44.9 | ok |  |
| 3 | E1 with motor drive | 576 | 576 | ok |  |
| 3 | E2 = 1000·P·ST·s/v | 834 | 833 | ok |  |
| 3 | E3 | 1,410 | 1,409 | ok |  |
| 3 | E4 | 1,41,000 | 1,40,933 | ok |  |
| 3 | We | 1,958 | 1,957 | ok |  |
| 4 | E1 driven rollers | 281 | 281 | ok |  |
| 4 | E2 = µ·W·g·s | 25 | 24.5 | ok |  |
| 4 | E3 | 306 | 306 | ok |  |
| 4 | E4 | 55,080 | 55,039 | ok |  |
| 4 | We | 272 | 272 | ok |  |
| 6 | E1 free fall = W·g·H | 147 | 147 | ok |  |
| 6 | E2 = W·g·s | 15 | 14.7 | ok |  |
| 6 | E3 | 162 | 162 | ok |  |
| 6 | E4 | 64,800 | 64,746 | ok |  |
| 6 | We | 33 | 33 | ok | vD = √(2gH) |
| 6.1 | E1 incline (v from H=0.1 m) | 491 | 491 | ok |  |
| 6.1 | E2 = W·g·s·(sinβ+µ·cosβ) | 136 | 136 | ok | ACE prints 63.9 (uses different µ term) — see note |
| 7 | E1 index table = 0.25·W·v² | 303 | 303 | ok |  |
| 7 | E2 = T·s/R | 63 | 62.5 | ok |  |
| 7 | E3 | 366 | 365 | ok |  |
| 7 | E4 | 36,600 | 36,500 | ok |  |
| 8 | E1 = ½·I·ω² | 28 | 28 | ok |  |
| 8 | E2 = T·s/R | 9 | 9.4 | ok |  |
| 8 | E3 | 37 | 37.4 | ok |  |
| 8 | E4 | 44,400 | 44,850 | ok |  |
| 9 | E2 swinging arm = F·r·s/R | 263 | 263 | ok |  |
| 10 | E1 lowered weight | 6,750 | 6,750 | ok |  |
| 10 | E2 = W·g·s | 17,952 | 17,952 | ok |  |
| 10 | E3 | 24,702 | 24,702 | ok |  |
| 10 | E4 | 14,82,120 | 14,82,138 | ok |  |
| 10 | We | 21,957 | 21,958 | ok |  |
| A | We = W (no propelling force) | 100 | 100 | ok |  |
| B | We with F=2000 N over 0.1 m | 200 | 200 | ok |  |
| 19 | wagon vs 2 absorbers: E3 per absorber (E1/2 + F·s) | 5,350 | 5,350 | ok | F·s not shared between absorbers (ACE convention) |
| 20 | wagon vs wagon E1 = m1·m2·(v1+v2)²/(2(m1+m2)) | 5,950 | 5,950 | ok |  |
| 20 | E3 | 6,450 | 6,450 | ok |  |
| 21 | two absorbers: E1 halves | 2,975 | 2,975 | ok |  |
| 21 | E3 per absorber | 3,475 | 3,475 | ok |  |
| F-0 | reaction force: ACE Q=1.5·E3/s vs engine E/(η·s) | 3,375 | 2,812 | ok | ACE 1.5 vs engine 1.25 (η=0.8) — engine is 17% lower, conservative for the customer structure? see notes |
| F-0 | deceleration: ACE 0.75·v²/s vs engine v²/(2ηs) | 33.8 | 28.1 | ok | same 17% ratio |
| WR | W per isolator (N) | 491 | 491 | ok |  |
| WR | fn required = fi/3 (Hz) | 13.3 | 13.3 | ok |  |
| WR | Kv,max (N/mm) | 351 | 351 | ok |  |
| WR | V = √(2gh) (m/s) | 1.7 | 1.7 | ok |  |
| WR | Dmin = V²/(g·AT) (mm) | 20 | 20 | ok |  |
| WR | Ks,max (N/mm) | 368 | 368 | ok |  |
| WR | transmissibility at r=3, ζ=0.15 | 0.2 | 0.2 | ok | isolation ≈ 83 % (catalogue: "r ≥ 3 for good isolation") |
| WR | fn from k,m: (1/2π)√(k/m) with Kv=350.9 N/mm, 50 kg | 13.3 | 13.3 | ok |  |
| EKD | T1: Kv,max for 40 kg / 4 / 3000 rpm (N/mm) | 110 | 110 | ok |  |
| RM | rubber: fn for 90 % isolation at 25 Hz | 7.5 | 7.5 | ok |  |
| RM | rubber: static deflection g/(2πfn)² (mm) | 4.4 | 4.4 | ok |  |

**60 agree, 0 differ.**

## Notes

* ACE example 6.1 (incline) prints E2 = 63.9 Nm; with the printed inputs (W 500 kg, β 10°, µ 0.2, s 0.075 m) the formula E2 = W·g·s·(sin β + µ·cos β) gives 136 Nm and W·g·s·sin β alone gives 63.9 Nm — the catalogue example omits the friction term. ImpactCal keeps friction (conservative).
* ACE approximate reaction force Q = 1.5·E3/s and deceleration a = 0.75·vD²/s assume an ideal square damping curve with a 1.5 margin; ImpactCal reports F = E/(η·s) and a = v²/(2·η·s) with η = 0.8 for hydraulic units (1.25·E/s). The ACE figures are 20 % higher by construction ("approximate, add safety margin"). For customer structures the ACE value is the safer number; the quotation/selection report states the η basis so the customer can apply ACE's factor if their standard requires it.
* Multiple absorbers (examples 19 and 21): ACE shares the kinetic energy between the n units but charges the full propelling work F·s to each. ImpactCal 2.0 adopts this convention (the earlier local app divided both by n); with n = 2 and a live drive this selects one size larger in some cases — the safer choice.
* Example 9 (swinging arm with force) uses ACE's lever formula for E1 (W·v²·0.5 referred to the absorber radius); ImpactCal's I9 uses 0.25·m·v² (uniform arm) — only E2 is compared.
* Wire rope: the Enidine and EKD catalogues publish the worksheet method but no filled-in example; the fixtures are constructed from their formulas and the WR12 / OVTW32 tables (see data/reference/*_selection_method.md) and agree to <1 %.
