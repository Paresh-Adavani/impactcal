# Changelog
## 2.5.1 — 25 Sep 2026
- DAMPA put on hold (settings `assistant.enabled` = 0): chat button and home banner hidden for everyone, including admin. Switch on later in Admin → DAMPA AI once the API key is set.

## 2.5.0 — 25 Sep 2026 (DAMPA AI assistant)
- **DAMPA** — "your impact & vibration engineer": a chat button on every page (home, selectors, WRI, rubber, dealer page, portal, admin). Customers and staff describe the application or attach photos, drawings, PDFs, Excel/CSV; DAMPA extracts the data, lists missing inputs, runs the real selection engines (crane buffers / shock absorbers, wire rope isolators, rubber mounts), explains the result in MKS units and offers an RFQ card that goes into the normal RFQ → quotation flow.
- Runs on the Claude API (env var `ANTHROPIC_API_KEY`; model, name, daily message limits and a monthly USD cap in settings `assistant.*`). No prices for visitors; prices for sales / dealers / admin. Never names competitor brands.
- Admin → **DAMPA AI**: usage and cost this month, settings, every conversation with transcript, the files people sent, and which chats became RFQs.
- Wire rope isolator selection now also runs on the server (`lib/wri.js`, same method as the WRI page).
- Rubber mounts without stiffness or natural-frequency data are no longer shown as passing.
- Home page: "Meet DAMPA" banner (shown when DAMPA is live).
## 2.4.1 — 25 Sep 2026 (GA library upload)
- Admin → Drawings → Whole folder: PDFs over 3 MB are sent in parts (no more 6 MB function limit), four files upload in parallel with one retry, folders starting with `_` (e.g. `_excluded`) are skipped, files already in the app are skipped unless "re-upload" is ticked.
- A drawing too large for a download link (> 4 MB) is attached to the quotation mail instead.
## 2.4.0 — 24 Sep 2026 (dealer sign-up page)
- **Dealer sign-up page** at `/dealers` (also `/become-a-dealer`): programme pitch, product families, the dealer-protection promise, how it works, FAQ, and a two-part application form (business + market: territory, products, industries) with inline e-mail verification. Welcome screen on submit; application lands in Admin → Dealers with territory and interests.
- Admin → Dealers: edit the **cities where dealers are sought** (shown on the sign-up page and the home banner) and the Google Analytics 4 ID.
- Traffic: "Become a dealer" in every header for visitors, dealer banner on the home page, SEO/Open Graph/FAQ structured data, `sitemap.xml`, `robots.txt`; Google tag (GA4) on all pages when `analytics.ga_id` is set, with sign-up and CTA events.
- Dealer quotations no longer name ADONI TECH anywhere (manufacturer footer removed). Dealers can also **download the PDF and send it from their own e-mail** (recorded as sent, ADONI TECH still gets the billing note); optional neutral sender `mail.dealer_from`.
- Sales: send on their own at list or up to 25 % below; a deeper discount **or a price above list** needs Paresh's approval.
- Settings keys added in a release now apply even after settings were saved in the admin panel.
## 2.3.0 — 24 Sep 2026 (dealers, sales offices, quote portal)
- **Dealers**: sign in → apply once in the Quote portal (company, address, GSTIN, bank, logo) → admin approves once in Admin → **Dealers**, setting the dealer code and his own terms (billing discount, max discount — e.g. a different structure for overseas dealers; blank = settings `dealer.discount_pct` / `dealer.max_discount_pct`, 25 %).
- Approved dealers see list prices in every selector and make quotations **in their own name** (letterhead, logo, GSTIN, bank, numbering `<CODE>/Q/<FY>/nnnn`), either from the **Quote portal** catalogue (no selection needed) or from any selector. The mail goes from the dealer's company name, reply-to and cc the dealer, cc ADONI TECH (`mail.dealer_cc`); ADONI TECH gets an internal note with the billing value (list − dealer discount) and the dealer's margin.
- **Discount limit**: dealers and sales may discount up to their limit (25 %) or add any markup; deeper = **special-price request** to Paresh (signed link), who approves case by case — and for a dealer can set the billing discount for that quotation. List prices, HSN and GST cannot be changed from the page.
- **Sales**: quotations carry the sales person and the billing office (`sales.office`, `office.<id>.*`; Satara / Pune), selectable per quotation; sales may send within 25 % (`quote.sales_self_send`). Drawings are released by ADONI TECH only.
- Export quotations print the **IEC 3106020261** (header + Exporter row). Company PIN corrected to 415001 (Satara office), works address SLU-W-39 Kodoli.
- Quotation page is role-aware (admin / sales / dealer; sign-in link when opened without a token). Header link "Quote portal"; home page Dealers box.
## 2.2.0 — 24 Sep 2026 (global price list)
- Prices for every product: 8 price lists merged (highest price wins), cost model per series for the rest (+25 % negotiation margin), rubber mounts costed as moulding + hardware + mould amortisation (+50 %). `data/costing.csv` records basis, file price, estimate, margin, list, dealer price and the cost build-up per product.
- New tables: `other_products.csv` (TSC feed-rate controllers etc.), `costing.csv`; 12 models added to the catalogue from the price lists (AKHG 85-300/400/500, 130-100/150/200/1000, AC-20-15, AC-27-25, AD 20-15, AD 27-25, AD 45-50) with interpolated ratings flagged `estimated`.
- Admin → **Pricing & costing**: download one Excel workbook (a sheet per table with list / dealer / USD / lead time / costing columns), edit, check, upload — applies live without a redeploy. Open to admin and the e-mails in settings `pricing.users`.
- `pricing/ImpactCal_Pricelist_2026-09.xlsx`: the costing workbook with live formulas (policy parameters on the first sheet) and the scripts that generated it (`pricing/*.py`).
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
