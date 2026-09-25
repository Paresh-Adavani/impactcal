# Changelog
## 2.9.1 — 26 Sep 2026 (wire rope isolator lug material)
- The standard build is now **EN8D lugs, Arkor treated**, with SS 304 wire rope and normal duty.
- Choices:
  - **Aluminium alloy lugs: +2 %** on the list price
  - **SS 304 lugs: +5 %**
  - Rounded up to Rs 50 below Rs 10,000, Rs 100 above.
- The old options "SS 316" and "EN8 zinc plated" are gone. Saved projects that used them fall back to the nearest new option.
- Surcharges and the list of lug and wire materials are editable in Admin → Pricing & costing → "Wire rope isolator build options". The first line is the standard, and you can add, remove or re-order materials (settings `wri.lug_options`, `wri.wire_options`).
- Price viewers (sales, dealers, admin) see the % next to each choice; the public sees only the choices. The price shown in the selector includes the chosen lug.
- The lug and wire go with the RFQ. The server prices the line with the surcharge — the page cannot set a price — and prints "Lugs: … · Wire rope: …" on the quotation line.
- Quote portal: every wire rope isolator line has a lug choice, and the price updates with it.
- Marine-duty hint updated: EN8D Arkor lugs for indoor / sheltered use, SS 304 lugs recommended for open deck and salt spray.
## 2.9.0 — 25 Sep 2026 (bump / shock check in the rubber selector)
- The rubber mount page has an optional **Shock / bump check**. Enter:
  - peak g
  - pulse duration (ms)
  - pulse shape: half-sine, rectangular or terminal-peak sawtooth
  - what the equipment can take (g)
  - the free travel (mm)
- For the bump itself it shows:
  - the velocity change, the transmissibility needed and the highest natural frequency allowed
  - the travel needed (linear mount, and the ideal-absorber floor)
  - a plain go / no-go verdict, with the best g achievable in the space given
- Every mount is checked by running the pulse through it as a damped single-mass system (5 % damping, natural rubber). This gives the **g reaching the equipment** and the **bump travel**. A mount is rejected if it exceeds the g limit or the free travel. It is flagged if rubber compression passes 25 % of its height, and rejected above 40 %.
- Works with vibration or alone: leave the running speed empty for a bump-only selection. The bump figures go into the selection report and the RFQ.
- Checked against the 29 Aug application note: 5 kg on 6 points, 60 g / 11 ms, 10 g limit, 25 mm. Result: Δv 4.12 m/s, 173 mm needed (floor 87 mm), best 69 g in 25 mm → not possible.
## 2.8.0 — 25 Sep 2026 (dealer rules, lead-time editor, customer master)
- **Dealer rules database.** The pricing policy has 13 points: dealer discount, max discount, markup, ways to sell (resale / direct / both), resale terms, commission terms, Rs/kg freight, export, payment terms, price list, lead times, territory and other conditions.
  - The commonly agreed standard values sit in settings (`dealer.*`). Any point can have the dealer's own value.
  - Admin → Dealers → **Terms & approve / Terms**: every point must be ticked "agreed" before confirming. You can preview the e-mail first. On confirmation the dealer is approved (first time) and the **policy letter is e-mailed** (copy to ADONI TECH).
  - Each confirmation is a new version, with its history kept.
  - His own discount, freight rate and allowed routes are enforced on his quotations.
- **At sign-up** the applicant receives the standard pricing policy by e-mail, marked as reference only; his confirmed terms follow on approval. The dealer sees his confirmed terms in the portal.
- **Lead times editor** (Admin → Lead times) for admin and settings `leadtime.users` (Shital: adonisatara@gmail.com).
  - Filter by product line or search, set one line or all shown lines, and give a reason.
  - The value is live at once in the selectors, quotations and portal. It is stored apart from the CSV, so a deploy or CSV upload does not overwrite it. Clearing a value returns to the database figure.
  - Every change is logged with name, time and reason.
- **Customer master in the Quote portal** (tab Customers):
  - Sales and admin share one ADONI TECH customer list (C-<FY>-0001 …). A new customer is pushed to UnitePro as a lead at once; the CRM status is shown and can be retried.
  - Duplicates (same GSTIN, e-mail or phone) are refused with the existing number.
  - **Quote** on a customer opens a catalogue quotation for him — no selection needed. On a new quotation you pick a saved customer, or a typed-in one is saved automatically.
  - A dealer keeps his own private list, which is never sent to the ADONI TECH CRM.
## 2.7.0 — 25 Sep 2026 (dealer routes, commission, packing & freight)
- **Two ways for a dealer to sell**, chosen when he creates a quotation in the Quote portal:
  - **Resale** (as before): quotation in the dealer's name; ADONI TECH bills him list − his dealer discount (default 25 %, per dealer in Admin → Dealers). He decides the discount or markup to his customer.
  - **Direct supply** (new): quotation on ADONI TECH letterhead and bank, numbered AT/Q/<dealer code>/…, with the dealer printed as channel partner. The customer orders and pays ADONI TECH. Commission per line = (dealer discount − discount passed on) × his quoted price (list or marked-up), on the basic value only. Examples: list 100, passes 10 % → 15; marks up to 125, passes 10 % → 18.75. Passing on more than his discount is blocked unless ADONI TECH approves a special price. The dealer cannot add his own lines or change ADONI TECH's terms or freight on a direct offer.
- **Packing & freight, India only:** Rs 35 per kg of estimated product weight (settings `freight.rate_per_kg`, editable in Admin → Dealers → Dealer terms).
  - Resale: added to ADONI TECH's billing to the dealer (to his godown), and pre-filled as a plain "Packing & freight" line on his own quotation, which he may change.
  - Direct: printed as a line "to site — N kg × Rs 35/kg".
  - Export quotations stay ex-works.
- **Estimated unit weights** (`weight_kg`) for all 311 shock absorbers and crane buffers and all 309 rubber mounts (`tools/estimate_weights.py`):
  - AKHG/AKHS from ADONI TECH's own assembly weights in the crane-buffer costing sheets.
  - PU and spring buffers from a sizing rule.
  - Other shock absorbers from a fit on 689 catalogue weights.
  - Rubber mounts from their costing build-up.
  - Every figure can be corrected in the CSV.
- **Admin → Dealers:**
  - Dealer terms card: standard discount, max discount, Rs/kg.
  - **Commission register** for direct supply, with statuses quoted → ordered → customer paid → invoice received → commission paid (or lost). Commission can be marked paid only after the customer has paid. History and note (invoice number, UTR) are kept.
- The dealer's quotation list shows the route and the commission. Mails to ADONI TECH on a direct offer show the commission and ADONI TECH's net.
## 2.6.1 — 25 Sep 2026 (prices)
- AWRI-127-60 list price confirmed by Paresh at Rs 15,500 (WR costing sheets); the costing row now shows 15,500 as the file price.
- New price file "Price List India 2022-23.pdf" (list 2019 + additional models 2018) applied under the agreed policy (file price beats estimate, highest file price wins, M-variant price for the plain body): AD 14-10 1,400; AD 16-13 2,400; AC-14-10 1,100; YSR-8-8 2,500; YSR-12-12 2,200; AC-64-50 11,000; AC-64-100 12,500; AD 42-25/50/75 8,500 / 11,800 / 12,000; AD 64-50/100 15,000 / 17,500; AD 115-150/200/250 44,000 / 50,000 / 55,000. Script: `tools/apply_pricelist_2019.py`.
- Held back: AD 85-150 (2018 price 30,550 is below AD 85-125 at 40,000), AC-8-6 / AC-10-5 / AC-12-10 (only flange-variant prices listed).
## 2.6.0 — 25 Sep 2026 (AT-RCM cylindrical rubber mounts)
- New range **AT-RCM** — 206 cylindrical rubber mounts, D10–D100 mm, M3–M16, in five styles with their own icons in the rubber selector: SU stud / plain face, SS studs both ends, SF stud + tapped hole, FF tapped holes both ends, F0 tapped hole / plain face. Imported or moulded locally in India.
- Data per size: rated compression load and deflection -> secant stiffness (N/mm), fn at rated load, load band (20–100 % of rating), shear rating in the note. Built by `tools/build_rcm.py` (re-runnable).
- List prices from the local-moulding cost build-up (same parameters as the price list: rubber Rs 420/kg, moulding, hardware, mould over 50 pcs, +50 %): Rs 450 – 1,800. Costing rows added to `costing.csv`.
- Supplier cross-references stay internal: the `source` column is shown to admin and sales only; no supplier brand appears anywhere.
- Rubber selection: plain-face styles (SU, F0) are flagged "not bolted at one end" and ranked slightly below boltable ones. The 1500 rpm / 90 % case that found nothing before now returns AT-RCM mounts.
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
