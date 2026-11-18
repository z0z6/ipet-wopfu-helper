'use strict';
// Ochrona danych osobowych ucznia.
//  • pseudonymize() – zamienia dane osobowe na znaczniki {{IMIE}}, {{UCZEN}} … oraz usuwa
//    ogólne wzorce (PESEL, daty, adresy, telefony, e-maile, nazwiska z tytułami).
//  • findLeaks()   – „strażnik”: sprawdza KAŻDY tekst przed wysłaniem do chmury.
//    Gdy znajdzie dane osobowe, wysyłka zostaje zablokowana.
//  • fill()        – lokalnie wstawia prawdziwe dane w miejsce znaczników.
(function (root, factory) {
  const dep = typeof module === 'object' && module.exports ? { text: require('./text') } : root.IPET;
  const m = factory(dep.text);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { privacy: m });
})(typeof self !== 'undefined' ? self : this, function (T) {
  const SUFFIXES = '(?:a|y|i|ę|ą|o|u|e|em|ie|owi|om|ami|ach|ów|ego|emu|ej|ą|owie|ek|ka|ki|ce|kę|kiem|ku|ci|cie|ie|zie|rze)?';
  const UP = /^[A-ZŁŚŻŹĆŃÓĘĄ]/;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const PLACEHOLDERS = {
    UCZEN: 'imię i nazwisko ucznia', IMIE: 'imię ucznia', NAZWISKO: 'nazwisko ucznia', PESEL: 'PESEL',
    DATA_URODZENIA: 'data urodzenia', MIEJSCE_URODZENIA: 'miejsce urodzenia', ADRES: 'adres zamieszkania',
    RODZICE: 'rodzice', SZKOLA: 'szkoła', KLASA: 'klasa', PORADNIA: 'poradnia', NR_ORZECZENIA: 'nr orzeczenia',
    DATA_ORZECZENIA: 'data orzeczenia', OKRES: 'okres obowiązywania orzeczenia', WIEK: 'wiek', ROK_SZKOLNY: 'rok szkolny',
    WYCHOWAWCA: 'wychowawca', DYREKTOR: 'dyrektor', MIEJSCOWOSC: 'miejscowość', DATA: 'data'
  };

  // popularne zdrobnienia – w opisach poradni często pojawia się „Kuba” zamiast „Jakub”
  const DIMINUTIVES = {
    jakub: ['Kuba', 'Kubuś'], aleksander: ['Olek', 'Alek'], aleksandra: ['Ola', 'Ala'], katarzyna: ['Kasia'], małgorzata: ['Gosia', 'Małgosia'],
    agnieszka: ['Aga'], magdalena: ['Magda'], joanna: ['Asia'], anna: ['Ania', 'Anka'], maria: ['Marysia'], zofia: ['Zosia'], julia: ['Julka'],
    zuzanna: ['Zuzia', 'Zuza'], wiktoria: ['Wika'], natalia: ['Natka'], weronika: ['Wera', 'Weronka'], karolina: ['Karolcia'], gabriela: ['Gabrysia'],
    barbara: ['Basia'], elżbieta: ['Ela'], dominika: ['Domi'], antonina: ['Tosia'], helena: ['Hela', 'Helenka'], amelia: ['Amelka'], hanna: ['Hania'],
    michał: ['Michaś'], mikołaj: ['Mikołajek'], wojciech: ['Wojtek'], tomasz: ['Tomek'], piotr: ['Piotruś'], paweł: ['Pawełek'], krzysztof: ['Krzyś'],
    grzegorz: ['Grześ'], stanisław: ['Staś'], antoni: ['Antek', 'Antoś'], franciszek: ['Franek', 'Franio'], jan: ['Jaś', 'Janek'], mateusz: ['Mati'],
    bartosz: ['Bartek'], bartłomiej: ['Bartek'], szymon: ['Szymek'], maksymilian: ['Maks', 'Maksiu'], ignacy: ['Ignaś'], wiktor: ['Wiki'],
    józef: ['Józek', 'Józio'], kacper: ['Kacperek'], adam: ['Adaś'], dawid: ['Dawidek'], łukasz: ['Łukaszek'], dominik: ['Domin'], filip: ['Filipek'],
    tymon: ['Tymek'], tymoteusz: ['Tymek'], leon: ['Leoś'], nikola: ['Nika'], kamil: ['Kamilek'], marcel: ['Marcelek'], igor: ['Igorek'], oliwier: ['Oli'], oliwia: ['Oliwka', 'Oli']
  };

  // rdzenie imion/nazwisk z odmianą: Kowalski → Kowalsk…, Agnieszka → Agniesz…, Jan → Jan(a|em|owi…)
  function nameTokens(name) {
    return String(name || '').split(/[\s\-]+/).map((t) => t.replace(/[^\p{L}]/gu, '')).filter((t) => t.length >= 3);
  }

  function namePattern(token) {
    let stem = token.replace(/[aeiouyąęó]+$/i, '');
    if (stem.length < 3) stem = token;
    if (/(ek|eł|ec)$/i.test(token) && token.length >= 4) stem = token.slice(0, -2); // Marek→Mark, Paweł→Paw, Wojtek→Wojt
    if (stem.length >= 5) return `${esc(stem.slice(0, -1))}\\p{L}{0,6}`;
    if (stem.length >= 4) return `${esc(stem)}\\p{L}{0,5}`;
    return `${esc(token)}${SUFFIXES}`;
  }

  function nameRegex(token) {
    return new RegExp(`(?<![\\p{L}{])${namePattern(token)}(?![\\p{L}}])`, 'giu');
  }

  // dane jednego ucznia → lista „sekretów” (wartość + znacznik)
  function secretsFor(student, extra) {
    const p = (student && student.personal) || {};
    const list = [];
    const add = (value, ph, kind) => { if (value && String(value).trim().length >= 2) list.push({ value: String(value).trim(), ph, kind: kind || 'text' }); };
    if (p.imie && p.nazwisko) {
      add(`${p.imie} ${p.nazwisko}`, 'UCZEN'); add(`${p.nazwisko} ${p.imie}`, 'UCZEN');
    }
    for (const t of nameTokens(p.nazwisko)) add(t, 'NAZWISKO', 'name');
    for (const t of nameTokens(p.imie)) {
      add(t, 'IMIE', 'name');
      for (const d of DIMINUTIVES[t.toLowerCase()] || []) add(d, 'IMIE', 'name');
    }
    if (p.zdrobnienie) for (const t of nameTokens(p.zdrobnienie)) add(t, 'IMIE', 'name');
    if (p.pesel) add(String(p.pesel).replace(/\D/g, ''), 'PESEL', 'digits');
    for (const v of T.dateVariants(p.dataUrodzenia)) add(v, 'DATA_URODZENIA');
    add(p.adres, 'ADRES');
    if (p.adres) {
      const street = p.adres.match(/(?:ul\.|ulica|al\.|os\.|pl\.)?\s*([\p{L}][\p{L}.\- ]{2,30}?)\s+\d/iu);
      if (street) add(street[1].trim(), 'ADRES');
      const pc = p.adres.match(/\d{2}-\d{3}/); if (pc) add(pc[0], 'ADRES');
    }
    add(p.rodzice, 'RODZICE');
    for (const t of nameTokens(p.rodzice)) if (!/^(rodzic|matka|ojciec|opiekun|prawn|brak)/i.test(t)) add(t, 'RODZICE', 'name');
    add(p.nrOrzeczenia, 'NR_ORZECZENIA');
    add(p.szkola, 'SZKOLA');
    add(p.poradnia, 'PORADNIA');
    add(p.miejsceUrodzenia, 'MIEJSCE_URODZENIA');
    for (const n of p.zespolOrzekajacy || []) for (const t of nameTokens(n)) add(t, 'OSOBA', 'name');
    for (const e of extra || []) add(e.value, e.ph || 'OSOBA', e.kind || 'text');
    // najdłuższe najpierw – „Jan Kowalski” przed „Jan”
    return list.sort((a, b) => b.value.length - a.value.length);
  }

  const GENERIC = [
    ['PESEL', /(?<!\d)\d{11}(?!\d)/g],
    ['DATA', /\b\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{2,4}\s*(?:r\.|roku)?/g],
    ['DATA', /\b\d{4}-\d{2}-\d{2}\b/g],
    ['DATA', /\b\d{1,2}\s+(?:stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|wrze[sś]nia|pa[zź]dziernika|listopada|grudnia)\s+\d{4}\s*(?:r\.|roku)?/giu],
    ['EMAIL', /[\w.+-]+@[\w-]+\.[\w.]+/g],
    ['TELEFON', /(?:\+48[\s-]?)?(?<!\d)\d{3}[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g],
    ['ADRES', /\b\d{2}-\d{3}(?:\s+[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+){0,3}/gu],
    ['ADRES', /\b(?:ul\.|ulica|ulicy|al\.|aleja|alei|os\.|osiedle|osiedlu|pl\.|plac)\s+[^\n,;]{2,40}?\s\d+[a-zA-Z]?(?:\s*\/\s*\d+[a-zA-Z]?)?/giu],
    ['PORADNIA', /\bporadni\p{L}*\s+psychologiczno[\s-]*pedagogiczn\p{L}*(?:\s+(?:nr|numer)\s*\d+)?(?:\s+(?:w|we)\s+[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+(?:\s+[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+)?)?/giu],
    ['NR_ORZECZENIA', /\b(?:nr|numer|znak)\s*[:.]?\s*[\w.\-]*\d[\w.\-]*\/[\w\/.\-]+/giu],
    ['OSOBA', /\b(?:mgr|dr|lek\.|lek|prof\.|prof|inż\.|pan|pani|pana|panią|panu)\s+(?:inż\.\s+|n\.\s*med\.\s+|hab\.\s+)?[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+(?:\s+[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+){0,2}/gu]
  ];

  function pseudonymize(text, student, extra) {
    let out = String(text || '');
    const hits = [];
    const mark = (ph, original) => { hits.push({ ph, original }); return `{{${ph}}}`; };
    for (const s of secretsFor(student, extra)) {
      if (s.kind === 'name') {
        out = out.replace(nameRegex(s.value), (m) => (UP.test(m) ? mark(s.ph, m) : m));
      } else if (s.kind === 'digits') {
        out = out.replace(new RegExp(s.value.split('').join('\\s?'), 'g'), (m) => mark(s.ph, m));
      } else {
        const re = new RegExp(esc(s.value).replace(/\s+/g, '\\s+'), 'giu');
        out = out.replace(re, (m) => mark(s.ph, m));
      }
    }
    for (const [ph, re] of GENERIC) out = out.replace(re, (m) => mark(ph, m));
    out = out.replace(/(\{\{(\w+)\}\})(\s*\{\{\2\}\})+/g, '$1');
    return { text: out, hits };
  }

  // „Strażnik”: czy w tekście są dane osobowe? Zwraca listę wykrytych (zamaskowanych) elementów.
  function findLeaks(text, secrets) {
    const t = String(text || '');
    const leaks = [];
    const mask = (v) => { const s = String(v); return s.length <= 3 ? s[0] + '…' : s.slice(0, 2) + '…' + s.slice(-1); };
    for (const s of secrets || []) {
      if (!s || !s.value) continue;
      if (s.kind === 'name') {
        const re = nameRegex(s.value);
        const m = [...t.matchAll(re)].find((x) => UP.test(x[0]));
        if (m) leaks.push({ kind: PLACEHOLDERS[s.ph] || 'dane osobowe', sample: mask(m[0]) });
      } else if (s.kind === 'digits') {
        if (t.replace(/\s/g, '').includes(s.value)) leaks.push({ kind: 'PESEL', sample: mask(s.value) });
      } else if (s.value.length >= 4) {
        const a = T.strip(t.toLowerCase()).replace(/\s+/g, ' ');
        const b = T.strip(s.value.toLowerCase()).replace(/\s+/g, ' ');
        if (b.length >= 4 && a.includes(b)) leaks.push({ kind: PLACEHOLDERS[s.ph] || 'dane osobowe', sample: mask(s.value) });
      }
    }
    for (const m of t.matchAll(/(?<!\d)\d{11}(?!\d)/g)) if (T.peselValid(m[0])) leaks.push({ kind: 'numer PESEL', sample: mask(m[0]) });
    for (const m of t.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) leaks.push({ kind: 'adres e-mail', sample: mask(m[0]) });
    const seen = new Set();
    return leaks.filter((l) => { const k = l.kind + l.sample; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  function valuesFor(student, ctx) {
    const p = (student && student.personal) || {};
    const c = ctx || {};
    const age = T.ageAt(p.dataUrodzenia);
    return {
      UCZEN: [p.imie, p.nazwisko].filter(Boolean).join(' '),
      IMIE: p.imie, NAZWISKO: p.nazwisko, PESEL: p.pesel,
      DATA_URODZENIA: T.formatDate(p.dataUrodzenia), MIEJSCE_URODZENIA: p.miejsceUrodzenia, ADRES: p.adres,
      RODZICE: p.rodzice, SZKOLA: p.szkola || c.szkola, KLASA: p.klasa, PORADNIA: p.poradnia, NR_ORZECZENIA: p.nrOrzeczenia,
      DATA_ORZECZENIA: T.formatDate(p.dataOrzeczenia), OKRES: p.okres, WIEK: age != null ? `${age} ${T.plural(age, 'rok', 'lata', 'lat')}` : '',
      ROK_SZKOLNY: c.rokSzkolny, WYCHOWAWCA: p.wychowawca || c.wychowawca, DYREKTOR: c.dyrektor, MIEJSCOWOSC: c.miejscowosc,
      DATA: T.formatDate(new Date().toISOString().slice(0, 10))
    };
  }

  function fill(text, student, ctx) {
    const v = valuesFor(student, ctx);
    return String(text || '').replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (m, k) => (v[k] ? v[k] : k in v || k === 'OSOBA' ? '……………' : m));
  }

  // tekst do „odanonimizowania” w drugą stronę (np. przy poprawianiu sekcji z AI)
  function toPlaceholders(text, student, extra) { return pseudonymize(text, student, extra).text; }

  return { secretsFor, pseudonymize, findLeaks, fill, toPlaceholders, valuesFor, PLACEHOLDERS, nameRegex };
});
