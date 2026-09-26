# Enidine (ITT) reference data – README

Reference database extracted from two Enidine catalogues for benchmarking Adoni Tech
equivalents. All values are transcribed from the catalogues; nothing is estimated. Blank
cells = not published. Imperial values were **not** converted — the catalogues print metric
alongside imperial and the metric figures were taken directly (the only arithmetic applied is
kN → N x1000 and g → kg /1000 where the catalogue printed those units).

## Files

| File | Rows | Content |
|---|---|---|
| `enidine_shock_absorbers.csv` | 49 | OEM / LROEM / OEMXT / LROEMXT adjustable hydraulic shock absorbers |
| `enidine_wire_rope_isolators.csv` | 138 | WR (standard), CR (compact) and HR (HERM) wire rope isolators |
| `enidine_wr_selection_method.md` | – | Sizing procedure, formulas, test fixture |
| `README_ENIDINE.md` | – | this file |

## Sources

1. **Enidine Adjustable Series Hydraulic Shock Absorbers**, A4 metric catalogue section,
   file `docs/reference-catalogues/Enidine_Shock_Absorber_Catalogue.pdf` (18 pages, printed
   page numbers 17–34, dated 2/13/08–4/10/08). Text extraction: `/home/claude/ref/enidine.txt`.
   Pages used: 17 (overview, temperature range), 18 (damping principle), 19 (adjustment
   examples), 21 (OEM 0.1M–1.0M data), 24 (OEM 1.15M/1.25M), 27 (OEMXT 3/4 & 1.5M),
   29 (OEMXT 1-1/8 & 2.0M), 31 (OEM 3.0M/4.0M). Pages 20, 22–23, 25–26, 28, 30, 32–34 are
   ordering info and mounting accessories (jam nuts, stop collars, flanges, clevis mounts,
   striker caps) — not tabulated here.
2. **Enidine Wire Rope Isolator Technologies** catalogue ENI877R4 (2007 edition, cover
   revised 09/23), file `docs/reference-catalogues/Enidine_Wire_Rope_Catalogue.pdf`
   (78 PDF pages; printed page N = PDF page N+3). Text extraction:
   `/home/claude/ref/enidine_wr.txt`. Pages used: 5–6 (WR overview + worksheet), 7–34 (WR2…WR40),
   37–38 (CR overview/worksheet), 39–50 (CR1…CR6), 53–54 (HR overview/worksheet), 55–70
   (HR6…HR40). Pages 71–72 (WEAR pipe restraints, wire mesh) have no tabulated data.
   PDF page images checked visually for dimension-drawing ambiguity: PDF pp. 9, 10, 22, 42, 48, 60.

## enidine_shock_absorbers.csv – columns

Requested columns first, extra columns appended after `notes`.

| Column | Meaning / catalogue source |
|---|---|
| source | catalogue citation |
| family | catalogue series page grouping |
| model | catalogue model designation. `(B)` = button-rod model (small bore 0.1M–1.0M are supplied as button models only). `x N` = stroke in inches. `LR` prefix = low-range velocity version. Imperial-thread twins (OEMXT 3/4 = 1.5M, OEMXT 1 1/8 = 2.0M) are listed as separate rows because the catalogue lists them separately; performance is identical. |
| stroke_mm | (S) Stroke |
| energy_per_cycle_nm | ET max, Nm/cycle |
| energy_per_hour_nm | ETC max, Nm/hour |
| eff_mass_min_kg / eff_mass_max_kg | **blank** – Enidine does not publish effective-mass ranges for adjustable units (they publish velocity range + adjustment graphs instead) |
| max_force_n | Fp max reaction force, N |
| max_velocity_m_s | upper end of "Optimal Velocity Range" |
| thread | body thread (C) |
| body_dia_mm | nominal thread OD (threaded-body units); the max diameter over knob/collar is in `max_body_dia_mm` |
| length_mm | dimension A = overall length, rod fully extended, without button/striker cap; A1 (with button or cap) is given in notes |
| weight_kg | mass (small-bore tables print grams → /1000) |
| damping_type | adjustable hydraulic, knob 0 (min) – 8 (max). Catalogue describes both single-orifice (ball) and multi-orifice (pin) adjustable designs but does not say which model uses which |
| temp_min_c / temp_max_c | standard -10…80 °C (p.17); optional fluids/seals -30…100 °C |
| notes | A/A1, lead-time flags (Δ = non-standard lead time), typos observed |
| min_velocity_m_s | lower end of Optimal Velocity Range |
| max_propelling_force_n | FD max propelling force |
| spring_force_extended_n / spring_force_compressed_n | nominal return coil-spring force |
| max_body_dia_mm | largest diameter (knob G / collar B / E) |
| catalogue_page | printed page number |

### Shock-absorber ambiguities
* (LR)OEM 1.15M x 2, (LR)OEM 1.25M x 1 and x 2 print a velocity range of "0,8-2,0 m/s"; the
  x 1 sibling prints "0,08-2,0". 0,8 is almost certainly a typo for 0,08 — recorded as printed
  with a note.
* OEMXT 3/4 x 2 vs LROEMXT 3/4 x 2 spring forces differ (29/68 vs 48/85 N) – as printed.
* The HP series is referenced only via accessory rows (stop collar for HP 110 MC/MF, p.25);
  no HP performance table exists in this catalogue extract, so no HP rows.
* CBOEM (custom orificed non-adjustable) and AOEM (air/oil return) are ordering options
  only; no separate data.
* Adjustment-setting graphs (p.19) are not in the text extraction; only the two worked
  examples are captured (see method file).

## enidine_wire_rope_isolators.csv – columns

Requested columns first, extra columns appended after `notes`.

| Column | Meaning / catalogue source |
|---|---|
| series | catalogue series page: WR2…WR40 (`WR12 (6-loop)` and `WR16 (6-loop)` are the separate 6-loop pages), CR1…CR6, HR6…HR40 (`HR16 8.0` / `HR16 9.5` are the two HR16 body lengths) |
| model | full catalogue model number incl. loop count for WR (e.g. `WR6-400-10`); CR and HR models have no loop suffix |
| wire_dia_mm | cable diameter "(Ref)" from dimension drawing; blank for HERM (not published) |
| loop_count | full-loop count from the ordering code (WR: 10/8/6). CR: 2, read from drawing (4 cable legs) – not stated numerically. HR: blank (not stated) |
| length_mm | WR: overall mount-bar length. CR: longest (bottom) bar. HR: overall length over mount tabs |
| width_mm | WR/CR: catalogue "W (Ref)" = loop width (bar width is in `bar_width_mm`). HR: end-view overall width |
| height_mm | "H" (WR/CR) or overall height (HR) |
| mount_hole_dia_mm | thru-hole diameter (metric value) |
| weight_kg | unit weight (CR printed in g → /1000) |
| vertical_static_load_min_n | **blank** – only max static load is published |
| vertical_static_load_max_n | Compression table "Max Static Load", N |
| vertical_stiffness_n_mm | Compression Kv (vibration stiffness). Catalogue kN/m ≡ N/mm |
| shear_stiffness_n_mm | Shear/Roll Kv (WR, CR) or Shear Kv (HR) |
| roll_stiffness_n_mm | WR/CR: same value as shear (catalogue publishes one combined Shear/Roll table). HR: Roll Kv |
| shock_load_max_n | **blank** – not published (use Ks x max deflection if needed) |
| max_dynamic_deflection_mm | Compression "Max Deflection" |
| natural_freq_hz | **blank** – not published per model; derive as fn = (1/2π)√(Kv·g/W) |
| notes | mounting options, torque, construction, unit remarks |
| vertical_shock_stiffness_n_mm | Compression Ks |
| roll45_static_load_max_n / roll45_max_deflection_mm / roll45_stiffness_n_mm / roll45_shock_stiffness_n_mm | "45° Compression/Roll" table (WR, CR only) |
| shear_static_load_max_n / shear_max_deflection_mm / shear_shock_stiffness_n_mm | Shear/Roll (WR, CR) or Shear (HR) table |
| roll_static_load_max_n / roll_max_deflection_mm / roll_shock_stiffness_n_mm | HR: Roll table; WR/CR: copy of shear (combined table) |
| mount_thread_metric | threaded-bar / insert metric thread |
| mount_hole_spacing_mm | hole centre distance (WR2–WR8, 4 holes) or hole positions from bar end (WR12+, 8 holes) |
| bar_width_mm / bar_thickness_mm | mount-bar section from drawing |
| temp_min_c / temp_max_c | -100…260 °C (WR, CR). HR: blank (elastomer; no range printed) |
| catalogue_page | printed pages (dimensions-performance) |

### Wire-rope ambiguities
* Units: catalogue prints lbf (N) and lb/in (kN/m). Metric figures were taken as printed; no
  x4.448 / x0.1751 conversion was applied anywhere. WR28/36/40 and HR28/40 print loads in kN
  → multiplied by 1000 (flagged in notes).
* WR16-200-08 Shear/Roll max static load prints 660 lb (2 936 N); the 6-loop WR16-206-06
  value is 335 lb and 8/6 scaling would give ~447 lb. Probably a catalogue typo; recorded as
  printed with a note.
* WR12 8-loop page states threaded-bar torque "100 in.-lbs. (20 Nm)" while the 6-loop page
  says "100 in.-lbs. (10 Nm)" — 100 in-lb ≈ 11.3 Nm; recorded as printed.
* HR8/HR12 mounting-option cells are garbled in the text extraction; read from page image as
  "B, D, E".
* HERM loop counts: size suffixes -x06 (HR16 8.0) vs -x00 (HR16 9.5) follow the WR 6-loop /
  8-loop convention but the catalogue does not state loop counts; left blank.
* Static load *minimum* is never published; Enidine's rule is only "W must be less than max
  static load" (and the shock-absorber 5 %-of-rated-energy rule for hydraulic units).
* Load-vs-deflection curves are printed as graphs only; not digitised.

## Validation
Both CSVs were re-read with Python `csv` (all rows have the header column count). Row counts
per family/series are listed above in the file table and in the SubagentHandback report.
