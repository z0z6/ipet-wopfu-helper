'use strict';
// Most między oknem a procesem głównym. Na Androidzie ten sam interfejs `window.api`
// dostarcza src/renderer/platform-android.js.
const { contextBridge, ipcRenderer } = require('electron');

const call = async (channel, ...args) => {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

contextBridge.exposeInMainWorld('api', {
  info: () => call('app:info'),
  windowControl: (a) => call('window:control', a),
  getState: () => call('state:get'),
  setSettings: (patch) => call('settings:set', patch),
  saveStudent: (s) => call('student:save', s),
  deleteStudent: (id) => call('student:delete', id),
  saveScan: (studentId, name, base64) => call('scan:save', studentId, name, base64),
  readScan: (studentId, id) => call('scan:read', studentId, id),
  setApiKey: (k) => call('apikey:set', k),
  testAi: () => call('ai:test'),
  aiRun: (req) => call('ai:run', req),
  privacyCheck: (text) => call('privacy:check', text),
  claudeStatus: () => call('claude:status'),
  claudeInstall: () => call('claude:install'),
  claudeLogin: () => call('claude:login'),
  claudeCode: (code) => call('claude:code', code),
  claudeCancel: () => call('claude:cancel'),
  claudeLogout: () => call('claude:logout'),
  browseClaude: () => call('ai:browseClaude'),
  saveFile: (f) => call('file:save', f),
  saveFiles: (f) => call('file:saveMany', f),
  showFile: (p) => call('shell:showFile', p),
  openFile: (p) => call('shell:openFile', p),
  openExternal: (u) => call('shell:openExternal', u),
  notify: (t, b) => call('notify', t, b),
  on: (channel, fn) => {
    const allowed = ['window:state', 'claude:log', 'claude:login'];
    if (!allowed.includes(channel)) return () => {};
    const h = (_e, payload) => fn(payload);
    ipcRenderer.on(channel, h);
    return () => ipcRenderer.removeListener(channel, h);
  }
});
