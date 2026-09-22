# ImpactCal 2.0 — ADONI TECH selection, RFQ & quotation suite

One Netlify site, one CSV database, four selectors, one approval workflow.

| Selector | Page | Engine |
|---|---|---|
| Crane buffers (AKHG, AKHS, ED, EI, SB, JHQC) | `selector.html?group=crane` | `lib/engine.js` — IS 3177 / ISO 8686 / FEM / CMAA / AISE, ACE-equivalent energy method |
| Industrial shock absorbers (AC, ACX, AD, YSRA) | `selector.html?group=industrial` | same engine, 11 picture cases |
| Wire rope isolators (AWRI, 114 models) | `wri/` | AWRI Selector Rev2 engine (sine, random, SDOF shock, roll/pitch) — data from the CSV |
| Rubber anti-vibration mounts | `rubber.html` | `lib/rubber.js` — SDOF isolation method |

Every selector ends in **Request drawings & quotation**. The request is numbered `AT/R/<FY>/<nnnn>`,
priced from the CSV, and the approver (adonitech@gmail.com) gets an e-mail (WhatsApp in phase 2) with a
link that opens `approve.html` on a phone. Nothing reaches the customer until **Approve & send** is pressed;
then the quotation PDF (INR + GST for India, USD zero-rated export otherwise, bank details, lead time) and the
ticked GA drawings go out, cc the sales person who raised it.

## Folder map

```
ImpactCal/
  site/                 the website (static) — index, selector, rubber, wri/, login, admin, approve
  netlify/functions/    api.js (the whole API, Express) · drive-sync.js (nightly)
  lib/                  engine, gst, quote, pdf, mail, notify, auth, data (CSV layer), store (Netlify Blobs), drive, fx, rubber
  data/                 THE DATABASE — plain CSV, edited in Excel:
                          shock_absorbers.csv  accessories.csv  wire_rope_isolators.csv  rubber_mounts.csv
                          settings.csv (company, bank, terms, FX uplift, mail routing, sales emails)
                          translations.csv (17 languages)  ga_index.csv (drawing index)
                        reference/  ACE, Enidine, EKD catalogue extracts (CSV) + worked examples + method notes
  GA-LIBRARY/           customer-shareable GA drawing PDFs, one folder per series (unchanged, built by _tools/build.py)
  docs/                 DEPLOY.md · ADMIN-GUIDE.md · VERIFICATION_REPORT.md · reference-catalogues/*.pdf
  test/                 run.js (70 end-to-end checks) · verify_catalogue.js (60 catalogue comparisons)
  tools/                dev-server.js · patch_wri.py · build_translations.py · BACKUP.bat · SYNC-CHECK.bat
  _legacy/              the previous local Node/SQLite app and the standalone AWRI selector, kept for reference
```

## Run it on the PC (no Netlify needed)

```
npm install
npm start          -> http://localhost:5000   (admin: /admin.html, login with adonitech@gmail.com; the OTP is printed on the login page while mail is not configured)
npm test           -> 70 passed, 0 failed
npm run verify     -> ACE / Enidine / EKD worked examples vs the engine, writes docs/VERIFICATION_REPORT.md
```

Locally everything is stored under `data/_store/` (RFQs, quotations, uploads). On Netlify the same code uses
Netlify Blobs. `docs/DEPLOY.md` has the deployment steps; `docs/ADMIN-GUIDE.md` is the monthly routine.

## How the CSV database works

* `data/*.csv` ships with every deploy — it is the master copy, kept on the PC and mirrored to Google Drive.
* The admin panel (**CSV database** tab) downloads any table, checks an uploaded revision (key column, duplicates,
  numeric price / lead time, HSN and GST sanity) and applies it. An upload lives in Netlify Blobs and wins over the
  shipped file until the next deploy — so after a monthly revision copy the same CSV into `data/` on the PC before
  the next deploy, or use **Revert to deploy** to discard it.
* `lead_time_days` and `price_inr` are the two columns the sales team maintains. Both print on the quotation.
* USD = INR ÷ live rate (open.er-api.com, cached 24 h) × (1 + `fx.uplift_pct`), rounded up. Fallback rate in settings.

## Roles

| Login | Role | Sees |
|---|---|---|
| `ADMIN_EMAILS` env (adonitech@gmail.com) or `admin.emails` setting | admin | everything, approves quotations |
| `sales.emails` / `sales.domains` (adonitech.co.in) | sales | prices, USD, lead times in selectors; RFQ queue |
| anyone else | customer | selectors, no prices; RFQ by e-mail + phone |

Login is OTP by e-mail (no passwords). Approval links are signed and valid 14 days — no login needed on the phone.
