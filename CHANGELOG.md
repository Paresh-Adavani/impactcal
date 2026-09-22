# Changelog
## 2.0.2 — 22 Sep 2026 (full-function test)
- Fixed: PDFs (quotation, approval preview, drawings) were blank on Netlify — function now serves them as binary.
- Fixed: lib/auth.js + site/common.js with sales.people display names had never been pushed; deployed now.
- Fixed: mistyped GSTIN (bad check digit) now still sets place of supply from the state prefix (was defaulting to Maharashtra → wrong CGST/SGST).
- SMTP: spaces in the Gmail app password are ignored; /api/health reports smtp user + password length.
- Approval page: confirms before sending a quotation with zero-rate product lines, before sending again, and when ticked drawings are not uploaded; un-uploaded drawings are labelled.
- Admin → Drawings: upload the whole GA-LIBRARY folder in one go (already-uploaded files skipped; tick to re-upload after a revision).
- RFQ mail: sales person who raised the RFQ is cc'd.
- Bank block: SBI cash-credit account for INR, HDFC USD account (with account currency) for overseas.
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
