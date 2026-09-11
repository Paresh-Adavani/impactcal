'use strict';
/**
 * SQLite for ImpactCal.
 *
 * Uses Node's built-in `node:sqlite` (Node 22.5+). Nothing to compile, no C++
 * toolchain, no prebuilt binary to go missing when Node moves a version.
 * Falls back to better-sqlite3 if it happens to be installed and the built-in
 * is not there (Node 20 and older).
 *
 * Presents the small slice of the better-sqlite3 API the app uses, so the rest
 * of the code does not care which one is underneath.
 */
let impl = null, kind = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  impl = DatabaseSync; kind = 'node:sqlite';
} catch {
  try { impl = require('better-sqlite3'); kind = 'better-sqlite3'; }
  catch {
    throw new Error(
      'No SQLite available.\n' +
      `This is Node ${process.version}. ImpactCal needs Node 22.5 or newer, which has SQLite built in.\n` +
      'Install the current LTS from https://nodejs.org and run again.');
  }
}

class Database {
  constructor(path) {
    this._db = new impl(path);
    this._native = kind === 'better-sqlite3';
  }
  exec(sql) { this._db.exec(sql); return this; }

  /** better-sqlite3 style: db.pragma('journal_mode = WAL') */
  pragma(str) {
    if (this._native) return this._db.pragma(str);
    try { return this._db.exec(`PRAGMA ${str}`); }
    catch { /* a pragma the build does not support is not fatal */ }
  }

  prepare(sql) {
    const st = this._db.prepare(sql);
    return {
      run : (...a) => norm(st.run(...clean(a))),
      get : (...a) => st.get(...clean(a)),
      all : (...a) => st.all(...clean(a)),
      raw : st,
    };
  }

  /** better-sqlite3 style: const fn = db.transaction(x => {...}); fn(arg) */
  transaction(fn) {
    if (this._native) return this._db.transaction(fn);
    const db = this._db;
    return (...args) => {
      let depth = 0;
      try { db.exec('BEGIN'); depth = 1; } catch { /* already inside one */ }
      try {
        const out = fn(...args);
        if (depth) db.exec('COMMIT');
        return out;
      } catch (e) {
        if (depth) { try { db.exec('ROLLBACK'); } catch {} }
        throw e;
      }
    };
  }

  close() { try { this._db.close(); } catch {} }
}

/** node:sqlite rejects undefined and JS booleans; normalise what the app passes. */
function clean(args) {
  return args.map(a => {
    if (a === undefined) return null;
    if (typeof a === 'boolean') return a ? 1 : 0;
    if (a && typeof a === 'object' && !Array.isArray(a) && !Buffer.isBuffer(a)) {
      const o = {};
      for (const [k, v] of Object.entries(a))
        o[k] = v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
      return o;
    }
    return a;
  });
}
/** better-sqlite3 returns lastInsertRowid as a number; node:sqlite may return BigInt. */
function norm(r) {
  if (!r) return r;
  const id = r.lastInsertRowid;
  return { changes: Number(r.changes),
           lastInsertRowid: typeof id === 'bigint' ? Number(id) : id };
}

Database.driver = kind;
module.exports = Database;
