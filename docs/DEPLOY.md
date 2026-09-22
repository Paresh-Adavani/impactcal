# Deploying ImpactCal 2.0 to Netlify

Everything below is one-time except step 6 (each release).

## 1. Netlify plan and credits

Netlify bills in **credits**. Free = 300/month hard cap and *all sites pause when it runs out*;
Personal = 1,000/month for $9 with auto-recharge. A production deploy costs 15 credits, preview/branch deploys
are free, web requests 2 credits per 10,000, functions 10 credits per GB-hour. Move the account to **Personal**
before going live (Team settings → Billing → Change plan) and switch on **Auto recharge** so a busy month cannot
take the site down.

## 2. Create the site

Option A — GitHub (recommended, gives free deploy previews):
1. Create a private repo `impactcal` and push the `ImpactCal` folder (`.gitignore` excludes node_modules, data/_store, _legacy).
2. Netlify → Add new project → Import from GitHub → pick the repo. Build settings are read from `netlify.toml`
   (publish `site`, functions `netlify/functions`, no build command).

Option B — Netlify CLI from the PC (no GitHub):
```
npm install -g netlify-cli
netlify login
netlify init            (create & configure a new project → name: impactcal)
netlify deploy --prod   (each release; use `netlify deploy` for a free preview URL first)
```

To keep the existing address **impactcal.netlify.app**, link to that existing project instead of creating a
new one (`netlify link`, or in Option A change the repo of the existing project under Site configuration → Build & deploy).

## 3. Environment variables (Site configuration → Environment variables)

| Variable | Value | Purpose |
|---|---|---|
| `IMPACTCAL_SECRET` | any long random string (e.g. 40 characters) | signs login tokens and approval links — change it and every link/login is invalidated |
| `ADMIN_EMAILS` | `adonitech@gmail.com` | who is admin (comma list) |
| `SMTP_USER` | `adonitech@gmail.com` | Gmail account that sends OTPs, alerts and quotations |
| `SMTP_PASS` | Gmail **App Password** (16 letters) | Google Account → Security → 2-Step Verification → App passwords → "ImpactCal" |
| `SMTP_FROM` | `ADONI TECH <adonitech@gmail.com>` | optional display name |
| `PUBLIC_URL` | `https://impactcal.netlify.app` | used inside e-mails for the approve link and drawing links |
| `GOOGLE_SERVICE_ACCOUNT_B64` | base64 of the service-account JSON (step 5) | Drive sync |
| `DRIVE_FOLDER_ID` | the ID in the URL of the *ImpactCal* folder in Drive | Drive sync |
| `WHATSAPP_TOKEN` | (phase 2) Meta Cloud API permanent token | WhatsApp alerts |

Keep the total under 4 KB (AWS Lambda limit) — the service-account key is ~2.4 KB in base64, fine.

## 4. First deploy checklist

1. `npm test` on the PC → 70 passed.
2. Deploy (preview first). Open `/api/health` → `{"ok":true,"products":299,"store":"netlify-blobs"}`.
3. Log in at `/login.html` with adonitech@gmail.com — the OTP arrives by mail (Tools tab → *Verify SMTP* if not).
4. Admin → **Settings**: fill both bank blocks (INR: bank, branch, account, IFSC; USD: SWIFT, AD code, correspondent),
   check company lines, FX uplift %, `sales.emails`.
5. Admin → **CSV database**: upload `shock_absorbers.csv` with the current prices (or edit `data/` and redeploy).
6. Admin → **Drawings & Drive** → *Sync now* (after step 5 below) or upload the GA PDFs directly.
7. Run one test request from `selector.html`, approve it from the phone link, confirm the customer mail with PDF + drawing.

## 5. Google Drive

**Mirror of the PC folder (zero code):** install *Google Drive for Desktop* on the office PC, sign in with the
Adoni Tech Google account, *Preferences → Add folder* → `E:\claude\Projects\ImpactCal` → *Sync with Google Drive*.
The whole project, GA-LIBRARY included, is then always current in Drive (`Computers → adonitech → ImpactCal`).

**App sync (service account):**
1. console.cloud.google.com → new project "impactcal" → APIs & Services → Enable **Google Drive API**.
2. IAM → Service accounts → Create (`impactcal-sync`) → Keys → Add key → JSON. Download it.
3. In Drive, create a folder **ImpactCal** (in *My Drive* — a service account cannot write to the *Computers* mirror), share it with the
   service-account e-mail (`impactcal-sync@...iam.gserviceaccount.com`) as **Editor**. Copy the folder ID from the URL.
4. Inside it create `GA-LIBRARY` and copy the series folders from the PC (or let the nightly `tools/SYNC-CHECK.bat` robocopy do it).
5. `GOOGLE_SERVICE_ACCOUNT_B64` = the JSON file base64-encoded (`certutil -encode key.json key.b64` on Windows, then remove the
   BEGIN/END lines, or `base64 -w0 key.json`). Set `DRIVE_FOLDER_ID`.
6. The function `drive-sync` runs nightly and from the admin *Sync now* button: pulls new/changed GA PDFs into the app,
   pushes approved quotation PDFs to `QUOTATIONS/`, CSV uploads to `DATA-UPLOADS/`, and `RFQ-EXPORTS/rfqs.csv`,
   `quotations.csv`. Large libraries finish over a few runs (25 s budget per run).

## 6. Each release (monthly revision)

1. Edit the CSVs in `data/` (or download the current ones from the admin panel and put them in `data/`).
2. `npm test` → push to GitHub (auto-deploys) or `netlify deploy --prod`. 15 credits.
3. If a table had been uploaded from the admin panel, either keep it (still wins) or *Revert to deploy* so the new CSV shows.

## 7. WhatsApp alerts (phase 2)

Meta for Developers → create a Business app → WhatsApp → add the Adoni Tech business number (must not be
registered on the WhatsApp app) → create a **utility** template `impactcal_approval` with body
`{{1}}` and a URL button `https://impactcal.netlify.app/approve.html?id={{1}}` (dynamic suffix). Once approved,
set `WHATSAPP_TOKEN` (permanent System User token), settings `whatsapp.phone_id`, `whatsapp.to` (919890852663),
`whatsapp.enabled = 1`. `lib/notify.js` already sends the template with the approve link — no code change.

## 8. Custom domain (optional)

Site configuration → Domain management → add `impactcal.adonitech.co.in` (CNAME to the Netlify site). Set `PUBLIC_URL` accordingly.
