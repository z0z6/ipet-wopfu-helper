'use strict';
// Trwały magazyn danych w pliku JSON (zapis atomowy). Wszystko zostaje na tym komputerze.
const fs = require('fs');
const path = require('path');

function defaultSchoolYear(d = new Date()) {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // od sierpnia – nowy rok szkolny
  return `${y}/${y + 1}`;
}

const DEFAULT_SETTINGS = {
  school: { nazwa: '', miejscowosc: '', dyrektor: '', rokSzkolny: defaultSchoolYear() },
  team: [], // [{ name, role }] – członkowie zespołu do protokołów i podpisów
  ai: {
    provider: 'claude-code', // 'claude-code' | 'api' | 'ollama' | 'offline'
    model: 'sonnet', // aliasy Claude Code: sonnet / opus / haiku
    apiModel: 'claude-sonnet-5-5',
    claudePath: '',
    useWebSearch: true,
    ollamaUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'qwen2.5:14b'
  },
  agent: { autoAnalyze: true, autoResearch: true, autoGenerate: true, runInBackground: true, notifications: true },
  ui: { theme: 'system' }
};

const DEFAULT_DATA = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  students: {}, // id -> uczeń (dane osobowe, dokumenty, wyniki agenta)
  outbox: [], // dziennik wysyłek do AI (tylko treść po pseudonimizacji)
  notified: {}
};

function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      for (const k of Object.keys(extra)) out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
    }
    return out;
  }
  return extra === undefined ? base : extra;
}

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'asystent-ipet-dane.json');
    this.data = this._load();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const d = deepMerge(DEFAULT_DATA, raw);
      d.students = raw.students || {};
      return d;
    } catch (e) {
      if (fs.existsSync(this.file)) {
        try { fs.copyFileSync(this.file, this.file + '.uszkodzony-' + Date.now()); } catch (_) { /* ignore */ }
      }
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  get settings() { return this.data.settings; }

  updateSettings(patch) {
    this.data.settings = deepMerge(this.data.settings, patch);
    if (patch && Array.isArray(patch.team)) this.data.settings.team = patch.team;
    this.save();
    return this.data.settings;
  }

  students() { return Object.values(this.data.students).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }

  saveStudent(s) {
    if (!s || !s.id) throw new Error('Brak identyfikatora ucznia.');
    s.updatedAt = new Date().toISOString();
    if (!s.createdAt) s.createdAt = s.updatedAt;
    this.data.students[s.id] = s;
    this.save();
    return s;
  }

  deleteStudent(id) {
    delete this.data.students[id];
    this.save();
  }

  logOutbox(entry) {
    this.data.outbox.unshift({ at: new Date().toISOString(), ...entry });
    this.data.outbox = this.data.outbox.slice(0, 80);
    this.save();
  }
}

module.exports = { Store, DEFAULT_SETTINGS, defaultSchoolYear, deepMerge };
