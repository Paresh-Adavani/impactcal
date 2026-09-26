'use strict';
/**
 * The CSV database.
 *
 *  data/<table>.csv        - shipped with every deploy (the master copy lives on the office PC
 *                            and in Google Drive; git carries it to Netlify)
 *  store  csv/<table>.csv  - an override uploaded from the admin panel (monthly revision).
 *                            Wins over the shipped file until the next deploy replaces both.
 *
 * Every table is read fresh per request (small files, and Blobs is strongly consistent),
 * with a 60 s in-memory memo so a hot function does not re-parse on every call.
 */
const fs = require('fs'), path = require('path');
const csv = require('./csv');
const store = require('./store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TABLES = {
  shock_absorbers:     { key: 'bk',    editable: ['model','status','price_inr','lead_time_days','hsn','gst_rate','uom','note','me_min_kg','me_max_kg','nm_per_cycle','nm_per_hour','fs_max_N','temp_min_c','temp_max_c','ga_pdf','image'] },
  accessories:         { key: 'code',  editable: ['name','kind','applies_to','hsn','gst_rate','uom','price_inr','lead_time_days','status'] },
  wire_rope_isolators: { key: 'model', editable: null },   // null = whole row replaceable
  rubber_mounts:       { key: 'model', editable: null },
  settings:            { key: 'key',   editable: ['value','note'] },
  ga_index:            { key: 'path',  editable: null },
  translations:        { key: 'key',   editable: null },
  other_products:      { key: 'code',  editable: null },
  costing:             { key: 'key',   editable: null },   // key is unique per table; the pricing module handles it
};

const memo = new Map();
async function raw(table) {
  if (!TABLES[table]) throw new Error('unknown table ' + table);
  const m = memo.get(table);
  if (m && Date.now() - m.at < 60000) return m.text;
  let text = await store.getText('csv/' + table + '.csv');
  let source = 'upload';
  if (!text) { text = fs.readFileSync(path.join(DATA_DIR, table + '.csv'), 'utf8'); source = 'deploy'; }
  memo.set(table, { at: Date.now(), text, source });
  return text;
}
function bust(table) { memo.delete(table); }

async function rows(table) { return csv.parse(await raw(table)).rows; }
async function header(table) { return csv.parse(await raw(table)).header; }
async function source(table) { await raw(table); return memo.get(table).source; }

/* ---------- typed views ---------- */
const N = csv.num;
async function products() {
  return (await rows('shock_absorbers')).map(r => ({
    ...r,
    eta: N(r.eta), stroke_mm: N(r.stroke_mm), nm_per_cycle: N(r.nm_per_cycle), nm_per_hour: N(r.nm_per_hour),
    fs_max_n: N(r.fs_max_N), me_min_kg: N(r.me_min_kg), me_max_kg: N(r.me_max_kg),
    side_angle_deg: N(r.side_angle_deg), max_cycles_per_hour: N(r.max_cycles_per_hour),
    temp_min_c: N(r.temp_min_c) ?? -10, temp_max_c: N(r.temp_max_c) ?? 80,
    gst_rate: N(r.gst_rate) ?? 18, price_inr: N(r.price_inr), lead_time_days: N(r.lead_time_days),
    status: r.status || 'active',
  }));
}
async function accessories() {
  return (await rows('accessories')).map(r => ({ ...r, gst_rate: N(r.gst_rate) ?? 18, price_inr: N(r.price_inr), lead_time_days: N(r.lead_time_days) }));
}
async function wri() {
  return (await rows('wire_rope_isolators')).map(r => {
    const o = { ...r };
    for (const k of Object.keys(o)) if (/_(n|mm|kg|days|rate|inr)$|^(height|width|weight|hole|family)/.test(k)) o[k] = N(o[k]) ?? o[k];
    o.gst_rate = N(r.gst_rate) ?? 18; o.price_inr = N(r.price_inr); o.lead_time_days = N(r.lead_time_days);
    return o;
  });
}
async function rubber() {
  return (await rows('rubber_mounts')).map(r => ({ ...r, load_min_kg: N(r.load_min_kg), load_max_kg: N(r.load_max_kg),
    natural_freq_hz: N(String(r.natural_freq_hz).split(/[~\-–]/)[0]), stiffness_n_mm: N(r.stiffness_n_mm), static_deflection_mm: N(r.static_deflection_mm),
    gst_rate: N(r.gst_rate) ?? 18, price_inr: N(r.price_inr), lead_time_days: N(r.lead_time_days) }));
}
async function settings() {
  const o = {};
  for (const r of await rows('settings')) o[r.key] = r.value;
  return o;
}
async function gaIndex() { return rows('ga_index'); }
/** { dict: { key: { en, hi, ... } }, languages } for the front-end */
async function i18n() {
  const t = csv.parse(await raw('translations'));
  const langs = t.header.filter(h => h !== 'key');
  const dict = {};
  for (const r of t.rows) { const o = {}; for (const l of langs) if (r[l]) o[l] = r[l]; dict[r.key] = o; }
  return { dict, languages: langs };
}

/** Company block for documents. */
function company(s) {
  const c = {};
  for (const [k, v] of Object.entries(s)) if (k.startsWith('company.')) c[k.slice(8)] = v;
  return c;
}
function bank(s, cur) {
  const b = {}; const p = 'bank.' + (cur === 'USD' ? 'usd' : 'inr') + '.';
  for (const [k, v] of Object.entries(s)) if (k.startsWith(p)) b[k.slice(p.length)] = v;
  return b;
}

/**
 * Validate an uploaded CSV against the shipped schema. Returns { ok, errors, warnings, rows }.
 * The key column must be present; unknown columns are kept (so a new column added in Excel
 * survives), missing columns are filled from the current data.
 */
async function validateUpload(table, text) {
  const t = TABLES[table]; if (!t) return { ok: false, errors: ['unknown table'] };
  const cur = csv.parse(await raw(table));
  const up = csv.parse(text);
  const errors = [], warnings = [];
  if (!up.header.includes(t.key)) errors.push(`key column "${t.key}" missing`);
  const missing = cur.header.filter(h => !up.header.includes(h));
  if (missing.length) warnings.push('columns missing, kept from current data: ' + missing.join(', '));
  const extra = up.header.filter(h => !cur.header.includes(h));
  if (extra.length) warnings.push('new columns added: ' + extra.join(', '));
  const seen = new Set();
  for (const r of up.rows) {
    const k = r[t.key];
    if (!k) { errors.push('row without ' + t.key); continue; }
    if (seen.has(k)) errors.push('duplicate ' + t.key + ' ' + k);
    seen.add(k);
  }
  if (table === 'shock_absorbers' || table === 'accessories' || table === 'wire_rope_isolators' || table === 'rubber_mounts') {
    for (const r of up.rows) {
      if (r.hsn && !/^\d{4}(\d{2})?(\d{2})?$/.test(r.hsn)) warnings.push(`${r[t.key]}: HSN "${r.hsn}" is not 4, 6 or 8 digits`);
      if (r.gst_rate && ![0, 0.1, 0.25, 3, 5, 12, 18, 28, 40].includes(Number(r.gst_rate))) warnings.push(`${r[t.key]}: GST ${r.gst_rate}% is not a standard slab`);
      if (r.price_inr && !(Number(String(r.price_inr).replace(/,/g, '')) >= 0)) errors.push(`${r[t.key]}: price_inr "${r.price_inr}" is not a number`);
      if (r.lead_time_days && !(Number(r.lead_time_days) >= 0)) errors.push(`${r[t.key]}: lead_time_days "${r.lead_time_days}" is not a number`);
    }
  }
  const curByKey = new Map(cur.rows.map(r => [r[t.key], r]));
  const gone = cur.rows.filter(r => !seen.has(r[t.key])).length;
  if (gone) warnings.push(`${gone} rows present today are absent from the upload and will be dropped`);
  // merge: missing columns from current
  const merged = up.rows.map(r => { const c = curByKey.get(r[t.key]) || {}; const o = {}; for (const h of [...cur.header, ...extra]) o[h] = r[h] !== undefined ? r[h] : (c[h] ?? ''); return o; });
  return { ok: !errors.length, errors, warnings, rows: merged, header: [...cur.header, ...extra], count: merged.length };
}

async function saveUpload(table, header, rowsIn) {
  await store.set('csv/' + table + '.csv', csv.stringify(rowsIn, header));
  await store.setJSON('csv/' + table + '.meta', { uploaded_at: new Date().toISOString(), rows: rowsIn.length });
  bust(table);
}
async function resetUpload(table) { await store.del('csv/' + table + '.csv'); await store.del('csv/' + table + '.meta'); bust(table); }
async function uploadMeta(table) { return store.getJSON('csv/' + table + '.meta'); }

module.exports = { TABLES, raw, rows, header, source, bust, products, accessories, wri, rubber, settings, gaIndex, i18n, company, bank,
                   validateUpload, saveUpload, resetUpload, uploadMeta, DATA_DIR };
