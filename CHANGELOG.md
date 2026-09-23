# Changelog
## 2.1.0 — 23 Sep 2026 (report leads)
- "Print this selection" replaced by **Download my selection report (PDF)** — gated on name, e-mail and phone (company optional). Creates a numbered selection AT/S/…, e-mails the PDF to the customer, notifies sales (cc the sales person if logged in) and pushes a UnitePro lead with source "ImpactCal Web (report)".
- Lead quality filter (lib/quality.js) on report downloads and RFQs: placeholder names (abcd, test, xxxx), keyboard runs, repeated/sequential phone numbers, disposable or fake e-mail domains are refused with a friendly message; borderline contacts are stored and mailed but held back from the CRM. Staff logins bypass the filter.
- Admin → **Report leads** tab: list, quality flag, CRM status, "Convert to RFQ" (creates RFQ + draft quotation + approval alert).
- Name is now required (with e-mail and phone) on the RFQ forms of all selectors.
## 2.0.1 — 22 Sep 2026
- Customer acknowledgement now carries a full copy: project/customer data, every application input (MKS), calculated result, requested models, message — plus an attached "Selection report" PDF (lib/report.js). Same PDF goes to the sales copy.
- UnitePro CRM: every RFQ is pushed as a lead (lib/crm.js) when settings `crm.enabled=1` and env `UNITEPRO_TOKEN` is set. Admin → Tools → CRM: status / preview / push a test lead. Audit rows crm.pushed / crm.failed / crm.skipped.
- Selector: after picking the application picture the picture grid rolls up to a one-line strip (with "Change") and the next block (Model type / standard) is highlighted and scrolled into view.
- Diagnosed 22 Sep: RFQ mails not sent because Gmail rejected SMTP_PASS (535 BadCredentials) — needs a valid Gmail App Password without spaces, then a redeploy.

## 2.0.0 — 2026-09-22
* Consolidated ImpactCal (Node/SQLite local app), the live React front-end, the Firebase/Express backend and the AWRI selector
  into one Netlify site with a CSV database (data/*.csv) and Netlify Blobs for runtime state.
* Four selectors under one interface with picture menus: crane buffers, industrial shock absorbers, wire rope isolators, rubber mounts.
* RFQ → automatic priced draft → approval alert (Gmail; WhatsApp hook ready) → phone approval page → PDF quotation + GA drawings to customer.
* Lead time per product (CSV column) printed per line and as overall delivery on the quotation; bank details block (INR / USD).
* INR with CGST/SGST/IGST for India; USD zero-rated export with live rate + uplift for everyone else.
* Admin panel: CSV download / validated upload / revert, settings, drawings + Drive sync, users, audit, mail & FX tools, exports.
* 17-language UI from translations.csv (7 complete).
* Reference database from ACE, Enidine and EKD catalogues (data/reference) and a verification run (docs/VERIFICATION_REPORT.md).
* Engine: propelling work F·s is no longer divided by the number of absorbers (ACE convention, examples 19–21).
