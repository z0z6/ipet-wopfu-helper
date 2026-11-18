'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage, nativeTheme, safeStorage, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');

const { Store } = require('./store');
const { ClaudeAccount } = require('./claude-account');
const { ClaudeCodeProvider, ApiProvider, OllamaProvider, findClaude } = require('./ai/providers');
const privacy = require('../renderer/lib/privacy');

const APP_NAME = 'Asystent IPET';
app.setName(APP_NAME);
app.commandLine.appendSwitch('lang', 'pl');
if (process.platform === 'win32') app.setAppUserModelId('pl.z0z6.asystentipet');

// Wersja portable (Windows): dane obok pliku .exe
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
const dataDir = process.env.APP_DATA_DIR || (portableDir ? path.join(portableDir, 'Asystent IPET - dane') : path.join(app.getPath('userData'), 'dane'));
const scansDir = () => path.join(dataDir, 'skany');
const RENDERER = path.join(__dirname, '..', 'renderer');

// Interfejs ładowany z własnego protokołu app:// (moduły ES, WASM i fetch działają jak na stronie www)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let tray = null;
let quitting = false;
let store, account;

const secretsFile = () => path.join(dataDir, 'klucz.bin');

function getApiKey() {
  try {
    const raw = fs.readFileSync(secretsFile());
    if (raw.slice(0, 4).toString() === 'b64:') return Buffer.from(raw.slice(4).toString(), 'base64').toString('utf8');
    return safeStorage.decryptString(raw);
  } catch (_) { return null; }
}

function setApiKey(key) {
  if (!key) { try { fs.unlinkSync(secretsFile()); } catch (_) { /* brak */ } return; }
  if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(secretsFile(), safeStorage.encryptString(key));
  else fs.writeFileSync(secretsFile(), 'b64:' + Buffer.from(key, 'utf8').toString('base64'));
}

function getProvider() {
  const s = store.settings;
  if (s.ai.provider === 'api') return new ApiProvider(s, getApiKey);
  if (s.ai.provider === 'ollama') return new OllamaProvider(s);
  if (s.ai.provider === 'offline') return null;
  return new ClaudeCodeProvider(s);
}

// ─────────── strażnik prywatności ───────────
// Każde zapytanie do AI przechodzi tutaj. Gdy w tekście są dane osobowe któregokolwiek
// ucznia (lub członków zespołu), a model nie działa lokalnie – wysyłka jest blokowana.
function allSecrets() {
  const extra = [];
  const s = store.settings;
  for (const m of s.team || []) if (m && m.name) for (const t of String(m.name).split(/\s+/)) if (t.length >= 3) extra.push({ value: t, ph: 'OSOBA', kind: 'name' });
  if (s.school.nazwa && s.school.nazwa.length >= 6) extra.push({ value: s.school.nazwa, ph: 'SZKOLA' });
  if (s.school.dyrektor) for (const t of String(s.school.dyrektor).split(/\s+/)) if (t.length >= 3) extra.push({ value: t, ph: 'OSOBA', kind: 'name' });
  const list = [];
  for (const st of store.students()) list.push(...privacy.secretsFor(st));
  return [...list, ...extra];
}

function guard(text, provider) {
  const leaks = privacy.findLeaks(text, allSecrets());
  if (leaks.length && !(provider && provider.isLocal)) {
    const what = [...new Set(leaks.map((l) => `${l.kind} (${l.sample})`))].slice(0, 5).join(', ');
    const err = new Error(`Strażnik prywatności zablokował wysyłkę do AI – w treści wykryto: ${what}. Usuń te dane z tekstu orzeczenia lub dokumentu i spróbuj ponownie.`);
    err.code = 'PRIVACY_BLOCK';
    throw err;
  }
  return leaks;
}

function emit(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function notify(title, body) {
  if (!Notification.isSupported() || !store.settings.agent.notifications) return;
  const n = new Notification({ title, body, icon: iconPath() });
  n.on('click', () => showWindow());
  n.show();
}

function iconPath() { return path.join(__dirname, '..', 'assets', 'icon.png'); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.gz': 'application/gzip' };

function registerAppProtocol() {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(RENDERER, rel));
    if (!file.startsWith(RENDERER)) return new Response('forbidden', { status: 403 });
    try {
      const buf = await fs.promises.readFile(file);
      return new Response(buf, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' } });
    } catch (_) { return new Response('not found', { status: 404 }); }
  });
}

// Okno aplikacji nie ma dostępu do internetu – tylko lokalne pliki. Sieć (AI) obsługuje
// wyłącznie proces główny, po kontroli strażnika prywatności.
function lockDownNetwork() {
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const ok = /^(app|data|blob|devtools|chrome-extension):/i.test(details.url);
    cb({ cancel: !ok });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications' || permission === 'clipboard-sanitized-write'));
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1020,
    minHeight: 660,
    show: false,
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      backgroundThrottling: false // agent pracuje także, gdy okno jest schowane w zasobniku
    }
  });
  win.setMenuBarVisibility(false);
  win.webContents.session.setSpellCheckerLanguages(['pl']);
  win.loadURL('app://local/index.html');
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  if (process.env.APP_SHOTS) win.webContents.on('console-message', (...a) => { const e = a[0]; console.log('[renderer]', e && e.message ? e.message : a.slice(1).join(' ')); });
  if (process.env.APP_SHOTS) win.webContents.once('did-finish-load', () => devScreenshots(process.env.APP_SHOTS));
  win.on('close', (e) => {
    if (!quitting && store.settings.agent.runInBackground && tray) {
      e.preventDefault();
      win.hide();
      if (!store.data.notified.trayHint) {
        store.data.notified.trayHint = true; store.save();
        notify(`${APP_NAME} działa w tle`, 'Agent AI dokończy rozpoczęte dokumenty. Aplikację zamkniesz z menu ikony w zasobniku.');
      }
    }
  });
  win.on('maximize', () => emit('window:state', { maximized: true }));
  win.on('unmaximize', () => emit('window:state', { maximized: false }));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

// Tryb deweloperski: zrzuty ekranu (APP_SHOTS=katalog, APP_STEPS="nazwa=<JS>,...")
async function devScreenshots(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const steps = (process.env.APP_STEPS || 'dashboard').split(',');
  await wait(1800);
  if (process.env.APP_TEST_FILE) {
    const b64 = fs.readFileSync(process.env.APP_TEST_FILE).toString('base64');
    await win.webContents.executeJavaScript(`window.__testB64 = ${JSON.stringify(b64)}; true`);
  }
  for (const step of steps) {
    const [name, js, delay] = step.split('=');
    let result;
    if (js) result = await win.webContents.executeJavaScript(decodeURIComponent(js)).catch((e) => console.error(e));
    if (/\.docx$/.test(name)) { if (result) fs.writeFileSync(path.join(dir, name), Buffer.from(result, 'base64')); continue; }
    await wait(Number(delay) || 1000);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, name + '.png'), img.toPNG());
  }
  quitting = true;
  app.quit();
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  win.show();
  win.focus();
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(iconPath()).resize({ width: 22, height: 22 });
    tray = new Tray(img);
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `Otwórz ${APP_NAME}`, click: showWindow },
      { type: 'separator' },
      { label: 'Zakończ', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', showWindow);
  } catch (_) { tray = null; }
}

// ─────────────────────────── IPC ───────────────────────────
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; } catch (err) { return { ok: false, error: err.message || String(err) }; }
  });
}

const safeName = (s) => String(s || 'dokument').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataDir, portable: !!portableDir, today: new Date().toISOString(), mobile: false }));

  handle('window:control', (action) => {
    if (!win) return false;
    if (action === 'close') { win.close(); return false; }
    if (action === 'minimize') { win.minimize(); return win.isMaximized(); }
    if (action === 'maximize') {
      const target = !win.isMaximized(); // Linux: asynchronicznie – zwracamy stan docelowy
      if (target) win.maximize(); else win.unmaximize();
      return target;
    }
    return win.isMaximized();
  });

  handle('state:get', () => ({ settings: store.settings, students: store.students(), hasApiKey: !!getApiKey(), claudePath: findClaude(store.settings.ai.claudePath), outbox: store.data.outbox }));
  handle('settings:set', (patch) => {
    const s = store.updateSettings(patch);
    if (patch && patch.ui && patch.ui.theme) nativeTheme.themeSource = patch.ui.theme;
    return s;
  });
  handle('student:save', (s) => store.saveStudent(s));
  handle('student:delete', (id) => {
    store.deleteStudent(id);
    try { fs.rmSync(path.join(scansDir(), path.basename(id)), { recursive: true, force: true }); } catch (_) { /* brak */ }
    return true;
  });

  // skany orzeczeń – tylko na dysku tego komputera
  handle('scan:save', (studentId, name, base64) => {
    const dir = path.join(scansDir(), path.basename(studentId));
    fs.mkdirSync(dir, { recursive: true });
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    fs.writeFileSync(path.join(dir, id), Buffer.from(base64, 'base64'));
    return { id, name };
  });
  handle('scan:read', (studentId, id) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(scansDir(), path.basename(studentId), path.basename(id))).toString('base64'));

  handle('apikey:set', (key) => { setApiKey((key || '').trim()); return !!getApiKey(); });
  handle('ai:test', async () => {
    const p = getProvider();
    if (!p) return 'Tryb bez AI – dokumenty powstają z wbudowanej bazy wiedzy.';
    return p.test();
  });
  handle('ai:run', async (req) => {
    const p = getProvider();
    if (!p) throw new Error('Wybrano tryb bez AI.');
    const { task, system, prompt, webSearch, studentId } = req || {};
    guard(`${system}\n${prompt}`, p);
    store.logOutbox({ task, provider: p.label, local: p.isLocal, studentId, chars: (system || '').length + (prompt || '').length, webSearch: !!webSearch, preview: String(prompt || '').slice(0, 4000) });
    const r = await p.run({ system, prompt, webSearch: !!webSearch && store.settings.ai.useWebSearch });
    return { text: r.text };
  });
  handle('privacy:check', (text) => privacy.findLeaks(text, allSecrets()));

  handle('claude:status', () => account.status());
  handle('claude:install', () => account.install());
  handle('claude:login', () => { store.updateSettings({ ai: { provider: 'claude-code' } }); return account.startLogin(); });
  handle('claude:code', (code) => account.submitCode(code));
  handle('claude:cancel', () => { account.cancelLogin(); return true; });
  handle('claude:logout', () => account.logout());
  handle('ai:browseClaude', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Wskaż program Claude Code', properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    store.updateSettings({ ai: { claudePath: r.filePaths[0] } });
    return r.filePaths[0];
  });

  handle('file:save', async ({ name, base64 }) => {
    const def = path.join(app.getPath('documents'), safeName(name));
    const r = await dialog.showSaveDialog(win, { title: 'Zapisz dokument', defaultPath: def, filters: [{ name: 'Dokument Word', extensions: ['docx'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
    return { path: r.filePath };
  });
  handle('file:saveMany', async ({ folder, files }) => {
    const r = await dialog.showOpenDialog(win, { title: 'Wybierz folder na dokumenty', defaultPath: app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const dir = path.join(r.filePaths[0], safeName(folder));
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(dir, safeName(f.name)), Buffer.from(f.base64, 'base64'));
    return { path: dir, count: files.length };
  });
  handle('shell:showFile', (p) => shell.showItemInFolder(p));
  handle('shell:openFile', (p) => shell.openPath(p));
  handle('shell:openExternal', (url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
  handle('notify', (title, body) => { notify(title, body); return true; });
}

app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  store = new Store(dataDir);
  nativeTheme.themeSource = process.env.APP_THEME || store.settings.ui.theme || 'system';
  account = new ClaudeAccount({ getSettings: () => store.settings, emit });
  registerAppProtocol();
  lockDownNetwork();
  registerIpc();
  createWindow();
  createTray();
  app.on('activate', showWindow);
});

app.on('before-quit', () => { quitting = true; if (account) account.cancelLogin(); });
app.on('window-all-closed', () => {
  if (!store || !store.settings.agent.runInBackground || !tray) app.quit();
});
