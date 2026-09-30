'use strict';
/**
 * RFQ specification options per series (data/rfq_options.csv, editable in Admin -> CSV database).
 *
 *   mounting  - how the buffer / shock absorber is fixed (AKHG FS/RS/..., EI FF/FR, AD/ADX thread/flange/foot/clevis)
 *   rod_end   - rod-end cap for AC / ACX / AD / ADX (the customer must freeze it before the RFQ goes out)
 *   wri_mount - catalogue mounting option A/B/C/D/E/S of a wire rope isolator (decides how the lugs are made)
 *
 * A field is "required" when any of its active options carries required=1. The chosen option travels on the RFQ line
 * and prints on the quotation as a specification, so the later supply order carries it to production.
 * Series without their own rows fall back to the generic mountings of accessories.csv (optional, priced by code).
 */
const data = require('./data');

const FIELDS = ['mounting', 'rod_end', 'wri_mount'];
const TITLES = { mounting: 'Mounting', rod_end: 'Rod end', wri_mount: 'Mounting option' };

async function all() {
  let rows = [];
  try { rows = await data.rows('rfq_options'); } catch { rows = []; }
  return rows.filter(r => (r.status || 'active') === 'active').map(r => ({
    series: String(r.series || '').split(/[,;]\s*/).map(s => s.trim().toUpperCase()).filter(Boolean),
    field: r.field, code: r.code, label: r.label || r.code, required: r.required === '1', is_default: r.is_default === '1', accessory: r.accessory || '',
  }));
}

/** { mounting: { required, options:[{code,label,is_default,accessory}] }, rod_end: {...}, wri_mount: {...} } for one series */
async function forSeries(series, accessories) {
  const S = String(series || '').toUpperCase(), rows = await all(), out = {};
  for (const f of FIELDS) {
    const o = rows.filter(r => r.field === f && r.series.includes(S));
    if (o.length) out[f] = { title: TITLES[f], required: o.some(r => r.required), options: o.map(({ code, label, is_default, accessory }) => ({ code, label, is_default, accessory })) };
  }
  if (!out.mounting && accessories && S !== 'AWRI') {
    const gen = accessories.filter(a => a.kind === 'mounting' && a.status === 'active');
    if (gen.length) out.mounting = { title: TITLES.mounting, required: false, options: gen.map(a => ({ code: a.code, label: a.name, is_default: false, accessory: a.code })) };
  }
  return out;
}

/** every series in one object, for the front end */
async function table(seriesList, accessories) {
  const o = {};
  for (const s of seriesList) o[s] = await forSeries(s, accessories);
  return o;
}

/**
 * Check one RFQ line. `series` is the product series; the line carries mounting_code / cap_code / wri_mount_code.
 * Returns { line (with labels filled in), missing: ['Rod end', ...] }.
 */
async function apply(line, series, accessories) {
  const spec = await forSeries(series, accessories), missing = [], out = { ...line };
  const pick = (f, codeKey, labelKey) => {
    const s = spec[f]; if (!s) return;
    const want = String(line[codeKey] || '').trim(), byLabel = String(line[labelKey] || '').trim();
    const opt = s.options.find(o => o.code === want) || s.options.find(o => byLabel && o.label === byLabel);
    if (opt) { out[codeKey] = opt.code; out[labelKey] = opt.label; if (f === 'mounting') out.mounting_accessory = opt.accessory || ''; }
    else if (s.required) missing.push(s.title);
  };
  pick('mounting', 'mounting_code', 'mounting');
  pick('rod_end', 'cap_code', 'cap');
  pick('wri_mount', 'wri_mount_code', 'wri_mount');
  return { line: out, missing };
}

module.exports = { FIELDS, TITLES, all, forSeries, table, apply };
