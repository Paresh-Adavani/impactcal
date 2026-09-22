# ACE Controls reference data (for Adoni Tech ImpactCal)

Reference database of ACE Controls shock absorber catalogue data, used as a benchmark for
selecting Adoni Tech equivalent products. All numbers are transcribed from the catalogue text;
nothing is computed or invented (the few catalogue misprints are flagged in `notes`, never corrected).

## Sources

| Source | File | Used for |
|---|---|---|
| ACE Main Catalog 2018 metric (Issue 04.2018, 294 pp) | `docs/reference-catalogues/ACE_Main_Catalog_2018_metric.pdf` (text: `ref/ace_main.txt`) | everything, page numbers below are **catalogue** page numbers (PDF page = catalogue page + 2) |
| ACE web catalogue (US, inch/metric, 132 pp) | `docs/reference-catalogues/ACE_Catalog-web.pdf` (text: `ref/ace_web.txt`) | only CB/EB body thread + max force (p.76-79) and SCS38/50/63 max force (p.72-75) |

Catalogue pages used:
- p.10-13 Formulas and Calculations (worked examples 1-10, A-D); p.14-15 capacity chart (cross-check only)
- p.18-39 miniature: MC5-MC75 (18-19), MC150-MC600 (20-21), -V4A (22-23), PMCN (24-27), SC190-SC925 (28-29), SC²25-190 (30-31), SC²300-650 (32-33), SC-HC (34-35), MA30-MA900 (36-37), 3/8x1 (38-39)
- p.56-89 industrial: MC33-MC64 MAGNUM (56-59), -V4A (60-63), -HT (64-67), -LT (68-71), SC33/SC45 (72-74), MA/ML33-64 (76-79), SASL (80-81), SALD (82-85), SALDN (86-88)
- p.102-109 heavy: CA2-CA4 (102-105), A1 1/2-A3 (106-109)
- p.116-127 TUBUS profile dampers TA, TS, TR, TR-H, TR-L, TR-HD
- p.262-273 safety: SCS33-64 (262-265), SCS38-63 (266-269), CB63-160 (270-271), EB63-160 (272-273); p.275 safety formulas (examples 19-21); p.280-281 TUBUS TC crane buffers

## Files

### `ace_industrial_shock_absorbers.csv` (499 rows)
One row per catalogue model code. Where a family publishes separate effective-weight ranges per code
(-0/-1/-2/-3/-4, -5…-9, H/H2/H3, L, etc.), each code is its own row. Columns:

| column | meaning |
|---|---|
| source | catalogue + page |
| family | product family as grouped in this DB |
| model | ACE model code exactly as printed (metric suffix M where printed) |
| stroke_mm | nominal stroke (dimension table or capacity chart; drawing for miniatures). TUBUS: max stroke |
| energy_per_cycle_nm | E3 max energy per cycle [Nm]. TUBUS: continuous-use value (emergency-stop value in notes) |
| energy_per_hour_nm | E4 max energy per hour [Nm/h], self-contained version at room temp. HT family: value at 20 °C (100 °C value in notes). Air/oil-tank and oil-recirculation E4 in notes |
| eff_mass_min_kg / eff_mass_max_kg | We min / We max [kg] (self-compensating range for SC190-925; soft-contact range in notes) |
| max_force_n | only where the catalogue publishes a force (TUBUS TR-HD F max static). Blank for hydraulic families – use Q ≈ 1.5·E3/s |
| thread | body thread (UNF / metric as printed); TUBUS: mounting screw |
| body_dia_mm | thread nominal OD for threaded-body units (M14 → 14); TUBUS: d1 or C = profile outer diameter |
| length_mm | MC33-64 & larger: "A max" overall extended length from dimension table. Miniatures: threaded body length read from drawing (p.19, 21, 29, 31, 33, 35, 37). TUBUS TA/TS/TC: A (free height); TR types: B (axial width / length) |
| weight_kg | unit weight |
| damping_type | self-compensating / adjustable / soft-contact / profile damper |
| temp_min_c / temp_max_c | operating temperature range from the family Technical Data block |
| notes | return force, return time, side-load angle, velocity range, hardness code, extra E4 values, dimension letters |

### `ace_crane_buffers.csv` (141 rows)
Same columns. Contains the heavy-duty / crane-relevant families: CA2-CA4 and A1½-A3 (duplicated from file 1 for convenience),
SCS33-64 and SCS38-63 safety absorbers, CB63-160 and EB63-160 crane buffers, TUBUS TC/TC-S crane buffers.
Safety absorbers have no E4 (emergency stop only, ~1000 full-load stops; orifice pattern is individually
calculated by ACE, so a model code is a size, not a catalogue-selectable rating). For SCS33-64 the
`energy_per_cycle_nm` is the "optimised characteristic" value; the self-compensating value is in notes.

### `ace_worked_examples.csv` (20 rows)
Row F-0 = approximate formulas Q = 1.5·E3/s, t = 2.6·s/vD, a = 0.75·vD²/s and symbol key.
Rows 1-10 = worked examples p.11-12; A-D = effective-weight examples p.13; 19-21 = safety-absorber examples p.275.
Values are as printed; e1/e2/e3/e4/vd/we blank where the catalogue does not print them.

## Ambiguities / things not resolved
1. **Body dia / length for miniatures** are read from drawings (not tables) and are the threaded body length, not overall length with rod/button. -V4A and PMCN miniatures: no drawing dims transcribed (blank).
2. **CA and A series body diameter** not published as a single number (only A/B/C/D/E envelope dims) – left blank, "bore size" in notes. Max force for these hydraulic units is not published.
3. **TUBUS TR/TR-H columns A/B/C/D** – assignment C = ring OD (matches model number), B = axial width is inferred from the TR-L table where B is clearly the length. Verify against drawing p.121/123 before using for design.
4. **SALD3/4X3-P** E4 with air/oil tank printed as 2,700,000 Nm/h – inconsistent with neighbours (likely 270,000).
5. **CA4X16** return time printed as "ask".
6. **Worked example 6.1**: printed E4 = 11880.0 but 554.4 × 200 = 110,880; example 5/7 print copy-paste artefacts in the formula column (results recorded, artefacts noted).
7. **CB/EB thread and max force** come from the older US web catalogue (M90x2 / M130x2 / M210x2; 187 / 467 / 700 kN), not the 2018 main catalogue, which only gives the family range 187-700 kN.
8. **SL-030…SL-300** are polyurethane damping pads (p.146-149), not shock absorbers – not included. MAGNUM is the marketing name of MC33-MC64 (+ MA/ML33-64), not a separate family. Capacity chart p.14 lists MC150H/225H "We max" values that differ slightly from the p.21 performance table (e.g. MC150H3 200 vs 408 kg); the performance-table values are used.
9. Effective-weight limits: catalogue footnote says they "can be raised or lowered to special order"; E4 values valid at room temperature only.
