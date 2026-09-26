# EKD / OVICTOR Vibration Isolator catalogue - selection method

Source: `docs/reference-catalogues/EKD_Vibration_Isolator.pdf` (Jiangsu EKD / Wuxi OVICTOR, 2023 edition, 76 PDF pages; Indian representative Adoni Tech). Catalogue page numbers below are the printed ones (PDF page = printed page + 2).

The catalogue gives ONE formal procedure: the "Applications Worksheet" for OVTW/OVTC wire rope isolators (printed p.09). The other families (OVTS, OVTN, OVTD, OVTG, OVTX, rubber) publish rated loads, deflection, natural frequency and damping only; no procedure is printed for them. Everything in section 1-3 is transcribed from the catalogue; section 4 contains test cases computed by us from those formulas and the catalogue tables (the catalogue itself prints a blank worksheet with no filled-in example).

## 1. Definitions and rules stated in the catalogue (p.08)

- Stiffness is non-linear. Two stiffness values are published per model and per load axis:
  - **Kv** = typical vibration stiffness (small deflections), N/mm
  - **Ks** = average shock stiffness (large deflections), N/mm
- Published performance is for **full-loop** isolators with standard 302/304 stainless cable.
- **Reduced loop rule:** stiffness (and by the same ratio the load) of a reduced-loop isolator = full-loop value x (desired loops / full loops). Minimum 2 loops.
- **Load axes** (each has its own table): Compression; 45 deg Compression/Roll; Shear/Roll.
- **Damping:** typically 5-15 % of critical, depending on size and input level (OVTN hybrid gives more).
- **Stabilizers:** recommended when supported-mass height >= 2 x width or depth. Quantity = half the number of base isolators, one size softer than the base isolators, side mounted.
- Operating temperature -100 C to +260 C (OVTW/OVTC).
- Bellmouth option ("R" suffix) for high-fatigue duty.
- Part number (OVTW): `OVTW32 - 40 - 10 D T M` = series (wire dia) - size - loops - mounting option (A/B/C/D/E/S) - thread option ([blank]=self-clinching insert, T=tapped; OVTW95+: [blank]=tapped, H=helical insert free-running, L=helical insert self-locking) - M=metric. OVTC: `OVTC12 - 40 - D M` (no loop field).

## 2. Applications Worksheet (p.09), metric

### PART I - System data
1. Total supported load  `WT = m[kg] x 9.81  [N]`
2. Number of isolators `N`
3. Static load per isolator  `W = WT / N  [N]`
4. Load axis: Compression / Shear-Roll / 45 deg Compression-Roll

### PART II - Vibration sizing
1. Input excitation frequency  `fi = rpm / 60  [Hz]`
2. System natural frequency for 80 % isolation: printed as  `fn = fi / 30  [Hz]`
   - **Ambiguity:** the printed divisor is "30". The standard Enidine/ITT worksheet this is derived from uses `fn = fi / 3` (transmissibility 1/(3^2-1) = 12.5 %, i.e. ~87 % isolation; the "80 %" wording corresponds to a ratio of 2.45). `fi/30` would demand impossibly soft isolators (see test case T4). Treat "30" as a misprint of "3" (or "3.0"), and flag it in the UI.
3. Maximum isolator vibration stiffness  `Kv_max = W (2 pi fn)^2 / g  [N/m]`, `g = 9.81 m/s^2`
4. Select: (a) `W` < isolator max static load for the chosen axis; (b) isolator `Kv` (table) < `Kv_max`. Note table values are N/mm, worksheet gives N/m.

### PART III - Shock sizing
1. Maximum allowable transmitted acceleration  `AT  [g's]`
2. Shock input velocity `V [m/s]`; for free-fall impact  `V = sqrt(2 g h)`, `h` = drop height [m]
3. Minimum isolator response deflection  `Dmin = V^2 / (g AT)  [m]`
4. Maximum isolator shock stiffness  `Ks_max = W (V / Dmin)^2 / g  [N/m]`
5. Select: (a) `W` < max static load; (b) `Dmin` < isolator max deflection (convert m to mm); (c) isolator `Ks` (table) < `Ks_max`.
6. Check actual deflection with the isolator's tabulated Ks:  `D_actual = V / sqrt( Ks_isolator x g / W )`   (Ks in N/m, W in N -> D in m). Must not exceed the isolator's max deflection.
7. If exceeded, pick another isolator and repeat 5-6.

Implied (not printed, but follows from step 6): transmitted acceleration with the chosen isolator `AT_actual = V^2 / (g D_actual)`.

## 3. Data published for the other families (what a selector can use)

| Family | Load basis | Stiffness published | Frequency | Damping | Deflection |
|---|---|---|---|---|---|
| OVTS (all-SS wire rope) p.50-53 | nominal load Z, X, Y (N) | static Z/X/Y, dynamic Z/X/Y, shock Z/X/Y | inherent Z/X/Y (Hz, +/-) | >= 0.18 | static defl at nominal; max allowable Z/X/Y |
| OVTN (rubber + wire rope) p.54-57 | vertical / lateral / longitudinal rated load (kg) | dynamic and shock, 3 axes | 10-18 Hz | 0.1-0.3 | static deformation at rated; max allowable, 3 axes |
| OVTD hanger p.58-59 | rated capacity axial / 45 deg / shear (N) | none | none | 0.1-0.2 | none |
| OVTG pipe clamp p.60-61 | none (pipe bore only) | none | 15-20 Hz std, 10-25 custom | none | none |
| OVTX metal-rubber p.62-63 | rated load (kg) | none | 6-20 Hz (per model) | 0.1-0.24 | deformation at rated; survives 15x rated |
| BE rubber p.64-65 | nominal Z fwd / Z bwd / Y / X (N) | dynamic Z fwd, Z bwd, Y, X | ~10 Hz | 0.07-0.11 | 3.5-5.0 mm |
| B-type rubber p.66 | nominal Z (N) | none | 15 +/- 2 Hz | 0.02 / 0.05 | 1.2-2.0 mm ambient |
| E / EA rubber p.67-68 | nominal Z / X / Y (N) | dynamic Z/X/Y | Z/X/Y per model (E ~30 Hz, EA ~23 Hz) | 0.08-0.12 | static deformation per model |
| 6JX rubber p.69 | rated vertical (kg) + application range | none | 6-8 Hz | 0.04-0.12 | at rated, per model |
| SH rubber p.70-71 | nominal (kg) | none | none | none | 0.3-1.1 mm |
| WH / WHG rubber p.72-73 | rated Z (N) | none | 6 Hz | none | 12 +/- 2 mm |

Selection for these families reduces to: static load per mount <= rated load (for 6JX: within the application range), and check the published natural frequency against the disturbing frequency (isolation needs fi/fn > sqrt 2; the OVTN text quotes "output within 15 g at fn 12-16 Hz" for ship-borne equipment).

## 4. Test cases (computed by us from the catalogue formulas and tables; NOT printed in the catalogue)

All use g = 9.81 m/s^2 and the compression-axis tables in `ekd_isolators.csv`.

### T1 - Vibration sizing, OVTW compression
Input: mass 40 kg, N = 4, fi = 3000 rpm.
- WT = 40 x 9.81 = 392.40 N; W = 98.10 N
- fi = 50.0 Hz; fn = 50/3 = 16.667 Hz (using the fi/3 reading)
- Kv_max = 98.10 x (2 pi x 16.667)^2 / 9.81 = 109 662 N/m = **109.66 N/mm**
- Candidates (W <= max static load AND Kv <= 109.66): OVTW32-50-10 (187 N, Kv 94) passes; OVTW32-40-10 (200 N, Kv 114) fails on Kv; OVTW32-60-10 (170 N, Kv 80) passes.
- Cross-check: fn of OVTW32-50-10 at W = (1/2pi) sqrt(94 000 / (98.1/9.81)) = 15.43 Hz (< 16.67, ok).

### T2 - Shock sizing, same system
Input: AT = 15 g, free fall h = 0.05 m.
- V = sqrt(2 x 9.81 x 0.05) = 0.9905 m/s
- Dmin = 0.9905^2 / (9.81 x 15) = 0.006667 m = 6.67 mm
- Ks_max = 98.10 x (0.9905 / 0.006667)^2 / 9.81 = 220 725 N/m = **220.7 N/mm**
- OVTW32-50-10: Ks = 47 N/mm <= 220.7 ok; Dmin 6.67 mm < dmax 16.8 mm ok.
- Step 6: D_actual = 0.9905 / sqrt(47 000 x 9.81 / 98.1) = 0.01445 m = **14.45 mm** <= 16.8 mm -> accepted. Implied AT_actual = 0.9905^2 / (9.81 x 0.01445) = 6.9 g.
- OVTW32-40-10: D_actual = 12.68 mm <= 13.7 mm (ok, 7.9 g). OVTW32-60-10: 16.07 mm <= 18.8 mm (ok, 6.2 g).

### T3 - Reduced loop ratio
OVTW32-50 with 6 loops instead of the full 10: Kv = 94 x 6/10 = 56.4 N/mm; Ks = 47 x 0.6 = 28.2 N/mm; max static load 187 x 0.6 = 112.2 N (ratio rule, p.08).

### T4 - Why "fi/30" must be a misprint
Same inputs as T1 with fn = 50/30 = 1.667 Hz: Kv_max = 1 097 N/m = 1.10 N/mm. The softest OVTW model in the catalogue that carries 98 N is far stiffer (smallest OVTC12-40 has Kv 1.31 N/mm at 1.3 N max load), so no catalogue product could ever be selected. Use fi/3.

### T5 - kN conversion check
OVTW318-20-08 compression max static load is printed 30.27 kN -> CSV stores 30 270 N. OVTW222-60-08 printed 11.83 kN -> 11 830 N.

### T6 - kg conversion check (rubber / OVTN / OVTX)
OVTN50-1000 vertical rated load printed 1000 kg -> 9 810 N. OVTX-100-8 rated 100 kg -> 981 N. 6JX-400 application range 200-400 kg -> 1 962 to 3 924 N. SH-2200A 2200 kg -> 21 582 N.

### T7 - Rubber mount natural-frequency sanity (E-type)
E60: nominal Z 600 N, dynamic stiffness Z 1600 N/mm -> fn = (1/2pi) sqrt(1 600 000 / (600/9.81)) = 25.7 Hz; catalogue prints 25.5 Hz (consistent, confirms the dynamic-stiffness / nominal-load pairing).
