# README - EKD / OVICTOR reference data

Files
- `ekd_isolators.csv` - 271 rows, one per catalogue model, 13 product families.
- `ekd_selection_method.md` - worksheet formulas (p.09), rules, and computed test cases.
- Source PDF: `docs/reference-catalogues/EKD_Vibration_Isolator.pdf` (Wuxi OVICTOR / Jiangsu EKD, InDesign file dated 2023-09, 76 PDF pages). Text layer extracted with `pdftotext -layout` to `/home/claude/ref/ekd.txt`.

Page convention: printed catalogue page = PDF page - 2. `notes` cites printed pages ("cat p.10-11").

## Pages used

| Family | Printed pages | How read |
|---|---|---|
| OVTW wire rope (16/24/32/40/48/64/95/127/159/222/286/318) | 07-37 | text layer for tables; drawing dimensions (wire dia, overall length, bar section, hole pitch) read from page images (PDF 12-38 even) because the drawings have no text layer |
| OVTC compact wire rope (12/16/24/32/40/48) | 38-49 | text layer + drawing images (PDF 40-50 even); OVTC32-40 dimension row missing from text layer, read from image (H 75, W 68, 0.77 kg) |
| OVTS special all-SS | 50-53 | text layer |
| OVTN rubber-coated anti-impact | 54-57 | text layer |
| OVTD multi-DOF hanger | 58-59 | text layer |
| OVTG pipe clamp | 60-61 | text layer |
| OVTX all-metal (metal rubber) | 62-63 | text layer |
| Rubber BE | 64-65 | text layer |
| Rubber B-type | 66 | text layer + image (to assign damping/weight to merged cells) |
| Rubber E / EA | 67-68 | text layer |
| Rubber 6JX | 69 | text layer |
| Rubber SH | 70-71 | text layer (SH-1150/1750/2200 dims are figure-only) |
| Rubber WH / WHG | 72-73 | text layer |
| Worksheet | 09 | image (formulas are graphics) |

## Row counts per family

| family | rows |
|---|---|
| OVTW wire rope isolator | 90 |
| OVTC compact wire rope isolator | 24 |
| OVTS special all-stainless wire rope isolator | 17 |
| OVTN rubber-coated anti-impact isolator | 18 |
| OVTD multi-DOF wire rope hanger | 12 |
| OVTG all-metal pipe clamp | 25 |
| OVTX all-metal (metal rubber) isolator | 7 |
| Rubber BE-type shock absorber | 13 |
| Rubber B-type reinforced shock absorber | 14 |
| Rubber E/EA-type shock absorber | 20 |
| Rubber 6JX-type shock absorber | 18 |
| Rubber SH-series isolator | 6 |
| Rubber WH/WHG-series isolator | 7 |
| **total** | **271** |

## Column meanings

| column | meaning |
|---|---|
| source | catalogue identification |
| family | product family (see table above) |
| model | full catalogue part number. OVTW models carry the loop count as third field (`OVTW95-46-06`). Dimension tables in the catalogue omit the loop field (`OVTW95-46`); the CSV uses the performance-table form. |
| type | short construction descriptor |
| wire_dia_mm | cable diameter. OVTW/OVTC: from the drawing (equals series number / 10, e.g. OVTW95 = 9.5 mm). OVTD: column "phi D". Blank for non-wire-rope families. |
| loop_count | full-loop count as sold (OVTW16-48: 10; OVTW64: 8; OVTW95/127: 6 or 8, separate models; OVTW159-318: 8; OVTC: 1 - compact single-loop design, catalogue has no loop field). |
| length_mm | OVTW: overall length from drawing (nominal, tolerance in drawing +/-0.08 or +/-0.8). OVTC: bar length from drawing. OVTS/OVTN/OVTG/BE/E/6JX/SH/WH: "L". OVTX and B-type: round/square body size A (also used as width). OVTD: adjustable range. |
| width_mm | OVTW/OVTC: table "W" (bar-to-bar outside width; tolerance +/-2 to +/-6.5). Others: B or W column. OVTG: clamp strip width B. |
| height_mm | OVTW/OVTC: table "H" (tolerance +/-2 to +/-6.5 as printed under the Height column). Others: H. |
| mount_hole_dia_mm | thru-hole diameter (OVTW: printed +/-0.2). A value like `M10` or `M5 or 5.5` is transcribed verbatim where the catalogue gives thread instead of a hole. |
| weight_kg | unit weight. OVTX: max ("<=") weight. Blank for OVTN (not published). |
| static_load_min_n | only 6JX (lower end of application range, kg x 9.81). |
| static_load_max_n | OVTW/OVTC: **compression** max static load. OVTS: nominal load Z. OVTN: vertical rated load (kg x 9.81). OVTD: axial rated capacity. OVTX, 6JX, SH: rated load kg x 9.81. BE: Z forward (pedestal). E/EA, B, WH: nominal Z. |
| vertical_stiffness_n_mm | OVTW/OVTC: compression **Kv** (vibration). OVTS: static stiffness Z (dynamic and shock Z in notes). OVTN: dynamic vertical. BE: dynamic Z forward. E/EA: dynamic Z. |
| shear_stiffness_n_mm | OVTW/OVTC: **Shear/Roll axis Kv**. OVTS/E/EA/BE: X. OVTN: lateral. |
| roll_stiffness_n_mm | OVTW/OVTC: **45 deg Compression/Roll axis Kv**. OVTS/E/EA/BE: Y. OVTN: longitudinal. |
| shock_load_max_n | always blank - the catalogue publishes shock *stiffness* (Ks) not shock load. Ks values are in notes (`Ks_comp=` plus the 45 deg and shear/roll sets). |
| max_deflection_mm | OVTW/OVTC: compression max deflection. OVTS: max allowable deflection Z. OVTN: vertical max allowable deformation. Others blank (rated-load deformation is in notes). |
| natural_freq_hz | as printed, may be a range or +/- form. OVTW/OVTC: not published (compute from Kv and load). |
| notes | everything else: page, other-axis loads/deflections/Kv/Ks, kN or kg conversion flags, bar section, hole pitch, thread, torque, damping, static deformation. |

Unit conversions applied: OVTW222/286/318 loads printed in kN -> x1000 (flagged in notes). OVTN, OVTX, 6JX, SH loads printed in kg -> x9.81 (flagged in notes). All other values are exactly as printed.

## Ambiguities and suspected misprints

1. **Worksheet fn = fi/30** (p.09) - almost certainly fi/3; see `ekd_selection_method.md` T4.
2. **OVTW95-8-loop and OVTW127-8-loop drawings** (p.24, p.28) show the same 44.5/111.1/155.6 hole positions as the 6-loop drawings while overall length changes 169.2/177.8 -> 215.9. Hole positions for the 8-loop models are probably wrong on the drawing; treated as unverified.
3. **OVTW95 8-loop thru hole** is printed "phi 9 +/-0.2" with "*M8 x 1.25" and a footnote "Tapped M8 x 1.25, Inserts M6 x 1.0"; the 6-loop variant is phi 7.4 / M6. Recorded as printed.
4. **OVTC12/16/24 drawings** show a second bar dimension (16.3 / 16.3 / 19.3) whose meaning is not labelled; recorded in notes only.
5. **OVTC32** thru hole phi 3.3 / M3 looks small for a 3.2 mm-cable unit (OVTC40/48 use phi 7 / M6); recorded as printed.
6. **OVTS-5** static stiffness X/Y = 296 N/mm breaks the family trend (OVTS-6 = 32); likely misprint.
7. **OVTG-85** printed as "OVYG-85" with L = 2110 (others 70-1070, and L1 = 175) - L is likely 210; recorded as printed with a note.
8. **OVTS-800/1000/1200** mounting-hole size given only in Diagram 3 ("phi 15" and "2-phi 22"); noted verbatim.
9. **SH-1150 / SH-1750 / SH-2200A/B** dimensions are figure-only; left blank.
10. **B-type** damping (0.02 for B1, 0.05 for B2 and B3) and weights (0.04 / 0.1 / 0.3 kg) come from merged cells; assignment made from the page image.
11. OVTW "Height" tolerance (+/-2, +/-3, +/-4, +/-6.5) is printed in a merged cell under the Height column and is not stored per row.
12. The catalogue prints no rated load for OVTG pipe clamps and no weights for OVTN.
13. Axis naming: OVTW tables use Compression / 45 deg Compression-Roll / Shear-Roll; the CSV maps these to vertical / roll / shear columns respectively. Other families use Z/X/Y or vertical/lateral/longitudinal; the mapping is stated in each row's notes.
