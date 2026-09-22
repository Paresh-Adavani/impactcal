# Enidine wire rope isolator selection method

Source: Enidine *Wire Rope Isolator Technologies* catalogue (ENI877R4), "Application
Worksheet" on catalogue p.6 (WR), p.38 (CR) and p.54 (HR) — the three worksheets are
identical. Supporting notes from p.5 (WR overview: stiffness definitions, axes, loops,
damping, stabilizers). Verified against the PDF page image (PDF p.9).

The catalogue itself contains **no numerically worked example**. Section 4 below is a
worked example constructed here from the catalogue formulas and the WR12 table so it can
be used as a regression test; it is labelled as such.

---

## 1. Definitions and conventions (catalogue p.5)

| Symbol | Meaning | Units (metric) |
|---|---|---|
| WT | total supported load | N (kg x 9.81) |
| n | number of isolators | – |
| W | static load per isolator = WT / n (assumes central CG) | N |
| Kv | *vibration* stiffness — small-deflection spring rate, tabulated per model per axis | kN/m (numerically = N/mm) |
| Ks | *shock* stiffness — average spring rate over large deflections, tabulated per model per axis | kN/m (= N/mm) |
| g | 9.81 m/s² (386 in/s²) | |
| fi | input (excitation) frequency = rpm / 60 | Hz |
| fn | system natural frequency | Hz |
| AT | max allowable transmitted acceleration | g |
| V | shock input velocity | m/s |
| h | drop height (free-fall impact) | m |

* Load axes: **Compression**, **45° Compression/Roll**, **Shear/Roll** (WR and CR series
  publish one combined Shear/Roll table; HERM publishes Roll and Shear separately).
* Tabulated values are for **full-loop** isolators with 302/304 stainless cable.
  Reduced-loop versions: multiply stiffness and load by (desired loops / full loops).
* Damping: typically 5–15 % of critical for WR/CR, 15–25 % for HERM.
* Stabilizers: recommended when supported-mass height ≥ 2 x width/depth; typically half as
  many stabilizers as base isolators, one size softer than the base isolators.
* "Do not extrapolate curves."

## 2. Selection procedure (catalogue worksheet, verbatim structure)

### Part I – System data
1. WT = mass [kg] x 9.81 → N
2. n = number of isolators
3. W = WT / n (N per isolator, central CG assumed)
4. Choose load axis: compression / shear or roll / 45° compression-roll.

### Part II – Vibration sizing
1. fi = rpm / 60 [Hz]
2. Target natural frequency for **80 % isolation**: **fn = fi / 3.0**
3. Maximum allowable isolator vibration stiffness:

       Kv,max = W (2π fn)² / g          [N/m when W in N, g = 9.81 m/s²]

4. Select an isolator from the table for the chosen load axis such that
   a) W < isolator max static load, **and**
   b) isolator Kv < Kv,max.

### Part III – Shock sizing
1. AT = allowable transmitted acceleration [g]
2. V = shock input velocity. Free-fall impact: **V = √(2 g h)**
3. Minimum isolator response deflection:

       Dmin = V² / (g · AT)             [m]   (tables are in mm – convert)

4. Maximum allowable isolator shock stiffness:

       Ks,max = W (V / Dmin)² / g       [N/m]

5. Select an isolator such that
   a) W < max static load, **and**
   b) Dmin < isolator max deflection, **and**
   c) isolator Ks < Ks,max.
6. Check actual deflection with the *isolator's* tabulated Ks:

       Dactual = V / √(Ks,isolator · g / W)     [m]

   and confirm Dactual < isolator max deflection.
7. If max deflection is exceeded, choose another isolator and repeat 5–6.

### Derived relations (not printed in the catalogue, but implied by the above)
* Actual natural frequency of a chosen isolator: fn = (1/2π) √(Kv · g / W)
* Transmitted acceleration (in g) after step 6: A = Ks · Dactual / W, equivalently A = V² / (g · Dactual)
* Undamped transmissibility at frequency ratio r = fi/fn: T = 1 / |r² − 1|; at r = 3 this
  gives T = 0.125, i.e. the ~80 % isolation the worksheet targets (the catalogue quotes the
  fn = fi/3 rule only, not this formula).

## 3. Example from the shock-absorber catalogue (adjustment setting, not WR)

The Adjustable Series shock absorber catalogue (p.19) gives two adjustment-setting examples
that can be used as test cases for the *knob-setting* logic:

| Model | Impact velocity | Intersection on model graph | Usable setting range |
|---|---|---|---|
| OEM 1.25M x 1 | 1.0 m/s | setting 5 | 0 to 5 |
| (LR)OEMXT 2.0M x 2 | 0.5 m/s | setting 3 | 0 to 3 |

Position 0 = minimum damping force, 8 = maximum. Settings above the intersection value may
overload the unit. (Graphs are not reproduced in the text extraction.)

## 4. Worked example (constructed here – NOT from the catalogue)

Uses only catalogue formulas and catalogue data for WR12 6-loop (p.20). Intended as a
unit-test fixture for a calculator implementation.

**Inputs**
* Equipment mass 200 kg, 4 isolators, compression axis, central CG
* Excitation 2400 rpm
* Shock: 0.15 m free-fall drop, AT = 15 g

**Part I**
* WT = 200 x 9.81 = 1962 N; W = 1962 / 4 = **490.5 N**

**Part II – vibration**
* fi = 2400 / 60 = 40 Hz; fn = 40 / 3 = **13.33 Hz**
* Kv,max = 490.5 x (2π x 13.33)² / 9.81 = 490.5 x 7018 / 9.81 = **351 000 N/m = 351 N/mm**
* Candidates (compression table, WR12 6-loop): all have max static load > 490.5 N except
  -706 (396 N) and -806 (320 N). Kv must be < 351: -206 (275) ✓, -306 (240) ✓, -406 (180) ✓,
  -506 (154) ✓, -606 (137) ✓.

**Part III – shock**
* V = √(2 x 9.81 x 0.15) = **1.716 m/s**
* Dmin = 1.716² / (9.81 x 15) = 2.943 / 147.2 = **0.0200 m = 20.0 mm**
* Ks,max = 490.5 x (1.716 / 0.0200)² / 9.81 = 490.5 x 7362 / 9.81 = **368 100 N/m = 368 N/mm**
* Step 5 passes for all five candidates (max deflection 34–50 mm > 20 mm; Ks 60–135 < 368).
* Step 6, Dactual = V / √(Ks·g/W):
  * WR12-406-06: Ks = 84 N/mm → Dactual = 1.716 / √(84000 x 9.81 / 490.5) = 1.716 / 40.99
    = 0.0419 m = **41.9 mm > 40.1 mm max → reject**
  * WR12-506-06: Ks = 68 → 1.716 / 36.88 = 0.0465 m = **46.5 mm > 44.7 mm → reject**
  * WR12-606-06: Ks = 60 → 1.716 / 34.64 = 0.0495 m = **49.5 mm < 49.8 mm → accept**

**Result: WR12-606-06 (compression), 4 off**
* Actual fn = (1/2π) √(137 000 x 9.81 / 490.5) = (1/2π) √2740 = **8.33 Hz**
* r = 40 / 8.33 = 4.80; undamped T = 1/(r²−1) = **0.045 (≈95 % isolation)**
* Transmitted shock acceleration = Ks·D/W = 60 000 x 0.0495 / 490.5 = **6.1 g < 15 g**
* Static load utilisation = 490.5 / 712 = 69 %

Expected calculator outputs for this fixture: W = 490.5 N; fn,target = 13.33 Hz;
Kv,max = 351 N/mm; V = 1.716 m/s; Dmin = 20.0 mm; Ks,max = 368 N/mm;
selected = WR12-606-06; Dactual = 49.5 mm; fn,actual = 8.33 Hz; A = 6.1 g.
