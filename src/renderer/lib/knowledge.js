'use strict';
// Wbudowana baza wiedzy specjalistycznej (pedagogika specjalna) – podstawa dokumentów
// tworzonych bez internetu i punkt wyjścia dla agenta AI. Stan prawny: listopad 2026.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.IPET = Object.assign(root.IPET || {}, { knowledge: m });
})(typeof self !== 'undefined' ? self : this, function () {
  // 9 obszarów aktywności i uczestniczenia (ICF) – podstawa Szkolnej Oceny Funkcjonalnej
  const ICF = [
    { k: 'd1', nazwa: 'Uczenie się i stosowanie wiedzy', opis: 'uwaga, naśladowanie, myślenie, czytanie, pisanie, liczenie, rozwiązywanie problemów' },
    { k: 'd2', nazwa: 'Ogólne zadania i wymagania', opis: 'podejmowanie i kończenie zadań, rutyna dnia, radzenie sobie ze zmianą i stresem' },
    { k: 'd3', nazwa: 'Porozumiewanie się', opis: 'rozumienie i nadawanie komunikatów werbalnych i niewerbalnych, rozmowa, AAC' },
    { k: 'd4', nazwa: 'Poruszanie się i aktywność manualna', opis: 'zmiana pozycji, chodzenie, motoryka mała, koordynacja wzrokowo-ruchowa' },
    { k: 'd5', nazwa: 'Dbanie o siebie (samoobsługa)', opis: 'higiena, ubieranie się, jedzenie i picie, korzystanie z toalety, dbanie o zdrowie i bezpieczeństwo' },
    { k: 'd6', nazwa: 'Życie domowe', opis: 'proste prace porządkowe, przygotowanie posiłku, dbanie o swoje rzeczy' },
    { k: 'd7', nazwa: 'Interakcje i relacje międzyludzkie', opis: 'nawiązywanie kontaktu, przestrzeganie zasad, relacje z rówieśnikami i dorosłymi' },
    { k: 'd8', nazwa: 'Główne dziedziny życia (edukacja, praca)', opis: 'udział w zajęciach szkolnych, przygotowanie do pracy, posługiwanie się pieniędzmi' },
    { k: 'd9', nazwa: 'Życie społeczne i w społeczności', opis: 'rekreacja, czas wolny, udział w wydarzeniach, zachowanie w miejscach publicznych' }
  ];

  const LAW = {
    warunki: 'rozporządzenie Ministra Edukacji Narodowej z dnia 9 sierpnia 2017 r. w sprawie warunków organizowania kształcenia, wychowania i opieki dla dzieci i młodzieży niepełnosprawnych, niedostosowanych społecznie i zagrożonych niedostosowaniem społecznym (z późn. zm.)',
    ppp: 'rozporządzenie Ministra Edukacji Narodowej z dnia 9 sierpnia 2017 r. w sprawie zasad organizacji i udzielania pomocy psychologiczno-pedagogicznej w publicznych przedszkolach, szkołach i placówkach (z późn. zm.)',
    orzeczenia: 'rozporządzenie w sprawie orzeczeń i opinii wydawanych przez zespoły orzekające w publicznych poradniach psychologiczno-pedagogicznych (nowe przepisy obowiązują od 13 kwietnia 2026 r.; dotychczasowe orzeczenia zachowują ważność)',
    podstawaSP: 'podstawa programowa kształcenia ogólnego dla szkoły podstawowej (rozporządzenie z 11 marca 2026 r., Dz.U. z 2026 r. poz. 378 – wprowadzana od 1 września 2026 r. stopniowo, od klas I i IV)',
    podstawaUZ: 'podstawa programowa kształcenia ogólnego dla szkoły podstawowej dla uczniów z niepełnosprawnością intelektualną w stopniu umiarkowanym lub znacznym (załącznik nr 3 do rozporządzenia z 11 marca 2026 r., Dz.U. z 2026 r. poz. 378 – obowiązuje od 1 września 2026 r. we wszystkich klasach)',
    podstawaSPdP: 'podstawa programowa kształcenia ogólnego dla szkoły specjalnej przysposabiającej do pracy (rozporządzenie z 14 lipca 2026 r., Dz.U. z 2026 r. poz. 1012)',
    zajeciaUZ: ['porozumiewanie się', 'edukacja środowiskowa', 'edukacja społeczna', 'edukacja osobista i zdrowotna', 'edukacja artystyczna', 'wychowanie fizyczne'],
    terminy: [
      'IPET opracowuje zespół nauczycieli i specjalistów prowadzących zajęcia z uczniem po dokonaniu wielospecjalistycznej oceny poziomu funkcjonowania ucznia (WOPFU), we współpracy z rodzicami.',
      'IPET opracowuje się na okres, na jaki zostało wydane orzeczenie – w terminie do 30 września roku szkolnego, w którym uczeń rozpoczyna naukę w szkole, albo w ciągu 30 dni od dnia złożenia orzeczenia w szkole.',
      'Zespół co najmniej dwa razy w roku szkolnym dokonuje okresowej WOPFU, w miarę potrzeb modyfikuje IPET i ocenia efektywność udzielanej pomocy.',
      'Rodzice są zawiadamiani o terminie spotkania zespołu i mogą w nim uczestniczyć; otrzymują kopię WOPFU i IPET.'
    ]
  };

  const C = {};

  C.NI_LEKKI = {
    nazwa: 'niepełnosprawność intelektualna w stopniu lekkim',
    podstawa: 'podstawaSP',
    opis: 'Uczeń uczy się wolniej, potrzebuje konkretu, poglądowości i wielokrotnego utrwalania. Myślenie przeważnie konkretno-obrazowe, trudności z abstrakcją, uogólnianiem i przenoszeniem umiejętności na nowe sytuacje.',
    mocne: ['dobra motywacja przy zadaniach praktycznych i konkretnych', 'chęć współpracy z dorosłym i rówieśnikami', 'umiejętności samoobsługowe na dobrym poziomie', 'reagowanie na pochwałę i wzmocnienia', 'zainteresowania praktyczne (technika, plastyka, sport, muzyka)'],
    trudnosci: {
      d1: 'wolniejsze tempo uczenia się, trudności z myśleniem abstrakcyjnym, uogólnianiem, rozumieniem treści czytanych i zadań tekstowych',
      d2: 'krótszy czas koncentracji, potrzeba dzielenia zadań na etapy i przypominania o kolejnych krokach',
      d3: 'uboższy zasób słownictwa, trudność w budowaniu dłuższych wypowiedzi i rozumieniu poleceń złożonych',
      d7: 'naiwność społeczna, trudność w odczytywaniu intencji innych, podatność na wpływ rówieśników',
      d8: 'trudności z posługiwaniem się pieniędzmi, zegarem, planowaniem'
    },
    metody: ['metoda ośrodków pracy (M. Grzegorzewska)', 'nauczanie polisensoryczne, poglądowe – z konkretem i pomocami', 'metody aktywizujące i praktyczne działanie (uczenie przez doświadczenie)', 'metoda Dobrego Startu (M. Bogdanowicz)', 'Dziecięca matematyka (E. Gruszczyk-Kolczyńska)', 'trening umiejętności społecznych (TUS)', 'tutoring i ocenianie kształtujące z jasnymi kryteriami sukcesu'],
    wymagania: ['wymagania z podstawy programowej obniżone do poziomu podstawowego/koniecznego – zakres treści ograniczony do najistotniejszych dla funkcjonowania', 'polecenia krótkie, jednoetapowe, upewnianie się, że uczeń zrozumiał (powtórzenie własnymi słowami)', 'więcej czasu na wykonanie zadań i sprawdzianów; mniejsza liczba zadań', 'teksty uproszczone, z ilustracjami, większa czcionka; tekst łatwy do czytania (ETR)', 'ocenianie z uwzględnieniem wysiłku i postępów, nie tylko efektu; częste informacje zwrotne', 'zapowiadane, krótsze sprawdziany; możliwość odpowiedzi ustnej zamiast pisemnej'],
    warunki: ['miejsce w pierwszych ławkach, blisko nauczyciela, z ograniczeniem bodźców rozpraszających', 'stały rytm dnia i czytelny plan lekcji', 'pomoce dydaktyczne konkretne (liczmany, modele, karty pracy)', 'praca w małych grupach'],
    zajecia: ['zajęcia rewalidacyjne usprawniające funkcje poznawcze (uwaga, pamięć, myślenie przyczynowo-skutkowe)', 'zajęcia korekcyjno-kompensacyjne (techniki szkolne: czytanie, pisanie, liczenie)', 'zajęcia logopedyczne – w razie potrzeby', 'zajęcia rozwijające kompetencje emocjonalno-społeczne', 'zajęcia związane z wyborem kierunku kształcenia i zawodu (klasy VII–VIII)'],
    cele: {
      d1: ['czyta ze zrozumieniem krótki tekst (3–5 zdań) i odpowiada na 3 pytania do tekstu', 'rozwiązuje proste zadania tekstowe z użyciem konkretów w zakresie dodawania i odejmowania do 100', 'utrzymuje uwagę na zadaniu przez 15 minut z jednym przypomnieniem'],
      d2: ['samodzielnie przygotowuje się do lekcji według listy kontrolnej', 'kończy rozpoczęte zadanie, korzystając z planu krok po kroku'],
      d3: ['wypowiada się pełnymi zdaniami na znany temat (3–4 zdania)', 'pyta o pomoc, gdy nie rozumie polecenia'],
      d7: ['rozpoznaje i nazywa podstawowe emocje u siebie i innych', 'stosuje ustalone sposoby rozwiązywania konfliktu z rówieśnikiem (z pomocą dorosłego)'],
      d8: ['odczytuje pełne godziny na zegarze i planuje swój dzień z pomocą planu', 'płaci za drobne zakupy i sprawdza resztę z kalkulatorem']
    },
    rodzice: ['konsultacje z wychowawcą i specjalistami co najmniej raz w miesiącu', 'wskazówki do utrwalania umiejętności szkolnych w domu (krótkie, codzienne ćwiczenia)', 'wspólne ustalenie systemu motywacyjnego dom–szkoła', 'informacja o formach wsparcia (poradnia, orzeczenie o niepełnosprawności, świadczenia)'],
    technologie: ['programy multimedialne do ćwiczeń czytania i liczenia', 'tablica interaktywna, aplikacje do utrwalania wiadomości', 'audiobooki i teksty łatwe do czytania (ETR)']
  };

  C.NI_UMIARKOWANY = {
    nazwa: 'niepełnosprawność intelektualna w stopniu umiarkowanym',
    podstawa: 'podstawaUZ',
    opis: 'Uczeń najlepiej uczy się przez działanie w realnych sytuacjach. Potrzebuje stałej struktury, modelowania, podpowiedzi i wielokrotnych powtórzeń. Rozwój komunikacji bywa ograniczony – często potrzebna jest komunikacja wspomagająca (AAC).',
    mocne: ['pozytywny kontakt emocjonalny z bliskimi dorosłymi', 'chęć uczestniczenia w zajęciach ruchowych, muzycznych i plastycznych', 'naśladowanie czynności wykonywanych przez dorosłego', 'dobra pamięć rutyn i miejsc', 'radość z pochwały i sukcesu'],
    trudnosci: {
      d1: 'myślenie konkretne, trudności z przyswajaniem pojęć liczbowych i symboli; potrzeba wielu powtórzeń',
      d2: 'potrzeba stałej struktury i podpowiedzi przy przechodzeniu między czynnościami; trudność z tolerowaniem zmian',
      d3: 'ograniczony zasób słów, mowa prosta lub jej brak; trudności w rozumieniu dłuższych poleceń',
      d4: 'obniżona precyzja ruchów, trudności grafomotoryczne',
      d5: 'częściowa samodzielność w samoobsłudze – wymaga przypomnień i asysty',
      d7: 'trudności w nawiązywaniu i podtrzymywaniu relacji z rówieśnikami',
      d9: 'potrzeba wsparcia w bezpiecznym poruszaniu się poza szkołą'
    },
    metody: ['metoda ośrodków pracy', 'trening umiejętności życiowych (dnia codziennego) w realnych sytuacjach', 'Ruch Rozwijający W. Sherborne', 'metoda Dobrego Startu', 'komunikacja wspomagająca i alternatywna (AAC): gesty, piktogramy, PCS, Makaton, komunikatory', 'Metoda Krakowska (wspomaganie rozwoju mowy i myślenia)', 'globalne czytanie (G. Doman, I. Majchrzak – odimienna nauka czytania)', 'plany aktywności i harmonogramy obrazkowe', 'elementy stosowanej analizy zachowania (ABA): podpowiedzi, wzmocnienia, łańcuchowanie'],
    wymagania: ['realizacja zajęć edukacyjnych z podstawy programowej dla uczniów z NI w stopniu umiarkowanym lub znacznym – cele dobrane funkcjonalnie, z myślą o samodzielności w życiu', 'treści przekazywane w formie konkretnej, w realnych sytuacjach (sklep, kuchnia, przystanek)', 'polecenia jednoetapowe, wsparte gestem i symbolem', 'ocenianie opisowe uwzględniające postęp w stosunku do możliwości ucznia', 'stopniowe wycofywanie podpowiedzi (fizyczna → gestem → słowna → samodzielnie)'],
    warunki: ['stały plan dnia w formie obrazkowej', 'oznaczenie pomieszczeń i przedmiotów symbolami', 'kącik wyciszenia w sali', 'pomoc nauczyciela lub asystenta w czynnościach wymagających wsparcia', 'krótkie jednostki pracy przeplatane ruchem'],
    zajecia: ['zajęcia rewalidacyjne rozwijające komunikację, w tym AAC', 'zajęcia usprawniające motorykę małą i dużą', 'zajęcia logopedyczne', 'zajęcia rozwijające umiejętności społeczne', 'zajęcia stymulujące rozwój poznawczy i percepcję'],
    cele: {
      d1: ['dobiera przedmioty według koloru, kształtu i przeznaczenia', 'rozpoznaje i odczytuje globalnie swoje imię i 10 wyrazów z najbliższego otoczenia', 'przelicza przedmioty w zakresie 5'],
      d2: ['wykonuje sekwencję 3 czynności według planu obrazkowego', 'przechodzi między aktywnościami po sygnale (dźwięk, obrazek) bez sprzeciwu'],
      d3: ['sygnalizuje potrzeby (picie, toaleta, pomoc, przerwa) słowem, gestem lub piktogramem', 'rozumie i wykonuje 10 prostych poleceń jednoetapowych'],
      d4: ['nawleka koraliki i przewleka sznurek', 'odwzorowuje proste szlaczki po śladzie'],
      d5: ['samodzielnie myje i wyciera ręce we właściwej kolejności', 'zapina zamek błyskawiczny i zakłada obuwie na rzepy'],
      d6: ['sprząta swoje miejsce pracy po zajęciach', 'przygotowuje prostą kanapkę z pomocą planu'],
      d7: ['wita się i żegna z osobami w klasie', 'czeka na swoją kolej w prostej grze z 1–2 rówieśnikami'],
      d9: ['zachowuje się bezpiecznie na przejściu dla pieszych z dorosłym', 'dokonuje prostego zakupu w sklepiku szkolnym']
    },
    rodzice: ['wspólne ustalenie celów priorytetowych na dany okres (samoobsługa, komunikacja)', 'przekazanie rodzicom systemu AAC używanego w szkole (te same symbole w domu)', 'instruktaż i zeszyt korespondencji dom–szkoła', 'informacja o wsparciu: orzeczenie o niepełnosprawności, świadczenia, turnusy rehabilitacyjne, opieka wytchnieniowa'],
    technologie: ['tablice komunikacyjne, książka komunikacyjna, komunikatory z nagranym głosem', 'aplikacje AAC na tablet', 'pomoce sensoryczne i dydaktyczne do manipulacji']
  };

  C.NI_ZNACZNY = {
    nazwa: 'niepełnosprawność intelektualna w stopniu znacznym',
    podstawa: 'podstawaUZ',
    opis: 'Uczeń potrzebuje wsparcia w większości czynności dnia codziennego. Najważniejsze jest rozwijanie komunikacji (najczęściej alternatywnej), samoobsługi, orientacji w najbliższym otoczeniu i aktywnego uczestnictwa w zajęciach.',
    mocne: ['reagowanie na znane osoby, głos i dotyk', 'wyraźne preferencje (ulubione zabawki, muzyka, aktywności) – można je wykorzystać jako wzmocnienia', 'uczestnictwo w zajęciach ruchowych i muzycznych', 'zdolność uczenia się rutyn przy stałej strukturze'],
    trudnosci: {
      d1: 'bardzo ograniczona zdolność przyswajania pojęć; uczenie się wymaga licznych powtórzeń w stałych warunkach',
      d2: 'pełna zależność od struktury i podpowiedzi dorosłego',
      d3: 'mowa nieobecna lub pojedyncze słowa; komunikacja głównie pozawerbalna',
      d4: 'trudności motoryczne, często obniżone napięcie mięśniowe i słaba koordynacja',
      d5: 'znaczne ograniczenia samodzielności w jedzeniu, ubieraniu się, higienie',
      d7: 'kontakt głównie z bliskimi dorosłymi; ograniczone inicjowanie interakcji'
    },
    metody: ['komunikacja alternatywna (AAC): przedmioty, zdjęcia, piktogramy, komunikatory jednoprzyciskowe', 'Ruch Rozwijający W. Sherborne', 'Programy Aktywności „Świadomość ciała, kontakt i komunikacja” M. i Ch. Knillów', 'stymulacja polisensoryczna, elementy Snoezelen', 'trening czynności samoobsługowych (łańcuchowanie, podpowiedzi fizyczne)', 'metoda Dennisona (kinezjologia edukacyjna) – elementy', 'muzykoterapia i elementy dogoterapii (jeśli dostępne)'],
    wymagania: ['realizacja podstawy programowej dla uczniów z NI w stopniu umiarkowanym lub znacznym z naciskiem na komunikację, samoobsługę i edukację osobistą i zdrowotną', 'cele formułowane bardzo konkretnie, małymi krokami', 'stałe osoby prowadzące i powtarzalne sytuacje', 'ocenianie opisowe w odniesieniu do indywidualnych postępów'],
    warunki: ['stała asysta osoby dorosłej', 'dostosowane stanowisko pracy (stabilne krzesło, podnóżek, antypoślizgowa mata)', 'przestrzeń do wyciszenia i odpoczynku', 'zabezpieczenie przed nadmiarem bodźców'],
    zajecia: ['zajęcia rewalidacyjne rozwijające komunikację (AAC)', 'zajęcia usprawniania ruchowego / fizjoterapia', 'stymulacja polisensoryczna', 'zajęcia samoobsługi'],
    cele: {
      d1: ['skupia wzrok na przedmiocie i śledzi go przez 5 sekund', 'wybiera jeden z dwóch przedmiotów, pokazując go wzrokiem lub ręką'],
      d3: ['komunikuje „tak/nie” w ustalony sposób (gest, mimika, symbol)', 'sygnalizuje „jeszcze” i „koniec” podczas aktywności'],
      d4: ['utrzymuje przedmiot w dłoni przez 10 sekund', 'przenosi przedmiot z pojemnika do pojemnika'],
      d5: ['pije z kubka z pomocą', 'współpracuje przy myciu rąk (podaje ręce, pociera dłonie)'],
      d7: ['reaguje uśmiechem lub spojrzeniem na powitanie', 'uczestniczy w zabawie z dorosłym w parze przez 2 minuty']
    },
    rodzice: ['ustalenie wspólnego systemu komunikacji tak/nie w domu i w szkole', 'instruktaż pielęgnacji, pozycjonowania i ćwiczeń do wykonywania w domu', 'wsparcie w kontakcie z instytucjami (PCPR, MOPS, NFZ – sprzęt ortopedyczny, rehabilitacja)'],
    technologie: ['komunikatory jedno- i wieloprzyciskowe (np. BIGmack)', 'przełączniki, adaptowane zabawki', 'sprzęt do pozycjonowania']
  };

  C.AUTYZM = {
    nazwa: 'autyzm',
    opis: 'Specyficzne trudności w komunikacji społecznej oraz sztywne, powtarzalne wzorce zachowań i zainteresowań; często odmienne przetwarzanie bodźców sensorycznych. Kluczowe są przewidywalność, struktura wizualna i uczenie umiejętności społecznych wprost.',
    mocne: ['dobra pamięć wzrokowa i mechaniczna', 'silne, szczegółowe zainteresowania (można wykorzystać do motywowania)', 'przestrzeganie znanych reguł i rutyn', 'dobra orientacja w znanym otoczeniu', 'zdolność koncentracji na interesujących zadaniach'],
    trudnosci: {
      d2: 'trudność z tolerowaniem zmian i przejściem między aktywnościami; potrzeba przewidywalności',
      d3: 'trudności w komunikacji społecznej: inicjowanie, podtrzymywanie rozmowy, rozumienie mowy przenośnej, gestów i mimiki; możliwe echolalie',
      d7: 'trudności w nawiązywaniu relacji, rozumieniu zasad społecznych i perspektywy innych osób',
      d9: 'nadwrażliwość na hałas i tłum w miejscach publicznych',
      d1: 'nierówny profil umiejętności; trudność z uogólnianiem umiejętności na nowe sytuacje'
    },
    metody: ['TEACCH – strukturalizacja przestrzeni, czasu i zadań', 'plany aktywności (L. McClannahan, P. Krantz)', 'stosowana analiza zachowania (ABA) i pozytywne wsparcie zachowania (PBS)', 'PECS i inne formy AAC', 'historyjki społeczne (C. Gray) i komiksy rozmowy', 'trening umiejętności społecznych (TUS)', 'integracja sensoryczna (SI) – zgodnie z zaleceniem terapeuty', 'wideomodelowanie'],
    wymagania: ['polecenia dosłowne, krótkie, wsparte wizualnie; unikanie metafor i ironii', 'zapowiadanie zmian z wyprzedzeniem (plan dnia, timer, karta zmiany)', 'możliwość pracy indywidualnej przy zadaniach wymagających skupienia', 'dostosowanie form sprawdzania wiedzy (zadania zamknięte, ustne, z wyborem)', 'wykorzystywanie zainteresowań ucznia w treściach zadań'],
    warunki: ['stałe miejsce w klasie, ograniczenie bodźców wzrokowych i słuchowych', 'słuchawki wygłuszające i kącik wyciszenia', 'wizualny plan dnia i oznaczenia przestrzeni', 'uprzedzanie o alarmach, dzwonkach i wydarzeniach szkolnych', 'zaplanowane przerwy sensoryczne'],
    zajecia: ['zajęcia rozwijające umiejętności społeczne, w tym umiejętności komunikacyjne (zajęcia rewalidacyjne wymagane u uczniów z autyzmem, w tym z zespołem Aspergera)', 'zajęcia rozwijające kompetencje emocjonalno-społeczne', 'zajęcia logopedyczne / komunikacja AAC', 'terapia integracji sensorycznej (jeśli zalecona)'],
    cele: {
      d2: ['akceptuje zmianę w planie dnia zapowiedzianą kartą „zmiana” bez zachowań trudnych', 'korzysta z planu aktywności, wykonując 4 zadania po kolei'],
      d3: ['inicjuje prośbę do dorosłego (słowem lub symbolem) w 4 z 5 sytuacji', 'odpowiada na pytanie „co robiłeś?” z pomocą zdjęć z dnia'],
      d7: ['rozpoznaje 4 podstawowe emocje na zdjęciach i w sytuacjach', 'bierze udział w grze z rówieśnikiem, czekając na swoją kolej (z podpowiedzią wizualną)'],
      d9: ['stosuje ustalony sposób radzenia sobie z hałasem (słuchawki, prośba o przerwę)']
    },
    rodzice: ['ujednolicenie strategii dom–szkoła (plan dnia, historyjki społeczne, sposób reagowania na zachowania trudne)', 'analiza funkcji zachowań trudnych wspólnie z rodzicami (obserwacja ABC)', 'informacja o grupach wsparcia i organizacjach (np. stowarzyszenia rodziców osób z autyzmem)'],
    technologie: ['wizualne plany dnia i timery (np. Time Timer)', 'aplikacje AAC i planery wizualne na tablet', 'słuchawki wygłuszające']
  };

  C.ASPERGER = {
    nazwa: 'zespół Aspergera',
    opis: 'Uczeń w spektrum autyzmu bez opóźnienia rozwoju mowy i z zachowanym rozwojem intelektualnym (lub w normie intelektualnej). Główne trudności: komunikacja społeczna, rozumienie niepisanych zasad, elastyczność myślenia, regulacja emocji i nadwrażliwości sensoryczne.',
    mocne: ['bogate słownictwo i wiedza w obszarach zainteresowań', 'logiczne myślenie, dbałość o szczegóły', 'szczerość i przestrzeganie zasad', 'dobra pamięć faktów', 'samodzielność w nauce w ustrukturyzowanych warunkach'],
    trudnosci: {
      d3: 'dosłowne rozumienie wypowiedzi, trudność z ironią, żartem, metaforą; monologi na temat zainteresowań',
      d7: 'trudność w odczytywaniu emocji i intencji, w pracy w grupie, w rozwiązywaniu konfliktów',
      d2: 'sztywność myślenia, trudność z nagłymi zmianami i nieprecyzyjnymi poleceniami; wybuchy emocji przy przeciążeniu',
      d4: 'możliwa niezgrabność ruchowa i trudności grafomotoryczne'
    },
    metody: ['trening umiejętności społecznych (TUS)', 'historyjki społeczne i komiksy rozmowy (C. Gray)', 'elementy terapii poznawczo-behawioralnej w pracy nad emocjami', 'mapy myśli i organizery graficzne', 'tutoring i mentoring rówieśniczy', 'jasne kontrakty i systemy żetonowe'],
    wymagania: ['precyzyjne, jednoznaczne polecenia i kryteria oceniania', 'możliwość pisania na komputerze przy trudnościach grafomotorycznych', 'wydłużenie czasu pracy, mniej zadań wymagających pracy w grupie lub jasno określone role w grupie', 'uprzedzanie o sprawdzianach i zmianach'],
    warunki: ['bezpieczne miejsce i osoba, do której uczeń może się zwrócić w trudnej sytuacji', 'możliwość krótkiej przerwy przy przeciążeniu', 'ograniczenie hałasu, miejsce z dala od drzwi i okna'],
    zajecia: ['zajęcia rozwijające umiejętności społeczne, w tym umiejętności komunikacyjne', 'zajęcia rozwijające kompetencje emocjonalno-społeczne', 'zajęcia związane z wyborem kierunku kształcenia i zawodu'],
    cele: {
      d3: ['prowadzi rozmowę na temat zaproponowany przez innych przez 3 wymiany zdań', 'rozpoznaje 5 popularnych związków frazeologicznych i wyjaśnia ich znaczenie'],
      d7: ['stosuje uzgodniony plan radzenia sobie ze złością (np. stop – oddech – prośba o przerwę)', 'pełni wyznaczoną rolę w pracy grupowej do końca zadania'],
      d2: ['akceptuje zmianę zapowiedzianą 10 minut wcześniej, korzystając z planu B']
    },
    rodzice: ['spójne zasady i kontrakty dom–szkoła', 'psychoedukacja rodziców i rodzeństwa', 'współpraca z poradnią i psychiatrą dziecięcym (jeśli prowadzi leczenie)'],
    technologie: ['komputer/laptop do pisania', 'aplikacje do planowania i przypominania', 'słuchawki wygłuszające']
  };

  C.DOWN = {
    nazwa: 'zespół Downa',
    opis: 'Uwarunkowana genetycznie (trisomia 21) niepełnosprawność intelektualna, zwykle w stopniu lekkim lub umiarkowanym. Charakterystyczne: obniżone napięcie mięśniowe, mocna strona – uczenie się wzrokowe i naśladowanie, słabsza pamięć słuchowa i mowa ekspresyjna; częstsze problemy ze słuchem, wzrokiem, tarczycą i układem krążenia.',
    mocne: ['uczenie się przez obserwację i naśladowanie', 'dobra pamięć wzrokowa', 'towarzyskość, empatia, chęć kontaktu', 'rozumienie mowy lepsze niż mówienie', 'radość z zajęć muzycznych i ruchowych'],
    trudnosci: {
      d3: 'mowa ekspresyjna mniej rozwinięta niż rozumienie; trudności artykulacyjne związane z budową i napięciem aparatu mowy',
      d4: 'obniżone napięcie mięśniowe, wiotkość stawów, słabsza motoryka mała i równowaga',
      d1: 'słabsza pamięć słuchowa krótkotrwała i wolniejsze tempo przetwarzania informacji',
      d2: 'szybsza męczliwość, potrzeba przerw; możliwy upór przy zmianie aktywności',
      d5: 'potrzeba wsparcia w czynnościach precyzyjnych (guziki, sznurowanie)'
    },
    metody: ['globalne czytanie i Metoda Krakowska', 'Makaton i inne formy wspomagania komunikacji gestem i symbolem', 'Ruch Rozwijający W. Sherborne', 'terapia ręki i ćwiczenia motoryki małej', 'Kinezjologia edukacyjna P. Dennisona (elementy)', 'nauczanie z dużą liczbą pomocy wizualnych, modelowanie'],
    wymagania: ['informacje podawane wzrokowo (obrazy, napisy, gesty), nie tylko słownie', 'krótkie polecenia, jedno na raz; więcej czasu na odpowiedź', 'zadania pisemne ograniczone na rzecz wskazywania, dopasowywania, wyboru'],
    warunki: ['miejsce blisko nauczyciela (możliwy niedosłuch, wada wzroku)', 'stabilne krzesło z podparciem stóp', 'częste przerwy ruchowe', 'kontrola stanu zdrowia (słuch, wzrok, tarczyca) we współpracy z rodzicami'],
    zajecia: ['zajęcia logopedyczne (w tym terapia funkcji prymarnych: oddychanie, gryzienie, żucie, połykanie)', 'zajęcia rozwijające komunikację (Makaton, AAC)', 'zajęcia ruchowe / fizjoterapia – praca nad napięciem mięśniowym i równowagą', 'zajęcia usprawniające motorykę małą'],
    cele: {
      d3: ['buduje wypowiedzi dwu-trzywyrazowe wspierane gestem Makatonu', 'stosuje 20 gestów/symboli w codziennych sytuacjach'],
      d4: ['stoi na jednej nodze przez 5 sekund', 'chwyta kredkę chwytem trójpalcowym'],
      d1: ['odczytuje globalnie 20 wyrazów i dopasowuje je do obrazków'],
      d5: ['samodzielnie zakłada kurtkę i zapina duże guziki']
    },
    rodzice: ['współpraca w zakresie opieki medycznej (kontrola słuchu, wzroku, tarczycy)', 'nauka gestów Makatonu w domu', 'informacja o stowarzyszeniach rodziców dzieci z zespołem Downa'],
    technologie: ['pomoce do nauki globalnego czytania', 'pomoce do ćwiczeń oddechowych i artykulacyjnych', 'nakładki na ołówki, nożyczki z ułatwieniem']
  };

  C.SPRZEZONE = {
    nazwa: 'niepełnosprawności sprzężone',
    opis: 'Współwystępowanie co najmniej dwóch niepełnosprawności, które wzajemnie się nasilają. Wymaga ścisłej współpracy wielu specjalistów i całościowego planowania wsparcia – priorytetem są komunikacja, bezpieczeństwo, samodzielność i uczestnictwo.',
    mocne: ['indywidualne mocne strony należy ustalić podczas obserwacji – często dobry kontakt emocjonalny i wyraźne preferencje'],
    trudnosci: {
      d2: 'nakładanie się trudności utrudnia przystosowanie do wymagań szkolnych; potrzeba dużej struktury',
      d3: 'ograniczenia komunikacyjne wymagające wspomagających metod porozumiewania się'
    },
    metody: ['zespołowe planowanie wsparcia (nauczyciel, logopeda, psycholog, fizjoterapeuta, terapeuta SI)', 'komunikacja wspomagająca i alternatywna (AAC)', 'łączenie metod właściwych dla każdej z niepełnosprawności'],
    wymagania: ['ustalenie priorytetów edukacyjnych i terapeutycznych na dany okres (najwyżej 3–4 obszary)', 'spójność metod u wszystkich osób pracujących z uczniem'],
    warunki: ['dostosowanie przestrzeni do potrzeb ruchowych i sensorycznych', 'zapewnienie sprzętu specjalistycznego i pomocy nauczyciela'],
    zajecia: ['zajęcia rewalidacyjne odpowiadające każdej ze współwystępujących niepełnosprawności'],
    cele: {},
    rodzice: ['regularne spotkania zespołu z rodzicami – wspólne priorytety', 'koordynacja wizyt lekarskich i terapii zewnętrznych'],
    technologie: []
  };

  C.RUCHOWA = {
    nazwa: 'niepełnosprawność ruchowa, w tym afazja',
    opis: 'Ograniczenia w poruszaniu się i/lub sprawności manualnej (np. mózgowe porażenie dziecięce), często z towarzyszącymi trudnościami w mowie (dyzartria, afazja).',
    mocne: ['zachowane obszary sprawności, które można wykorzystać kompensacyjnie', 'motywacja do samodzielności'],
    trudnosci: {
      d4: 'ograniczenia w lokomocji, zmianie pozycji, precyzji ruchów rąk',
      d5: 'potrzeba pomocy w czynnościach samoobsługowych',
      d3: 'możliwe trudności artykulacyjne lub afatyczne'
    },
    metody: ['metody neurorozwojowe (NDT-Bobath) – przez fizjoterapeutę', 'terapia ręki', 'AAC przy trudnościach w mowie', 'nauczanie wspomagane technologią'],
    wymagania: ['wydłużony czas na zadania wymagające pisania; możliwość pisania na komputerze lub odpowiedzi ustnych', 'zwolnienie z elementów zajęć niemożliwych do wykonania z uwagi na stan zdrowia – z zastąpieniem ich formami dostępnymi'],
    warunki: ['dostępność architektoniczna (podjazdy, winda, toaleta)', 'stanowisko pracy dostosowane (stolik z wycięciem, pochyła powierzchnia, uchwyty)', 'możliwość zmiany pozycji w ciągu dnia (pionizator, materac)'],
    zajecia: ['zajęcia rewalidacyjne usprawniające ruchowo (fizjoterapia)', 'zajęcia rozwijające umiejętności manualne', 'zajęcia logopedyczne / komunikacja AAC'],
    cele: { d4: ['samodzielnie zmienia pozycję z siedzącej do stojącej przy poręczy', 'chwyta i odkłada przedmioty średniej wielkości'], d5: ['je samodzielnie dostosowanymi sztućcami'] },
    rodzice: ['instruktaż pozycjonowania i ćwiczeń domowych', 'pomoc w pozyskaniu sprzętu (NFZ, PFRON przez PCPR)'],
    technologie: ['klawiatury i myszy adaptowane, trackball, przełączniki', 'oprogramowanie do sterowania wzrokiem (eyetracking) – w razie potrzeby', 'pomoce ortopedyczne']
  };
  C.AFAZJA = Object.assign({}, C.RUCHOWA, { nazwa: 'afazja' });

  C.SLABOWIDZACY = {
    nazwa: 'słabowidzenie / niewidzenie',
    opis: 'Ograniczenia widzenia wymagające dostosowania materiałów, oświetlenia i metod pracy; u uczniów niewidomych – nauki brajla i orientacji przestrzennej.',
    mocne: ['dobra pamięć słuchowa', 'wykorzystywanie innych zmysłów do poznawania otoczenia'],
    trudnosci: { d1: 'trudności z odczytywaniem tekstu i materiałów graficznych', d4: 'trudności z orientacją w przestrzeni', d9: 'ograniczona samodzielność w poruszaniu się poza znanym otoczeniem' },
    metody: ['nauka orientacji przestrzennej i poruszania się', 'materiały powiększone, wypukłe, kontrastowe', 'nauka brajla (uczniowie niewidomi)', 'tyflopedagogiczne usprawnianie widzenia'],
    wymagania: ['powiększony druk (wg zaleceń okulisty/tyflopedagoga), kontrastowe materiały', 'wydłużony czas pracy z tekstem', 'opis słowny treści prezentowanych wizualnie'],
    warunki: ['odpowiednie oświetlenie stanowiska, miejsce blisko tablicy', 'stały układ sali i oznaczenia kontrastowe'],
    zajecia: ['zajęcia rewalidacyjne z orientacji przestrzennej i poruszania się', 'zajęcia usprawniania widzenia', 'nauka brajla – uczniowie niewidomi'],
    cele: { d4: ['samodzielnie przemieszcza się trasą sala–toaleta–stołówka'] },
    rodzice: ['współpraca z okulistą i ośrodkiem dla dzieci z dysfunkcją wzroku'],
    technologie: ['lupy, powiększalniki, programy powiększające i czytające ekran', 'książki z dużym drukiem i audiobooki']
  };

  C.SLABOSLYSZACY = {
    nazwa: 'słabosłyszenie / niesłyszenie',
    opis: 'Ograniczenia słyszenia wpływające na rozumienie mowy i rozwój języka; wymagają dostosowania akustyki, sposobu mówienia i – w razie potrzeby – języka migowego.',
    mocne: ['dobra percepcja wzrokowa', 'umiejętność korzystania z kontekstu wizualnego'],
    trudnosci: { d3: 'trudności w rozumieniu mowy w hałasie, uboższe słownictwo i gramatyka', d7: 'trudności w rozmowach grupowych' },
    metody: ['metoda audytywno-werbalna (wg zaleceń surdopedagoga)', 'język migowy / system językowo-migowy – w razie potrzeby', 'fonogesty', 'wizualizacja treści'],
    wymagania: ['mówienie twarzą do ucznia, wyraźnie, bez przesadnej artykulacji', 'zapisywanie poleceń i kluczowych słów', 'sprawdzanie zrozumienia'],
    warunki: ['miejsce z widokiem na nauczyciela i klasę, z dala od źródeł hałasu', 'system FM / Roger, kontrola aparatów słuchowych lub implantu'],
    zajecia: ['zajęcia rewalidacyjne rozwijające umiejętności komunikacyjne', 'zajęcia logopedyczne / surdologopedyczne', 'nauka języka migowego – w razie potrzeby'],
    cele: { d3: ['rozumie polecenia nauczyciela w klasie z wykorzystaniem systemu FM'] },
    rodzice: ['współpraca z ośrodkiem audiologicznym'],
    technologie: ['systemy wspomagające słyszenie (FM/Roger)', 'napisy i transkrypcja w materiałach wideo']
  };

  C.EPILEPSJA = {
    nazwa: 'padaczka',
    opis: 'Informacja medyczna istotna dla bezpieczeństwa – szkoła powinna znać procedurę postępowania w razie napadu.',
    mocne: [], trudnosci: { d2: 'możliwa męczliwość i spadki koncentracji (napady, leki)' },
    metody: [], wymagania: ['uwzględnienie wpływu napadów i leków na koncentrację i tempo pracy'],
    warunki: ['procedura postępowania w razie napadu znana wszystkim pracownikom', 'informacja od rodziców o lekach i objawach ostrzegawczych'],
    zajecia: [], cele: {}, rodzice: ['przekazanie przez rodziców informacji medycznych i procedury na wypadek napadu'], technologie: []
  };

  // dokumentacja i metody wg roli specjalisty
  const SPECIALISTS = {
    psycholog: { tytul: 'psycholog', obszary: ['funkcje poznawcze (uwaga, pamięć, myślenie)', 'funkcjonowanie emocjonalne i regulacja emocji', 'motywacja i zachowanie', 'relacje społeczne', 'samoocena'] },
    logopeda: { tytul: 'logopeda', obszary: ['rozumienie mowy', 'ekspresja słowna i pozawerbalna', 'funkcje prymarne (oddychanie, połykanie, gryzienie, żucie)', 'artykulacja i słuch fonemowy', 'komunikacja wspomagająca (AAC)'] },
    pedagog: { tytul: 'pedagog specjalny / wychowawca', obszary: ['umiejętności szkolne (czytanie, pisanie, liczenie)', 'funkcjonowanie na zajęciach', 'samodzielność i samoobsługa', 'zainteresowania i uzdolnienia'] },
    fizjoterapeuta: { tytul: 'fizjoterapeuta', obszary: ['postawa ciała i napięcie mięśniowe', 'motoryka duża: lokomocja, równowaga, koordynacja', 'motoryka mała i sprawność rąk', 'lateralizacja i schemat ciała'] },
    terapeutaSI: { tytul: 'terapeuta integracji sensorycznej', obszary: ['przetwarzanie bodźców dotykowych, przedsionkowych i proprioceptywnych', 'nad- i podwrażliwości słuchowe, wzrokowe, smakowe', 'planowanie ruchu (praksja)', 'regulacja pobudzenia'] }
  };

  function get(code) { return C[code] || null; }
  function listFor(codes) { return (codes || []).map(get).filter(Boolean); }

  // łączy listy z kilku niepełnosprawności (bez powtórzeń, z limitem)
  function union(codes, field, limit) {
    const out = [];
    for (const c of listFor(codes)) for (const x of c[field] || []) if (!out.includes(x)) out.push(x);
    return limit ? out.slice(0, limit) : out;
  }

  function trudnosciByArea(codes) {
    const out = {};
    for (const c of listFor(codes)) for (const [k, v] of Object.entries(c.trudnosci || {})) out[k] = out[k] ? out[k] + '; ' + v : v;
    return out;
  }

  function celeByArea(codes, perArea) {
    const out = {};
    for (const c of listFor(codes)) for (const [k, v] of Object.entries(c.cele || {})) out[k] = [...new Set([...(out[k] || []), ...v])].slice(0, perArea || 3);
    return out;
  }

  function podstawaFor(codes, etap) {
    if (etap === 'SPdP') return LAW.podstawaSPdP;
    if ((codes || []).some((c) => c === 'NI_UMIARKOWANY' || c === 'NI_ZNACZNY')) return LAW.podstawaUZ;
    return LAW.podstawaSP;
  }

  return { ICF, LAW, CONDITIONS: C, SPECIALISTS, get, listFor, union, trudnosciByArea, celeByArea, podstawaFor };
});
