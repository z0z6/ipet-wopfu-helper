'use strict';
// Sposoby korzystania z AI (do chmury trafia wyłącznie tekst po pseudonimizacji,
// sprawdzony przez strażnika prywatności w main.js):
//  1) "claude-code" – oficjalny program Claude Code (CLI) zainstalowany na komputerze
//     i zalogowany kontem użytkownika (Pro/Max). Aplikacja uruchamia go w trybie
//     nieinteraktywnym (`claude -p`), więc korzysta z Twojego planu w sposób dozwolony
//     przez Anthropic – bez wyciągania tokenów logowania.
//  2) "api" – klucz API z platform.claude.com (rozliczany osobno, za zużycie).
//  3) "ollama" – lokalny model na tym komputerze (http://127.0.0.1:11434) – nic nie wychodzi w sieć.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const API_WEB_SEARCH_TOOL = { type: 'web_search_20250305', name: 'web_search', max_uses: 6 };

function candidatesForClaude() {
  const home = os.homedir();
  const list = [];
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    list.push(
      path.join(home, '.local', 'bin', 'claude.exe'),
      path.join(appdata, 'npm', 'claude.cmd'),
      path.join(local, 'Programs', 'claude', 'claude.exe'),
      path.join(local, 'AnthropicClaude', 'claude.exe')
    );
  } else {
    list.push(
      path.join(home, '.local', 'bin', 'claude'),
      path.join(home, '.claude', 'local', 'claude'),
      path.join(home, '.npm-global', 'bin', 'claude'),
      path.join(home, '.bun', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      '/opt/homebrew/bin/claude'
    );
  }
  // katalogi z PATH
  const exts = process.platform === 'win32' ? ['.exe', '.cmd'] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) list.push(path.join(dir, 'claude' + ext));
  }
  return [...new Set(list)];
}

function findClaude(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  for (const p of candidatesForClaude()) {
    try { if (fs.statSync(p).isFile()) return p; } catch (_) { /* brak */ }
  }
  return null;
}

function runProcess(cmd, args, input, { cwd, timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    const isWinScript = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
    const child = spawn(isWinScript ? `"${cmd}"` : cmd, args, {
      cwd,
      shell: isWinScript,
      windowsHide: true,
      env: process.env
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude Code nie odpowiedział w wyznaczonym czasie.'));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    child.stderr.on('data', (d) => { err += d.toString('utf8'); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
    if (input != null) child.stdin.end(input, 'utf8');
    else child.stdin.end();
  });
}

class ClaudeCodeProvider {
  constructor(settings) {
    this.settings = settings;
  }

  get label() { return 'Konto Claude (Claude Code)'; }

  get isLocal() { return false; }

  locate() { return findClaude(this.settings.ai.claudePath); }

  async version() {
    const bin = this.locate();
    if (!bin) return null;
    const r = await runProcess(bin, ['--version'], null, { timeoutMs: 20000 });
    return (r.out || r.err).trim();
  }

  async run({ system, prompt, images = [], webSearch = false, model }) {
    const bin = this.locate();
    if (!bin) {
      throw new Error('Nie znaleziono programu Claude Code. Zainstaluj go (https://claude.com/claude-code), zaloguj się poleceniem „claude” i spróbuj ponownie – albo wskaż ścieżkę w Ustawieniach.');
    }
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'asystent-ipet-'));
    try {
      if (images.length) throw new Error('Zdjęcia nie są wysyłane do chmury – analiza obrazu odbywa się lokalnie.');
      // Claude Code działa w pustym katalogu tymczasowym i NIE ma narzędzi do plików ani poleceń –
      // wyłącznie wyszukiwanie i czytanie stron internetowych (gdy włączone).
      const tools = webSearch ? ['WebSearch', 'WebFetch'] : [];
      const full = `${system}\n\n---\n\n${prompt}\n\nNie twórz ani nie modyfikuj żadnych plików. Odpowiedz wyłącznie wynikiem w żądanym formacie JSON.`;
      const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--model', model || this.settings.ai.model || 'sonnet'];
      if (tools.length) args.push('--tools', tools.join(','), '--allowedTools', tools.join(','));
      else args.push('--tools', process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin) ? '""' : '');
      const r = await runProcess(bin, args, full, { cwd: work, timeoutMs: 12 * 60 * 1000 });
      let parsed = null;
      try {
        parsed = JSON.parse(r.out);
        if (Array.isArray(parsed)) parsed = parsed.find((x) => x.type === 'result') || parsed[parsed.length - 1];
      } catch (_) { /* nie JSON */ }
      if (!parsed) {
        const msg = (r.err || r.out || '').trim().slice(0, 600);
        if (/login|log in|authenticat|zaloguj/i.test(msg)) {
          throw new Error('Claude Code nie jest zalogowany. Otwórz terminal, uruchom „claude” i zaloguj się swoim kontem Claude.');
        }
        throw new Error('Claude Code zwrócił nieoczekiwaną odpowiedź: ' + (msg || `kod ${r.code}`));
      }
      if (parsed.is_error) {
        const msg = String(parsed.result || parsed.subtype || 'błąd');
        if (/authenticat|log ?in|credential|unauthori[sz]ed|401/i.test(msg)) {
          throw new Error('Claude Code nie jest zalogowany (lub sesja wygasła). Otwórz terminal, uruchom „claude”, wpisz /login i zaloguj się swoim kontem Claude.');
        }
        if (/usage limit|rate limit|limit reached|429/i.test(msg)) {
          throw new Error('Osiągnięto limit użycia Twojego planu Claude. Spróbuj później albo przełącz się na klucz API w Ustawieniach.');
        }
        throw new Error('Claude Code: ' + msg.slice(0, 600));
      }
      return { text: String(parsed.result || ''), usage: { costUsd: parsed.total_cost_usd || null } };
    } finally {
      try { fs.rmSync(work, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    }
  }

  async test() {
    const v = await this.version();
    if (!v) throw new Error('Nie znaleziono Claude Code na tym komputerze.');
    const r = await this.run({ system: 'Jesteś testem połączenia.', prompt: 'Odpowiedz dokładnie tekstem: {"ok":true}', model: 'haiku' });
    return `${v} – połączenie działa (${r.text.trim().slice(0, 40)})`;
  }
}

class ApiProvider {
  constructor(settings, getKey) {
    this.settings = settings;
    this.getKey = getKey;
  }

  get label() { return 'Klucz API Claude'; }

  get isLocal() { return false; }

  client() {
    const key = this.getKey();
    if (!key) throw new Error('Brak klucza API. Wklej klucz w Ustawieniach → AI.');
    const Anthropic = require('@anthropic-ai/sdk');
    const Ctor = Anthropic.default || Anthropic.Anthropic || Anthropic;
    return new Ctor({ apiKey: key, maxRetries: 2, timeout: 5 * 60 * 1000 });
  }

  async run({ system, prompt, images = [], webSearch = false, model, maxTokens = 16000 }) {
    if (images.length) throw new Error('Zdjęcia nie są wysyłane do chmury – analiza obrazu odbywa się lokalnie.');
    const client = this.client();
    const content = [];
    for (const img of images) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.data } });
    }
    content.push({ type: 'text', text: prompt });
    const messages = [{ role: 'user', content }];
    const params = {
      model: model || this.settings.ai.apiModel || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      system,
      messages
    };
    if (webSearch) params.tools = [API_WEB_SEARCH_TOOL];
    let texts = [];
    for (let i = 0; i < 5; i++) {
      const res = await client.messages.create(params);
      texts = res.content.filter((b) => b.type === 'text').map((b) => b.text);
      if (res.stop_reason === 'pause_turn') {
        // długie wyszukiwanie po stronie serwera – kontynuuj tę samą turę
        messages.push({ role: 'assistant', content: res.content });
        continue;
      }
      return { text: texts.join('\n'), usage: res.usage };
    }
    return { text: texts.join('\n') };
  }

  async test() {
    const r = await this.run({ system: 'Jesteś testem połączenia.', prompt: 'Odpowiedz dokładnie tekstem: {"ok":true}', maxTokens: 50 });
    return `Połączenie działa (model ${this.settings.ai.apiModel}): ${r.text.trim().slice(0, 40)}`;
  }
}

function isLoopbackUrl(u) {
  try { const h = new URL(u).hostname; return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]'; } catch (_) { return false; }
}

// Lokalny model przez Ollama (https://ollama.com). Gdy adres to localhost – dane nie opuszczają komputera.
class OllamaProvider {
  constructor(settings) { this.settings = settings; }

  get label() { return 'Lokalny model (Ollama)'; }

  get url() { return (this.settings.ai.ollamaUrl || 'http://127.0.0.1:11434').replace(/\/$/, ''); }

  get isLocal() { return isLoopbackUrl(this.url); }

  async run({ system, prompt, images = [], model }) {
    const msg = { role: 'user', content: prompt };
    if (images.length) msg.images = images.map((i) => i.data);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15 * 60 * 1000);
    try {
      const res = await fetch(this.url + '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: model || this.settings.ai.ollamaModel, stream: false, options: { num_ctx: 16384, temperature: 0.4 }, messages: [{ role: 'system', content: system }, msg] }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`Ollama: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      return { text: (j.message && j.message.content) || '' };
    } catch (e) {
      if (/ECONNREFUSED|fetch failed/i.test(String(e.message || e))) throw new Error('Nie można połączyć się z Ollama pod adresem ' + this.url + '. Zainstaluj Ollama (ollama.com) i pobierz model, np. „ollama pull ' + this.settings.ai.ollamaModel + '”.');
      throw e;
    } finally { clearTimeout(timer); }
  }

  async test() {
    const res = await fetch(this.url + '/api/tags').catch(() => null);
    if (!res || !res.ok) throw new Error('Ollama nie odpowiada pod adresem ' + this.url);
    const j = await res.json();
    const names = (j.models || []).map((m) => m.name);
    if (!names.some((n) => n.startsWith(this.settings.ai.ollamaModel.split(':')[0]))) throw new Error(`Ollama działa, ale brak modelu ${this.settings.ai.ollamaModel}. Dostępne: ${names.join(', ') || 'brak'}`);
    return `Ollama działa (${this.isLocal ? 'lokalnie' : 'UWAGA: adres zdalny'}), model: ${this.settings.ai.ollamaModel}`;
  }
}

function extractJson(text) {
  if (!text) throw new Error('Pusta odpowiedź modelu.');
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const tries = [...blocks.reverse(), text];
  for (const t of tries) {
    try { return JSON.parse(t.trim()); } catch (_) { /* dalej */ }
    const starts = [t.indexOf('{'), t.indexOf('[')].filter((x) => x >= 0);
    if (!starts.length) continue;
    const s = Math.min(...starts);
    const closer = t[s] === '{' ? '}' : ']';
    const e = t.lastIndexOf(closer);
    if (e > s) {
      try { return JSON.parse(t.slice(s, e + 1)); } catch (_) { /* dalej */ }
    }
  }
  throw new Error('Nie udało się odczytać odpowiedzi modelu jako JSON.');
}

module.exports = { ClaudeCodeProvider, ApiProvider, OllamaProvider, extractJson, findClaude, isLoopbackUrl };
