'use strict';
// Narzędzia tekstowe: normalizacja, daty po polsku, PESEL. Działa w Node i w przeglądarce.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { text: m });
})(typeof self !== 'undefined' ? self : this, function () {
  const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_ASCII = MONTHS_GEN.map((m) => strip(m));
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  function strip(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
  }

  // małe litery, bez polskich znaków, scalone dzielenie wyrazów i białe znaki – do wyszukiwania słów kluczowych w OCR
  function norm(s) {
    return strip(String(s || '').toLowerCase())
      .replace(/-\s*\n\s*/g, '')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n');
  }

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function validDate(y, m, d) {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  // "12.05.2013", "12-05-2013 r.", "2013-05-12", "12 maja 2013" → "2013-05-12"
  function parseDate(s) {
    if (!s) return null;
    const t = String(s);
    let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (m && validDate(+m[1], +m[2], +m[3])) return isoOf(+m[1], +m[2], +m[3]);
    m = t.match(/\b(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{4})\b/);
    if (m && validDate(+m[3], +m[2], +m[1])) return isoOf(+m[3], +m[2], +m[1]);
    const a = strip(t.toLowerCase());
    m = a.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
    if (m) {
      const mi = MONTHS_ASCII.findIndex((x) => m[2].startsWith(x.slice(0, 4)));
      if (mi >= 0 && validDate(+m[3], mi + 1, +m[1])) return isoOf(+m[3], mi + 1, +m[1]);
    }
    return null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${pad(d)}.${pad(m)}.${y}`;
  }

  function longDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
  }

  // różne zapisy jednej daty – do wykrywania i usuwania jej z tekstu
  function dateVariants(iso) {
    if (!iso) return [];
    const [y, m, d] = iso.split('-').map(Number);
    return [...new Set([
      `${pad(d)}.${pad(m)}.${y}`, `${d}.${m}.${y}`, `${d}.${pad(m)}.${y}`, `${pad(d)}-${pad(m)}-${y}`, `${pad(d)}/${pad(m)}/${y}`,
      iso, `${d} ${MONTHS_GEN[m - 1]} ${y}`, `${pad(d)} ${MONTHS_GEN[m - 1]} ${y}`
    ])];
  }

  function ageAt(birthIso, atIso) {
    if (!birthIso) return null;
    const [by, bm, bd] = birthIso.split('-').map(Number);
    const at = atIso ? new Date(atIso) : new Date();
    let age = at.getFullYear() - by;
    if (at.getMonth() + 1 < bm || (at.getMonth() + 1 === bm && at.getDate() < bd)) age--;
    return age >= 0 && age < 40 ? age : null;
  }

  function plural(n, a, b, c) {
    if (n === 1) return a;
    const d = n % 10, t = n % 100;
    return d >= 2 && d <= 4 && !(t >= 12 && t <= 14) ? b : c;
  }

  // ───────── PESEL ─────────
  function peselValid(p) {
    const s = String(p || '').replace(/\D/g, '');
    if (s.length !== 11) return false;
    const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const sum = w.reduce((acc, wi, i) => acc + wi * Number(s[i]), 0);
    return (10 - (sum % 10)) % 10 === Number(s[10]) && !!peselDecode(s);
  }

  function peselDecode(p) {
    const s = String(p || '').replace(/\D/g, '');
    if (s.length !== 11) return null;
    let y = Number(s.slice(0, 2));
    let m = Number(s.slice(2, 4));
    const d = Number(s.slice(4, 6));
    const centuries = [[80, 1800], [0, 1900], [20, 2000], [40, 2100], [60, 2200]];
    let base = null;
    for (const [off, c] of centuries) {
      if (m > off && m <= off + 12) { base = c; m -= off; break; }
    }
    if (base == null) return null;
    y += base;
    if (!validDate(y, m, d)) return null;
    return { birthDate: isoOf(y, m, d), sex: Number(s[9]) % 2 === 1 ? 'M' : 'K' };
  }

  // ───────── klasa i etap ─────────
  function classNumber(klasa) {
    if (!klasa) return null;
    const t = String(klasa).trim().toUpperCase();
    const r = t.match(/^(VIII|VII|VI|IV|V|III|II|I)\b/);
    if (r) return ROMAN.indexOf(r[1]);
    const n = t.match(/^(\d)/);
    return n ? Number(n[1]) : null;
  }

  return { MONTHS_GEN, strip, norm, parseDate, formatDate, longDate, dateVariants, ageAt, plural, peselValid, peselDecode, classNumber, ROMAN };
});
