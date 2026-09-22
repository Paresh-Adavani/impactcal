'use strict';
/**
 * Tiny, dependency-free CSV reader/writer (RFC 4180: quotes, embedded commas,
 * newlines inside quotes, CRLF). Excel "Save as CSV (UTF-8)" output parses
 * cleanly, including the BOM Excel adds.
 */

function parse(text) {
  const s = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (!nonEmpty.length) return { header: [], rows: [] };
  const header = nonEmpty[0].map(h => String(h).trim());
  const out = nonEmpty.slice(1).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { header, rows: out };
}

function cell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** rows: array of objects. header: optional column order. */
function stringify(rows, header) {
  const cols = header || Array.from(rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set()));
  const lines = [cols.map(cell).join(',')];
  for (const r of rows) lines.push(cols.map(c => cell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';   // BOM so Excel opens UTF-8 correctly
}

const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const bool = v => /^(1|true|yes|y)$/i.test(String(v || '').trim());

module.exports = { parse, stringify, num, bool };
