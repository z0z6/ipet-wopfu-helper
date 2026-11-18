'use strict';
// Katalog dokumentów (IPET, WOPFU, oceny funkcjonalne, programy …), reguły „który dokument
// wynika z orzeczenia” oraz generator wersji wzorcowej działający bez internetu.
// Teksty zawierają znaczniki {{IMIE}}, {{UCZEN}} … – prawdziwe dane wstawiane są lokalnie.
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const dep = isNode ? { knowledge: require('./knowledge'), text: require('./text') } : root.IPET;
  const m = factory(dep.knowledge, dep.text);
  if (isNode) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { catalog: m });
})(typeof self !== 'undefined' ? self : this, function (K, T) {
  const has = (ctx, ...codes) => codes.some((c) => (ctx.codes || []).includes(c));
  const UZ = (ctx) => has(ctx, 'NI_UMIARKOWANY', 'NI_ZNACZNY', 'NI_GLEBOKI');
  const mentions = (ctx, re) => re.test(T.norm(ctx.anonText || ''));

  const METRYCZKA = 'Imię i nazwisko: {{UCZEN}}\nData urodzenia: {{DATA_URODZENIA}}\nKlasa: {{KLASA}}\nSzkoła: {{SZKOLA}}\nOrzeczenie o potrzebie kształcenia specjalnego nr {{NR_ORZECZENIA}} z dnia {{DATA_ORZECZENIA}}\nPoradnia, która wydała orzeczenie: {{PORADNIA}}\nOrzeczenie wydano na okres: {{OKRES}}\nRok szkolny: {{ROK_SZKOLNY}}';

  const TYPES = [
    {
      id: 'wopfu', title: 'Wielospecjalistyczna ocena poziomu funkcjonowania ucznia (WOPFU)', short: 'WOPFU', icon: 'chart', color: 'var(--indigo)', order: 1,
      when: () => ({ auto: true, reason: 'Obowiązkowa – podstawa do opracowania IPET; aktualizowana co najmniej 2 razy w roku szkolnym.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'potrzeby', title: '1. Indywidualne potrzeby rozwojowe i edukacyjne' },
        { key: 'mocne', title: '2. Mocne strony, predyspozycje, zainteresowania i uzdolnienia' },
        { key: 'przyczyny', title: '3. Przyczyny niepowodzeń edukacyjnych lub trudności w funkcjonowaniu, w tym bariery i ograniczenia utrudniające funkcjonowanie i uczestnictwo w życiu szkoły' },
        { key: 'obszary', title: '4. Poziom funkcjonowania w obszarach aktywności i uczestniczenia (ICF)' },
        { key: 'wsparcie', title: '5. Zakres i charakter wsparcia ze strony nauczycieli, specjalistów i pomocy nauczyciela' },
        { key: 'efekty', title: '6. Efekty dotychczasowych działań podejmowanych w celu poprawy funkcjonowania' },
        { key: 'wnioski', title: '7. Wnioski i zalecenia do IPET' },
        { key: 'podpisy', title: 'Zespół i podpisy', local: true }
      ]
    },
    {
      id: 'ipet', title: 'Indywidualny program edukacyjno-terapeutyczny (IPET)', short: 'IPET', icon: 'doc', color: 'var(--accent)', order: 2,
      when: () => ({ auto: true, reason: 'Obowiązkowy dla każdego ucznia z orzeczeniem o potrzebie kształcenia specjalnego.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'dostosowanie', title: '1. Zakres i sposób dostosowania wymagań edukacyjnych do indywidualnych potrzeb rozwojowych i edukacyjnych oraz możliwości psychofizycznych ucznia, w tym metody i formy pracy' },
        { key: 'zintegrowane', title: '2. Zintegrowane działania nauczycieli i specjalistów, w tym działania o charakterze rewalidacyjnym' },
        { key: 'cele', title: '3. Cele do osiągnięcia w okresie realizacji programu (w obszarach funkcjonowania)' },
        { key: 'formy', title: '4. Formy i okres udzielania pomocy psychologiczno-pedagogicznej oraz wymiar godzin' },
        { key: 'rodzice', title: '5. Działania wspierające rodziców ucznia oraz zakres współdziałania z poradniami i innymi instytucjami' },
        { key: 'zajecia', title: '6. Zajęcia rewalidacyjne oraz inne zajęcia odpowiednie ze względu na indywidualne potrzeby ucznia' },
        { key: 'warunki', title: '7. Rodzaj i sposób dostosowania warunków organizacji kształcenia, w tym technologie wspomagające' },
        { key: 'indywidualne', title: '8. Zajęcia edukacyjne realizowane indywidualnie lub w grupie do 5 uczniów' },
        { key: 'ewaluacja', title: '9. Sposób i terminy oceny efektywności programu' },
        { key: 'podpisy', title: 'Zespół, podpisy i potwierdzenie otrzymania kopii przez rodziców', local: true }
      ]
    },
    {
      id: 'ocena_icf', title: 'Szkolna ocena funkcjonalna – 9 obszarów ICF', short: 'Ocena ICF', icon: 'grid', color: 'var(--teal)', order: 3,
      when: () => ({ auto: true, reason: 'Nowa podstawa programowa (od 1.09.2026) opiera planowanie na 9 obszarach funkcjonowania ICF.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'zrodla', title: 'Źródła informacji i sposób oceny' },
        { key: 'obszary', title: 'Ocena w 9 obszarach: mocne strony, ograniczenia, poziom potrzebnego wsparcia' },
        { key: 'czynniki', title: 'Czynniki środowiskowe – ułatwiające i utrudniające' },
        { key: 'priorytety', title: 'Priorytety wsparcia na najbliższy okres' }
      ]
    },
    {
      id: 'ocena_ped', title: 'Ocena funkcjonalna – pedagog specjalny / wychowawca', short: 'Ocena pedagoga', icon: 'person', color: 'var(--green)', order: 4,
      when: () => ({ auto: true, reason: 'Wkład wychowawcy i pedagoga specjalnego do WOPFU.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'szkolne', title: 'Umiejętności szkolne i funkcjonowanie na zajęciach' },
        { key: 'samodzielnosc', title: 'Samodzielność i samoobsługa' },
        { key: 'spoleczne', title: 'Funkcjonowanie w grupie' },
        { key: 'zainteresowania', title: 'Zainteresowania i mocne strony' },
        { key: 'wnioski', title: 'Wnioski i zalecenia' }
      ]
    },
    {
      id: 'ocena_psych', title: 'Ocena funkcjonalna – psycholog', short: 'Ocena psychologa', icon: 'brain', color: 'var(--purple)', order: 5,
      when: () => ({ auto: true, reason: 'Wkład psychologa do WOPFU (funkcje poznawcze, emocje, zachowanie).' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'metody', title: 'Metody oceny (obserwacja, rozmowa, narzędzia)' },
        { key: 'poznawcze', title: 'Funkcjonowanie poznawcze' },
        { key: 'emocje', title: 'Funkcjonowanie emocjonalne i zachowanie' },
        { key: 'spoleczne', title: 'Funkcjonowanie społeczne' },
        { key: 'wnioski', title: 'Wnioski i zalecenia' }
      ]
    },
    {
      id: 'ocena_logo', title: 'Ocena funkcjonalna – logopeda', short: 'Ocena logopedy', icon: 'speech', color: 'var(--orange)', order: 6,
      when: (ctx) => (UZ(ctx) || has(ctx, 'AUTYZM', 'DOWN', 'AFAZJA', 'SPRZEZONE', 'SLABOSLYSZACY') || mentions(ctx, /mow|logoped|artykul|komunikac/)
        ? { auto: true, reason: 'Orzeczenie wskazuje na trudności w komunikacji lub mowie.' }
        : { auto: false, reason: 'Zalecana, jeśli występują trudności w mowie.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'rozumienie', title: 'Rozumienie mowy' },
        { key: 'ekspresja', title: 'Ekspresja słowna i pozawerbalna' },
        { key: 'prymarne', title: 'Funkcje prymarne, budowa i sprawność narządów artykulacyjnych' },
        { key: 'komunikacja', title: 'Komunikacja w codziennych sytuacjach (w tym AAC)' },
        { key: 'wnioski', title: 'Wnioski i zalecenia do terapii' }
      ]
    },
    {
      id: 'ocena_fizjo', title: 'Ocena funkcjonalna – fizjoterapeuta', short: 'Ocena fizjoterapeuty', icon: 'figure', color: 'var(--pink)', order: 7,
      when: (ctx) => (has(ctx, 'DOWN', 'RUCHOWA', 'NI_ZNACZNY', 'NI_GLEBOKI', 'SPRZEZONE', 'AFAZJA') || mentions(ctx, /motoryk|napiec|rehabilit|fizjoter|ruchow/)
        ? { auto: true, reason: 'Wskazania ruchowe (napięcie mięśniowe, motoryka, rehabilitacja).' }
        : { auto: false, reason: 'Opcjonalnie – przy trudnościach ruchowych.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'postawa', title: 'Postawa ciała i napięcie mięśniowe' },
        { key: 'duza', title: 'Motoryka duża: lokomocja, równowaga, koordynacja' },
        { key: 'mala', title: 'Motoryka mała i sprawność manualna' },
        { key: 'wnioski', title: 'Wnioski i zalecenia (w tym do ćwiczeń w domu)' }
      ]
    },
    {
      id: 'ocena_si', title: 'Profil sensoryczny – obserwacja integracji sensorycznej', short: 'Profil sensoryczny', icon: 'waves', color: 'var(--yellow)', order: 8,
      when: (ctx) => (has(ctx, 'AUTYZM', 'ASPERGER', 'SPRZEZONE') || mentions(ctx, /sensory|nadwrazliw|integracj\w* sensor|\bsi\b/)
        ? { auto: true, reason: 'W orzeczeniu są wskazania dotyczące przetwarzania sensorycznego.' }
        : { auto: false, reason: 'Opcjonalnie – przy nad- lub podwrażliwościach.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'zmysly', title: 'Reakcje na bodźce (dotyk, słuch, wzrok, węch/smak, przedsionek, propriocepcja)' },
        { key: 'regulacja', title: 'Regulacja pobudzenia i zachowania sensoryczne' },
        { key: 'dieta', title: 'Proponowana „dieta sensoryczna” i dostosowania w klasie' }
      ]
    },
    {
      id: 'program_rewal', title: 'Program zajęć rewalidacyjnych', short: 'Program rewalidacji', icon: 'target', color: 'var(--accent)', order: 9,
      when: () => ({ auto: true, reason: 'Zajęcia rewalidacyjne przysługują uczniom z orzeczeniem o potrzebie kształcenia specjalnego.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'cel', title: 'Cel ogólny' },
        { key: 'szczegolowe', title: 'Cele szczegółowe i treści' },
        { key: 'metody', title: 'Metody, formy i środki dydaktyczne' },
        { key: 'ewaluacja', title: 'Przewidywane osiągnięcia i sposób ewaluacji' }
      ]
    },
    {
      id: 'program_kes', title: 'Program zajęć rozwijających umiejętności społeczne i komunikacyjne (kompetencje emocjonalno-społeczne)', short: 'Program KES', icon: 'people', color: 'var(--green)', order: 10,
      when: (ctx) => (has(ctx, 'AUTYZM', 'ASPERGER')
        ? { auto: true, reason: 'U uczniów z autyzmem, w tym z zespołem Aspergera, IPET obejmuje zajęcia rozwijające umiejętności społeczne, w tym komunikacyjne.' }
        : mentions(ctx, /emocjonaln\w*-spoleczn|kompetencj\w* spoleczn|umiejetnosc\w* spoleczn/) ? { auto: true, reason: 'Zalecone w orzeczeniu.' } : { auto: false, reason: 'Opcjonalnie.' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'cel', title: 'Cel ogólny' },
        { key: 'szczegolowe', title: 'Cele szczegółowe (emocje, komunikacja, relacje, zasady)' },
        { key: 'tematy', title: 'Przykładowe tematy zajęć' },
        { key: 'metody', title: 'Metody i formy pracy' },
        { key: 'ewaluacja', title: 'Ewaluacja' }
      ]
    },
    {
      id: 'program_aac', title: 'Program rozwijania komunikacji (AAC)', short: 'Program AAC', icon: 'speech', color: 'var(--teal)', order: 11,
      when: (ctx) => (has(ctx, 'NI_UMIARKOWANY', 'NI_ZNACZNY', 'NI_GLEBOKI', 'AFAZJA') || (has(ctx, 'AUTYZM', 'DOWN', 'SPRZEZONE') && UZ(ctx)) || mentions(ctx, /\baac\b|piktogram|alternatywn|wspomagaj\w* (i alternatywn\w* )?komunik|makaton|pecs/)
        ? { auto: true, reason: 'Ograniczona komunikacja werbalna – wskazane metody AAC.' }
        : null),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'stan', title: 'Aktualny sposób porozumiewania się' },
        { key: 'system', title: 'Dobrany system AAC i słownictwo startowe' },
        { key: 'cele', title: 'Cele i sytuacje komunikacyjne' },
        { key: 'srodowisko', title: 'Wdrożenie w szkole i w domu' }
      ]
    },
    {
      id: 'zalecenia_dom', title: 'Wskazówki dla rodziców do pracy w domu', short: 'Wskazówki dla rodziców', icon: 'home', color: 'var(--orange)', order: 12,
      when: () => ({ auto: true, reason: 'Działania wspierające rodziców są elementem IPET.' }),
      sections: [
        { key: 'wstep', title: 'Wprowadzenie' },
        { key: 'codzienne', title: 'Ćwiczenia i aktywności na co dzień' },
        { key: 'zasady', title: 'Wspólne zasady dom–szkoła' },
        { key: 'wsparcie', title: 'Gdzie szukać wsparcia' }
      ]
    },
    {
      id: 'ocena_efekt', title: 'Ocena efektywności pomocy i modyfikacja IPET', short: 'Ocena efektywności', icon: 'check', color: 'var(--green)', order: 13,
      when: () => ({ auto: false, reason: 'Przygotuj na koniec okresu/roku szkolnego (co najmniej 2 razy w roku).' }),
      sections: [
        { key: 'metryczka', title: 'Dane ucznia', local: true },
        { key: 'realizacja', title: 'Stopień realizacji celów IPET' },
        { key: 'efekty', title: 'Efekty zajęć i form pomocy' },
        { key: 'modyfikacje', title: 'Wnioski i proponowane modyfikacje programu' }
      ]
    },
    {
      id: 'zawiadomienie', title: 'Zawiadomienie rodziców o posiedzeniu zespołu', short: 'Zawiadomienie', icon: 'mail', color: 'var(--text-3)', order: 14, noAi: true,
      when: () => ({ auto: true, reason: 'Rodzice muszą zostać zawiadomieni o terminie spotkania zespołu.' }),
      sections: [{ key: 'tresc', title: 'Treść zawiadomienia', local: true }]
    },
    {
      id: 'protokol', title: 'Protokół z posiedzenia zespołu', short: 'Protokół', icon: 'list', color: 'var(--text-3)', order: 15, noAi: true,
      when: () => ({ auto: true, reason: 'Dokumentuje opracowanie WOPFU i IPET.' }),
      sections: [{ key: 'tresc', title: 'Protokół', local: true }]
    }
  ];

  const byId = (id) => TYPES.find((t) => t.id === id);

  function proposals(ctx) {
    const out = [];
    for (const t of TYPES) {
      const w = t.when(ctx);
      if (w) out.push({ id: t.id, title: t.title, short: t.short, icon: t.icon, color: t.color, auto: !!w.auto, reason: w.reason });
    }
    return out;
  }

  // ───────── generator wersji wzorcowej (bez AI) ─────────
  function gram(plec) {
    return plec === 'K'
      ? { uczen: 'uczennica', ucznia: 'uczennicy', uczniowi: 'uczennicy', uczniem: 'uczennicą', jego: 'jej', Jego: 'Jej', jest: 'jest', potrafi: 'potrafi', sam: 'sama', zainteresowany: 'zainteresowana' }
      : { uczen: 'uczeń', ucznia: 'ucznia', uczniowi: 'uczniowi', uczniem: 'uczniem', jego: 'jego', Jego: 'Jego', jest: 'jest', potrafi: 'potrafi', sam: 'sam', zainteresowany: 'zainteresowany' };
  }
  const bl = (arr) => (arr || []).filter(Boolean).map((x) => '- ' + String(x).replace(/^[-•]\s*/, '')).join('\n');
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  function profileOf(ctx) {
    const p = ctx.profile || {};
    const codes = ctx.codes && ctx.codes.length ? ctx.codes : ['NI_LEKKI'];
    return {
      codes,
      mocne: p.mocneStrony && p.mocneStrony.length ? p.mocneStrony : K.union(codes, 'mocne', 6),
      trudnosci: p.trudnosci && p.trudnosci.length ? p.trudnosci : Object.values(K.trudnosciByArea(codes)).slice(0, 6),
      potrzeby: p.potrzeby && p.potrzeby.length ? p.potrzeby : null,
      obszary: p.obszary || {},
      zalecenia: p.zaleceniaPoradni && p.zaleceniaPoradni.length ? p.zaleceniaPoradni : null,
      nazwy: K.listFor(codes).map((c) => c.nazwa)
    };
  }

  function teamLines(ctx) {
    const team = (ctx.team || []).filter((m) => m && m.name);
    const rows = team.length ? team.map((m) => `| ${m.name} | ${m.role || ''} | |`) : ['| ……………………………… | wychowawca | |', '| ……………………………… | pedagog specjalny | |', '| ……………………………… | psycholog | |', '| ……………………………… | logopeda | |'];
    return ['| Imię i nazwisko | Funkcja | Podpis |', ...rows].join('\n');
  }

  function localSection(type, key, ctx) {
    if (key === 'metryczka') {
      const nazwy = profileOf(ctx).nazwy.join(', ');
      return METRYCZKA + (nazwy ? `\nRodzaj niepełnosprawności (wg orzeczenia): ${nazwy}` : '') + (ctx.etapLabel ? `\nEtap edukacyjny: ${ctx.etapLabel}` : '') + `\nData opracowania: {{DATA}}`;
    }
    if (key === 'podpisy') {
      const kopia = type === 'ipet' || type === 'wopfu' ? '\n\nPotwierdzam otrzymanie kopii dokumentu.\nData i podpis rodzica / opiekuna prawnego: ……………………………………' : '';
      return `Dokument opracował zespół nauczycieli i specjalistów prowadzących zajęcia z uczniem, we współpracy z rodzicami.\n\n${teamLines(ctx)}\n\nDyrektor szkoły: {{DYREKTOR}}${kopia}`;
    }
    if (type === 'zawiadomienie') {
      return `{{MIEJSCOWOSC}}, dnia {{DATA}}\n\nSzanowni Państwo\n{{RODZICE}}\n\nUprzejmie zawiadamiam, że posiedzenie zespołu nauczycieli i specjalistów prowadzących zajęcia z {{UCZEN}}, ${gram(ctx.plec).uczniem} klasy {{KLASA}}, odbędzie się w dniu …………………… o godz. ………… w sali nr ………… w {{SZKOLA}}.\n\nCelem spotkania jest dokonanie wielospecjalistycznej oceny poziomu funkcjonowania ${gram(ctx.plec).ucznia} oraz opracowanie (modyfikacja) indywidualnego programu edukacyjno-terapeutycznego.\n\nZapraszam Państwa do udziału w spotkaniu. Na Państwa wniosek w spotkaniu mogą uczestniczyć także: przedstawiciel poradni psychologiczno-pedagogicznej, lekarz, psycholog, pedagog, logopeda lub inny specjalista.\n\nZ poważaniem\n\n……………………………………\n(dyrektor szkoły)`;
    }
    if (type === 'protokol') {
      return `Protokół z posiedzenia zespołu nauczycieli i specjalistów\n\nData posiedzenia: ……………………\nUczeń: {{UCZEN}}, klasa {{KLASA}}\nPodstawa: orzeczenie nr {{NR_ORZECZENIA}} z dnia {{DATA_ORZECZENIA}} – {{PORADNIA}}\n\nObecni:\n${teamLines(ctx)}\n\nRodzice/opiekunowie prawni: obecni / nieobecni (zawiadomieni dnia …………)\n\nPorządek posiedzenia:\n- Analiza orzeczenia i dokumentacji ${gram(ctx.plec).ucznia}.\n- Wielospecjalistyczna ocena poziomu funkcjonowania ${gram(ctx.plec).ucznia}.\n- Opracowanie / modyfikacja IPET.\n- Ustalenie form, okresu i wymiaru godzin pomocy psychologiczno-pedagogicznej.\n- Sprawy różne.\n\nUstalenia:\n- Zespół dokonał WOPFU i opracował IPET na okres: {{OKRES}}.\n- Ustalono formy wsparcia zgodnie z IPET.\n- Termin kolejnej oceny: ……………………\n\nProtokołował(a): ……………………`;
    }
    return '';
  }

  function draftSection(type, key, ctx) {
    const P = profileOf(ctx);
    const g = gram(ctx.plec);
    const codes = P.codes;
    const areas = K.trudnosciByArea(codes);
    const cele = K.celeByArea(codes, 3);
    const icfText = (fmt) => K.ICF.map((a) => fmt(a)).join('\n');
    const uz = UZ(ctx);
    const zajUZ = K.LAW.zajeciaUZ.join(', ');

    switch (`${type}.${key}`) {
      // ── WOPFU ──
      case 'wopfu.potrzeby':
        return P.potrzeby ? bl(P.potrzeby) : bl([
          `stała struktura dnia, przewidywalność i jasne zasady`,
          `uczenie się przez działanie, z konkretem i wsparciem wizualnym`,
          K.union(codes, 'zajecia', 1)[0] && `udział w zajęciach: ${K.union(codes, 'zajecia', 3).join('; ')}`,
          uz ? 'rozwijanie komunikacji, w tym z użyciem metod wspomagających (AAC)' : 'rozwijanie umiejętności szkolnych w tempie dostosowanym do możliwości',
          'rozwijanie samodzielności i umiejętności społecznych',
          'współpraca szkoły z rodzicami i spójne oddziaływania dom–szkoła'
        ]);
      case 'wopfu.mocne': return bl(P.mocne);
      case 'wopfu.przyczyny':
        return `Trudności ${g.ucznia} wynikają przede wszystkim z: ${P.nazwy.join(', ') || 'rodzaju niepełnosprawności wskazanego w orzeczeniu'}.\n${bl(P.trudnosci)}\n\nBariery w środowisku szkolnym (do weryfikacji przez zespół):\n${bl(['nadmiar bodźców (hałas, zatłoczone przestrzenie)', 'polecenia słowne bez wsparcia wizualnego', 'nagłe zmiany planu dnia', 'ograniczony dostęp do pomocy dydaktycznych i technologii wspomagających'])}`;
      case 'wopfu.obszary':
      case 'ocena_icf.obszary':
        return icfText((a) => `## ${a.k.toUpperCase()}. ${a.nazwa}\n${P.obszary[a.k] || (areas[a.k] ? cap(areas[a.k]) + '.' : `Do uzupełnienia na podstawie obserwacji (${a.opis}).`)}${type === 'ocena_icf' ? '\nPoziom wsparcia: brak / niewielki / umiarkowany / znaczny / całkowity (zaznaczyć)' : ''}`);
      case 'wopfu.wsparcie':
        return bl([
          'nauczyciele: dostosowanie wymagań, metod i form pracy zgodnie z IPET; wsparcie wizualne i indywidualizacja',
          `specjaliści: ${K.union(codes, 'zajecia', 4).join('; ')}`,
          uz || has(ctx, 'SPRZEZONE', 'RUCHOWA') ? 'pomoc nauczyciela: wsparcie w samoobsłudze, przemieszczaniu się i udziale w zajęciach' : 'pomoc nauczyciela: w razie potrzeby, przy zadaniach wymagających indywidualnego wsparcia',
          'charakter wsparcia: stały, z systematycznym wycofywaniem podpowiedzi w miarę wzrostu samodzielności'
        ]);
      case 'wopfu.efekty':
        return 'Pierwsza ocena w okresie obowiązywania orzeczenia – efekty działań zostaną opisane podczas kolejnej WOPFU (nie rzadziej niż dwa razy w roku szkolnym).\nW przypadku kontynuacji: opisać, które cele zostały osiągnięte całkowicie, częściowo lub nie zostały osiągnięte, i z jakich powodów.';
      case 'wopfu.wnioski':
        return bl([
          `realizacja ${K.podstawaFor(codes, ctx.etap)}`,
          ...K.union(codes, 'zajecia', 4).map((z) => `zajęcia: ${z}`),
          ...K.union(codes, 'warunki', 3),
          ...(P.zalecenia || []).slice(0, 4)
        ]);

      // ── IPET ──
      case 'ipet.dostosowanie':
        return `Podstawa programowa: ${K.podstawaFor(codes, ctx.etap)}.${uz && ctx.etap !== 'SPdP' ? `\nZajęcia edukacyjne (ramowy plan nauczania od 1.09.2026): ${zajUZ}.` : ''}\n\nDostosowanie wymagań:\n${bl(K.union(codes, 'wymagania', 8))}\n\nMetody i formy pracy:\n${bl(K.union(codes, 'metody', 8))}`;
      case 'ipet.zintegrowane':
        return bl([
          'wszyscy nauczyciele i specjaliści stosują wspólne strategie: te same symbole/plany wizualne, ten sam system wzmocnień i sposób reagowania na zachowania trudne',
          'wychowawca koordynuje działania zespołu i kontakt z rodzicami',
          ...K.union(codes, 'zajecia', 4).map((z) => `działania rewalidacyjne: ${z}`),
          'specjaliści przekazują nauczycielom wskazówki do pracy na lekcjach (raz w miesiącu)',
          'zespół spotyka się co najmniej 2 razy w roku szkolnym (WOPFU, ocena efektywności)'
        ]);
      case 'ipet.cele':
        return K.ICF.filter((a) => cele[a.k]).map((a) => `## ${a.nazwa}\n${bl(cele[a.k].map((c) => `${cap(c)} (kryterium: 4 z 5 prób; termin: koniec I/II okresu)`))}`).join('\n') || 'Cele ustala zespół na podstawie WOPFU.';
      case 'ipet.formy': {
        const rows = [
          '| Forma pomocy / zajęć | Okres | Wymiar godzin | Prowadzący |',
          ...K.union(codes, 'zajecia', 5).map((z) => `| ${cap(z)} | {{ROK_SZKOLNY}} | …… godz./tydz. | …………… |`),
          '| Porady i konsultacje dla rodziców | {{ROK_SZKOLNY}} | wg potrzeb, min. 1 x w miesiącu | wychowawca, specjaliści |'
        ];
        return rows.join('\n') + '\n\nWymiar godzin zajęć rewalidacyjnych ustala dyrektor zgodnie z ramowym planem nauczania i arkuszem organizacji szkoły.';
      }
      case 'ipet.rodzice':
        return `Działania wspierające rodziców:\n${bl(K.union(codes, 'rodzice', 6))}\n\nWspółdziałanie z instytucjami:\n${bl(['poradnia psychologiczno-pedagogiczna – konsultacje, ponowna diagnoza przed upływem okresu orzeczenia', 'placówki ochrony zdrowia (lekarz prowadzący, rehabilitacja) – za zgodą rodziców', 'ośrodek pomocy społecznej / PCPR – w razie potrzeby wsparcia rodziny', 'organizacje pozarządowe działające na rzecz osób z niepełnosprawnością'])}`;
      case 'ipet.zajecia':
        return bl([...K.union(codes, 'zajecia', 8), has(ctx, 'AUTYZM', 'ASPERGER') ? 'zajęcia rozwijające umiejętności społeczne, w tym komunikacyjne (obowiązkowo w przypadku ucznia z autyzmem, w tym z zespołem Aspergera)' : null]);
      case 'ipet.warunki':
        return `${bl(K.union(codes, 'warunki', 8))}\n\nTechnologie wspomagające:\n${bl(K.union(codes, 'technologie', 6)) || '- w razie potrzeby'}`;
      case 'ipet.indywidualne':
        return `Na podstawie WOPFU zespół nie wskazuje / wskazuje (niepotrzebne skreślić) zajęcia edukacyjne realizowane indywidualnie z ${g.uczniem} lub w grupie do 5 uczniów: ……………………………\nUzasadnienie: ……………………………`;
      case 'ipet.ewaluacja':
        return bl(['ocena efektywności i modyfikacja IPET – co najmniej 2 razy w roku szkolnym, po okresowej WOPFU', 'narzędzia: obserwacja, arkusze osiągnięć, karty pracy, informacje od rodziców i specjalistów', 'kryteria: stopień osiągnięcia celów (osiągnięty / częściowo / nieosiągnięty) i samodzielność wykonania', ...K.LAW.terminy.slice(1, 2)]);

      // ── Ocena ICF ──
      case 'ocena_icf.zrodla':
        return bl(['obserwacja w naturalnych sytuacjach szkolnych (lekcje, przerwy, stołówka, wyjścia)', 'rozmowa z rodzicami i informacje od specjalistów', 'analiza orzeczenia i dokumentacji', `ocena z udziałem ${g.ucznia}, na miarę ${g.jego} możliwości`]);
      case 'ocena_icf.czynniki':
        return `Ułatwiające:\n${bl(['wsparcie rodziny', ...K.union(codes, 'warunki', 3), ...K.union(codes, 'technologie', 2)])}\n\nUtrudniające:\n${bl(['nadmiar bodźców i hałas', 'brak wsparcia wizualnego', 'nagłe zmiany i nieprzewidywalność'])}`;
      case 'ocena_icf.priorytety':
        return bl(K.ICF.filter((a) => cele[a.k]).slice(0, 4).map((a) => `${a.nazwa}: ${cele[a.k][0]}`));

      // ── oceny specjalistów ──
      case 'ocena_ped.szkolne': return areas.d1 ? cap(areas.d1) + '.' + (areas.d2 ? '\n' + cap(areas.d2) + '.' : '') : 'Do uzupełnienia na podstawie obserwacji na zajęciach.';
      case 'ocena_ped.samodzielnosc': return areas.d5 ? cap(areas.d5) + '.' : `${cap(g.uczen)} wymaga wsparcia w zakresie ustalonym podczas obserwacji (samoobsługa, organizacja miejsca pracy, przygotowanie do zajęć).`;
      case 'ocena_ped.spoleczne': return areas.d7 ? cap(areas.d7) + '.' : 'Do uzupełnienia na podstawie obserwacji w grupie.';
      case 'ocena_ped.zainteresowania': return bl(P.mocne);
      case 'ocena_ped.wnioski': case 'ocena_psych.wnioski':
        return bl([...K.union(codes, 'wymagania', 3), ...K.union(codes, 'zajecia', 2)]);
      case 'ocena_psych.metody': return bl(['obserwacja ' + g.ucznia + ' podczas zajęć i przerw', 'rozmowa z ' + g.uczniem + ' i rodzicami', 'analiza wytworów i dokumentacji', 'narzędzia przesiewowe dostosowane do możliwości (wpisać jakie)']);
      case 'ocena_psych.poznawcze': return areas.d1 ? cap(areas.d1) + '.' : 'Do uzupełnienia.';
      case 'ocena_psych.emocje': return areas.d2 ? cap(areas.d2) + '.' : 'Do uzupełnienia.';
      case 'ocena_psych.spoleczne': return areas.d7 ? cap(areas.d7) + '.' : 'Do uzupełnienia.';
      case 'ocena_logo.rozumienie': return 'Rozumienie poleceń: proste / złożone; rozumienie w kontekście sytuacyjnym; reakcja na imię. (uzupełnić)';
      case 'ocena_logo.ekspresja': return areas.d3 ? cap(areas.d3) + '.' : 'Do uzupełnienia.';
      case 'ocena_logo.prymarne': return 'Oddychanie (tor, sposób), połykanie, gryzienie, żucie; budowa i sprawność warg, języka, podniebienia. (uzupełnić)';
      case 'ocena_logo.komunikacja': return uz ? 'Sposoby komunikowania się: mowa, gesty, mimika, wskazywanie, piktogramy. Zalecane wprowadzenie/rozwijanie AAC.' : 'Komunikacja w sytuacjach codziennych – do uzupełnienia.';
      case 'ocena_logo.wnioski': return bl(['terapia logopedyczna ' + (uz ? 'z elementami AAC' : ''), ...K.union(codes, 'metody', 8).filter((m) => /AAC|Makaton|PECS|Krakowsk|mow/i.test(m)).slice(0, 3)]);
      case 'ocena_fizjo.postawa': return areas.d4 ? cap(areas.d4) + '.' : 'Do uzupełnienia.';
      case 'ocena_fizjo.duza': return 'Chód, bieg, skoki, równowaga statyczna i dynamiczna, koordynacja – opis na podstawie obserwacji. (uzupełnić)';
      case 'ocena_fizjo.mala': return 'Chwyt, precyzja, koordynacja wzrokowo-ruchowa, grafomotoryka. (uzupełnić)';
      case 'ocena_fizjo.wnioski': return bl(['zajęcia usprawniania ruchowego', 'ćwiczenia równoważne i koordynacyjne', 'ćwiczenia wzmacniające mięśnie posturalne', 'zalecenia do domu: codzienna aktywność ruchowa, prawidłowe pozycjonowanie przy stole']);
      case 'ocena_si.zmysly': return bl(['dotyk: ……', 'słuch: ' + (has(ctx, 'AUTYZM', 'ASPERGER') ? 'możliwa nadwrażliwość na hałas – obserwować' : '……'), 'wzrok: ……', 'węch/smak: ……', 'układ przedsionkowy (ruch, równowaga): ……', 'propriocepcja (czucie głębokie): ……']);
      case 'ocena_si.regulacja': return 'Poziom pobudzenia w ciągu dnia, sytuacje wywołujące przeciążenie, sposoby samoregulacji. (uzupełnić)';
      case 'ocena_si.dieta': return bl(['zaplanowane przerwy ruchowe co 20–30 minut', 'dostęp do słuchawek wygłuszających i kącika wyciszenia', 'aktywności proprioceptywne (noszenie, pchanie, ciężka kamizelka – jeśli zalecona)', 'ograniczenie bodźców wzrokowych w miejscu pracy']);

      // ── programy ──
      case 'program_rewal.cel': return `Wspomaganie wszechstronnego rozwoju ${g.ucznia}, usprawnianie zaburzonych funkcji oraz rozwijanie samodzielności i uczestnictwa w życiu szkoły i społeczności.`;
      case 'program_rewal.szczegolowe': case 'program_kes.szczegolowe':
        return K.ICF.filter((a) => cele[a.k] && (type !== 'program_kes' || ['d2', 'd3', 'd7', 'd9'].includes(a.k))).map((a) => `## ${a.nazwa}\n${bl(cele[a.k])}`).join('\n') || 'Do uzupełnienia.';
      case 'program_rewal.metody': case 'program_kes.metody': return bl(K.union(codes, 'metody', 8));
      case 'program_rewal.ewaluacja': case 'program_kes.ewaluacja': return bl(['obserwacja i arkusz postępów prowadzony co miesiąc', 'ocena osiągnięcia celów przy okresowej WOPFU', 'informacje zwrotne od rodziców']);
      case 'program_kes.cel': return `Rozwijanie umiejętności społecznych i komunikacyjnych ${g.ucznia}: rozpoznawania i wyrażania emocji, nawiązywania relacji, współpracy i radzenia sobie w sytuacjach społecznych.`;
      case 'program_kes.tematy': return bl(['Emocje – jak je rozpoznać u siebie i innych?', 'Proszę, dziękuję, przepraszam – zwroty grzecznościowe', 'Czekam na swoją kolej – gry planszowe w parach', 'Co zrobić, gdy się złoszczę? – mój plan spokoju', 'Rozmowa – pytam i słucham', 'Przerwa w szkole – jak się bawić razem', 'Proszę o pomoc', 'Zmiany w planie dnia – co wtedy robię?']);
      case 'program_aac.stan': return areas.d3 ? cap(areas.d3) + '.' : 'Opis aktualnych sposobów porozumiewania się (mowa, gesty, mimika, wskazywanie, symbole). (uzupełnić)';
      case 'program_aac.system': return bl(['system symboli (np. PCS/piktogramy, Makaton) dobrany do możliwości percepcyjnych', 'słownictwo startowe: chcę, jeszcze, koniec, pomóż, nie, tak, pić, jeść, toaleta, przerwa', 'tablica komunikacyjna przy stanowisku + książka komunikacyjna przenośna', 'komunikator z nagranym głosem – w razie potrzeby']);
      case 'program_aac.cele': return bl([...(cele.d3 || []), 'używa symboli w co najmniej 3 sytuacjach dnia (posiłek, zabawa, prośba o przerwę)']);
      case 'program_aac.srodowisko': return bl(['te same symbole w klasie, świetlicy, internacie i w domu', 'modelowanie: dorośli sami wskazują symbole podczas mówienia', 'szkolenie rodziców i personelu', 'aktualizacja słownika co miesiąc']);

      // ── rodzice ──
      case 'zalecenia_dom.wstep': return `Poniższe wskazówki przygotował zespół nauczycieli i specjalistów, aby wspólnie wspierać rozwój {{IMIE}}. Najlepsze efekty daje krótka, codzienna praca w miłej atmosferze i stosowanie tych samych zasad w domu i w szkole.`;
      case 'zalecenia_dom.codzienne': return bl([...Object.values(cele).flat().slice(0, 6).map((c) => `ćwiczymy w codziennych sytuacjach: ${c}`), 'chwalimy za wysiłek, nie tylko za efekt']);
      case 'zalecenia_dom.zasady': return bl(K.union(codes, 'rodzice', 4));
      case 'zalecenia_dom.wsparcie': return bl(['poradnia psychologiczno-pedagogiczna', 'powiatowe centrum pomocy rodzinie (PCPR) – dofinansowania PFRON, turnusy rehabilitacyjne', 'ośrodek pomocy społecznej – usługi opiekuńcze, opieka wytchnieniowa', 'organizacje pozarządowe i grupy wsparcia dla rodziców']);

      // ── ocena efektywności ──
      case 'ocena_efekt.realizacja': return '| Cel | Osiągnięty | Częściowo | Nieosiągnięty | Uwagi |\n' + Object.values(cele).flat().slice(0, 6).map((c) => `| ${cap(c)} | | | | |`).join('\n');
      case 'ocena_efekt.efekty': return bl(K.union(codes, 'zajecia', 5).map((z) => `${z}: ……`));
      case 'ocena_efekt.modyfikacje': return bl(['kontynuować cele częściowo osiągnięte, zmieniając metody/wsparcie', 'wprowadzić nowe cele w miejsce osiągniętych', 'zmiana wymiaru/form pomocy: ……']);
      default: return '';
    }
  }

  function offlineDocument(typeId, ctx) {
    const t = byId(typeId);
    if (!t) throw new Error('Nieznany typ dokumentu: ' + typeId);
    return {
      type: t.id,
      title: t.title,
      sections: t.sections.map((s) => ({ key: s.key, title: s.title, local: !!s.local, content: s.local ? localSection(t.id, s.key, ctx) : draftSection(t.id, s.key, ctx) }))
    };
  }

  return { TYPES, byId, proposals, offlineDocument, localSection, gram, METRYCZKA };
});
