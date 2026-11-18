'use strict';
/* global IPET */
// Android (Capacitor): ten sam interfejs `window.api` co w Electronie (preload.js).
// Dane uczniów i skany – w prywatnym katalogu aplikacji na telefonie/tablecie.
// Do AI (klucz API Claude lub lokalny Ollama) trafia wyłącznie tekst po pseudonimizacji,
// sprawdzony przez tego samego strażnika prywatności co na komputerze.
(function () {
  if (window.api || !window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return;
  const cap = window.Capacitor;
  const P = { Filesystem: cap.registerPlugin('Filesystem'), Preferences: cap.registerPlugin('Preferences'), Share: cap.registerPlugin('Share') };
  const FS = P.Filesystem;
  const PREF = P.Preferences;
  const DATA = 'DATA';
  const FILE = 'asystent-ipet-dane.json';
  const VERSION = '1.0.0';

  const year = (d = new Date()) => (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1);
  const DEFAULT_SETTINGS = {
    school: { nazwa: '', miejscowosc: '', dyrektor: '', rokSzkolny: `${year()}/${year() + 1}` },
    team: [],
    ai: { provider: 'api', model: 'sonnet', apiModel: 'claude-sonnet-5-5', claudePath: '', useWebSearch: true, ollamaUrl: 'http://127.0.0.1:11434', ollamaModel: 'qwen2.5:14b' },
    agent: { autoAnalyze: true, autoResearch: true, autoGenerate: true, runInBackground: true, notifications: true },
    ui: { theme: 'system' }
  };

  function deepMerge(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
    if (base && typeof base === 'object') {
      const out = { ...base };
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) for (const k of Object.keys(extra)) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
      return out;
    }
    return extra === undefined ? base : extra;
  }

  let data = null;
  async function load() {
    if (data) return data;
    try {
      const r = await FS.readFile({ path: FILE, directory: DATA, encoding: 'utf8' });
      const raw = JSON.parse(r.data);
      data = { settings: deepMerge(DEFAULT_SETTINGS, raw.settings), students: raw.students || {}, outbox: raw.outbox || [] };
    } catch (_) {
      data = { settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), students: {}, outbox: [] };
    }
    return data;
  }
  let saving = Promise.resolve();
  function save() {
    saving = saving.then(() => FS.writeFile({ path: FILE, directory: DATA, encoding: 'utf8', data: JSON.stringify(data) })).catch((e) => console.error(e));
    return saving;
  }
  const students = () => Object.values(data.students).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  async function getKey() { const r = await PREF.get({ key: 'anthropic_api_key' }); return r.value || ''; }

  function isLoopback(u) { try { const h = new URL(u).hostname; return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h); } catch (_) { return false; } }

  function allSecrets() {
    const out = [];
    for (const s of students()) out.push(...IPET.privacy.secretsFor(s));
    for (const m of data.settings.team || []) if (m && m.name) for (const t of m.name.split(/\s+/)) if (t.length >= 3) out.push({ value: t, ph: 'OSOBA', kind: 'name' });
    if (data.settings.school.nazwa && data.settings.school.nazwa.length >= 6) out.push({ value: data.settings.school.nazwa, ph: 'SZKOLA' });
    return out;
  }

  async function anthropic({ system, prompt, webSearch }) {
    const key = await getKey();
    if (!key) throw new Error('Brak klucza API. Wklej klucz w Ustawieniach → AI.');
    const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
    const body = { model: data.settings.ai.apiModel || 'claude-sonnet-5-5', max_tokens: 16000, system, messages };
    if (webSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }];
    let texts = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(body)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Claude API: ' + ((j.error && j.error.message) || res.status));
      texts = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text);
      if (j.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: j.content }); continue; }
      break;
    }
    return { text: texts.join('\n') };
  }

  async function ollama({ system, prompt }) {
    const url = (data.settings.ai.ollamaUrl || '').replace(/\/$/, '');
    const res = await fetch(url + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: data.settings.ai.ollamaModel, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
    if (!res.ok) throw new Error('Ollama: ' + res.status);
    const j = await res.json();
    return { text: (j.message && j.message.content) || '' };
  }

  const listeners = {};
  window.api = {
    info: async () => ({ version: VERSION, platform: 'android', dataDir: 'pamięć aplikacji na urządzeniu', portable: false, today: new Date().toISOString(), mobile: true }),
    windowControl: async () => false,
    getState: async () => { await load(); return { settings: data.settings, students: students(), hasApiKey: !!(await getKey()), claudePath: null, outbox: data.outbox }; },
    setSettings: async (patch) => { await load(); data.settings = deepMerge(data.settings, patch); if (patch && Array.isArray(patch.team)) data.settings.team = patch.team; await save(); return data.settings; },
    saveStudent: async (s) => { await load(); s.updatedAt = new Date().toISOString(); if (!s.createdAt) s.createdAt = s.updatedAt; data.students[s.id] = s; await save(); return s; },
    deleteStudent: async (id) => { await load(); delete data.students[id]; await save(); try { await FS.rmdir({ path: 'skany/' + id, directory: DATA, recursive: true }); } catch (_) { /* brak */ } return true; },
    saveScan: async (studentId, name, base64) => { const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`; await FS.writeFile({ path: `skany/${studentId}/${id}`, directory: DATA, data: base64, recursive: true }); return { id, name }; },
    readScan: async (studentId, id) => { const r = await FS.readFile({ path: `skany/${studentId}/${id}`, directory: DATA }); return 'data:image/jpeg;base64,' + r.data; },
    setApiKey: async (k) => { if (k && k.trim()) await PREF.set({ key: 'anthropic_api_key', value: k.trim() }); else await PREF.remove({ key: 'anthropic_api_key' }); return !!(await getKey()); },
    testAi: async () => {
      await load();
      const p = data.settings.ai.provider;
      if (p === 'offline') return 'Tryb bez AI – dokumenty powstają z wbudowanej bazy wiedzy.';
      const r = p === 'ollama' ? await ollama({ system: 'Test', prompt: 'Odpowiedz: {"ok":true}' }) : await anthropic({ system: 'Jesteś testem połączenia.', prompt: 'Odpowiedz dokładnie tekstem: {"ok":true}' });
      return 'Połączenie działa: ' + r.text.trim().slice(0, 40);
    },
    aiRun: async (req) => {
      await load();
      const p = data.settings.ai.provider;
      if (p === 'offline') throw new Error('Wybrano tryb bez AI.');
      const local = p === 'ollama' && isLoopback(data.settings.ai.ollamaUrl);
      const leaks = IPET.privacy.findLeaks(`${req.system}\n${req.prompt}`, allSecrets());
      if (leaks.length && !local) throw new Error('Strażnik prywatności zablokował wysyłkę do AI – w treści wykryto: ' + [...new Set(leaks.map((l) => `${l.kind} (${l.sample})`))].slice(0, 5).join(', ') + '.');
      data.outbox.unshift({ at: new Date().toISOString(), task: req.task, provider: p === 'ollama' ? 'Ollama' : 'Klucz API Claude', local, studentId: req.studentId, chars: (req.system || '').length + (req.prompt || '').length, webSearch: !!req.webSearch, preview: String(req.prompt || '').slice(0, 4000) });
      data.outbox = data.outbox.slice(0, 80);
      await save();
      return p === 'ollama' ? ollama(req) : anthropic({ ...req, webSearch: !!req.webSearch && data.settings.ai.useWebSearch });
    },
    privacyCheck: async (text) => { await load(); return IPET.privacy.findLeaks(text, allSecrets()); },
    claudeStatus: async () => ({ installed: false, loggedIn: false, unsupported: true }),
    claudeInstall: async () => { throw new Error('Na Androidzie użyj klucza API.'); },
    claudeLogin: async () => { throw new Error('Na Androidzie użyj klucza API.'); },
    claudeCode: async () => false,
    claudeCancel: async () => true,
    claudeLogout: async () => ({ installed: false, loggedIn: false }),
    browseClaude: async () => null,
    saveFile: async ({ name, base64 }) => {
      const r = await FS.writeFile({ path: 'eksport/' + name, directory: 'CACHE', data: base64, recursive: true });
      try { await P.Share.share({ title: name, url: r.uri, dialogTitle: 'Zapisz lub wyślij dokument' }); } catch (_) { /* anulowano */ }
      return { path: name };
    },
    saveFiles: async ({ folder, files }) => {
      const uris = [];
      for (const f of files) { const r = await FS.writeFile({ path: `eksport/${folder}/${f.name}`, directory: 'CACHE', data: f.base64, recursive: true }); uris.push(r.uri); }
      try { await P.Share.share({ title: folder, files: uris, dialogTitle: 'Zapisz lub wyślij dokumenty' }); } catch (_) { /* anulowano */ }
      return { path: folder, count: files.length };
    },
    showFile: async () => true,
    openFile: async () => true,
    openExternal: async (u) => { if (/^https:\/\//.test(u)) window.open(u, '_system'); },
    notify: async () => true,
    on: (channel, fn) => { (listeners[channel] = listeners[channel] || []).push(fn); return () => {}; }
  };
})();
