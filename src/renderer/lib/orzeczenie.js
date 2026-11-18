'use strict';
// Lokalny parser treści orzeczenia o potrzebie kształcenia specjalnego (tekst z OCR).
// Odczytuje dane osobowe ucznia, rodzaj niepełnosprawności, okres obowiązywania
// i wycina część merytoryczną (diagnoza, zalecenia, uzasadnienie). Nic nie wysyła w sieć.
(function (root, factory) {
  const dep = typeof module === 'object' && module.exports ? { text: require('./text') } : root.IPET;
  const m = factory(dep.text);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { orzeczenie: m });
})(typeof self !== 'undefined' ? self : this, function (T) {
  const DISABILITIES = {
    NI_LEKKI: 'niepełnosprawność intelektualna w stopniu lekkim',
    NI_UMIARKOWANY: 'niepełnosprawność intelektualna w stopniu umiarkowanym',
    NI_ZNACZNY: 'niepełnosprawność intelektualna w stopniu znacznym',
    NI_GLEBOKI: 'niepełnosprawność intelektualna w stopniu głębokim',
    AUTYZM: 'autyzm',
    ASPERGER: 'zespół Aspergera',
    DOWN: 'zespół Downa',
    SPRZEZONE: 'niepełnosprawności sprzężone',
    RUCHOWA: 'niepełnosprawność ruchowa (w tym afazja)',
    AFAZJA: 'afazja',
    SLABOWIDZACY: 'słabowidzenie / niewidzenie',
    SLABOSLYSZACY: 'słabosłyszenie / niesłyszenie',
    EPILEPSJA: 'padaczka (informacja medyczna)'
  };

  const LABELS = {
    name: /^\s*imi[eę]\s*(?:\(\s*imiona\s*\))?\s*(?:i\s+)?nazwisko(?:\s+(?:dziecka|ucznia|ucznia\/dziecka|wychowanka))?\s*[:;.\-]?\s*(.*)$/i,
    birth: /^\s*data\s+i\s+miejsce\s+urodzenia\s*[:;.\-]?\s*(.*)$/i,
    birthDate: /^\s*data\s+urodzenia\s*[:;.\-]?\s*(.*)$/i,
    birthPlace: /^\s*miejsce\s+urodzenia\s*[:;.\-]?\s*(.*)$/i,
    pesel: /^\s*(?:numer\s+)?pesel\s*[:;.\-]?\s*(.*)$/i,
    parents: /^\s*imiona\s+i\s+nazwiska\s+rodzic[oó]w\s*(?:\(?\s*prawnych\s+opiekun[oó]w\s*\)?)?\s*[:;.\-]?\s*(.*)$/i,
    address: /^\s*adres\s+(?:miejsca\s+)?zamieszkania[^:]*[:;.\-]?\s*(.*)$/i,
    school: /^\s*(?:nazwa\s+(?:i\s+adres\s+)?(?:przedszkola|szkoły|szkoly|placówki|placowki|ośrodka|osrodka)[^:]*|szkoła|szkola|placówka|placowka)\s*[:;.\-]\s*(.*)$/i,
    klasa: /^\s*klasa\s*(?:\/\s*oddział)?\s*[:;.\-]?\s*(.*)$/i,
    zawod: /^\s*zaw[oó]d\s*[:;.\-]?\s*(.*)$/i
  };

  const SECTION_HEADS = [
    ['diagnoza', /^\s*(?:[IVX]+\.|\d+\.)?\s*(diagnoza|opis\s+funkcjonowania|ocena\s+funkcjonowania|charakterystyka\s+funkcjonowania)/i],
    ['zalecenia', /^\s*(?:[IVX]+\.|\d+\.)?\s*(zalecenia|zalecane\s+formy|zalecane\s+warunki|wskazania)/i],
    ['uzasadnienie', /^\s*(?:[IVX]+\.|\d+\.)?\s*uzasadnienie/i],
    ['koniec', /^\s*(pouczenie|od\s+orzeczenia\s+(?:przysługuje|przysluguje)|przewodnicz[aą]c[ya]\s+zespo[lł]u\s*$|podpis)/i]
  ];

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').replace(/^[\s:;.\-–]+|[\s;,–-]+$/g, '').trim();
  }

  function capitalizeName(s) {
    return clean(s).toLowerCase().replace(/(^|[\s\-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  }

  function looksLikeLabel(line) {
    return Object.values(LABELS).some((re) => re.test(line)) || SECTION_HEADS.some(([, re]) => re.test(line));
  }

  // wartość pola: reszta linii po etykiecie albo następna niepusta linia
  function fieldValue(lines, i, m, minLen) {
    let v = clean(m[1]);
    if (!v || v.length < (minLen || 2)) {
      for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
        const nx = clean(lines[j]);
        if (!nx) continue;
        if (looksLikeLabel(lines[j])) break;
        v = nx; break;
      }
    }
    return v;
  }

  function detectDisabilities(text) {
    const n = T.norm(text).replace(/\n/g, ' ');
    const found = new Set();
    const stopien = /niepelnosprawn\w*\s+intelektualn\w*\s+(?:w\s+)?stopni\w*\s+(lekk|umiarkowan|znaczn|gleb)/g;
    let m;
    while ((m = stopien.exec(n))) {
      found.add({ lekk: 'NI_LEKKI', umiarkowan: 'NI_UMIARKOWANY', znaczn: 'NI_ZNACZNY', gleb: 'NI_GLEBOKI' }[m[1]]);
    }
    if (/upos\w*\s+umysl\w*\s+(?:w\s+)?stopni\w*\s+lekk|niepelnosprawn\w*\s+intelektualn\w*\s+lekk/.test(n)) found.add('NI_LEKKI');
    if (/\bf7[01]\b/.test(n)) found.add(/\bf70\b/.test(n) ? 'NI_LEKKI' : 'NI_UMIARKOWANY');
    // „autyzm, w tym zespół Aspergera” to formuła z rozporządzenia – Asperger tylko, gdy wymieniony osobno lub kodem F84.5
    const aspergerAlone = n.replace(/autyzm\w*\s*,?\s*w\s+tym\s+(?:z\s+)?zespo\w*\s+aspergera/g, 'autyzm').match(/asperger/);
    if (aspergerAlone || /\bf\s?84[.,]5\b/.test(n)) found.add('ASPERGER');
    else if (/autyzm|autystyczn|\bf\s?84[.,]?[01]?\b|spektrum\s+autyzmu|asd\b/.test(n)) found.add('AUTYZM');
    if (/zespo\w*\s+downa|trisomi\w*\s*(?:chromosomu\s*)?21|\bq\s?90\b/.test(n)) found.add('DOWN');
    if (/sprzezon/.test(n)) found.add('SPRZEZONE');
    if (/niepelnosprawn\w*\s+ruchow|mozgow\w*\s+porazen\w*\s+dzieci|\bmpd\b|\bg\s?80\b|przepuklin\w*\s+opon/.test(n)) found.add('RUCHOWA');
    if (/afazj/.test(n)) found.add('AFAZJA');
    if (/slabowidz|niewidom/.test(n)) found.add('SLABOWIDZACY');
    if (/slaboslysz|nieslysz|niedosluch/.test(n)) found.add('SLABOSLYSZACY');
    if (/padaczk|epilepsj|\bg\s?40\b/.test(n)) found.add('EPILEPSJA');
    const list = [...found].filter(Boolean);
    const kinds = list.filter((c) => !['SPRZEZONE', 'EPILEPSJA', 'AFAZJA'].includes(c));
    if (kinds.length >= 2) list.push('SPRZEZONE');
    return [...new Set(list)];
  }

  function stopienNI(codes) {
    for (const c of ['NI_GLEBOKI', 'NI_ZNACZNY', 'NI_UMIARKOWANY', 'NI_LEKKI']) if (codes.includes(c)) return c;
    return null;
  }

  function detectStage(schoolText, klasa) {
    const s = T.norm(schoolText || '');
    const k = T.classNumber(klasa);
    if (/przysposabiaj/.test(s)) return { etap: 'SPdP', label: 'Szkoła specjalna przysposabiająca do pracy' };
    if (/branzow/.test(s)) return { etap: 'BS', label: 'Branżowa szkoła I stopnia' };
    if (/liceum|technikum/.test(s)) return { etap: 'PONAD', label: 'Szkoła ponadpodstawowa' };
    if (/przedszkol/.test(s) && !/podstaw/.test(s)) return { etap: 'PRZ', label: 'Wychowanie przedszkolne' };
    if (k) return k <= 3 ? { etap: 'SP1', label: `Szkoła podstawowa – I etap (klasa ${T.ROMAN[k]})` } : { etap: 'SP2', label: `Szkoła podstawowa – II etap (klasa ${T.ROMAN[k] || k})` };
    if (/podstaw/.test(s)) return { etap: 'SP', label: 'Szkoła podstawowa' };
    return { etap: '', label: '' };
  }

  function sectionize(lines, startIdx) {
    const sections = { diagnoza: [], zalecenia: [], uzasadnienie: [], inne: [] };
    let cur = 'inne';
    for (let i = startIdx; i < lines.length; i++) {
      const l = lines[i];
      const head = SECTION_HEADS.find(([, re]) => re.test(l));
      if (head) {
        if (head[0] === 'koniec') break;
        cur = head[0];
        const rest = l.replace(head[1], '').replace(/^[\s:.\-–]+/, '');
        if (rest.trim()) sections[cur].push(rest.trim());
        continue;
      }
      sections[cur].push(l);
    }
    const join = (a) => a.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { diagnoza: join(sections.diagnoza), zalecenia: join(sections.zalecenia), uzasadnienie: join(sections.uzasadnienie), inne: join(sections.inne) };
  }

  function parse(rawText) {
    const text = String(rawText || '').replace(/\r/g, '');
    const lines = text.split('\n');
    const p = {};
    const conf = {};
    let lastLabelLine = -1;
    let teamFrom = -1, teamTo = -1;

    lines.forEach((line, i) => {
      for (const [key, re] of Object.entries(LABELS)) {
        const m = line.match(re);
        if (!m) continue;
        if (key === 'name' && /rodzic|opiekun|przewodnicz|lekarz/i.test(line)) continue;
        let v = fieldValue(lines, i, m, key === 'klasa' ? 1 : 2);
        if (!v) continue;
        // długie pola zawinięte na kolejną linię (np. nazwa szkoły, adres)
        if (['school', 'address', 'parents'].includes(key) && clean(m[1]) === v) {
          const nx = clean(lines[i + 1] || '');
          if (nx && nx.length < 70 && !/:/.test(nx) && !looksLikeLabel(lines[i + 1]) && !/^na\s+okres/i.test(nx)) v = `${v} ${nx}`;
        }
        if (!p[key]) { p[key] = v; lastLabelLine = Math.max(lastLabelLine, i); }
        break;
      }
      if (/w\s+sk[lł]adzie/i.test(line) && teamFrom < 0) teamFrom = i;
      if (teamFrom >= 0 && teamTo < 0 && i > teamFrom && /orzeka|po\s+rozpatrzeniu|rozpatrzy/i.test(line)) teamTo = i;
    });

    const out = {
      imie: '', nazwisko: '', pesel: '', dataUrodzenia: '', miejsceUrodzenia: '', plec: '', rodzice: '', adres: '',
      szkola: '', klasa: '', zawod: '', nrOrzeczenia: '', dataOrzeczenia: '', poradnia: '', okres: '', etap: '', etapLabel: '', zespolOrzekajacy: []
    };

    if (p.name) {
      const parts = clean(p.name.replace(/\(.*?\)/g, '')).split(/\s+/).filter((x) => /\p{L}/u.test(x));
      if (parts.length >= 2) {
        out.nazwisko = capitalizeName(parts[parts.length - 1]);
        out.imie = capitalizeName(parts.slice(0, -1).join(' '));
        // zapis „NAZWISKO Imię” – wersaliki tylko w pierwszym członie
        if (parts[0] === parts[0].toUpperCase() && parts[parts.length - 1] !== parts[parts.length - 1].toUpperCase()) {
          out.nazwisko = capitalizeName(parts[0]);
          out.imie = capitalizeName(parts.slice(1).join(' '));
        }
        conf.imie = conf.nazwisko = 'wysoka';
      } else if (parts.length === 1) { out.nazwisko = capitalizeName(parts[0]); conf.nazwisko = 'niska'; }
    }

    // PESEL: z etykiety albo dowolny poprawny 11-cyfrowy numer
    const peselCand = [];
    if (p.pesel) peselCand.push(p.pesel.replace(/[^\d]/g, '').slice(0, 11));
    for (const m of text.matchAll(/(?<!\d)(\d[\d ]{9,13}\d)(?!\d)/g)) { const d = m[1].replace(/ /g, ''); if (d.length === 11) peselCand.push(d); }
    const goodPesel = peselCand.find((c) => T.peselValid(c));
    if (goodPesel) { out.pesel = goodPesel; conf.pesel = 'wysoka'; } else if (peselCand[0]) { out.pesel = peselCand[0]; conf.pesel = 'niska – zła suma kontrolna, sprawdź'; }

    const birthRaw = p.birth || p.birthDate || '';
    out.dataUrodzenia = T.parseDate(birthRaw) || '';
    if (birthRaw) {
      const place = (p.birthPlace || birthRaw.replace(/\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{4}\s*(r\.?|roku)?/i, '').replace(/\d{1,2}\s+\p{L}+\s+\d{4}\s*(r\.?|roku)?/iu, '').replace(/^[\s,;w]+/i, '')).trim();
      out.miejsceUrodzenia = clean(place).replace(/^w\s+/i, '');
    } else if (p.birthPlace) out.miejsceUrodzenia = clean(p.birthPlace);
    const dec = out.pesel && T.peselValid(out.pesel) ? T.peselDecode(out.pesel) : null;
    if (dec) {
      out.plec = dec.sex;
      if (!out.dataUrodzenia) { out.dataUrodzenia = dec.birthDate; conf.dataUrodzenia = 'z numeru PESEL'; }
      else if (out.dataUrodzenia !== dec.birthDate) conf.dataUrodzenia = 'niezgodna z PESEL – sprawdź';
    }
    if (!out.plec && out.imie) out.plec = /a$/i.test(out.imie.split(' ')[0]) && !/^(kuba|barnaba|bonawentura|kosma)$/i.test(out.imie.split(' ')[0]) ? 'K' : 'M';

    out.rodzice = clean(p.parents || '');
    out.adres = clean(p.address || '');
    out.szkola = clean(p.school || '');
    out.klasa = clean((p.klasa || '').split(/[,;]/)[0]).slice(0, 20);
    out.zawod = clean(p.zawod || '');

    // numer orzeczenia
    const nr = text.match(/orzeczenie\s+(?:nr|numer)\s*[:.]?\s*([\w\/.\-]*\d[\w\/.\-]*)/i) || text.match(/\b(?:nr|numer)\s+orzeczenia\s*[:.]?\s*([\w\/.\-]*\d[\w\/.\-]*)/i) || text.match(/^\s*(?:nr|znak)\s*[:.]?\s*([\w\/.\-]*\d[\w\/.\-]*\/\d{2,4}[\w\/.\-]*)/im);
    if (nr) out.nrOrzeczenia = nr[1].replace(/[.,]$/, '');

    // data wydania – „dnia …” w pobliżu nagłówka albo pierwsza data przed danymi osobowymi
    const head = lines.slice(0, Math.max(12, lastLabelLine)).join('\n');
    const dn = head.match(/(?:z\s+dnia|dnia|data\s+wydania)\s*[:.]?\s*(\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{4}|\d{1,2}\s+\p{L}+\s+\d{4})/iu);
    if (dn) out.dataOrzeczenia = T.parseDate(dn[1]) || '';

    // poradnia
    const pl = lines.findIndex((l) => /poradni\w*\s+psychologiczno/i.test(l));
    if (pl >= 0) {
      let v = clean(lines[pl].replace(/^.*?(poradni\w*\s+psychologiczno)/i, '$1'));
      const nx = clean(lines[pl + 1] || '');
      if (nx && /^(nr|w\s|we\s|im\.)/i.test(nx) && v.length < 60) v += ' ' + nx;
      out.poradnia = v.replace(/^poradni\s/i, 'Poradnia ').replace(/\s+w\s+sk[lł]adzie.*$/i, '');
      out.poradnia = out.poradnia.replace(/^Poradni(?=\s)/, 'Poradnia');
    }

    // okres obowiązywania
    const ok = text.replace(/\n/g, ' ').match(/na\s+okres\s*:?\s*(.{4,120}?)(?:\.\s|;|$|\s+(?:ze\s+wzgl|imi[eę]|data))/i);
    if (ok) out.okres = clean(ok[1]);

    // zespół orzekający – nazwiska tylko do usuwania z tekstu, nie do dokumentów
    if (teamFrom >= 0) {
      for (let i = teamFrom; i < (teamTo > 0 ? teamTo : Math.min(lines.length, teamFrom + 10)); i++) {
        const l = lines[i];
        const m = l.match(/(?:mgr|dr|lek\.?|prof\.?|psycholog|pedagog|logopeda)?\s*([A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+\s+[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}-]+(?:-[A-ZŁŚŻŹĆŃÓĘĄ][\p{L}]+)?)/u);
        if (m && !/zesp[oó]|poradni|sk[lł]adzie|orzekaj/i.test(m[1])) out.zespolOrzekajacy.push(clean(m[1]));
      }
    }

    const st = detectStage(out.szkola + ' ' + out.zawod, out.klasa);
    out.etap = st.etap; out.etapLabel = st.label;

    const niepelnosprawnosci = detectDisabilities(text);
    const sections = sectionize(lines, Math.max(0, lastLabelLine + 1));
    const fallbackBody = lines.slice(Math.max(0, lastLabelLine + 1)).join('\n');

    return {
      personal: out,
      confidence: conf,
      niepelnosprawnosci,
      stopien: stopienNI(niepelnosprawnosci),
      sections,
      body: [sections.diagnoza, sections.zalecenia, sections.uzasadnienie].filter(Boolean).join('\n\n') || fallbackBody,
      foundFields: Object.keys(p)
    };
  }

  // scalanie wyników z kilku stron/skanów – pierwsza niepusta wartość wygrywa
  function merge(results) {
    const base = { personal: {}, confidence: {}, niepelnosprawnosci: [], stopien: null, sections: { diagnoza: '', zalecenia: '', uzasadnienie: '', inne: '' }, body: '' };
    for (const r of results) {
      for (const [k, v] of Object.entries(r.personal)) {
        if (Array.isArray(v)) base.personal[k] = [...new Set([...(base.personal[k] || []), ...v])];
        else if (v && !base.personal[k]) { base.personal[k] = v; if (r.confidence[k]) base.confidence[k] = r.confidence[k]; }
        else if (!(k in base.personal)) base.personal[k] = v;
      }
      base.niepelnosprawnosci = [...new Set([...base.niepelnosprawnosci, ...r.niepelnosprawnosci])];
      for (const k of Object.keys(base.sections)) if (r.sections[k]) base.sections[k] = [base.sections[k], r.sections[k]].filter(Boolean).join('\n');
      base.body = [base.body, r.body].filter(Boolean).join('\n\n');
    }
    base.stopien = stopienNI(base.niepelnosprawnosci);
    return base;
  }

  return { parse, merge, detectDisabilities, detectStage, DISABILITIES, stopienNI };
});
