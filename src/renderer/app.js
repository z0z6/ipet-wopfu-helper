'use strict';
/* global UI, icon, IPET, OCR, DocxExport, Agent */
const { h, iconEl, toast, sheet, toggle, segmented, select, spinner, group, row, busy } = UI;
// window.api – most z procesem głównym (preload.js) lub warstwa Androida (platform-android.js)
const { text: T, orzeczenie: ORZ, privacy: PRIV, catalog: CAT, knowledge: KB } = IPET;

const state = {
  info: null,
  settings: null,
  students: [],
  hasApiKey: false,
  claudePath: null,
  outbox: [],
  view: 'dashboard',
  studentId: null,
  docType: null,
  studentTab: 'docs',
  add: null,
  settingsTab: 'school',
  claude: { status: null, login: null, installing: false, log: '', advanced: false },
  kbCode: 'NI_UMIARKOWANY',
  search: ''
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fullName = (s) => [s.personal.imie, s.personal.nazwisko].filter(Boolean).join(' ') || 'Uczeń bez nazwiska';
const student = (id) => state.students.find((s) => s.id === (id || state.studentId));
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function errToast(e) { toast(e.message || String(e), 'error', 8000); }
const isMobile = () => state.info && state.info.mobile;

// ───────────────────────── start ─────────────────────────
async function init() {
  state.info = await api.info();
  document.body.classList.add('platform-' + state.info.platform);
  if (isMobile()) document.body.classList.add('mobile');
  await loadState();

  document.querySelectorAll('#traffic .tl').forEach((b) => b.addEventListener('click', async () => {
    const maximized = await api.windowControl(b.dataset.act);
    if (b.dataset.act === 'maximize') setMaxTitle(maximized);
  }));
  api.on('window:state', (s) => setMaxTitle(s.maximized));
  document.querySelector('.titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('.traffic')) api.windowControl('maximize'); });
  window.addEventListener('blur', () => document.body.classList.add('window-blur'));
  window.addEventListener('focus', () => document.body.classList.remove('window-blur'));
  document.getElementById('content').addEventListener('scroll', (e) => e.target.classList.toggle('scrolled', e.target.scrollTop > 4));

  api.on('claude:log', (t) => { state.claude.log = (state.claude.log + t).slice(-4000); const el = document.querySelector('.acc-log'); if (el) el.textContent = state.claude.log.split('\n').slice(-6).join('\n'); });
  api.on('claude:login', (ev) => {
    const C = state.claude;
    if (ev.stage === 'url' || ev.stage === 'code') { C.login = { ...(C.login || {}), stage: ev.stage, url: ev.url || (C.login && C.login.url) }; render(); }
    if (ev.stage === 'done') { C.login = null; C.status = ev.status; toast('Połączono z kontem Claude', 'success'); render(); }
    if (ev.stage === 'error') { C.login = null; errToast(new Error(ev.error)); render(); }
  });

  Agent.getSettings = () => state.settings;
  Agent.getStudent = (id) => { const s = student(id); return s ? JSON.parse(JSON.stringify(s)) : null; };
  Agent.saveStudent = async (s) => { const saved = await api.saveStudent(s); upsertLocal(saved); return JSON.parse(JSON.stringify(saved)); };
  let pending = false;
  Agent.onChange = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; if (!isTyping()) render(); else renderSidebar(); }); };

  render();
  if (state.settings.ai.provider === 'claude-code' && !isMobile()) refreshClaude();
  // dokończ pracę agenta przerwaną zamknięciem aplikacji
  for (const s of state.students) if (s.agent && s.agent.status === 'running') Agent.enqueue(s.id);
}

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox')) && document.getElementById('content').contains(a);
}

function setMaxTitle(maximized) {
  const b = document.querySelector('#traffic .tl.max');
  if (b) b.title = maximized ? 'Przywróć' : 'Maksymalizuj';
}

async function loadState() {
  const r = await api.getState();
  state.settings = r.settings;
  state.students = r.students;
  state.hasApiKey = r.hasApiKey;
  state.claudePath = r.claudePath;
  state.outbox = r.outbox || [];
}

function upsertLocal(s) {
  const i = state.students.findIndex((x) => x.id === s.id);
  if (i >= 0) state.students[i] = s; else state.students.unshift(s);
}

async function saveSettings(patch, quiet) {
  try {
    state.settings = await api.setSettings(patch);
    if (!quiet) toast('Zapisano ustawienia', 'success', 1600);
  } catch (e) { errToast(e); }
}

async function saveDoc(id, type, d) {
  const copy = JSON.parse(JSON.stringify(d));
  try { await Agent.update(id, (x) => { x.documents = x.documents || {}; x.documents[type] = copy; }); } catch (e) { errToast(e); }
}

async function persist(s, quiet) {
  try { const saved = await api.saveStudent(s); upsertLocal(saved); if (!quiet) toast('Zapisano', 'success', 1400); return saved; } catch (e) { errToast(e); return s; }
}

function go(view, opts = {}) {
  state.view = view;
  if (opts.studentId !== undefined) state.studentId = opts.studentId;
  if (opts.docType !== undefined) state.docType = opts.docType;
  if (opts.tab) state.studentTab = opts.tab;
  render();
  document.getElementById('content').scrollTop = 0;
}

// ───────────────────────── pasek boczny ─────────────────────────
function agentSummary() {
  const c = Agent.current;
  if (c) {
    const s = student(c.studentId);
    return { cls: 'busy', t1: 'Agent pracuje…', t2: `${s ? fullName(s) : ''} · ${c.label}${c.total ? ` ${c.done}/${c.total}` : ''}` };
  }
  const p = state.settings.ai.provider;
  if (p === 'offline') return { cls: 'off', t1: 'Tryb bez AI', t2: 'Dokumenty z wbudowanej bazy wiedzy' };
  const st = state.claude.status;
  if (p === 'claude-code' && st && !st.loggedIn) return { cls: 'err', t1: 'Agent: brak połączenia', t2: 'Połącz z kontem Claude w Ustawieniach' };
  if (p === 'api' && !state.hasApiKey) return { cls: 'err', t1: 'Agent: brak klucza API', t2: 'Wklej klucz w Ustawieniach' };
  const q = Agent.queue.length;
  return { cls: '', t1: 'Agent gotowy', t2: q ? `W kolejce: ${q}` : providerLabel() };
}

function providerLabel() {
  return { 'claude-code': 'Claude (Twoje konto)', api: 'Claude (klucz API)', ollama: 'Lokalny model (Ollama)', offline: 'Bez AI' }[state.settings.ai.provider];
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  const docs = state.students.reduce((n, s) => n + Object.keys(s.documents || {}).length, 0);
  const items = [
    ['dashboard', 'home', 'Pulpit'],
    ['add', 'scan', 'Nowe orzeczenie'],
    ['students', 'people', 'Uczniowie', state.students.length || null],
    ['knowledge', 'book', 'Baza wiedzy'],
    ['privacy', 'shield', 'Prywatność']
  ];
  const ag = agentSummary();
  const active = (v) => state.view === v || (v === 'students' && (state.view === 'student' || state.view === 'doc'));
  sb.replaceChildren(
    h('div', { class: 'brand' },
      h('div', { class: 'brand-logo', html: icon('school', 20) }),
      h('div', null, h('div', { class: 'brand-name' }, 'Asystent IPET'), h('div', { class: 'brand-sub' }, `SOSW · ${docs} ${T.plural(docs, 'dokument', 'dokumenty', 'dokumentów')}`))),
    h('div', { class: 'nav-section' }, 'Praca'),
    ...items.map(([v, ic, label, badge]) => h('div', { class: 'nav-item' + (active(v) ? ' active' : ''), onclick: () => go(v) },
      h('span', { html: icon(ic, 17) }), h('span', { class: 'nav-label' }, label), badge ? h('span', { class: 'nav-badge' }, badge) : null)),
    h('div', { class: 'nav-section' }, 'Aplikacja'),
    h('div', { class: 'nav-item' + (state.view === 'settings' ? ' active' : ''), onclick: () => go('settings') }, h('span', { html: icon('gear', 17) }), h('span', { class: 'nav-label' }, 'Ustawienia')),
    h('div', { class: 'sidebar-spacer' }),
    h('div', { class: 'agent-pill', onclick: () => { if (Agent.current) go('student', { studentId: Agent.current.studentId, tab: 'docs' }); else go('settings', {}); } },
      h('span', { class: 'agent-dot ' + ag.cls }),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 't1' }, ag.t1), h('div', { class: 't2' }, ag.t2)))
  );
}

// ───────────────────────── render ─────────────────────────
function render() {
  renderSidebar();
  const c = document.getElementById('content');
  const views = { dashboard: viewDashboard, add: viewAdd, students: viewStudents, student: viewStudent, doc: viewDoc, knowledge: viewKnowledge, privacy: viewPrivacy, settings: viewSettings };
  if ((state.view === 'student' || state.view === 'doc') && !student()) state.view = 'students';
  const el = views[state.view]();
  el.classList.add('fade-in');
  const scroll = c.scrollTop;
  c.replaceChildren(el);
  if (state.keepScroll) { c.scrollTop = scroll; state.keepScroll = false; }
  const titles = { dashboard: 'Pulpit', add: 'Nowe orzeczenie', students: 'Uczniowie', student: student() ? fullName(student()) : 'Uczeń', doc: CAT.byId(state.docType) ? CAT.byId(state.docType).short : 'Dokument', knowledge: 'Baza wiedzy', privacy: 'Prywatność', settings: 'Ustawienia' };
  document.getElementById('window-title').textContent = titles[state.view] + ' — Asystent IPET';
}

function rerender() { state.keepScroll = true; render(); }

function toolbar(title, ...right) {
  return h('div', { class: 'toolbar' }, h('h1', null, title), h('div', { class: 'spacer' }), ...right);
}

function codeChips(codes) {
  return (codes || []).map((c) => h('span', { class: 'chip ' + chipColor(c) }, shortCode(c)));
}
function shortCode(c) {
  return { NI_LEKKI: 'NI lekka', NI_UMIARKOWANY: 'NI umiarkowana', NI_ZNACZNY: 'NI znaczna', NI_GLEBOKI: 'NI głęboka', AUTYZM: 'autyzm', ASPERGER: 'Asperger', DOWN: 'zespół Downa', SPRZEZONE: 'sprzężone', RUCHOWA: 'ruchowa', AFAZJA: 'afazja', SLABOWIDZACY: 'wzrok', SLABOSLYSZACY: 'słuch', EPILEPSJA: 'padaczka' }[c] || c;
}
function chipColor(c) {
  return /^NI_/.test(c) ? 'blue' : c === 'AUTYZM' || c === 'ASPERGER' ? 'purple' : c === 'DOWN' ? 'teal' : c === 'SPRZEZONE' ? 'orange' : c === 'EPILEPSJA' ? 'red' : 'green';
}

// ───────────────────────── PULPIT ─────────────────────────
function viewDashboard() {
  const total = state.students.length;
  const docs = state.students.reduce((n, s) => n + Object.keys(s.documents || {}).length, 0);
  const aiDocs = state.students.reduce((n, s) => n + Object.values(s.documents || {}).filter((d) => d.source === 'ai').length, 0);
  const sent = state.outbox.length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Dzień dobry' : hour < 18 ? 'Dzień dobry' : 'Dobry wieczór';
  const recent = state.students.slice(0, 6);
  return h('div', null,
    toolbar('Pulpit'),
    h('div', { class: 'page' },
      h('div', { class: 'hello' }, h('h1', null, `${hello}!`), h('p', { class: 'muted' }, 'Dodaj skan lub zdjęcie orzeczenia – agent odczyta je na tym urządzeniu i przygotuje komplet dokumentów do weryfikacji przez zespół.')),
      connectBanner(),
      dropzone(true),
      h('div', { class: 'grid grid-4', style: { marginTop: '18px' } },
        statCard('Uczniowie', total, '', 'people'),
        statCard('Dokumenty', docs, '', 'doc'),
        statCard('Opracowane z AI', aiDocs, '', 'sparkles'),
        statCard('Zapytania do AI', sent, 'zanonimizowane', 'shield')),
      h('div', { class: 'grid grid-2', style: { marginTop: '18px' } },
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, iconEl('people', 16), 'Ostatnio edytowani uczniowie', h('div', { class: 'spacer' }), total ? h('button', { class: 'btn plain sm', onclick: () => go('students') }, 'Wszyscy') : null),
          recent.length ? h('div', null, recent.map(studentRow)) : h('div', { class: 'empty' }, iconEl('scan', 28), h('p', null, 'Nie dodano jeszcze żadnego orzeczenia.'))),
        privacyCard()))
  );
}

function statCard(label, value, unit, ic) {
  return h('div', { class: 'card stat' }, h('div', { class: 'label' }, iconEl(ic, 14), label), h('div', { class: 'value' }, String(value), unit ? h('small', null, ' ' + unit) : null));
}

function privacyCard() {
  return h('div', { class: 'card privacy-card' },
    h('div', { class: 'card-title' }, iconEl('lock', 16), 'Dane uczniów zostają na tym urządzeniu'),
    h('ul', { class: 'checks' },
      h('li', null, iconEl('check', 14), 'Skany i zdjęcia orzeczeń odczytuje lokalny OCR – obrazy nigdy nie trafiają do internetu.'),
      h('li', null, iconEl('check', 14), 'Imiona, nazwiska, PESEL, adresy i daty są zamieniane na znaczniki, zanim cokolwiek trafi do AI.'),
      h('li', null, iconEl('check', 14), 'Strażnik prywatności blokuje każde zapytanie, w którym wykryje dane osobowe.'),
      h('li', null, iconEl('check', 14), 'Prawdziwe dane są wstawiane do dokumentów dopiero na tym urządzeniu.')),
    h('button', { class: 'btn sm', onclick: () => go('privacy') }, iconEl('eye', 14), 'Zobacz, co zostało wysłane'));
}

function connectBanner() {
  const p = state.settings.ai.provider;
  if (p === 'claude-code' && state.claude.status && !state.claude.status.loggedIn && !isMobile()) {
    return h('div', { class: 'connect-banner' }, iconEl('sparkles', 20), h('div', { style: { flex: 1 } }, h('b', null, 'Połącz aplikację z kontem Claude'), h('div', { class: 'muted small' }, 'Agent AI opracuje dokumenty indywidualnie i sprawdzi aktualną wiedzę w internecie. Bez połączenia powstaną wersje wzorcowe.')), h('button', { class: 'btn primary', onclick: () => { state.settingsTab = 'ai'; go('settings'); } }, 'Połącz'));
  }
  if ((p === 'api' || (isMobile() && p === 'claude-code')) && !state.hasApiKey) {
    return h('div', { class: 'connect-banner' }, iconEl('key', 20), h('div', { style: { flex: 1 } }, h('b', null, 'Dodaj klucz API Claude'), h('div', { class: 'muted small' }, 'Bez klucza dokumenty powstaną z wbudowanej bazy wiedzy.')), h('button', { class: 'btn primary', onclick: () => { state.settingsTab = 'ai'; go('settings'); } }, 'Ustawienia'));
  }
  return null;
}

function studentRow(s) {
  const st = Agent.status(s.id);
  const n = Object.keys(s.documents || {}).length;
  return h('div', { class: 'up-item clickable', onclick: () => go('student', { studentId: s.id, tab: 'docs' }) },
    h('div', { class: 'avatar' }, (s.personal.imie || '?')[0] + ((s.personal.nazwisko || '')[0] || '')),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { class: 'strong' }, fullName(s), s.personal.klasa ? h('span', { class: 'muted small' }, `  ·  klasa ${s.personal.klasa}`) : null),
      h('div', { class: 'chips' }, codeChips(s.codes))),
    st ? h('span', { class: 'chip blue' }, spinner(10), ' ', st.label) : h('span', { class: 'muted small' }, `${n} ${T.plural(n, 'dokument', 'dokumenty', 'dokumentów')}`),
    iconEl('chevronR', 14, 'muted'));
}

// ───────────────────────── NOWE ORZECZENIE ─────────────────────────
const fileInput = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, style: { display: 'none' } });
const cameraInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
document.body.append(fileInput, cameraInput);
fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
cameraInput.addEventListener('change', () => { addFiles([...cameraInput.files]); cameraInput.value = ''; });

function newAdd() { return { pages: [], stage: 'pick', progress: null, draft: null, manualAnon: false, rawBody: '' }; }

function dropzone(compact) {
  const dz = h('div', { class: 'dropzone' + (compact ? ' compact' : ''), onclick: () => fileInput.click() },
    h('div', { class: 'dz-ic', html: icon('scan', 30) }),
    h('h2', null, compact ? 'Dodaj orzeczenie' : 'Upuść tutaj skany lub zdjęcia orzeczenia'),
    h('p', { class: 'muted' }, 'JPG, PNG lub PDF – wszystkie strony orzeczenia. Odczyt odbywa się na tym urządzeniu.'),
    h('div', { class: 'dz-actions' },
      h('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); fileInput.click(); } }, iconEl('upload', 15), 'Wybierz pliki'),
      isMobile() ? h('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); cameraInput.click(); } }, iconEl('camera', 15), 'Zrób zdjęcie') : null));
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
  return dz;
}

async function addFiles(files) {
  if (!files.length) return;
  if (!state.add || state.add.stage !== 'pick') state.add = newAdd();
  state.view = 'add';
  state.add.loading = true; render();
  for (const f of files) {
    try {
      const pages = await OCR.fileToPages(f);
      pages.forEach((c, i) => state.add.pages.push({ canvas: c, name: pages.length > 1 ? `${f.name} – str. ${i + 1}` : f.name, thumb: OCR.toJpeg(c, 360, 0.8) }));
    } catch (e) { errToast(e); }
  }
  state.add.loading = false;
  render();
}

function viewAdd() {
  if (!state.add) state.add = newAdd();
  const A = state.add;
  if (A.stage === 'review') return viewReview();
  const thumbs = A.pages.length ? h('div', { class: 'thumbs' },
    A.pages.map((p, i) => h('div', { class: 'thumb' }, h('img', { src: p.thumb, alt: p.name }), h('span', { class: 'pg' }, String(i + 1)),
      A.stage === 'pick' ? h('button', { class: 'rm', title: 'Usuń', onclick: () => { A.pages.splice(i, 1); render(); }, html: icon('x', 12) }) : null)),
    A.stage === 'pick' ? h('div', { class: 'thumb add', onclick: () => fileInput.click() }, iconEl('plus', 22), h('span', { class: 'small muted' }, 'Dodaj stronę')) : null) : null;

  const ocrBox = A.stage === 'ocr' ? h('div', { class: 'card analyzing' },
    h('div', { class: 'acc-row' }, spinner(20), h('div', { style: { flex: 1 } },
      h('div', { class: 'strong' }, A.progress ? `Odczytuję stronę ${A.progress.page} z ${A.progress.total}…` : 'Przygotowuję lokalny OCR…'),
      h('div', { class: 'muted small' }, 'Rozpoznawanie tekstu (język polski) działa na tym urządzeniu – obrazy nie są nigdzie wysyłane.'),
      h('div', { class: 'progress', style: { marginTop: '8px' } }, h('div', { id: 'ocr-bar', style: { width: `${Math.round(((A.progress ? (A.progress.page - 1 + (A.progress.pct || 0)) / A.progress.total : 0)) * 100)}%` } }))))) : null;

  return h('div', null,
    toolbar('Nowe orzeczenie', A.pages.length && A.stage === 'pick' ? h('button', { class: 'btn', onclick: () => { state.add = newAdd(); render(); } }, 'Wyczyść') : null),
    h('div', { class: 'page' },
      A.pages.length ? null : dropzone(false),
      A.loading ? h('div', { class: 'muted', style: { margin: '12px 0' } }, spinner(14), ' Wczytuję pliki…') : null,
      thumbs,
      ocrBox,
      A.pages.length && A.stage === 'pick' ? h('div', { class: 'action-bar' },
        h('div', { class: 'muted small', style: { flex: 1 } }, iconEl('lock', 13), ` ${A.pages.length} ${T.plural(A.pages.length, 'strona', 'strony', 'stron')} · odczyt lokalny, bez internetu`),
        h('button', { class: 'btn primary lg', onclick: runOcr }, iconEl('scan', 16), 'Odczytaj orzeczenie')) : null,
      A.pages.length ? null : h('div', { class: 'grid grid-3', style: { marginTop: '18px' } },
        stepCard('1', 'scan', 'Odczyt lokalny', 'OCR rozpoznaje tekst orzeczenia i dane ucznia na tym urządzeniu.'),
        stepCard('2', 'shield', 'Weryfikacja i anonimizacja', 'Sprawdzasz odczytane dane; dane osobowe są usuwane z treści dla AI.'),
        stepCard('3', 'sparkles', 'Komplet dokumentów', 'Agent proponuje i opracowuje IPET, WOPFU, oceny funkcjonalne i programy.')))
  );
}

function stepCard(n, ic, title, text) {
  return h('div', { class: 'card step-card' }, h('div', { class: 'step-n' }, n), h('div', { class: 'step-ic', html: icon(ic, 22) }), h('h3', null, title), h('p', { class: 'muted small' }, text));
}

async function runOcr() {
  const A = state.add;
  A.stage = 'ocr'; A.progress = null; render();
  const texts = [];
  try {
    for (let i = 0; i < A.pages.length; i++) {
      A.progress = { page: i + 1, total: A.pages.length, pct: 0 }; render();
      const r = await OCR.recognize(A.pages[i].canvas, (p) => {
        A.progress.pct = p;
        const bar = document.getElementById('ocr-bar');
        if (bar) bar.style.width = `${Math.round(((i + p) / A.pages.length) * 100)}%`;
      });
      texts.push(r.text);
    }
  } catch (e) { A.stage = 'pick'; errToast(new Error('OCR nie powiódł się: ' + (e.message || e))); render(); return; }
  const full = texts.join('\n\n');
  const parsed = ORZ.parse(full);
  const draft = {
    id: uid(),
    personal: { ...parsed.personal, zdrobnienie: '' },
    confidence: parsed.confidence,
    codes: parsed.niepelnosprawnosci,
    etap: parsed.personal.etap,
    etapLabel: parsed.personal.etapLabel,
    ocrText: full,
    sections: parsed.sections,
    documents: {},
    scans: []
  };
  A.rawBody = parsed.body || full;
  A.draft = draft;
  A.stage = 'review';
  recomputeAnon();
  render();
}

function recomputeAnon() {
  const A = state.add;
  const src = A.manualAnon ? A.draft.anonText : A.rawBody;
  const r = PRIV.pseudonymize(src, A.draft, teamSecrets());
  A.draft.anonText = r.text;
  A.hits = A.manualAnon ? (A.hits || []).concat(r.hits) : r.hits;
}

function teamSecrets() {
  const out = [];
  for (const m of state.settings.team || []) if (m && m.name) for (const t of m.name.split(/\s+/)) if (t.length >= 3) out.push({ value: t, ph: 'OSOBA', kind: 'name' });
  return out;
}

const PERSONAL_FIELDS = [
  ['imie', 'Imię (imiona)'], ['nazwisko', 'Nazwisko'], ['zdrobnienie', 'Zdrobnienie używane w opisie', 'np. Kuba – też zostanie ukryte'],
  ['pesel', 'PESEL'], ['dataUrodzenia', 'Data urodzenia', '', 'date'], ['miejsceUrodzenia', 'Miejsce urodzenia'],
  ['rodzice', 'Rodzice / opiekunowie prawni'], ['adres', 'Adres zamieszkania'], ['szkola', 'Szkoła / placówka'], ['klasa', 'Klasa'],
  ['nrOrzeczenia', 'Nr orzeczenia'], ['dataOrzeczenia', 'Data wydania orzeczenia', '', 'date'], ['poradnia', 'Poradnia'], ['okres', 'Orzeczenie wydano na okres'], ['wychowawca', 'Wychowawca']
];

function personalForm(s, onChange) {
  const conf = s.confidence || {};
  const peselOk = s.personal.pesel ? T.peselValid(s.personal.pesel) : null;
  return h('div', { class: 'form-grid' },
    PERSONAL_FIELDS.map(([k, label, ph, type]) => h('div', { class: 'field' + (k === 'szkola' || k === 'poradnia' || k === 'adres' || k === 'rodzice' ? ' wide' : '') },
      h('label', null, label,
        k === 'pesel' && peselOk != null ? h('span', { class: 'chip ' + (peselOk ? 'green' : 'red') }, peselOk ? 'poprawny' : 'błędna suma kontrolna') : null,
        conf[k] && k !== 'pesel' && /niska|sprawdź|niezgodna/.test(conf[k]) ? h('span', { class: 'chip orange' }, conf[k]) : null,
        !s.personal[k] && ['imie', 'nazwisko', 'klasa'].includes(k) ? h('span', { class: 'chip orange' }, 'nie odczytano') : null),
      h('input', { class: 'input full', type: type || 'text', value: s.personal[k] || '', placeholder: ph || '', onchange: (e) => { s.personal[k] = e.target.value.trim(); if (k === 'pesel' && T.peselValid(s.personal.pesel)) { const d = T.peselDecode(s.personal.pesel); s.personal.plec = d.sex; if (!s.personal.dataUrodzenia) s.personal.dataUrodzenia = d.birthDate; } onChange(k); } }))),
    h('div', { class: 'field' }, h('label', null, 'Płeć (do odmiany w dokumentach)'), segmented([{ value: 'M', label: 'Chłopiec' }, { value: 'K', label: 'Dziewczynka' }], s.personal.plec || 'M', (v) => { s.personal.plec = v; onChange('plec'); })));
}

function codesEditor(s, onChange) {
  const all = Object.keys(ORZ.DISABILITIES);
  return h('div', { class: 'chips toggles' }, all.map((c) => h('button', {
    class: 'chip-toggle' + ((s.codes || []).includes(c) ? ' on ' + chipColor(c) : ''),
    onclick: () => { s.codes = (s.codes || []).includes(c) ? s.codes.filter((x) => x !== c) : [...(s.codes || []), c]; s.codesLocked = true; onChange(); }
  }, ORZ.DISABILITIES[c])));
}

function stageSelect(s, onChange) {
  const opts = [
    { value: '', label: '— wybierz —' }, { value: 'PRZ', label: 'Wychowanie przedszkolne' }, { value: 'SP1', label: 'Szkoła podstawowa – I etap (kl. I–III)' },
    { value: 'SP2', label: 'Szkoła podstawowa – II etap (kl. IV–VIII)' }, { value: 'SPdP', label: 'Szkoła przysposabiająca do pracy' }, { value: 'BS', label: 'Branżowa szkoła I stopnia' }, { value: 'PONAD', label: 'Inna szkoła ponadpodstawowa' }
  ];
  return select(opts, s.etap || '', (v) => { s.etap = v; s.etapLabel = (opts.find((o) => o.value === v) || {}).label || ''; onChange(); });
}

function guardStatus(text, s) {
  const leaks = PRIV.findLeaks(text, [...PRIV.secretsFor(s, teamSecrets())]);
  return leaks.length
    ? h('div', { class: 'status-line bad' }, iconEl('warn', 14), `Strażnik: wykryto dane osobowe (${leaks.map((l) => l.kind).join(', ')}) – zostaną zablokowane. Popraw dane ucznia albo usuń je z tekstu.`)
    : h('div', { class: 'status-line ok' }, iconEl('shield', 14), 'Strażnik: w treści dla AI nie ma danych osobowych ucznia.');
}

function viewReview() {
  const A = state.add;
  const s = A.draft;
  const props = CAT.proposals(Agent.ctx(s));
  const anonArea = h('textarea', { class: 'input full mono-sm', rows: 16, value: s.anonText, oninput: (e) => { s.anonText = e.target.value; A.manualAnon = true; const g = document.getElementById('guard-line'); if (g) g.replaceChildren(guardStatus(s.anonText, s)); } });
  const refresh = () => { recomputeAnon(); rerender(); };
  const hidden = (A.hits || []).length;
  return h('div', null,
    toolbar('Sprawdź odczytane dane',
      h('button', { class: 'btn', onclick: () => { A.stage = 'pick'; render(); } }, iconEl('chevronL', 13), 'Wróć'),
      h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, () => saveNewStudent(false), 'Zapisuję…') }, 'Zapisz bez AI'),
      h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, () => saveNewStudent(true), 'Zapisuję…') }, iconEl('sparkles', 14), 'Zapisz i uruchom agenta')),
    h('div', { class: 'page review' },
      h('div', { class: 'review-grid' },
        h('div', null,
          h('div', { class: 'card' },
            h('div', { class: 'card-title' }, iconEl('person', 16), 'Dane ucznia', h('div', { class: 'spacer' }), h('span', { class: 'chip green' }, iconEl('lock', 11), ' tylko na tym urządzeniu')),
            h('p', { class: 'muted small' }, 'Odczytane automatycznie z orzeczenia. Popraw błędy OCR – te dane trafią do nagłówków dokumentów i posłużą do anonimizacji.'),
            personalForm(s, refresh)),
          h('div', { class: 'card' },
            h('div', { class: 'card-title' }, iconEl('flag', 16), 'Rodzaj niepełnosprawności i etap'),
            codesEditor(s, rerender),
            h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', null, 'Etap edukacyjny'), stageSelect(s, rerender))),
          h('div', { class: 'card' },
            h('div', { class: 'card-title' }, iconEl('doc', 16), `Dokumenty możliwe do wygenerowania (${props.length})`),
            h('div', { class: 'prop-list' }, props.map((p) => h('div', { class: 'prop' }, h('span', { class: 'prop-ic', style: { background: p.color }, html: icon(p.icon, 13) }), h('div', null, h('div', { class: 'strong small' }, p.short, p.auto ? null : h('span', { class: 'chip' }, 'opcjonalny')), h('div', { class: 'muted xsmall' }, p.reason))))))),
        h('div', null,
          h('div', { class: 'card sticky' },
            h('div', { class: 'card-title' }, iconEl('shield', 16), 'Treść dla agenta AI (zanonimizowana)'),
            h('p', { class: 'muted small' }, `Tylko ten tekst może trafić do AI. Ukryto ${hidden} ${T.plural(hidden, 'fragment', 'fragmenty', 'fragmentów')} z danymi osobowymi. Możesz go edytować – np. usunąć wzmianki o innych osobach.`),
            anonArea,
            h('div', { id: 'guard-line', style: { marginTop: '8px' } }, guardStatus(s.anonText, s)),
            h('details', { class: 'raw' }, h('summary', null, 'Pełny tekst z OCR (zostaje na urządzeniu)'), h('pre', { class: 'mono-sm' }, s.ocrText))))))
  );
}

async function saveNewStudent(runAgent) {
  const A = state.add;
  const s = A.draft;
  if (!s.personal.nazwisko && !s.personal.imie) { toast('Uzupełnij imię i nazwisko ucznia.', 'error'); return; }
  const leaks = PRIV.findLeaks(s.anonText, PRIV.secretsFor(s, teamSecrets()));
  if (leaks.length && runAgent) { toast('Treść dla AI nadal zawiera dane osobowe – popraw ją przed uruchomieniem agenta.', 'error', 7000); return; }
  for (const p of A.pages) {
    try { s.scans.push(await api.saveScan(s.id, p.name, OCR.toJpeg(p.canvas, 1800, 0.85).split(',')[1])); } catch (e) { console.error(e); }
  }
  s.scanThumbs = A.pages.map((p) => p.thumb);
  delete s.confidence;
  Agent.ensureDrafts(s);
  const saved = await persist(s, true);
  state.add = null;
  toast(runAgent && state.settings.ai.provider !== 'offline' ? 'Zapisano. Agent opracowuje dokumenty w tle.' : 'Zapisano. Utworzono wersje wzorcowe dokumentów.', 'success', 4500);
  if (runAgent) Agent.enqueue(saved.id);
  go('student', { studentId: saved.id, tab: 'docs' });
}

// ───────────────────────── UCZNIOWIE ─────────────────────────
function viewStudents() {
  const q = T.norm(state.search);
  const list = state.students.filter((s) => !q || T.norm(fullName(s) + ' ' + (s.personal.klasa || '')).includes(q));
  const search = h('input', { class: 'input', placeholder: 'Szukaj ucznia…', value: state.search, style: { width: '220px' }, oninput: (e) => { state.search = e.target.value; const pos = e.target.selectionStart; render(); const el = document.querySelector('.toolbar input'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } } });
  return h('div', null,
    toolbar('Uczniowie', search, h('button', { class: 'btn primary', onclick: () => { state.add = newAdd(); go('add'); } }, iconEl('plus', 14), 'Nowe orzeczenie')),
    h('div', { class: 'page' },
      list.length ? h('div', { class: 'card list-card' }, list.map(studentRow))
        : h('div', { class: 'empty card' }, iconEl('people', 30), h('p', null, state.students.length ? 'Brak wyników.' : 'Dodaj pierwsze orzeczenie, aby utworzyć ucznia.'))));
}

// ───────────────────────── UCZEŃ ─────────────────────────
function viewStudent() {
  const s = student();
  const tabs = [
    { value: 'docs', label: 'Dokumenty', icon: 'doc' },
    { value: 'data', label: 'Orzeczenie i dane', icon: 'person' },
    { value: 'analysis', label: 'Analiza AI', icon: 'sparkles' },
    { value: 'research', label: 'Wiedza i źródła', icon: 'globe' }
  ];
  const body = { docs: studentDocs, data: studentData, analysis: studentAnalysis, research: studentResearch }[state.studentTab](s);
  return h('div', null,
    toolbar(fullName(s),
      h('button', { class: 'btn', onclick: () => go('students') }, iconEl('chevronL', 13), 'Uczniowie'),
      h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, () => exportAll(s), 'Eksportuję…') }, iconEl('download', 14), 'Eksportuj wszystkie'),
      h('button', { class: 'btn primary', disabled: Agent.status(s.id) ? true : null, onclick: () => runAgentFor(s) }, iconEl('sparkles', 14), 'Uruchom agenta')),
    h('div', { class: 'page' },
      h('div', { class: 'student-head' },
        h('div', { class: 'avatar lg' }, (s.personal.imie || '?')[0] + (s.personal.nazwisko || ' ')[0]),
        h('div', { style: { flex: 1 } },
          h('div', { class: 'muted small' }, [s.personal.klasa ? `klasa ${s.personal.klasa}` : null, s.etapLabel, s.personal.dataUrodzenia ? `ur. ${T.formatDate(s.personal.dataUrodzenia)}` : null].filter(Boolean).join(' · ')),
          h('div', { class: 'chips', style: { marginTop: '6px' } }, codeChips(s.codes)))),
      agentBanner(s),
      h('div', { class: 'settings-tabs' }, segmented(tabs, state.studentTab, (v) => { state.studentTab = v; render(); })),
      body));
}

function agentBanner(s) {
  const st = Agent.status(s.id);
  if (st) {
    return h('div', { class: 'progress-banner' }, spinner(16), h('div', { style: { flex: 1 } }, h('b', null, st.label), st.total ? h('div', { class: 'progress', style: { marginTop: '6px' } }, h('div', { style: { width: `${Math.round((st.done / st.total) * 100)}%` } })) : null),
      st.total ? h('span', { class: 'muted small' }, `${st.done}/${st.total}`) : null);
  }
  if (s.agent && s.agent.status === 'error' && (s.agent.errors || []).length) {
    return h('div', { class: 'alert warn' }, h('span', { class: 'a-ic', html: icon('warn', 16) }), h('div', { class: 'a-text' }, h('b', null, 'Agent nie wykonał części zadań'), h('div', { class: 'small' }, s.agent.errors.slice(0, 4).join(' · '))), h('button', { class: 'btn sm a-act', onclick: () => runAgentFor(s) }, 'Ponów'));
  }
  return null;
}

function runAgentFor(s, opts) {
  if (state.settings.ai.provider === 'offline') { toast('Wybrano tryb bez AI – zmień go w Ustawieniach → AI.', 'info', 5000); return; }
  Agent.enqueue(s.id, opts || {});
  toast('Agent rozpoczął pracę w tle.', 'info', 2500);
}

function studentDocs(s) {
  const props = Agent.proposals(s);
  const busyDocs = Agent.busyDocs(s.id);
  const extra = Object.keys(s.documents || {}).filter((id) => !props.find((p) => p.id === id)).map((id) => ({ ...CAT.byId(id), auto: false, reason: '' }));
  const all = [...props, ...extra];
  return h('div', { class: 'doc-grid' }, all.map((p) => {
    const d = (s.documents || {})[p.id];
    const b = busyDocs[p.id];
    const status = b === 'running' ? h('span', { class: 'chip blue' }, spinner(9), ' opracowuję') : b === 'queued' ? h('span', { class: 'chip' }, 'w kolejce')
      : !d ? h('span', { class: 'chip' }, p.auto ? 'do utworzenia' : 'opcjonalny')
        : d.source === 'ai' ? h('span', { class: 'chip green' }, iconEl('sparkles', 10), ' opracowany z AI') : h('span', { class: 'chip orange' }, 'wersja wzorcowa');
    return h('div', { class: 'card doc-card' + (d ? ' clickable' : ''), onclick: d ? () => go('doc', { docType: p.id }) : null },
      h('div', { class: 'doc-card-head' }, h('span', { class: 'prop-ic', style: { background: p.color }, html: icon(p.icon, 15) }), status),
      h('h3', null, p.short),
      h('p', { class: 'muted xsmall' }, p.title),
      p.reason ? h('p', { class: 'small doc-reason' }, p.reason) : null,
      h('div', { class: 'doc-card-foot' },
        d ? h('span', { class: 'muted xsmall' }, (d.edited ? 'edytowano ' : 'utworzono ') + fmtDateTime(d.updatedAt)) : h('span'),
        h('div', { class: 'spacer' }),
        !d ? h('button', { class: 'btn sm', onclick: async (e) => { e.stopPropagation(); await Agent.update(s.id, (x) => { Agent.ensureDrafts(x, [p.id]); }); if (!CAT.byId(p.id).noAi && state.settings.ai.provider !== 'offline') Agent.enqueue(s.id, { docs: [p.id] }); render(); } }, iconEl('plus', 12), 'Utwórz')
          : h('button', { class: 'btn sm', onclick: (e) => { e.stopPropagation(); exportDoc(s, p.id); } }, iconEl('download', 12), 'DOCX')));
  }));
}

function studentData(s) {
  const copy = JSON.parse(JSON.stringify(s));
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    const anonText = PRIV.pseudonymize(copy.anonText, copy, teamSecrets()).text;
    await Agent.update(s.id, (x) => { x.personal = copy.personal; x.etap = copy.etap; x.etapLabel = copy.etapLabel; x.anonText = anonText; });
    toast('Zapisano. Dane w nagłówkach dokumentów zaktualizujesz przyciskiem „Odśwież dane” w dokumencie.', 'success', 5000); render();
  } }, 'Zapisz zmiany');
  const thumbs = h('div', { class: 'thumbs' }, (s.scans || []).map((sc, i) => {
    const img = h('img', { src: (s.scanThumbs || [])[i] || '', alt: sc.name });
    return h('div', { class: 'thumb clickable', onclick: async () => { try { const src = await api.readScan(s.id, sc.id); sheet({ title: sc.name, wide: true, body: h('img', { src, style: { width: '100%' } }) }); } catch (e) { errToast(e); } } }, img, h('span', { class: 'pg' }, String(i + 1)));
  }));
  return h('div', { class: 'review-grid' },
    h('div', null,
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('person', 16), 'Dane ucznia', h('div', { class: 'spacer' }), saveBtn), personalForm(copy, () => {})),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('flag', 16), 'Niepełnosprawność i etap'), codesEditor(copy, () => { const el = document.activeElement; rerenderCodes(copy); if (el) el.blur(); }), h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', null, 'Etap edukacyjny'), stageSelect(copy, () => {}))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('photo', 16), 'Skany orzeczenia'), (s.scans || []).length ? thumbs : h('p', { class: 'muted small' }, 'Brak zapisanych skanów.'),
        h('div', { style: { marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn sm danger', onclick: () => confirmDelete(s) }, iconEl('trash', 12), 'Usuń ucznia i jego dane')))),
    h('div', null,
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('shield', 16), 'Treść orzeczenia dla AI (zanonimizowana)'),
        h('textarea', { class: 'input full mono-sm', rows: 18, value: copy.anonText || '', oninput: (e) => { copy.anonText = e.target.value; } }),
        h('div', { style: { marginTop: '8px' } }, guardStatus(copy.anonText, copy)),
        h('details', { class: 'raw' }, h('summary', null, 'Pełny tekst z OCR (zostaje na urządzeniu)'), h('pre', { class: 'mono-sm' }, s.ocrText || '')))));
  function rerenderCodes(c) { Agent.update(s.id, (x) => { x.codes = c.codes; x.codesLocked = true; }).then(rerender); }
}

function confirmDelete(s) {
  sheet({
    title: 'Usunąć ucznia?', subtitle: fullName(s),
    body: h('p', null, 'Zostaną trwale usunięte: dane osobowe, skany orzeczenia i wszystkie dokumenty tego ucznia z tego urządzenia.'),
    actions: [{ label: 'Anuluj' }, { label: 'Usuń', kind: 'danger', onClick: async () => { await api.deleteStudent(s.id); state.students = state.students.filter((x) => x.id !== s.id); toast('Usunięto dane ucznia', 'success'); go('students'); } }]
  });
}

function bullets(list) { return list && list.length ? h('ul', { class: 'bullets' }, list.map((x) => h('li', null, x))) : h('p', { class: 'muted small' }, 'Brak danych.'); }

function studentAnalysis(s) {
  const p = s.profile;
  if (!p) {
    return h('div', { class: 'card empty' }, iconEl('sparkles', 28), h('p', null, 'Agent nie przeanalizował jeszcze orzeczenia.'),
      h('button', { class: 'btn primary', onclick: () => runAgentFor(s, { reanalyze: true }) }, 'Analizuj teraz'));
  }
  return h('div', null,
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('sparkles', 16), 'Podsumowanie', h('div', { class: 'spacer' }), h('span', { class: 'muted xsmall' }, fmtDateTime(p.at)), h('button', { class: 'btn sm', onclick: () => runAgentFor(s, { reanalyze: true }) }, iconEl('refresh', 12), 'Analizuj ponownie')),
      h('p', null, PRIV.fill(p.podsumowanie, s))),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('checkCircle', 16), 'Mocne strony'), bullets(p.mocneStrony)),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('warn', 16), 'Trudności'), bullets(p.trudnosci)),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('target', 16), 'Potrzeby'), bullets(p.potrzeby)),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('list', 16), 'Zalecenia poradni'), bullets(p.zaleceniaPoradni))),
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('grid', 16), 'Funkcjonowanie w obszarach ICF'),
      h('table', { class: 'tbl' }, h('tbody', null, KB.ICF.map((a) => h('tr', null, h('td', { class: 'strong', style: { width: '32%' } }, `${a.k.toUpperCase()}. ${a.nazwa}`), h('td', null, PRIV.fill(p.obszary[a.k] || '—', s))))))),
    p.uwagi && p.uwagi.length ? h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('info', 16), 'Do sprawdzenia przez zespół'), bullets(p.uwagi)) : null);
}

function studentResearch(s) {
  const r = s.research;
  if (!r) {
    return h('div', { class: 'card empty' }, iconEl('globe', 28), h('p', null, 'Agent nie zebrał jeszcze wiedzy z internetu dla tego profilu ucznia.'),
      h('p', { class: 'muted small' }, 'Do wyszukiwarki trafia wyłącznie ogólny opis (rodzaj niepełnosprawności, etap edukacyjny) – nigdy dane ucznia.'),
      state.settings.ai.useWebSearch ? h('button', { class: 'btn primary', onclick: () => runAgentFor(s, { research: true }) }, 'Wyszukaj teraz') : h('p', { class: 'muted small' }, 'Wyszukiwanie w internecie jest wyłączone w Ustawieniach → AI.'));
  }
  return h('div', null,
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('globe', 16), 'Wskazówki do dokumentów', h('div', { class: 'spacer' }), h('span', { class: 'muted xsmall' }, fmtDateTime(r.at)), h('button', { class: 'btn sm', onclick: () => runAgentFor(s, { research: true }) }, iconEl('refresh', 12), 'Odśwież')), bullets(r.wskazowki)),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('book', 16), 'Przepisy'), bullets(r.przepisy.map((x) => `${x.akt} – ${x.co}`))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('wand', 16), 'Metody pracy'), bullets(r.metody.map((x) => `${x.nazwa}: ${x.opis}`)))),
    h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('globe', 16), 'Źródła'),
      r.zrodla.length ? h('div', null, r.zrodla.map((z) => h('div', { class: 'up-item clickable', onclick: () => api.openExternal(z.url) }, iconEl('globe', 14), h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'strong small' }, z.tytul), h('div', { class: 'muted xsmall ellipsis' }, z.url), z.wniosek ? h('div', { class: 'small' }, z.wniosek) : null)))) : h('p', { class: 'muted small' }, 'Brak źródeł.')));
}

// ───────────────────────── DOKUMENT ─────────────────────────
const saveTimers = {};
function viewDoc() {
  const s = student();
  const t = CAT.byId(state.docType);
  const d = s.documents[state.docType];
  if (!d) { state.view = 'student'; return viewStudent(); }
  const b = Agent.busyDocs(s.id)[t.id];
  const scheduleSave = () => {
    d.edited = true; d.updatedAt = new Date().toISOString();
    clearTimeout(saveTimers[s.id]);
    saveTimers[s.id] = setTimeout(() => saveDoc(s.id, t.id, d), 700);
  };
  const sections = d.sections.map((sec, i) => {
    const ta = h('textarea', { class: 'input full doc-text', value: sec.content, oninput: (e) => { sec.content = e.target.value; autoGrow(e.target); scheduleSave(); } });
    requestAnimationFrame(() => autoGrow(ta));
    return h('div', { class: 'card doc-section' },
      h('div', { class: 'doc-section-head' }, h('h3', null, sec.title), h('div', { class: 'spacer' }),
        sec.local ? h('span', { class: 'chip green', title: 'Ta część jest uzupełniana lokalnie danymi ucznia i nie trafia do AI' }, iconEl('lock', 10), ' lokalnie') : null,
        !sec.local && !t.noAi && state.settings.ai.provider !== 'offline' ? h('button', { class: 'btn plain sm', onclick: () => refineDialog(s, d, i) }, iconEl('wand', 12), 'Popraw z AI') : null),
      ta);
  });
  return h('div', null,
    toolbar(t.short,
      h('button', { class: 'btn', onclick: () => go('student', { tab: 'docs' }) }, iconEl('chevronL', 13), fullName(s)),
      h('button', { class: 'btn', title: 'Wstaw ponownie aktualne dane ucznia i zespołu do części lokalnych', onclick: async () => { for (const sec of d.sections) if (sec.local) sec.content = PRIV.fill(CAT.localSection(t.id, sec.key, Agent.ctx(s)), s, Agent.fillCtx()); await saveDoc(s.id, t.id, d); toast('Wstawiono aktualne dane', 'success', 1500); render(); } }, iconEl('refresh', 13), 'Odśwież dane'),
      !t.noAi && state.settings.ai.provider !== 'offline' ? h('button', { class: 'btn', disabled: b ? true : null, onclick: () => regenerateDoc(s, t.id) }, b ? spinner(12) : iconEl('sparkles', 13), b ? 'Opracowuję…' : 'Opracuj z AI') : null,
      h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, () => exportDoc(s, t.id), 'Eksportuję…') }, iconEl('download', 14), 'Eksportuj DOCX')),
    h('div', { class: 'page doc-page' },
      h('div', { class: 'doc-title' }, h('h2', null, t.title), h('div', { class: 'muted small' }, d.source === 'ai' ? 'Opracowano z pomocą AI – zweryfikuj i uzupełnij obserwacjami zespołu.' : 'Wersja wzorcowa z wbudowanej bazy wiedzy – uzupełnij lub opracuj z AI.')),
      ...sections));
}

function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(90, ta.scrollHeight + 4) + 'px'; }

function regenerateDoc(s, id) {
  const d = s.documents[id];
  const go2 = () => { Agent.enqueue(s.id, { docs: [id] }); toast('Agent opracowuje dokument w tle.', 'info'); };
  if (d && d.edited) {
    sheet({ title: 'Opracować dokument od nowa?', body: h('p', null, 'Ręczne zmiany w tym dokumencie zostaną zastąpione nową wersją przygotowaną przez AI.'), actions: [{ label: 'Anuluj' }, { label: 'Opracuj od nowa', kind: 'primary', onClick: go2 }] });
  } else go2();
}

function refineDialog(s, d, i) {
  const sec = d.sections[i];
  const custom = h('input', { class: 'input full', placeholder: 'Własne polecenie, np. „dodaj cele z zakresu samoobsługi”' });
  const presets = ['Rozwiń i uszczegółów', 'Uprość język', 'Skróć', 'Sformułuj cele operacyjne (SMART)', 'Dodaj konkretne metody i pomoce', 'Dopasuj do zaleceń z orzeczenia'];
  let chosen = presets[0];
  const seg = h('div', { class: 'chips toggles' }, presets.map((p) => h('button', { class: 'chip-toggle' + (p === chosen ? ' on blue' : ''), onclick: (e) => { chosen = p; seg.querySelectorAll('button').forEach((x) => x.className = 'chip-toggle'); e.currentTarget.className = 'chip-toggle on blue'; } }, p)));
  sheet({
    title: 'Popraw z AI', subtitle: sec.title,
    body: h('div', null, seg, h('div', { class: 'field', style: { marginTop: '10px' } }, custom), h('p', { class: 'muted xsmall' }, 'Przed wysłaniem treść sekcji zostanie zanonimizowana i sprawdzona przez strażnika prywatności.')),
    actions: [{ label: 'Anuluj' }, {
      label: 'Popraw', kind: 'primary', onClick: async () => {
        const instruction = custom.value.trim() || chosen;
        const anon = PRIV.pseudonymize(sec.content, s, teamSecrets()).text;
        toast('AI poprawia sekcję…', 'info', 2500);
        try {
          const req = IPET.prompts.refine(d.type, sec.title, anon, instruction, Agent.ctx(s));
          const r = await api.aiRun({ ...req, studentId: s.id });
          const j = IPET.prompts.extractJson(r.text);
          if (!j.tresc) throw new Error('Model nie zwrócił treści.');
          sec.content = PRIV.fill(String(j.tresc), s, Agent.fillCtx());
          d.edited = true; d.updatedAt = new Date().toISOString();
          await saveDoc(s.id, d.type, d);
          toast('Sekcja poprawiona', 'success');
          if (state.view === 'doc') rerender();
        } catch (e) { errToast(e); }
      }
    }]
  });
}

function docFileName(s, id) {
  return `${s.personal.nazwisko || 'Uczeń'} ${s.personal.imie || ''} - ${CAT.byId(id).short}.docx`.replace(/\s+/g, ' ');
}

async function buildDoc(s, id) {
  const d = s.documents[id];
  return DocxExport.build({ title: d.title, school: state.settings.school.nazwa || s.personal.szkola || '', sections: d.sections });
}

async function exportDoc(s, id) {
  try {
    const base64 = await buildDoc(s, id);
    const r = await api.saveFile({ name: docFileName(s, id), base64 });
    if (r && r.path && !isMobile()) toast(h('span', null, 'Zapisano: ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); api.openFile(r.path); } }, r.path.split(/[\\/]/).pop())), 'success', 6000);
  } catch (e) { errToast(e); }
}

async function exportAll(s) {
  const ids = Object.keys(s.documents || {});
  if (!ids.length) { toast('Brak dokumentów do eksportu.', 'info'); return; }
  try {
    const files = [];
    for (const id of ids) files.push({ name: docFileName(s, id), base64: await buildDoc(s, id) });
    const r = await api.saveFiles({ folder: `${s.personal.nazwisko || 'Uczeń'} ${s.personal.imie || ''} - dokumenty`.trim(), files });
    if (r) toast(`Zapisano ${r.count} ${T.plural(r.count, 'dokument', 'dokumenty', 'dokumentów')}`, 'success', 5000);
    if (r && r.path && !isMobile()) api.showFile(r.path);
  } catch (e) { errToast(e); }
}

// ───────────────────────── BAZA WIEDZY ─────────────────────────
function viewKnowledge() {
  const c = KB.CONDITIONS[state.kbCode];
  const codes = Object.keys(KB.CONDITIONS).filter((k) => k !== 'AFAZJA');
  return h('div', null,
    toolbar('Baza wiedzy'),
    h('div', { class: 'page' },
      h('p', { class: 'muted' }, 'Wbudowana wiedza, z której korzysta agent (także bez internetu). Przy każdym uczniu agent dodatkowo wyszukuje aktualne informacje w sieci – zobacz zakładkę „Wiedza i źródła” u ucznia.'),
      h('div', { class: 'chips toggles', style: { margin: '12px 0' } }, codes.map((k) => h('button', { class: 'chip-toggle' + (k === state.kbCode ? ' on ' + chipColor(k) : ''), onclick: () => { state.kbCode = k; rerender(); } }, KB.CONDITIONS[k].nazwa))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('info', 16), c.nazwa), h('p', null, c.opis)),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('wand', 16), 'Metody pracy'), bullets(c.metody)),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('target', 16), 'Dostosowanie wymagań'), bullets(c.wymagania)),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('home', 16), 'Dostosowanie warunków'), bullets(c.warunki)),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('list', 16), 'Zajęcia rewalidacyjne i specjalistyczne'), bullets(c.zajecia))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('grid', 16), '9 obszarów funkcjonowania (ICF) – Szkolna Ocena Funkcjonalna'),
        h('table', { class: 'tbl' }, h('tbody', null, KB.ICF.map((a) => h('tr', null, h('td', { class: 'strong', style: { width: '34%' } }, `${a.k.toUpperCase()}. ${a.nazwa}`), h('td', { class: 'muted' }, a.opis)))))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('book', 16), 'Podstawy prawne (stan: listopad 2026)'),
        bullets([KB.LAW.warunki, KB.LAW.ppp, KB.LAW.orzeczenia, KB.LAW.podstawaSP, KB.LAW.podstawaUZ, KB.LAW.podstawaSPdP, ...KB.LAW.terminy]))));
}

// ───────────────────────── PRYWATNOŚĆ ─────────────────────────
function viewPrivacy() {
  const test = h('textarea', { class: 'input full', rows: 4, placeholder: 'Wklej dowolny tekst, aby sprawdzić, czy strażnik wykryje w nim dane osobowe Twoich uczniów…' });
  const out = h('div', { style: { marginTop: '8px' } });
  return h('div', null,
    toolbar('Prywatność'),
    h('div', { class: 'page' },
      h('div', { class: 'grid grid-2' },
        privacyCard(),
        h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('shield', 16), 'Jak działa ochrona danych'),
          h('ol', { class: 'steps-list' },
            h('li', null, h('b', null, 'OCR lokalnie. '), 'Tesseract (język polski) i pdf.js działają w aplikacji, bez internetu.'),
            h('li', null, h('b', null, 'Dane osobowe zostają lokalnie. '), 'Imię, nazwisko (z odmianą i zdrobnieniami), PESEL, data i miejsce urodzenia, adres, rodzice, numer orzeczenia, poradnia, szkoła, nazwiska specjalistów, telefony i e-maile zastępują znaczniki {{…}}.'),
            h('li', null, h('b', null, 'Strażnik. '), isMobile() ? 'Przed każdym zapytaniem do AI tekst jest sprawdzany pod kątem danych wszystkich uczniów; wykrycie = blokada.' : 'Każde zapytanie przechodzi przez proces główny aplikacji, który sprawdza je pod kątem danych wszystkich uczniów; wykrycie = blokada. Okno aplikacji nie ma dostępu do internetu.'),
            h('li', null, h('b', null, 'Wyszukiwanie w sieci. '), 'Agent szuka wyłącznie wiedzy ogólnej (przepisy, metody) – bez danych ucznia.'),
            h('li', null, h('b', null, 'Pełna lokalność (opcjonalnie). '), 'W Ustawieniach → AI możesz wybrać lokalny model (Ollama) – wtedy nic nie opuszcza komputera.')))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('search', 16), 'Sprawdź tekst strażnikiem'), test,
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' } }, h('button', { class: 'btn', onclick: async () => { const l = await api.privacyCheck(test.value); out.replaceChildren(l.length ? h('div', { class: 'status-line bad' }, iconEl('warn', 14), 'Wykryto: ' + l.map((x) => `${x.kind} (${x.sample})`).join(', ')) : h('div', { class: 'status-line ok' }, iconEl('checkCircle', 14), 'Brak danych osobowych uczniów.')); } }, iconEl('shield', 14), 'Sprawdź')), out),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, iconEl('list', 16), `Dziennik wysyłek do AI (${state.outbox.length})`, h('div', { class: 'spacer' }), h('button', { class: 'btn plain sm', onclick: async () => { await loadState(); rerender(); } }, iconEl('refresh', 12), 'Odśwież')),
        state.outbox.length ? h('table', { class: 'tbl' },
          h('thead', null, h('tr', null, h('th', null, 'Kiedy'), h('th', null, 'Zadanie'), h('th', null, 'Dokąd'), h('th', null, 'Znaków'), h('th', null, ''))),
          h('tbody', null, state.outbox.slice(0, 40).map((o) => h('tr', null,
            h('td', null, fmtDateTime(o.at)), h('td', null, { analyze: 'analiza orzeczenia', research: 'wyszukiwanie wiedzy', generate: 'dokument', refine: 'poprawa sekcji' }[o.task] || o.task),
            h('td', null, o.local ? h('span', { class: 'chip green' }, 'lokalnie') : o.provider, o.webSearch ? h('span', { class: 'chip teal' }, 'internet') : null), h('td', null, String(o.chars)),
            h('td', null, h('button', { class: 'btn plain sm', onclick: () => sheet({ title: 'Wysłana treść (zanonimizowana)', subtitle: fmtDateTime(o.at), wide: true, body: h('pre', { class: 'mono-sm prewrap' }, o.preview) }) }, iconEl('eye', 12), 'Podgląd')))))) : h('p', { class: 'muted small' }, 'Nic jeszcze nie zostało wysłane.'))));
}

// ───────────────────────── USTAWIENIA ─────────────────────────
function viewSettings() {
  const tabs = [
    { value: 'school', label: 'Szkoła i zespół', icon: 'school' },
    { value: 'ai', label: 'AI', icon: 'cpu' },
    { value: 'agent', label: 'Agent', icon: 'bolt' },
    { value: 'general', label: 'Wygląd i dane', icon: 'paint' }
  ];
  const body = { school: settingsSchool, ai: settingsAi, agent: settingsAgent, general: settingsGeneral }[state.settingsTab]();
  return h('div', null,
    toolbar('Ustawienia'),
    h('div', { class: 'page' }, h('div', { class: 'settings-tabs' }, segmented(tabs, state.settingsTab, (v) => { state.settingsTab = v; render(); })), body));
}

function textInput(value, onSave, attrs = {}) {
  return h('input', { class: 'input', style: { width: attrs.width || '300px' }, value: value || '', placeholder: attrs.placeholder || '', type: attrs.type || 'text', onchange: (e) => onSave(e.target.value.trim()) });
}

function settingsSchool() {
  const s = state.settings;
  const team = (s.team || []).map((m) => ({ ...m }));
  const saveTeam = () => saveSettings({ team: team.filter((m) => m.name || m.role) }, true);
  const ROLES = ['wychowawca', 'pedagog specjalny', 'psycholog', 'logopeda', 'fizjoterapeuta', 'terapeuta SI', 'pedagog', 'nauczyciel', 'pomoc nauczyciela', 'wicedyrektor'];
  return h('div', null,
    group('Szkoła', [
      row('Nazwa szkoły / ośrodka', textInput(s.school.nazwa, (v) => saveSettings({ school: { nazwa: v } }), { placeholder: 'np. Specjalny Ośrodek Szkolno-Wychowawczy nr 1' }), { icon: 'school', color: 'var(--accent)' }),
      row('Miejscowość', textInput(s.school.miejscowosc, (v) => saveSettings({ school: { miejscowosc: v } }), { width: '200px' }), { icon: 'globe', color: 'var(--teal)' }),
      row('Dyrektor', textInput(s.school.dyrektor, (v) => saveSettings({ school: { dyrektor: v } }), { width: '220px' }), { icon: 'person', color: 'var(--indigo)' }),
      row('Rok szkolny', textInput(s.school.rokSzkolny, (v) => saveSettings({ school: { rokSzkolny: v } }), { width: '120px' }), { icon: 'calendar', color: 'var(--orange)' })
    ], 'Dane szkoły i zespołu są wstawiane do nagłówków, podpisów i protokołów lokalnie. Strażnik pilnuje, żeby nie trafiły do AI.'),
    h('section', { class: 'group' }, h('h3', { class: 'group-title' }, 'Zespół nauczycieli i specjalistów'),
      h('div', { class: 'group-body team-body' },
        team.length ? team.map((m, i) => h('div', { class: 'row' },
          h('input', { class: 'input', style: { flex: 1 }, value: m.name || '', placeholder: 'Imię i nazwisko', onchange: (e) => { m.name = e.target.value.trim(); saveTeam(); } }),
          h('div', { style: { width: '200px' } }, select([{ value: '', label: '— funkcja —' }, ...ROLES.map((r) => ({ value: r, label: r }))], m.role || '', (v) => { m.role = v; saveTeam(); }, { style: { width: '100%' } })),
          h('button', { class: 'icon-btn', title: 'Usuń', onclick: async () => { team.splice(i, 1); await saveTeam(); render(); }, html: icon('trash', 14) }))) : h('div', { class: 'row muted small' }, 'Dodaj osoby, które podpisują dokumenty – pojawią się w protokołach i tabelach podpisów.'),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: async () => { team.push({ name: '', role: '' }); state.settings.team = team; render(); } }, iconEl('plus', 12), 'Dodaj osobę')))));
}

function accountCard() {
  const C = state.claude;
  const st = C.status;
  const wrap = h('div', { class: 'account' });
  if (!st) { wrap.append(h('div', { class: 'acc-row' }, spinner(18), h('span', { class: 'muted' }, 'Sprawdzam połączenie z kontem Claude…'))); return wrap; }
  const logo = (cls) => h('div', { class: 'acc-logo ' + (cls || ''), html: icon(st.loggedIn ? 'checkCircle' : 'person', 24) });
  if (st.loggedIn) {
    wrap.append(h('div', { class: 'acc-row' }, logo('ok'),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Połączono z kontem Claude'), h('div', { class: 'muted small' }, [st.email, st.plan ? `plan ${st.plan}` : null].filter(Boolean).join(' · ') || 'Aplikacja korzysta z Twojego planu Claude.')),
      h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { try { toast(await api.testAi(), 'success', 5000); } catch (er) { errToast(er); } }, 'Testuję…') }, iconEl('bolt', 14), 'Testuj'),
      h('button', { class: 'btn danger', onclick: async () => { try { C.status = await api.claudeLogout(); render(); } catch (er) { errToast(er); } } }, 'Wyloguj')));
    return wrap;
  }
  if (!st.installed) {
    wrap.append(h('div', { class: 'acc-row' }, logo(),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Połącz aplikację ze swoim kontem Claude'), h('div', { class: 'muted small' }, 'Jednorazowo zainstaluję oficjalny program Claude Code od Anthropic (ok. 1 minuty), a potem otworzę stronę logowania Claude.')),
      h('button', { class: 'btn primary lg', disabled: C.installing || null, onclick: installAndLogin }, C.installing ? spinner(14) : iconEl('upload', 15), C.installing ? 'Instaluję…' : 'Zainstaluj i połącz')));
    if (C.installing || C.log) wrap.append(h('pre', { class: 'acc-log' }, (C.log || '').split('\n').slice(-6).join('\n')));
    return wrap;
  }
  const L = C.login;
  if (!L) {
    wrap.append(h('div', { class: 'acc-row' }, logo(),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Zaloguj się swoim kontem Claude'), h('div', { class: 'muted small' }, 'Otworzy się strona logowania Claude w przeglądarce – zaloguj się tak samo jak na claude.ai.')),
      h('button', { class: 'btn primary lg', onclick: startLogin }, iconEl('key', 15), 'Zaloguj się')));
    return wrap;
  }
  const code = h('input', { class: 'input', style: { flex: 1 }, placeholder: 'Wklej kod ze strony logowania (jeśli się pojawił)' });
  wrap.append(
    h('div', { class: 'acc-row' }, h('div', { class: 'acc-logo' }, spinner(20)),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Czekam na zalogowanie w przeglądarce…'), h('div', { class: 'muted small' }, 'Po zalogowaniu na stronie Claude aplikacja połączy się sama.')),
      h('button', { class: 'btn', onclick: async () => { await api.claudeCancel(); C.login = null; render(); } }, 'Anuluj')),
    h('div', { class: 'acc-sub' },
      L.url ? h('button', { class: 'btn plain sm', onclick: () => api.openExternal(L.url) }, iconEl('globe', 12), 'Przeglądarka się nie otworzyła? Otwórz stronę logowania') : null,
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } }, code,
        h('button', { class: 'btn primary', onclick: async () => { if (!code.value.trim()) return; try { await api.claudeCode(code.value); toast('Przekazano kod – trwa łączenie…', 'info', 3000); } catch (er) { errToast(er); } } }, 'Zatwierdź kod'))));
  return wrap;
}

async function refreshClaude() {
  try { state.claude.status = await api.claudeStatus(); } catch (e) { state.claude.status = { installed: false, loggedIn: false }; }
  if (state.view === 'settings' || state.view === 'dashboard') render(); else renderSidebar();
}

async function installAndLogin() {
  const C = state.claude;
  C.installing = true; C.log = ''; render();
  try {
    C.status = await api.claudeInstall();
    C.installing = false; render();
    if (C.status.installed && !C.status.loggedIn) await startLogin();
  } catch (e) { C.installing = false; errToast(e); render(); }
}

async function startLogin() {
  const C = state.claude;
  try { C.login = { stage: 'start' }; render(); await api.claudeLogin(); await loadState(); } catch (e) { C.login = null; errToast(e); render(); }
}

function settingsAi() {
  const s = state.settings;
  const status = h('div', { class: 'status-line' });
  const testBtn = h('button', { class: 'btn' }, iconEl('bolt', 14), 'Testuj połączenie');
  testBtn.addEventListener('click', () => busy(testBtn, async () => {
    status.className = 'status-line'; status.replaceChildren(spinner(12), ' Łączę…');
    try { const r = await api.testAi(); status.className = 'status-line ok'; status.replaceChildren(iconEl('checkCircle', 14), r); } catch (e) { status.className = 'status-line bad'; status.replaceChildren(iconEl('warn', 14), e.message); }
  }, 'Testuję…'));
  const keyInput = h('input', { class: 'input', type: 'password', style: { width: '280px' }, placeholder: state.hasApiKey ? '•••••••• (zapisany)' : 'sk-ant-…' });
  const providers = [
    !isMobile() ? { value: 'claude-code', label: 'Konto Claude' } : null,
    { value: 'api', label: 'Klucz API' },
    { value: 'ollama', label: 'Lokalny model' },
    { value: 'offline', label: 'Bez AI' }
  ].filter(Boolean);
  const p = isMobile() && s.ai.provider === 'claude-code' ? 'api' : s.ai.provider;
  const hint = {
    'claude-code': 'Oficjalny program Claude Code na tym komputerze, zalogowany Twoim kontem Claude (Pro/Max). Do Claude trafia tylko zanonimizowany tekst.',
    api: 'Klucz z platform.claude.com, rozliczany za zużycie. Do Claude trafia tylko zanonimizowany tekst.',
    ollama: 'Model AI uruchomiony na tym komputerze przez Ollama – żadne dane nie opuszczają urządzenia. Wymaga mocnego komputera (zalecane 16 GB RAM).',
    offline: 'Dokumenty powstają wyłącznie z wbudowanej bazy wiedzy – bez internetu.'
  }[p];
  return h('div', null,
    group('Sposób działania agenta', [row('Silnik AI', segmented(providers, p, async (v) => { await saveSettings({ ai: { provider: v } }, true); if (v === 'claude-code') refreshClaude(); render(); }), { icon: 'cpu', color: 'var(--accent)' })], hint),
    p === 'claude-code' ? h('div', null,
      h('div', { class: 'group' }, h('h3', { class: 'group-title' }, 'Konto Claude'), h('div', { class: 'group-body' }, accountCard()),
        h('p', { class: 'group-footer' }, 'Logujesz się na oficjalnej stronie Claude – aplikacja nie widzi Twojego hasła. Claude Code działa bez dostępu do plików, tylko z wyszukiwaniem w internecie.')),
      group('Model', [
        row('Model Claude', select([{ value: 'sonnet', label: 'Sonnet (zalecany)' }, { value: 'opus', label: 'Opus (najdokładniejszy)' }, { value: 'haiku', label: 'Haiku (najszybszy)' }], s.ai.model, (v) => saveSettings({ ai: { model: v } })), { icon: 'sparkles', color: 'var(--purple)' }),
        row('Program Claude Code', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, state.claudePath ? h('span', { class: 'path' }, state.claudePath) : h('span', { class: 'muted small' }, 'nie znaleziono'), h('button', { class: 'btn sm', onclick: async () => { try { const r = await api.browseClaude(); if (r) { await loadState(); refreshClaude(); } } catch (e) { errToast(e); } } }, 'Wskaż…')), { icon: 'folder', color: 'var(--orange)' })
      ])) : null,
    p === 'api' ? group('Klucz API', [
      row('Klucz', h('div', { style: { display: 'flex', gap: '6px' } }, keyInput, h('button', { class: 'btn', onclick: async () => { try { state.hasApiKey = await api.setApiKey(keyInput.value); keyInput.value = ''; toast(state.hasApiKey ? 'Zapisano klucz' : 'Usunięto klucz', 'success'); render(); } catch (e) { errToast(e); } } }, 'Zapisz')), { icon: 'key', color: 'var(--green)' }),
      row('Model', select([{ value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (zalecany)' }, { value: 'claude-opus-5-5', label: 'Claude Opus 5.5' }, { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }], s.ai.apiModel, (v) => saveSettings({ ai: { apiModel: v } })), { icon: 'sparkles', color: 'var(--purple)' }),
      row('Pobierz klucz', h('button', { class: 'btn sm', onclick: () => api.openExternal('https://platform.claude.com/settings/keys') }, 'platform.claude.com'), { icon: 'globe', color: 'var(--teal)' })
    ], isMobile() ? 'Klucz jest przechowywany w prywatnej pamięci aplikacji.' : 'Klucz jest zaszyfrowany systemowym magazynem haseł.') : null,
    p === 'ollama' ? group('Lokalny model (Ollama)', [
      row('Adres', textInput(s.ai.ollamaUrl, (v) => saveSettings({ ai: { ollamaUrl: v } }), { width: '240px' }), { icon: 'globe', color: 'var(--teal)', hint: 'Tylko adres 127.0.0.1/localhost jest traktowany jako lokalny.' }),
      row('Model', textInput(s.ai.ollamaModel, (v) => saveSettings({ ai: { ollamaModel: v } }), { width: '200px' }), { icon: 'cpu', color: 'var(--purple)', hint: 'np. qwen2.5:14b, gemma3:12b, llama3.1:8b – pobierz: ollama pull <model>' }),
      row('Pobierz Ollama', h('button', { class: 'btn sm', onclick: () => api.openExternal('https://ollama.com/download') }, 'ollama.com'), { icon: 'download', color: 'var(--green)' })
    ], 'Lokalny model nie przeszukuje internetu – agent użyje wbudowanej bazy wiedzy.') : null,
    p !== 'offline' ? group('Wiedza z internetu', [
      row('Wyszukiwanie wiedzy specjalistycznej', toggle(s.ai.useWebSearch, (v) => saveSettings({ ai: { useWebSearch: v } }, true)), { icon: 'globe', color: 'var(--teal)', hint: 'Agent sprawdza aktualne przepisy, podstawy programowe i metody pracy (bez danych ucznia).' })
    ]) : null,
    p !== 'offline' ? h('div', { class: 'group', style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } }, testBtn, status) : null);
}

function settingsAgent() {
  const a = state.settings.agent;
  return h('div', null,
    group('Po dodaniu orzeczenia agent…', [
      row('analizuje orzeczenie', toggle(a.autoAnalyze, (v) => saveSettings({ agent: { autoAnalyze: v } }, true)), { icon: 'sparkles', color: 'var(--purple)', hint: 'Mocne strony, trudności, potrzeby i opis w 9 obszarach ICF.' }),
      row('wyszukuje aktualną wiedzę w internecie', toggle(a.autoResearch, (v) => saveSettings({ agent: { autoResearch: v } }, true)), { icon: 'globe', color: 'var(--teal)' }),
      row('opracowuje wszystkie potrzebne dokumenty', toggle(a.autoGenerate, (v) => saveSettings({ agent: { autoGenerate: v } }, true)), { icon: 'doc', color: 'var(--accent)', hint: 'IPET, WOPFU, oceny funkcjonalne, programy zajęć i wskazówki dla rodziców.' })
    ]),
    !isMobile() ? group('Praca w tle', [
      row('Działaj w tle po zamknięciu okna', toggle(a.runInBackground, (v) => saveSettings({ agent: { runInBackground: v } }, true)), { icon: 'bolt', color: 'var(--orange)', hint: 'Aplikacja zostaje w zasobniku i kończy rozpoczęte dokumenty.' }),
      row('Powiadomienia', toggle(a.notifications, (v) => saveSettings({ agent: { notifications: v } }, true)), { icon: 'bell', color: 'var(--red)' })
    ]) : null);
}

function settingsGeneral() {
  const s = state.settings;
  return h('div', null,
    group('Wygląd', [row('Motyw', segmented([{ value: 'system', label: 'Systemowy' }, { value: 'light', label: 'Jasny' }, { value: 'dark', label: 'Ciemny' }], s.ui.theme, (v) => { saveSettings({ ui: { theme: v } }, true); applyTheme(v); }), { icon: 'paint', color: 'var(--pink)' })]),
    group('Dane', [
      row('Folder danych', h('span', { class: 'path', style: { maxWidth: '380px' } }, state.info.dataDir), { icon: 'folder', color: 'var(--orange)', hint: state.info.portable ? 'Wersja przenośna – dane leżą obok pliku .exe. Trzymaj je na zaszyfrowanym dysku.' : 'Kopia tego folderu = kopia wszystkich danych. Zalecane szyfrowanie dysku (BitLocker / LUKS).' }),
      row('Wersja', h('span', { class: 'muted' }, state.info.version), { icon: 'info', color: 'var(--text-3)' })
    ]));
}

function applyTheme(v) {
  document.documentElement.dataset.theme = v === 'system' ? '' : v;
}

init().then(() => applyTheme(state.settings.ui.theme)).catch((e) => { console.error(e); document.getElementById('content').textContent = 'Błąd uruchamiania: ' + e.message; });
