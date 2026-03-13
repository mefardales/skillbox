/**
 * Preload script injected into extension webview <webview> tags.
 * Bridges acquireVsCodeApi().postMessage <-> ipcRenderer for two-way communication.
 */
const { ipcRenderer } = require('electron');

// acquireVsCodeApi shim
const vscodeApi = {
  postMessage(msg) {
    ipcRenderer.sendToHost('webview-message', msg);
  },
  getState() {
    try { return JSON.parse(sessionStorage.getItem('vscode-state') || 'null'); } catch { return null; }
  },
  setState(state) {
    sessionStorage.setItem('vscode-state', JSON.stringify(state));
    return state;
  }
};

window.acquireVsCodeApi = function() { return vscodeApi; };

// Listen for messages from extension host (forwarded through main process)
ipcRenderer.on('extension-to-webview', (_e, msg) => {
  window.dispatchEvent(new MessageEvent('message', { data: msg }));
});
