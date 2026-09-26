# ImpactCal GA drawing library

Customer-shareable General Arrangement drawings, one PDF per model / mounting / accessory.
Master copy: E:\claude\Projects\ImpactCal\GA-LIBRARY  (originals in DESIGN\... are never modified)

Layout
  <SERIES>/<MODEL>[-<MOUNT>][+<ACC>].pdf    e.g. AKHG/AKHG-140-300-FS.pdf, AD/AD-42-50+CL.pdf
  ga_index.csv     one row per PDF, columns match the ImpactCal cad_asset table
                   (bk, model, mounting, fmt, filename, rev) + series, accessory, path, source, status, notes
  GAP_REPORT.md    coverage vs data/products.csv and the list of models still without a GA
  _tools/build.py  rebuilds the library + index from the source folders (safe to re-run)
  _tools/scan.py   raw inventory of the source folders

Rules
  * GA only — outline, mounting dims, stroke, thread, technical-parameter table. No part drawings, no
    material/tolerance/manufacturing detail, no BOM.
  * status = ok | review (see notes) | generated (sheet produced from catalogue dimension tables,
    marked "GA for customer approval — not for manufacture").
  * bk is the key ImpactCal uses; a row whose bk is not in products.csv is kept but flagged.

Mount codes: FS front flange, RS rear flange, FF/FR (EI/AKHS legacy front-flange / foot-rear),
SS both flanges, RC rod clevis, TM front flange+foot, FM foot mount.
Accessory codes: MC metallic cap, CL clevis, MF/FM foot mount, S45 stop collar, JN jam nut.
