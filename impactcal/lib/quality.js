'use strict';
/**
 * Lead quality filter - keeps dummy / mischievous entries ("abcd", "xxxx", "test test",
 * 9999999999, asdf@asdf.com ...) out of the CRM and the sales inbox.
 *
 *   check(customer) -> { level: 'ok' | 'suspect' | 'reject', reasons: [...], score }
 *
 *   reject  : the request is refused with a friendly message (name, e-mail and phone are required and must look real)
 *   suspect : stored and mailed to sales, but NOT pushed to the CRM; flagged in the admin panel
 *   ok      : full processing
 */
const JUNK_WORDS = ['test', 'testing', 'tester', 'abc', 'abcd', 'abcde', 'xyz', 'xxx', 'xxxx', 'asdf', 'asdfg', 'qwerty', 'qwe', 'zxc', 'dummy', 'sample', 'demo', 'none', 'null', 'na', 'n/a', 'nil', 'fake', 'aaa', 'bbb', 'ddd', 'sss', 'lorem', 'ipsum', 'foo', 'bar', 'baz', 'hello', 'hi', 'user', 'name', 'customer', 'company', 'unknown', 'no', 'nope', 'random', 'temp', 'temporary', 'blah', 'gjhg', 'jhgf'];
const DISPOSABLE = ['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'fakeinbox.com', 'throwawaymail.com', 'maildrop.cc', 'mohmal.com', 'emailondeck.com', 'tempr.email', 'discard.email', 'mailnesia.com', 'spamgourmet.com'];
const BAD_DOMAINS = ['example.com', 'example.org', 'example.net', 'test.com', 'test.in', 'abc.com', 'xyz.com', 'asdf.com', 'aaa.com', 'email.com', 'mail.com', 'domain.com', 'company.com', 'gmail.co', 'gmial.com', 'gamil.com', 'localhost'];
const KEYBOARD = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', '0987654321', 'abcdefghijklmnopqrstuvwxyz'];

const norm = s => String(s || '').trim();
const letters = s => s.replace(/[^a-z]/gi, '');
const isRepeated = s => s.length >= 3 && /^(.)\1+$/.test(s);                     // aaaa, 1111
const isPattern = s => s.length >= 3 && /^(..?)\1+$/.test(s);                    // abab, 121212
const isKeyboardRun = s => { const l = s.toLowerCase(); return l.length >= 4 && KEYBOARD.some(k => k.includes(l) || [...k].reverse().join('').includes(l)); };
const isJunkWord = s => { const l = letters(s).toLowerCase(); return !l || JUNK_WORDS.includes(l) || JUNK_WORDS.some(w => l === w + w || l === w + 's'); };
const hasVowel = s => /[aeiouy]/i.test(s);
const distinctRatio = s => new Set(s.toLowerCase()).size / Math.max(1, s.length);

function checkName(name, reasons) {
  const n = norm(name); let bad = 0;
  if (n.length < 2) { reasons.push('name too short'); return 3; }
  const l = letters(n);
  if (l.length < 2) { reasons.push('name has no letters'); return 3; }
  const words = n.split(/\s+/).filter(Boolean);
  if (words.every(isJunkWord)) { reasons.push('name looks like a placeholder'); bad += 3; }
  if (words.some(w => isRepeated(letters(w)) || isPattern(letters(w)))) { reasons.push('name is repeated characters'); bad += 3; }
  if (words.some(w => letters(w).length >= 4 && isKeyboardRun(letters(w)))) { reasons.push('name is a keyboard run'); bad += 3; }
  if (l.length >= 4 && !hasVowel(l)) { reasons.push('name has no vowels'); bad += 2; }
  if (l.length >= 6 && distinctRatio(l) < 0.34) { reasons.push('name has too few distinct letters'); bad += 2; }
  if (/(.)\1{3,}/i.test(l)) { reasons.push('name has a run of the same letter'); bad += 2; }
  if (/\d{3,}/.test(n)) { reasons.push('name contains a number'); bad += 1; }
  return bad;
}
function checkEmail(email, reasons) {
  const e = norm(email).toLowerCase(); let bad = 0;
  const m = e.match(/^([^\s@]+)@([^\s@]+\.[a-z]{2,})$/i);
  if (!m) { reasons.push('e-mail address is not valid'); return 3; }
  const [, local, domain] = m;
  if (DISPOSABLE.includes(domain)) { reasons.push('disposable e-mail domain'); bad += 3; }
  if (BAD_DOMAINS.includes(domain)) { reasons.push('placeholder e-mail domain'); bad += 3; }
  const dl = domain.split('.')[0];
  if (isRepeated(dl) || (dl.length >= 4 && isKeyboardRun(dl)) || (JUNK_WORDS.includes(dl) && dl.length <= 5)) { reasons.push('e-mail domain looks fake'); bad += 2; }
  const ll = letters(local);
  if (isRepeated(ll) || (ll.length >= 4 && isKeyboardRun(ll)) || isJunkWord(local) && ll.length <= 5) { reasons.push('e-mail name looks fake'); bad += 2; }
  if (/^(test|dummy|fake|sample|demo|noreply|no-reply|abc|xyz|asdf|qwerty)\d*$/.test(local)) { reasons.push('e-mail name is a placeholder'); bad += 2; }
  return bad;
}
function checkPhone(phone, reasons) {
  const p = norm(phone); let bad = 0;
  const digits = p.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) { reasons.push('phone number must have 8-15 digits'); return 3; }
  const nat = digits.replace(/^(91|0091|0)/, '');
  if (isRepeated(digits) || isRepeated(nat)) { reasons.push('phone is the same digit repeated'); bad += 3; }
  if (isPattern(nat)) { reasons.push('phone is a repeating pattern'); bad += 3; }
  if (KEYBOARD.slice(3, 5).some(k => k.includes(nat) && nat.length >= 6)) { reasons.push('phone is a sequence'); bad += 3; }
  if (new Set(nat).size <= 2 && nat.length >= 8) { reasons.push('phone has only two distinct digits'); bad += 3; }
  if (/^0{4,}|0{5,}$/.test(nat)) { reasons.push('phone is mostly zeros'); bad += 2; }
  if (/^(1234|2345|3456|4567|5678|6789)/.test(nat) && /(1234|2345|3456|4567|5678|6789)$/.test(nat)) { reasons.push('phone is sequential'); bad += 2; }
  if (digits.length === 10 && !/^[6-9]/.test(digits) && !p.startsWith('+')) { reasons.push('10-digit Indian mobile should start with 6-9'); bad += 1; }
  return bad;
}
function checkCompany(company, reasons) {
  const c = norm(company); if (!c) return 0;
  const l = letters(c);
  if (l.length >= 2 && (isJunkWord(c) || isRepeated(l) || (l.length >= 4 && isKeyboardRun(l)) || (l.length >= 4 && !hasVowel(l)))) { reasons.push('company looks like a placeholder'); return 1; }
  return 0;
}

/** Score a customer block. Anything >= 3 in a required field, or a combined score >= 5, is rejected. */
function check(customer = {}) {
  const reasons = [];
  const n = checkName(customer.contact || customer.name, reasons);
  const e = checkEmail(customer.email, reasons);
  const p = checkPhone(customer.phone, reasons);
  const c = checkCompany(customer.company, reasons);
  const score = n + e + p + c;
  const hard = n >= 3 || e >= 3 || p >= 3;
  const level = hard || score >= 5 ? 'reject' : score >= 2 ? 'suspect' : 'ok';
  return { level, score, reasons, fields: { name: n, email: e, phone: p, company: c } };
}

/** Friendly message for a rejection. */
function message(q) {
  const f = q.fields || {};
  const which = [f.name >= 2 && 'your name', f.email >= 2 && 'a working e-mail address', f.phone >= 2 && 'a real phone number'].filter(Boolean);
  const list = which.length > 1 ? which.slice(0, -1).join(', ') + ' and ' + which[which.length - 1] : (which[0] || 'your real contact details');
  return `Please enter ${list} so that our engineer can get back to you.`;
}

module.exports = { check, message };
