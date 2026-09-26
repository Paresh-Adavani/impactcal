'use strict';
/**
 * Pricing & costing panel.
 *
 *   data/costing.csv  - one row per product across all tables: basis (file | model | cost),
 *                       file price, estimate, margin, list price, dealer price, and for rubber
 *                       mounts the cost build-up (rubber, moulding, hardware, mould amortisation).
 *
 *   exportWorkbook()  - one .xlsx with a sheet per table (current price_inr / lead time + costing
 *                       columns) and a Policy sheet. Admin or an approved user downloads it, edits
 *                       in Excel, uploads it again.
 *   importWorkbook()  - reads the same layout (xlsx or a single-table csv), validates, and updates
 *                       price_inr / lead_time_days / status in the product tables plus costing.csv.
 *                       Never touches engineering columns.
 */
const XLSX = require('xlsx');
const data = require('./data');
const fx = require('./fx');

const SHEETS = { shock_absorbers: 'Shock absorbers', wire_rope_isolators: 'Wire rope isolators', rubber_mounts: 'Rubber mounts', accessories: 'Accessories', other_products: 'Other products' };
const NAME_OF = { 'shock_absorbers': 'shock_absorbers', 'wire_rope_isolators': 'wire_rope_isolators', 'rubber_mounts': 'rubber_mounts', 'accessories': 'accessories', 'other_products': 'other_products' };
const COST_COLS = ['basis', 'file_price', 'file_source', 'estimate', 'margin_pct', 'dealer_inr', 'cavities', 'rubber_kg', 'rubber_cost', 'moulding', 'metal_kg', 'hardware', 'mould_cost', 'mould_amort', 'unit_cost', 'note'];
const EDITABLE = ['price_inr', 'lead_time_days', 'status'];

function canUsePricing(user, settings) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const allowed = String(settings['pricing.users'] || '').toLowerCase().split(/[,\s;]+/).filter(Boolean);
  return allowed.includes(String(user.email).toLowerCase());
}

async function costingRows() { try { return await data.rows('costing'); } catch { return []; } }

/** Rows of one table joined with their costing row. */
async function joined(table) {
  const t = data.TABLES[table]; const rows = await data.rows(table);
  const cost = new Map((await costingRows()).filter(c => c.table === table).map(c => [c.key, c]));
  return rows.map(r => {
    const c = cost.get(r[t.key]) || {};
    const out = { key: r[t.key], model: r.model || r.name || r[t.key], series: r.series || r.family || c.series || '' };
    for (const k of ['hsn', 'gst_rate', 'uom', 'price_inr', 'lead_time_days', 'status']) out[k] = r[k] ?? '';
    for (const k of COST_COLS) out[k] = c[k] ?? '';
    out.usd_indicative = '';
    return out;
  });
}

async function exportWorkbook(settings) {
  const wb = XLSX.utils.book_new();
  const rate = await fx.inrPerUsd(settings).catch(() => ({ rate: Number(settings['fx.fallback_inr_per_usd'] || 88), source: 'fallback' }));
  const uplift = Number(settings['fx.uplift_pct'] || 12);
  const policy = [
    ['ImpactCal price & costing workbook', ''], ['Generated', new Date().toISOString()], [],
    ['How to use', 'Edit price_inr, lead_time_days, status and the costing columns in the table sheets, keep the key column unchanged, then upload this file in Admin → Pricing. Engineering columns are never changed by an upload.'],
    ['Columns', 'basis = file (from a price list) | model (estimated from size/energy) | cost (built up from moulding + hardware + mould amortisation). list price = price_inr. dealer_inr = dealer / negotiation price.'],
    [], ['INR per USD (live)', rate.rate], ['FX source', rate.source], ['Export uplift %', uplift], ['USD indicative', 'price_inr ÷ rate × (1 + uplift)'],
    [], ['Rubber mount costing parameters (used when the costing was generated; edit unit_cost directly or regenerate)'],
    ['rubber compound ₹/kg', 420], ['moulding ₹ per shot', 180], ['moulding ₹ per kg', 260], ['metal ₹/kg + machining ₹/kg', '95 + 140'], ['mould cost small/medium/large ₹', '28000 / 45000 / 80000'], ['cavities small/medium/large', '8 / 4 / 1'], ['mould amortised over pcs', 50], ['margin over cost %', 50],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(policy), 'Policy');
  for (const [table, name] of Object.entries(SHEETS)) {
    if (!data.TABLES[table]) continue;
    const rows = await joined(table);
    for (const r of rows) { const p = Number(r.price_inr); r.usd_indicative = p > 0 ? Math.ceil(p / rate.rate * (1 + uplift / 100)) : ''; }
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['key', 'model', 'series', 'price_inr', 'dealer_inr', 'usd_indicative', 'lead_time_days', 'status', 'basis', 'file_price', 'file_source', 'estimate', 'margin_pct', 'hsn', 'gst_rate', 'uom', 'cavities', 'rubber_kg', 'rubber_cost', 'moulding', 'metal_kg', 'hardware', 'mould_cost', 'mould_amort', 'unit_cost', 'note'] });
    ws['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[,₹\s]/g, '')); return Number.isFinite(n) ? n : NaN; };

/** Parse an uploaded workbook (or csv) into { table: [rows] }. */
function parseUpload(buffer, filename = '') {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  const out = {};
  for (const sn of wb.SheetNames) {
    const table = Object.keys(SHEETS).find(t => SHEETS[t].toLowerCase() === sn.toLowerCase() || t === sn.toLowerCase());
    if (!table && wb.SheetNames.length === 1 && /\.csv$/i.test(filename)) { const t = Object.keys(SHEETS).find(t => filename.toLowerCase().includes(t)); if (t) out[t] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' }); continue; }
    if (!table) continue;
    out[table] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
  }
  return out;
}

/** Validate + (unless dry) apply. Returns a per-table report. */
async function importWorkbook(buffer, filename, user, { dry = false } = {}) {
  const sheets = parseUpload(buffer, filename);
  if (!Object.keys(sheets).length) return { ok: false, errors: ['no recognised sheet: expected ' + Object.values(SHEETS).join(', ')] };
  const report = { ok: true, tables: {}, errors: [] };
  const costing = await costingRows(); const costHeader = costing.length ? Object.keys(costing[0]) : ['table', 'key', 'series', 'model', 'basis', 'file_price', 'file_source', 'estimate', 'margin_pct', 'list_inr', 'dealer_inr', 'lead_time_days', 'cavities', 'rubber_kg', 'rubber_cost', 'moulding', 'metal_kg', 'hardware', 'mould_cost', 'mould_amort', 'unit_cost', 'note'];
  const costByKey = new Map(costing.map(c => [c.table + '|' + c.key, c]));
  for (const [table, rows] of Object.entries(sheets)) {
    const t = data.TABLES[table]; if (!t) continue;
    const cur = await data.rows(table); const header = await data.header(table);
    const byKey = new Map(cur.map(r => [String(r[t.key]), r]));
    const rep = { rows: rows.length, changed: 0, unknown: [], errors: [], warnings: [] };
    for (const u of rows) {
      const k = String(u.key ?? u[t.key] ?? '').trim(); if (!k) continue;
      const r = byKey.get(k); if (!r) { rep.unknown.push(k); continue; }
      for (const f of EDITABLE) {
        if (!(f in u)) continue;
        let v = u[f];
        if (f === 'price_inr' || f === 'lead_time_days') { const n = num(v); if (Number.isNaN(n)) { rep.errors.push(`${k}: ${f} "${v}" is not a number`); continue; } v = n == null ? '' : String(f === 'price_inr' ? Math.round(n) : n); }
        v = String(v ?? '').trim();
        if (String(r[f] ?? '') !== v) { r[f] = v; rep.changed++; }
      }
      const c = costByKey.get(table + '|' + k) || (() => { const n = { table, key: k, series: u.series || '', model: u.model || k }; costing.push(n); costByKey.set(table + '|' + k, n); return n; })();
      for (const f of COST_COLS) if (f in u) c[f] = String(u[f] ?? '').trim();
      if ('price_inr' in u) c.list_inr = r.price_inr;
      if ('lead_time_days' in u) c.lead_time_days = r.lead_time_days;
      const p = num(r.price_inr), d = num(c.dealer_inr); if (p > 0 && d > p) rep.warnings.push(`${k}: dealer price ${d} is above list ${p}`);
    }
    if (rep.unknown.length) rep.warnings.push(`${rep.unknown.length} keys not in the catalogue (ignored): ${rep.unknown.slice(0, 8).join(', ')}${rep.unknown.length > 8 ? '…' : ''}`);
    if (rep.errors.length) report.ok = false;
    report.tables[table] = rep;
    if (!dry && !rep.errors.length) await data.saveUpload(table, header, cur);
  }
  if (!dry && report.ok) await data.saveUpload('costing', costHeader, costing.map(c => { const o = {}; for (const h of costHeader) o[h] = c[h] ?? ''; return o; }));
  return report;
}

async function summary() {
  const out = [];
  for (const table of Object.keys(SHEETS)) {
    if (!data.TABLES[table]) continue;
    const rows = await joined(table);
    const priced = rows.filter(r => Number(r.price_inr) > 0).length;
    const by = {}; for (const r of rows) by[r.basis || '—'] = (by[r.basis || '—'] || 0) + 1;
    out.push({ table, name: SHEETS[table], rows: rows.length, priced, basis: by, upload: await data.uploadMeta(table) });
  }
  return out;
}

module.exports = { exportWorkbook, importWorkbook, summary, canUsePricing, joined, SHEETS };
