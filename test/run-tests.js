'use strict';
// Testy logiki bez Electrona: node test/run-tests.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const T = require('../src/renderer/lib/text');
const O = require('../src/renderer/lib/orzeczenie');
const P = require('../src/renderer/lib/privacy');
const K = require('../src/renderer/lib/knowledge');
const C = require('../src/renderer/lib/catalog');
const PR = require('../src/renderer/lib/prompts');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n    ')); }
}

const sample = fs.readFileSync(path.join(__dirname, 'fixtures', 'orzeczenie-przyklad.txt'), 'utf8');
const parsed = O.parse(sample);
const st = { personal: parsed.personal };

console.log('PESEL i daty');
test('poprawny PESEL (2000+)', () => { assert.ok(T.peselValid('14290301233')); assert.deepStrictEqual(T.peselDecode('14290301233'), { birthDate: '2014-09-03', sex: 'M' }); });
test('zły PESEL', () => assert.ok(!T.peselValid('14290301236')));
test('daty po polsku', () => { assert.strictEqual(T.parseDate('3 września 2014 r.'), '2014-09-03'); assert.strictEqual(T.parseDate('03.09.2014'), '2014-09-03'); assert.strictEqual(T.parseDate('2014-09-03'), '2014-09-03'); });
test('wiek', () => assert.strictEqual(T.ageAt('2014-09-03', '2026-11-18'), 12));

console.log('Parser orzeczenia');
test('imię i nazwisko', () => { assert.strictEqual(parsed.personal.imie, 'Jakub'); assert.strictEqual(parsed.personal.nazwisko, 'Nowakowski'); });
test('PESEL, data urodzenia, płeć', () => { assert.strictEqual(parsed.personal.pesel, '14290301233'); assert.strictEqual(parsed.personal.dataUrodzenia, '2014-09-03'); assert.strictEqual(parsed.personal.plec, 'M'); });
test('klasa, etap, okres', () => { assert.strictEqual(parsed.personal.klasa, 'V'); assert.strictEqual(parsed.personal.etap, 'SP2'); assert.match(parsed.personal.okres, /II etapu/); });
test('numer i data orzeczenia, poradnia', () => { assert.strictEqual(parsed.personal.nrOrzeczenia, '245/2024/2025'); assert.strictEqual(parsed.personal.dataOrzeczenia, '2025-05-14'); assert.match(parsed.personal.poradnia, /Poradnia Psychologiczno-Pedagogiczna nr 3 w Kielcach/); });
test('rodzaje niepełnosprawności (formuła „w tym zespół Aspergera” ≠ Asperger)', () => { assert.deepStrictEqual(parsed.niepelnosprawnosci.sort(), ['AUTYZM', 'NI_UMIARKOWANY', 'SPRZEZONE'].sort()); });
test('zespół Downa i stopień lekki', () => { const r = O.detectDisabilities('niepełnosprawność intelektualną w stopniu lekkim, zespół Downa (Q90)'); assert.ok(r.includes('DOWN') && r.includes('NI_LEKKI') && r.includes('SPRZEZONE')); });
test('Asperger wymieniony osobno', () => assert.ok(O.detectDisabilities('rozpoznanie: zespół Aspergera F84.5').includes('ASPERGER')));
test('tekst OCR bez polskich znaków', () => assert.ok(O.detectDisabilities('niepelnosprawnosc intelektualna w stopniu znacznym').includes('NI_ZNACZNY')));
test('zespół orzekający rozpoznany', () => assert.ok(parsed.personal.zespolOrzekajacy.includes('Tomasz Zieliński')));

console.log('Pseudonimizacja i strażnik');
const anon = P.pseudonymize(parsed.body, st).text;
test('brak danych osobowych po pseudonimizacji', () => assert.deepStrictEqual(P.findLeaks(anon, P.secretsFor(st)), []));
test('odmiana i zdrobnienie (Jakuba, Kuba) ukryte', () => { assert.ok(!/Jakub|Kuba|Nowakowsk/.test(anon)); assert.ok(anon.includes('{{IMIE}}')); });
test('telefon i specjaliści ukryci', () => { assert.ok(!/601 234 567/.test(anon)); assert.ok(!/Zieliński/.test(anon)); });
test('strażnik wykrywa dane w surowym tekście', () => { const l = P.findLeaks(parsed.body, P.secretsFor(st)); assert.ok(l.length >= 3); });
test('strażnik wykrywa odmienione nazwisko', () => assert.ok(P.findLeaks('Rozmowa z Nowakowskim', P.secretsFor(st)).length));
test('strażnik nie blokuje zwykłych słów', () => assert.deepStrictEqual(P.findLeaks('Janusz Korczak, metoda Sherborne, ruch rozwijający', P.secretsFor(st)), []));
test('strażnik wykrywa każdy poprawny PESEL', () => assert.ok(P.findLeaks('numer 14290301233', []).length));
test('wypełnianie znaczników', () => assert.strictEqual(P.fill('{{UCZEN}}, kl. {{KLASA}}', st), 'Jakub Nowakowski, kl. V'));
test('dane z zespołu (extra) ukryte', () => { const r = P.pseudonymize('Prowadząca: Ewa Kamińska', st, [{ value: 'Kamińska', ph: 'OSOBA', kind: 'name' }]); assert.ok(!/Kamińsk/.test(r.text)); });

console.log('Katalog dokumentów');
const ctx = { codes: parsed.niepelnosprawnosci, plec: 'M', wiek: 12, etap: 'SP2', etapLabel: parsed.personal.etapLabel, anonText: anon, team: [] };
const props = C.proposals(ctx);
test('IPET, WOPFU i program KES proponowane automatycznie', () => { for (const id of ['ipet', 'wopfu', 'program_kes', 'program_aac', 'ocena_logo']) assert.ok(props.find((p) => p.id === id && p.auto), id); });
test('dla NI lekkiej bez autyzmu brak programu AAC', () => { const p = C.proposals({ codes: ['NI_LEKKI'], anonText: 'uczeń czyta wolno' }); assert.ok(!p.find((x) => x.id === 'program_aac')); assert.ok(!p.find((x) => x.id === 'program_kes' && x.auto)); });
test('każdy dokument ma treść w każdej sekcji', () => {
  for (const t of C.TYPES) for (const code of ['NI_LEKKI', 'NI_UMIARKOWANY', 'NI_ZNACZNY', 'ASPERGER', 'DOWN']) {
    const d = C.offlineDocument(t.id, { ...ctx, codes: [code] });
    for (const s of d.sections) assert.ok(s.content && s.content.trim().length > 5, `${t.id}.${s.key} (${code})`);
  }
});
test('IPET dla NI umiarkowanej wskazuje nową podstawę i 6 zajęć edukacyjnych', () => { const d = C.offlineDocument('ipet', ctx); const t = d.sections.find((s) => s.key === 'dostosowanie').content; assert.match(t, /2026 r\. poz\. 378/); assert.match(t, /edukacja osobista i zdrowotna/); });
test('WOPFU zawiera 9 obszarów ICF', () => { const d = C.offlineDocument('wopfu', ctx); const t = d.sections.find((s) => s.key === 'obszary').content; assert.strictEqual((t.match(/^## D\d/gm) || []).length, 9); });

console.log('Prompty AI');
test('prompt dokumentu bez danych osobowych', () => { const g = PR.generate('ipet', ctx); assert.deepStrictEqual(P.findLeaks(g.system + g.prompt, P.secretsFor(st)), []); });
test('prompt wyszukiwania nie zawiera treści orzeczenia', () => { const g = PR.research(ctx); assert.ok(!g.prompt.includes('piktogram')); assert.ok(g.webSearch); });
test('normalizacja dokumentu z odpowiedzi AI', () => {
  const j = PR.extractJson('```json\n{"sekcje":[{"klucz":"dostosowanie","tresc":"- polecenia krótkie i wsparte piktogramem"},{"klucz":"cele","tresc":"## Porozumiewanie się\\n- {{IMIE}} sygnalizuje potrzebę przerwy kartą"}]}\n```');
  const d = PR.normalizeDocument('ipet', j, ctx);
  assert.match(d.sections.find((s) => s.key === 'dostosowanie').content, /piktogramem/);
  assert.ok(d.sections.find((s) => s.key === 'formy').content.length > 20, 'brakujące sekcje z wersji wzorcowej');
});
test('normalizacja analizy', () => { const a = PR.normalizeAnalysis({ niepelnosprawnosci: ['autyzm', 'NI_UMIARKOWANY', 'XYZ'], obszary: { d3: 'mowa' }, dokumenty: [{ typ: 'ipet' }, { typ: 'zly' }] }); assert.deepStrictEqual(a.niepelnosprawnosci, ['AUTYZM', 'NI_UMIARKOWANY']); assert.strictEqual(a.dokumenty.length, 1); });
test('baza wiedzy – wszystkie stany mają metody i cele lub opis', () => { for (const [k, c] of Object.entries(K.CONDITIONS)) assert.ok(c.nazwa && c.opis, k); });

console.log(`\n${passed} zaliczonych, ${failed} niezaliczonych`);
process.exit(failed ? 1 : 0);
