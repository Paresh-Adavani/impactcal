'use strict';
/**
 * Selection report (A4 PDF) - a copy of what the selection programme produced for an RFQ:
 * project, customer, application inputs (MKS), calculated summary, the model(s) requested.
 * Attached to the customer's acknowledgement and to the sales copy.
 */
const PDFDocument = require('pdfkit');
const fs = require('fs'), path = require('path');

const NAVY = '#1B3160', ORANGE = '#F57C00', GREY = '#5A6672', LINE = '#C9D1DB';
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** Human labels + units for the duty inputs sent by selector.js (MKS). */
const INPUT_LABELS = {
  m: ['Moving mass', 'kg'], m2: ['Second mass', 'kg'], v: ['Impact velocity', 'm/s'], v2: ['Second velocity', 'm/s'],
  F: ['Propelling force', 'N'], P: ['Drive power', 'W'], n: ['Number of absorbers', ''], C: ['Cycles per hour', '/h'],
  H_M: ['Stroke utilisation factor', ''], mu: ['Friction coefficient', ''], H: ['Drop height', 'm'], J: ['Moment of inertia', 'kg·m²'],
  omega: ['Angular velocity', 'rad/s'], M_t: ['Torque', 'N·m'], r: ['Radius to absorber', 'm'], R: ['Radius to mass', 'm'],
  beta: ['Incline angle', 'rad'], temp_min: ['Min. temperature', '°C'], temp_max: ['Max. temperature', '°C'],
  k: ['Stiffness', 'N/m'], f: ['Frequency', 'Hz'], g_level: ['Shock level', 'g'], duration_ms: ['Pulse duration', 'ms'],
};
const numFmt = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : Number(v.toPrecision(4)).toString()) : String(v ?? '');

function render(rfq, company, opts = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Selection ${rfq.number}`, Author: company.name || 'ADONI TECH' } });
    const chunks = []; doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 80, L = 40;
    let y = 40;
    const logo = opts.logoPath || path.join(__dirname, '..', 'site', 'img', 'logo.png');
    if (fs.existsSync(logo)) { try { doc.image(logo, L, y, { height: 34 }); } catch {} }
    doc.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text('SELECTION REPORT', L, y, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(GREY).text(`Request ${rfq.number}   ·   ${fmtDate(rfq.created_at)}`, L, y + 22, { width: W, align: 'right' });
    y += 48; doc.moveTo(L, y).lineTo(L + W, y).lineWidth(2).strokeColor(ORANGE).stroke(); y += 12;

    const c = rfq.customer || {}, p = rfq.project || {}, sel = rfq.selection || {};
    const section = title => { if (y > doc.page.height - 120) { doc.addPage(); y = 40; } doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY).text(title, L, y); y += 16; };
    const kv = (rows, cols = 2) => {
      const cw = W / cols; let i = 0;
      for (const [k, v] of rows.filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '')) {
        const x = L + (i % cols) * cw;
        doc.font('Helvetica').fontSize(8.5).fillColor(GREY).text(k, x, y, { width: cw * 0.48 });
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#222').text(String(v), x + cw * 0.48, y, { width: cw * 0.5 });
        if (i % cols === cols - 1) y += 14;
        i++;
      }
      if (i % cols !== 0) y += 14;
      y += 6;
    };

    section('Project & customer');
    kv([['Project', p.name], ['Reference', p.reference], ['Equipment', p.equipment], ['Prepared by', p.prepared_by],
        ['Company', c.company || c.name], ['Contact', c.contact], ['E-mail', c.email], ['Phone', c.phone], ['Country', c.country], ['GSTIN', c.gstin]]);

    section('Application data entered (MKS units)');
    const inputs = sel.inputs || sel.duty || {};
    const rows = Object.entries(inputs).map(([k, v]) => { const l = INPUT_LABELS[k] || [k, '']; return [l[0], numFmt(v) + (l[1] ? ' ' + l[1] : '')]; });
    kv([['Impact case', sel.case_id], ['Standard', sel.standard], ...rows]);

    if (sel.summary && Object.keys(sel.summary).length) { section('Calculated result'); kv(Object.entries(sel.summary)); }

    section('Selected / requested');
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke(); y += 4;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GREY).text('Model', L, y, { width: W * 0.35 }).text('Qty', L + W * 0.35, y, { width: W * 0.1, align: 'right' }).text('Mounting / options', L + W * 0.48, y, { width: W * 0.52 });
    y += 13;
    for (const i of rfq.items || []) {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#222').text(i.model || i.key, L, y, { width: W * 0.35 });
      doc.font('Helvetica').text(String(i.qty), L + W * 0.35, y, { width: W * 0.1, align: 'right' });
      doc.text([i.mounting, i.cap, i.damping_code, i.remark].filter(Boolean).join(' · ') || '—', L + W * 0.48, y, { width: W * 0.52 });
      y += 15;
    }
    y += 4;
    if (rfq.formats && rfq.formats.length) kv([['Drawings requested', rfq.formats.join(', ')]]);
    if (rfq.message) { section('Message'); doc.font('Helvetica').fontSize(9).fillColor('#222').text(rfq.message, L, y, { width: W }); y = doc.y + 8; }

    y += 8; doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke(); y += 8;
    doc.font('Helvetica').fontSize(8).fillColor(GREY).text(
      `This is a copy of the data you entered in ImpactCal and the preliminary selection it produced. The selection is subject to confirmation by ${company.name || 'ADONI TECH'} against the application data; a quotation follows separately. E & O E.`,
      L, y, { width: W });
    doc.text(`${company.name || 'ADONI TECH'} · ${company.email || ''} · ${company.phone || ''} · ${company.web || ''}`, L, doc.y + 6, { width: W });
    doc.end();
  });
}

module.exports = { render, INPUT_LABELS };
