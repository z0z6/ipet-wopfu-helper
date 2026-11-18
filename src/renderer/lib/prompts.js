'use strict';
// Zadania agenta AI: analiza orzeczenia, wyszukiwanie wiedzy specjalistycznej w internecie,
// tworzenie dokumentów i poprawianie sekcji. Do modelu trafia WYŁĄCZNIE tekst po pseudonimizacji.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const dep = isNode ? { knowledge: require('./knowledge'), catalog: require('./catalog'), orzeczenie: require('./orzeczenie') } : root.IPET;
  const m = factory(dep.knowledge, dep.catalog, dep.orzeczenie);
  if (isNode) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { prompts: m });
})(typeof self !== 'undefined' ? self : this, function (K, CAT, O) {
  const PRIVACY_RULES = `ZASADY OCHRONY DANYCH (bezwzględne):
- Tekst jest zanonimizowany. Znaczniki w podwójnych nawiasach klamrowych, np. {{IMIE}}, {{UCZEN}}, {{KLASA}}, oznaczają dane, które aplikacja wstawi lokalnie. Zachowuj je dokładnie w tej postaci.
- Nigdy nie wymyślaj imion, nazwisk, dat, adresów ani numerów. Gdy musisz odnieść się do ucznia, pisz „uczeń”/„uczennica” albo użyj {{IMIE}}.
- Nie próbuj ustalać tożsamości ucznia ani wyszukiwać w internecie czegokolwiek o konkretnej osobie. Wyszukuj wyłącznie wiedzę ogólną (przepisy, metody, programy).`;

  const ROLE = `Jesteś doświadczonym pedagogiem specjalnym (oligofrenopedagog, terapeuta), członkiem zespołu nauczycieli i specjalistów w Specjalnym Ośrodku Szkolno-Wychowawczym (SOSW) w Polsce. Znasz aktualne prawo oświatowe dotyczące kształcenia specjalnego, model biopsychospołeczny i klasyfikację ICF, podstawy programowe i metody pracy z uczniami z niepełnosprawnością intelektualną, autyzmem, zespołem Aspergera, zespołem Downa i niepełnosprawnościami sprzężonymi.
Piszesz po polsku, językiem urzędowym, ale konkretnym i życzliwym wobec ucznia. Unikasz ogólników – formułujesz obserwowalne, mierzalne cele (z kryterium i terminem) i praktyczne dostosowania. Opisujesz mocne strony, nie tylko deficyty. Nie stawiasz diagnoz medycznych wykraczających poza orzeczenie.

Aktualny stan prawny (zweryfikuj, jeśli masz dostęp do internetu):
- ${K.LAW.warunki} – IPET i WOPFU.
- ${K.LAW.ppp}.
- ${K.LAW.orzeczenia}.
- ${K.LAW.podstawaSP}.
- ${K.LAW.podstawaUZ}; zajęcia edukacyjne: ${K.LAW.zajeciaUZ.join(', ')}.
- ${K.LAW.podstawaSPdP}.
${K.LAW.terminy.map((t) => '- ' + t).join('\n')}

${PRIVACY_RULES}`;

  function profileBlock(ctx) {
    const names = (ctx.codes || []).map((c) => O.DISABILITIES[c] || c).join(', ') || 'nie rozpoznano automatycznie';
    return [
      `Rodzaj niepełnosprawności wg orzeczenia: ${names}`,
      ctx.plec ? `Płeć: ${ctx.plec === 'K' ? 'dziewczynka (pisz: uczennica)' : 'chłopiec (pisz: uczeń)'}` : null,
      ctx.wiek != null ? `Wiek: ${ctx.wiek} lat` : null,
      ctx.etapLabel ? `Etap edukacyjny: ${ctx.etapLabel}` : null,
      ctx.klasa ? `Klasa: ${ctx.klasa}` : null
    ].filter(Boolean).join('\n');
  }

  function analysisBlock(ctx) {
    const p = ctx.profile;
    if (!p) return '';
    return `\nWyniki wcześniejszej analizy orzeczenia:\n${JSON.stringify({ podsumowanie: p.podsumowanie, mocneStrony: p.mocneStrony, trudnosci: p.trudnosci, potrzeby: p.potrzeby, obszary: p.obszary, zaleceniaPoradni: p.zaleceniaPoradni, komunikacja: p.komunikacja }, null, 1)}`;
  }

  function researchBlock(ctx) {
    const r = ctx.research;
    if (!r || !(r.wskazowki || []).length) return '';
    return `\nAktualna wiedza specjalistyczna zebrana z internetu (wykorzystaj, jeśli pasuje):\n${(r.wskazowki || []).slice(0, 12).map((w) => '- ' + w).join('\n')}${(r.przepisy || []).length ? '\nPrzepisy:\n' + r.przepisy.slice(0, 6).map((x) => `- ${x.akt}: ${x.co}`).join('\n') : ''}`;
  }

  // ── 1. analiza orzeczenia ──
  function analyze(ctx) {
    return {
      task: 'analyze',
      system: ROLE,
      webSearch: false,
      prompt: `Przeanalizuj zanonimizowaną treść orzeczenia o potrzebie kształcenia specjalnego (tekst z OCR – mogą być błędy odczytu; popraw je w myślach).

${profileBlock(ctx)}

TREŚĆ ORZECZENIA (diagnoza, zalecenia, uzasadnienie):
"""
${ctx.anonText}
"""

Zwróć wyłącznie JSON w bloku \`\`\`json:
{
  "niepelnosprawnosci": ["kody z listy: ${Object.keys(O.DISABILITIES).join(', ')}"],
  "podsumowanie": "3–5 zdań: kim jest uczeń jako osoba uczącą się, co mu pomaga, co utrudnia",
  "mocneStrony": ["…"],
  "trudnosci": ["…"],
  "potrzeby": ["indywidualne potrzeby rozwojowe i edukacyjne"],
  "obszary": { "d1": "opis funkcjonowania w obszarze: Uczenie się i stosowanie wiedzy", "d2": "Ogólne zadania i wymagania", "d3": "Porozumiewanie się", "d4": "Poruszanie się i aktywność manualna", "d5": "Dbanie o siebie", "d6": "Życie domowe", "d7": "Interakcje i relacje", "d8": "Główne dziedziny życia (edukacja)", "d9": "Życie społeczne" },
  "zaleceniaPoradni": ["każde zalecenie z orzeczenia osobno, zwięźle"],
  "komunikacja": "werbalna | ograniczona | niewerbalna/AAC",
  "dokumenty": [{ "typ": "id dokumentu z listy: ${CAT.TYPES.map((t) => t.id).join(', ')}", "powod": "dlaczego jest potrzebny" }],
  "uwagi": ["niejasności, braki w orzeczeniu, rzeczy do sprawdzenia przez zespół"]
}
W obszarach, o których orzeczenie nic nie mówi, napisz „brak informacji w orzeczeniu – do obserwacji”.`
    };
  }

  function normalizeAnalysis(j) {
    const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
    const codes = arr(j.niepelnosprawnosci).map((c) => c.toUpperCase()).filter((c) => O.DISABILITIES[c]);
    const obszary = {};
    for (const a of K.ICF) if (j.obszary && j.obszary[a.k]) obszary[a.k] = String(j.obszary[a.k]).trim();
    return {
      niepelnosprawnosci: codes,
      podsumowanie: String(j.podsumowanie || '').trim(),
      mocneStrony: arr(j.mocneStrony).slice(0, 12),
      trudnosci: arr(j.trudnosci).slice(0, 12),
      potrzeby: arr(j.potrzeby).slice(0, 12),
      obszary,
      zaleceniaPoradni: arr(j.zaleceniaPoradni).slice(0, 20),
      komunikacja: String(j.komunikacja || '').trim(),
      dokumenty: (Array.isArray(j.dokumenty) ? j.dokumenty : []).filter((d) => d && CAT.byId(d.typ)).map((d) => ({ typ: d.typ, powod: String(d.powod || '') })),
      uwagi: arr(j.uwagi).slice(0, 10)
    };
  }

  // ── 2. wiedza specjalistyczna z internetu ──
  function research(ctx) {
    const names = (ctx.codes || []).map((c) => O.DISABILITIES[c] || c).join(', ');
    return {
      task: 'research',
      system: ROLE,
      webSearch: true,
      prompt: `Wyszukaj w internecie aktualną (2025–2026) wiedzę specjalistyczną potrzebną zespołowi SOSW do przygotowania IPET, WOPFU i ocen funkcjonalnych dla ucznia o profilu:
${profileBlock(ctx)}

Sprawdź w szczególności:
1. Aktualne przepisy dotyczące IPET, WOPFU i zajęć rewalidacyjnych (czy były zmiany w 2025–2026, nowe podstawy programowe, ramowe plany nauczania, nowe wzory orzeczeń) – preferuj źródła: isap.sejm.gov.pl, gov.pl/edukacja, ore.edu.pl, ibe.edu.pl, kuratoria oświaty.
2. Rekomendowane metody i programy pracy (oparte na dowodach) dla: ${names || 'ucznia z niepełnosprawnością intelektualną'}.
3. Praktyczne przykłady dostosowań i celów w obszarach ICF dla takiego ucznia na tym etapie edukacyjnym.

Wyszukuj tylko wiedzę ogólną – nie wpisuj do wyszukiwarki żadnych znaczników ani danych ucznia.

Zwróć wyłącznie JSON w bloku \`\`\`json:
{
  "przepisy": [{ "akt": "nazwa aktu, Dz.U.", "co": "co z niego wynika dla IPET/WOPFU" }],
  "metody": [{ "nazwa": "…", "opis": "jak stosować u tego ucznia" }],
  "wskazowki": ["konkretna wskazówka do dokumentów"],
  "zrodla": [{ "tytul": "…", "url": "https://…", "wniosek": "jedno zdanie" }]
}`
    };
  }

  function normalizeResearch(j) {
    const arr = (v) => (Array.isArray(v) ? v : []);
    return {
      przepisy: arr(j.przepisy).filter((x) => x && x.akt).map((x) => ({ akt: String(x.akt), co: String(x.co || '') })).slice(0, 10),
      metody: arr(j.metody).filter((x) => x && x.nazwa).map((x) => ({ nazwa: String(x.nazwa), opis: String(x.opis || '') })).slice(0, 12),
      wskazowki: arr(j.wskazowki).map(String).filter(Boolean).slice(0, 20),
      zrodla: arr(j.zrodla).filter((x) => x && /^https?:\/\//.test(x.url || '')).map((x) => ({ tytul: String(x.tytul || x.url), url: String(x.url), wniosek: String(x.wniosek || '') })).slice(0, 15),
      at: new Date().toISOString()
    };
  }

  // ── 3. dokument ──
  function generate(typeId, ctx) {
    const t = CAT.byId(typeId);
    const draft = CAT.offlineDocument(typeId, ctx);
    const aiSections = t.sections.filter((s) => !s.local);
    return {
      task: 'generate',
      system: ROLE,
      webSearch: false,
      prompt: `Opracuj dokument „${t.title}” dla ucznia SOSW. To ma być przykładowy, dobrze opracowany dokument, który zespół zweryfikuje i uzupełni obserwacjami.

${profileBlock(ctx)}
${analysisBlock(ctx)}
${researchBlock(ctx)}

Zanonimizowana treść orzeczenia:
"""
${(ctx.anonText || '').slice(0, 9000)}
"""

Wersja robocza z bazy wiedzy aplikacji (możesz z niej korzystać, ale napisz lepiej, konkretniej i indywidualnie, zgodnie z orzeczeniem):
${aiSections.map((s) => `### ${s.title}\n${draft.sections.find((d) => d.key === s.key).content}`).join('\n\n')}

Wymagania:
- Uzupełnij każdą z sekcji: ${aiSections.map((s) => `"${s.key}" (${s.title})`).join('; ')}.
- Opieraj się na treści orzeczenia (zalecenia poradni muszą znaleźć odzwierciedlenie w dokumencie).
- Cele formułuj operacyjnie: kto, co robi, w jakich warunkach, kryterium, termin.
- Format treści: zwykły tekst; podtytuły zaczynaj od "## ", wypunktowania od "- ", tabelę zapisuj wierszami "| kol1 | kol2 |" (pierwszy wiersz to nagłówek).
- Miejsca, których nie da się ustalić z orzeczenia (np. wyniki obserwacji, wymiar godzin z arkusza), oznacz „……” do uzupełnienia przez zespół.
- Nie używaj imienia ani danych osobowych – tylko znaczników {{IMIE}}, {{UCZEN}}, {{KLASA}}, {{ROK_SZKOLNY}}.

Zwróć wyłącznie JSON w bloku \`\`\`json:
{ "sekcje": [ { "klucz": "${aiSections[0] ? aiSections[0].key : 'tresc'}", "tresc": "…" } ] }`
    };
  }

  function normalizeDocument(typeId, j, ctx) {
    const t = CAT.byId(typeId);
    const draft = CAT.offlineDocument(typeId, ctx);
    const list = Array.isArray(j.sekcje) ? j.sekcje : Array.isArray(j.sections) ? j.sections : [];
    const map = {};
    for (const s of list) if (s && (s.klucz || s.key)) map[s.klucz || s.key] = String(s.tresc || s.content || '').trim();
    let filled = 0;
    const sections = t.sections.map((s) => {
      if (s.local) return draft.sections.find((d) => d.key === s.key);
      const c = map[s.key];
      if (c && c.length > 10) filled++;
      return { key: s.key, title: s.title, local: false, content: c && c.length > 10 ? c : draft.sections.find((d) => d.key === s.key).content };
    });
    if (!filled) throw new Error('Model nie zwrócił treści dokumentu.');
    return { type: t.id, title: t.title, sections };
  }

  // ── 4. poprawa sekcji ──
  function refine(typeId, sectionTitle, anonContent, instruction, ctx) {
    return {
      task: 'refine',
      system: ROLE,
      webSearch: !!ctx.webSearch,
      prompt: `Popraw sekcję „${sectionTitle}” dokumentu „${(CAT.byId(typeId) || {}).title}”.
${profileBlock(ctx)}
${analysisBlock(ctx)}

Obecna treść (zanonimizowana):
"""
${anonContent}
"""

Polecenie: ${instruction}

Zachowaj format (## podtytuły, - punkty, | tabele |) i znaczniki {{…}}. Zwróć wyłącznie JSON w bloku \`\`\`json: { "tresc": "…" }`
    };
  }

  function extractJson(text) {
    if (!text) throw new Error('Pusta odpowiedź modelu.');
    const blocks = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
    for (const t of [...blocks.reverse(), text]) {
      try { return JSON.parse(t.trim()); } catch (_) { /* dalej */ }
      const s = Math.min(...[t.indexOf('{'), t.indexOf('[')].filter((x) => x >= 0));
      if (!isFinite(s)) continue;
      const e = t.lastIndexOf(t[s] === '{' ? '}' : ']');
      if (e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch (_) { /* dalej */ } }
    }
    throw new Error('Nie udało się odczytać odpowiedzi modelu jako JSON.');
  }

  return { ROLE, analyze, normalizeAnalysis, research, normalizeResearch, generate, normalizeDocument, refine, extractJson };
});
