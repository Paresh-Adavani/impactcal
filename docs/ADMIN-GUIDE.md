# ImpactCal — Admin guide (Paresh / Shital)

Open **https://impactcal.netlify.app/admin.html**, sign in with the admin e-mail (6-digit code by mail).

## A request comes in

1. Mail *"New request AT/R/2627/0012 — <customer>"* arrives at adonitech@gmail.com and sales@adonitech.co.in with the
   customer's calculation. The customer gets an acknowledgement.
2. A second mail *"APPROVAL: AT/Q/2627/0009 — <customer> — INR 45,194"* has the **Review, edit & approve** button.
   (WhatsApp with the same button once phase 2 is enabled.) The link works on the phone for 14 days, no login.
3. The approval page shows the calculation, every line with rate / discount / GST / **lead time** / HSN, freight,
   packing, validity, terms, the GA drawings that match the quoted models and the bank block that will print.
   Edit, **Save changes**, **Preview PDF**, then **Approve & send to customer**.
4. The customer receives the PDF + ticked drawings (attached, or as 30-day expiring links), cc the sales person who raised
   it and `mail.cc_on_offer`. The RFQ moves to *quoted*; the PDF is stored and pushed to Drive `QUOTATIONS/` at the next sync.
5. Need a revision? Admin → RFQ queue → *Prepare quotation* again: same number, rev +1.

Unpriced lines (price blank in the CSV) are flagged in the alert mail and on the page — type the rate before approving.

## Monthly price / lead-time revision (CSV database tab)

1. **Download** `shock_absorbers.csv` (or wire_rope_isolators / rubber_mounts / accessories).
2. Open in Excel. Edit `price_inr`, `lead_time_days`, `status` (`active`, `obsolete`, `on_request`), `note`.
   Never change the key column (`bk` / `model` / `code`). **File → Save As → CSV UTF-8 (Comma delimited)**.
3. Drop the file on the same card. The app checks it and shows *N rows ready* plus warnings (rows dropped, odd HSN…).
   Click **Apply**. The new data is live at once for the sales team and for every new quotation.
4. Copy the same file into `E:\claude\Projects\ImpactCal\data\` so the next deploy carries it (Drive mirror keeps a copy).

Settings (bank details, terms, FX uplift, who is sales) are on the **Settings** tab — one form, *Save all*.

## Drawings

* The library lives at `E:\claude\Projects\ImpactCal\GA-LIBRARY\<SERIES>\<MODEL>.pdf`, indexed by `data/ga_index.csv`
  (rebuild with `GA-LIBRARY\_tools\build.py` after adding drawings; upload the new `ga_index.csv` on the CSV tab).
* The app needs its own copy to attach them: **Drawings & Drive → Sync now** pulls from the Drive `ImpactCal/GA-LIBRARY`
  folder (changed files only), or select PDFs under *Upload GA drawings directly*. The tab lists what is still missing.

## Sales team

* Add addresses to `sales.emails` (or the whole `adonitech.co.in` domain is already sales). They log in with the same
  OTP screen and then see prices, USD export prices and lead times in every selector, and the RFQ queue.
* A request a sales person raises carries their e-mail; they are cc'd on the offer.

## Languages

`translations.csv` has one column per language. English, Hindi, Marathi, German, French, Spanish and Korean are complete;
Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Urdu, Arabic, Thai and Vietnamese fall back to English until the
column is filled (Excel → upload on the CSV tab). `ui.languages` in settings controls which appear in the menu.

## Tools tab

*Verify SMTP*, *Send me a test mail*, exchange rate (live value and the USD a ₹10,000 item would be quoted at), health.

## Backups

* Netlify Blobs holds RFQs, quotations, uploads and drawings — durable, but export monthly: **Team & activity → Export RFQs CSV**,
  Quotations → *Export CSV*; Drive sync pushes the same files nightly to `RFQ-EXPORTS/`.
* The PC folder is mirrored by Google Drive for Desktop; `tools\BACKUP.bat` makes a dated zip of `data/` and `GA-LIBRARY/`.


## CRM leads (UnitePro)

Every RFQ is sent to UnitePro as a lead: client = customer company, brand = contact person, industry = equipment, phone/e-mail/GSTIN/state, keywords = models, requirement = "RFQ n: model × qty", remarks = calculation summary + message + admin link. Tools → CRM has *Status*, *Preview test lead* (nothing sent) and *Push a test lead*. Turn off with settings `crm.enabled=0`.

## Customer copy of the RFQ

The acknowledgement to the customer repeats everything they entered (inputs in MKS, calculated result, models, message) and attaches `Selection-<RFQ>.pdf`. The sales copy gets the same PDF.
