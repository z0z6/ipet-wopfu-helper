# Asystent IPET

Aplikacja dla zespołów nauczycieli i specjalistów w SOSW (Windows, Linux, Android). Z agentem AI w tle automatyzuje tworzenie dokumentacji ucznia z orzeczeniem o potrzebie kształcenia specjalnego. Obsługuje niepełnosprawność intelektualną w stopniu lekkim, umiarkowanym i znacznym, autyzm, zespół Aspergera, zespół Downa i niepełnosprawności sprzężone.

1. **Dodajesz skan, zdjęcie lub PDF orzeczenia** z poradni psychologiczno-pedagogicznej. Na Androidzie możesz też zrobić zdjęcie aparatem.
2. **Aplikacja odczytuje je lokalnie (OCR, język polski).** Rozpoznaje dane ucznia (imię, nazwisko, PESEL z kontrolą sumy, datę urodzenia, rodziców, adres, szkołę, klasę, numer i datę orzeczenia, poradnię, okres), rodzaj niepełnosprawności i etap edukacyjny.
3. **Proponuje wszystkie dokumenty, które wynikają z orzeczenia:**
   - WOPFU i IPET,
   - szkolną ocenę funkcjonalną w 9 obszarach ICF,
   - oceny funkcjonalne pedagoga, psychologa, logopedy i fizjoterapeuty oraz profil sensoryczny,
   - programy zajęć: rewalidacyjnych, rozwijających umiejętności społeczne i komunikacyjne (KES) oraz AAC,
   - wskazówki dla rodziców, ocenę efektywności, zawiadomienie rodziców i protokół zespołu.
4. **Agent AI w tle** analizuje orzeczenie i wyszukuje w internecie aktualną wiedzę specjalistyczną (przepisy, podstawy programowe, metody). Potem opracowuje każdy dokument indywidualnie. Bez AI powstają wersje wzorcowe z wbudowanej bazy wiedzy.
5. **Dane osobowe są wstawiane lokalnie.** Dokumenty edytujesz w aplikacji i eksportujesz do Word (.docx).

> Dokumenty przygotowane przez AI są **propozycją do weryfikacji** przez zespół. Zespół uzupełnia je własnymi obserwacjami i zatwierdza na posiedzeniu.

## Ochrona danych uczniów

| Co | Gdzie |
|---|---|
| Skany i zdjęcia orzeczeń | tylko na urządzeniu; OCR (Tesseract + pdf.js) działa lokalnie, obrazy **nigdy** nie są wysyłane |
| Dane osobowe ucznia, rodziców, zespołu | tylko na urządzeniu (folder danych aplikacji) |
| Treść wysyłana do AI | opis funkcjonowania po **pseudonimizacji**: imiona (z odmianą i zdrobnieniami), nazwiska, PESEL, daty, adresy, telefony, e-maile, numery orzeczeń, poradnie, szkoły i nazwiska specjalistów są zastąpione znacznikami `{{IMIE}}`, `{{UCZEN}}` … |
| Wyszukiwanie w internecie | tylko wiedza ogólna (rodzaj niepełnosprawności, etap edukacyjny), bez danych ucznia |

- **Strażnik prywatności.** Każde zapytanie do AI (w Electronie w procesie głównym) jest sprawdzane pod kątem danych **wszystkich** uczniów zapisanych w aplikacji. Jeśli strażnik coś wykryje, wysyłka zostaje zablokowana.
- **Okno aplikacji (Electron) nie ma dostępu do internetu.** Sieć jest zablokowana na poziomie sesji, a połączenia z AI wykonuje wyłącznie proces główny.
- **Claude Code działa w pustym katalogu tymczasowym, bez narzędzi do plików.** Ma dostęp tylko do wyszukiwania w sieci.
- **Przed pierwszym uruchomieniem agenta widzisz dokładną treść**, która może trafić do AI, i możesz ją edytować.
- **Zakładka „Prywatność” zawiera dziennik wysyłek** z podglądem każdej wysłanej treści oraz tester strażnika.
- **Opcjonalnie pełna lokalność:** lokalny model przez [Ollama](https://ollama.com) (`127.0.0.1`). Wtedy nic nie opuszcza komputera.
- **Na Androidzie kopia zapasowa w chmurze Google jest wyłączona** (`allowBackup=false`).

Zalecenie: trzymaj folder danych na zaszyfrowanym dysku (BitLocker, LUKS). Na telefonie używaj blokady ekranu.

## Połączenie z AI

- **Konto Claude (domyślnie, Windows/Linux):** aplikacja jednym kliknięciem instaluje oficjalny program Claude Code i otwiera stronę logowania Claude. Korzysta z Twojego planu Pro/Max zgodnie z zasadami Anthropic.
- **Klucz API** z [platform.claude.com](https://platform.claude.com/settings/keys), rozliczany za zużycie. To jedyna opcja chmurowa na Androidzie.
- **Lokalny model (Ollama)**, np. `qwen2.5:14b`. Wymaga mocnego komputera.
- **Bez AI:** wyłącznie wbudowana baza wiedzy.

## Pobieranie

GitHub Actions buduje przy każdym pushu na `main`. Pliki są w zakładce **Actions → najnowszy przebieg → Artifacts**:
- `Asystent-IPET-linux-AppImage`: nadaj prawo wykonywania (`chmod +x`) i uruchom,
- `Asystent-IPET-windows-portable`: plik `.exe` bez instalacji; dane zapisują się obok pliku, w folderze „Asystent IPET - dane”,
- `Asystent-IPET-android-APK`: zainstaluj na telefonie lub tablecie (zezwól na instalację z nieznanych źródeł).

Tag `v*` (np. `git tag v1.0.0 && git push --tags`) tworzy Release ze wszystkimi plikami.

### Android: stały klucz podpisu (ważne przy aktualizacjach)

Bez sekretów powstaje APK testowy podpisany kluczem debug. Ten klucz jest inny w każdym buildzie, więc aktualizacja wymaga odinstalowania aplikacji, **a to usuwa dane**. Żeby aktualizacje zachowywały dane, utwórz raz własny klucz:

```bash
keytool -genkeypair -v -keystore asystent-ipet.jks -alias asystentipet -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 asystent-ipet.jks   # wynik wklej jako sekret ANDROID_KEYSTORE_BASE64
```

Następnie w repozytorium otwórz **Settings → Secrets and variables → Actions** i dodaj sekrety: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (np. `asystentipet`) i `ANDROID_KEY_PASSWORD`. Plik `.jks` przechowuj bezpiecznie.

## Podstawy prawne uwzględnione w bazie wiedzy (stan: listopad 2026)

- Rozporządzenie MEN z 9 sierpnia 2017 r. w sprawie warunków organizowania kształcenia … (IPET, WOPFU) oraz rozporządzenie w sprawie pomocy psychologiczno-pedagogicznej.
- Nowe przepisy o orzeczeniach poradni (od 13 kwietnia 2026 r.).
- Podstawa programowa dla SP (Dz.U. 2026 poz. 378), w tym dla uczniów z NI w stopniu umiarkowanym lub znacznym. Od 1.09.2026 obowiązuje 6 zajęć edukacyjnych: porozumiewanie się, edukacja środowiskowa, edukacja społeczna, edukacja osobista i zdrowotna, edukacja artystyczna, wychowanie fizyczne. Planowanie opiera się na 9 obszarach ICF.
- Podstawa programowa szkoły specjalnej przysposabiającej do pracy (Dz.U. 2026 poz. 1012).

Agent przy każdym uczniu sprawdza w internecie, czy przepisy się nie zmieniły.

## Rozwój

```bash
npm install          # instaluje zależności i kopiuje biblioteki OCR/PDF/DOCX do src/renderer/vendor
npm start            # uruchomienie (Electron)
npm test             # testy logiki: parser orzeczeń, PESEL, pseudonimizacja, strażnik, katalog dokumentów
npm run dist:linux   # AppImage
npm run dist:win     # portable .exe
npx cap add android && python3 scripts/android-setup.py && npx cap sync android   # projekt Android
```

Struktura:
- `src/main/`: Electron (okno, protokół `app://`, blokada sieci, strażnik, dostawcy AI, konto Claude),
- `src/renderer/lib/`: logika wspólna dla wszystkich platform:
  - `orzeczenie.js`: parser orzeczeń,
  - `privacy.js`: pseudonimizacja i strażnik,
  - `knowledge.js`: baza wiedzy,
  - `catalog.js`: dokumenty i wersje wzorcowe,
  - `prompts.js`: zadania AI,
- `src/renderer/`: interfejs:
  - `app.js`: widoki,
  - `agent.js`: agent w tle,
  - `ocr.js`: odczyt orzeczeń,
  - `docx-export.js`: eksport do Word,
  - `platform-android.js`: Capacitor.
