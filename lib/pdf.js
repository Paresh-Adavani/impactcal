'use strict';
/**
 * Quotation PDF (A4) with pdfkit. Pure JavaScript, no fonts to ship: Helvetica has no
 * rupee glyph, so amounts are written "INR 18,500.00" / "USD 240.00" - which is also
 * what banks and customs prefer on export documents.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs'), path = require('path');

const NAVY = '#1B3160', ORANGE = '#F57C00', GREY = '#5A6672', LINE = '#C9D1DB';
const money = (n, cur) => `${cur} ${Number(n || 0).toLocaleString(cur === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function render(q, company, bank, opts = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Quotation ${q.number}`, Author: company.name || 'ADONI TECH' } });
    const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 80, L = 40;
    let y = 40;

    /* header */
    const logo = opts.logoPath || path.join(__dirname, '..', 'site', 'img', 'logo.png');
    if (fs.existsSync(logo)) { try { doc.image(logo, L, y, { height: 34 }); } catch {} }
    doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text('QUOTATION', L, y, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GREY)
       .text(`${q.number}${q.rev ? '  Rev ' + q.rev : ''}`, L, y + 22, { width: W, align: 'right' })
       .text(`Date ${fmtDate(q.date)}   ·   Valid ${q.valid_days} days`, L, y + 34, { width: W, align: 'right' });
    y += 48;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(2).strokeColor(ORANGE).stroke(); y += 8;
    doc.fontSize(8.5).fillColor('#222').font('Helvetica')
       .text(`${company.name || 'ADONI TECH PVT. LTD.'} · ${company.iso || ''}`, L, y)
       .text(`${company.addr1 || ''}, ${company.addr2 || ''}, ${company.city || ''} ${company.pincode || ''}, ${company.state_name || ''}, India`, L, y + 11)
       .text(`Works: ${company.works || ''}`, L, y + 22)
       .text(`${company.email || ''} · ${company.phone || ''} · ${company.web || ''}   GSTIN ${company.gstin || ''}`, L, y + 33);
    y += 52;

    /* parties */
    const c = q.customer || {}, p = q.project || {};
    doc.rect(L, y, W / 2 - 6, 78).strokeColor(LINE).lineWidth(0.6).stroke();
    doc.rect(L + W / 2 + 6, y, W / 2 - 6, 78).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text('TO', L + 6, y + 5).text('PROJECT / REFERENCE', L + W / 2 + 12, y + 5);
    doc.font('Helvetica').fontSize(8.5).fillColor('#222');
    const toLines = [c.company || c.name, c.contact ? 'Attn: ' + c.contact : null, [c.city, c.state_name, c.country].filter(Boolean).join(', '),
      c.gstin ? 'GSTIN ' + c.gstin : null, [c.email, c.phone].filter(Boolean).join(' · ')].filter(Boolean);
    doc.text(toLines.join('\n'), L + 6, y + 17, { width: W / 2 - 18 });
    const prLines = [p.name, p.equipment, p.reference ? 'Your ref: ' + p.reference : null, 'Our ref: ' + (q.rfq_number || ''),
      q.currency === 'INR' ? `Place of supply: ${q.place_of_supply_name || ''} (${q.place_of_supply_code || ''}) — ${q.supply_type === 'intra' ? 'CGST + SGST' : 'IGST'}` : 'Export supply — zero-rated under LUT'].filter(Boolean);
    doc.text(prLines.join('\n'), L + W / 2 + 12, y + 17, { width: W / 2 - 18 });
    y += 90;

    /* items table */
    const cols = [['#', 18, 'left'], ['Description', 212, 'left'], ['HSN', 50, 'left'], ['Qty', 34, 'right'], ['Rate', 68, 'right'],
                  ['Disc %', 36, 'right'], ['GST %', 36, 'right'], ['Amount', W - 18 - 212 - 50 - 34 - 68 - 36 - 36, 'right']];
    const head = () => {
      doc.rect(L, y, W, 16).fillColor('#EEF1F5').fill(); doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8);
      let x = L + 3; for (const [t, w, a] of cols) { doc.text(t, x, y + 4, { width: w - 6, align: a }); x += w; }
      y += 16; doc.font('Helvetica').fillColor('#222');
    };
    head();
    const rows = q.totals.rows;
    rows.forEach((r, i) => {
      const desc = r.description + (r.lead_time_days ? `\nLead time: ${r.lead_time_days} days` : '');
      const h = Math.max(14, doc.heightOfString(desc, { width: cols[1][1] - 6 }) + 5);
      if (y + h > doc.page.height - 200) { doc.addPage(); y = 40; head(); }
      const vals = [String(i + 1), desc, r.hsn, String(r.qty), money(r.rate, q.currency).replace(q.currency + ' ', ''), r.discount_pct ? String(r.discount_pct) : '—', String(r.gst_rate), money(r.taxable, q.currency).replace(q.currency + ' ', '')];
      let x = L + 3; cols.forEach(([, w, a], j) => { doc.fontSize(8).text(vals[j], x, y + 3, { width: w - 6, align: a }); x += w; });
      y += h; doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.4).strokeColor(LINE).stroke();
    });
    y += 6;

    /* totals */
    const t = q.totals;
    const tx = L + W - 220;
    const tl = (k, v, bold) => { doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#222').text(k, tx, y, { width: 110 }).text(money(v, q.currency), tx + 110, y, { width: 110, align: 'right' }); y += 13; };
    tl('Sub total', t.sub_total);
    if (t.discount_total) tl('Discount', -t.discount_total);
    tl('Taxable value', t.taxable);
    if (q.supply_type === 'intra') { tl('CGST', t.cgst); tl('SGST', t.sgst); }
    if (q.supply_type === 'inter') tl('IGST', t.igst);
    if (t.round_off) tl('Round off', t.round_off);
    doc.moveTo(tx, y).lineTo(L + W, y).lineWidth(0.8).strokeColor(NAVY).stroke(); y += 3;
    tl('GRAND TOTAL', t.grand_total, true);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(GREY).text(t.amount_in_words, L, y - 13, { width: W - 230 });
    y += 10;

    /* lead time + terms */
    if (y > doc.page.height - 230) { doc.addPage(); y = 40; }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('DELIVERY & TERMS', L, y); y += 13;
    doc.font('Helvetica').fontSize(8.5).fillColor('#222');
    const T = q.terms || {};
    const terms = [
      ['Lead time', q.lead_time_days ? `${q.lead_time_days} days from receipt of technically & commercially clear order (per-line lead times as stated above)` : 'As stated per line'],
      ['Payment', T.payment], ['Delivery', T.delivery], ['Warranty', T.warranty], ['Other', T.other], q.notes ? ['Notes', q.notes] : null,
    ].filter(x => x && x[1]);
    for (const [k, v] of terms) { const h = doc.heightOfString(v, { width: W - 90 }); doc.font('Helvetica-Bold').text(k, L, y, { width: 80 }); doc.font('Helvetica').text(v, L + 88, y, { width: W - 90 }); y += h + 4; }
    y += 6;

    /* bank */
    if (y > doc.page.height - 150) { doc.addPage(); y = 40; }
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(`BANK DETAILS (${q.currency === 'USD' ? 'foreign currency remittance' : 'NEFT / RTGS / IMPS'})`, L, y); y += 13;
    const b = bank || {};
    const bl = q.currency === 'USD'
      ? [['Beneficiary', b.beneficiary], ['Bank', b.bank], ['Branch', b.branch], ['Account no.', b.account], ['Account currency', 'USD'], ['SWIFT / BIC', b.swift], ['IFSC', b.ad_code ? b.ad_code.replace(/^IFSC\s*/i, '') : ''], ['Correspondent bank', b.correspondent]]
      : [['Beneficiary', b.beneficiary], ['Bank', b.bank], ['Branch', b.branch], ['Account no.', b.account], ['Account type', b.type], ['IFSC', b.ifsc]];
    doc.rect(L, y, W, bl.filter(x => x[1]).length * 12 + 8).strokeColor(LINE).lineWidth(0.6).stroke(); y += 4;
    doc.fontSize(8.5).fillColor('#222');
    for (const [k, v] of bl) if (v) { doc.font('Helvetica-Bold').text(k, L + 6, y, { width: 110 }); doc.font('Helvetica').text(v, L + 120, y); y += 12; }
    if (!bl.some(x => x[1])) { doc.font('Helvetica-Oblique').fillColor(GREY).text('Bank details not yet entered in ImpactCal settings.', L + 6, y); y += 12; }
    y += 14;

    /* signature */
    doc.font('Helvetica').fontSize(8.5).fillColor('#222').text(`For ${company.name || 'ADONI TECH PVT. LTD.'}`, L + W - 200, y, { width: 200, align: 'right' });
    doc.text(q.approved_by ? `Approved by ${q.approved_by}` : 'Authorised signatory', L + W - 200, y + 34, { width: 200, align: 'right' });
    doc.fontSize(7.5).fillColor(GREY).text('This quotation is generated from ImpactCal after engineering review of the application data supplied. E & O E.', L, y + 34, { width: W - 210 });
    doc.end();
  });
}

module.exports = { render, money };
