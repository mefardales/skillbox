/**
 * VS Code API Shim for Skillbox Extension Host
 * Provides the `vscode` module that extensions import via require('vscode')
 */
const path = require('node:path');
const fs = require('node:fs');
const EventEmitter = require('node:events');

function createVscodeShim(extensionPath, ipcBridge) {

  // ── Event system (VS Code style) ──────────────────────────────
  class VscodeEventEmitter {
    constructor() {
      this._emitter = new EventEmitter();
      this._nextId = 0;
      this.event = (listener, thisArgs, disposables) => {
        const id = this._nextId++;
        const wrapped = (...args) => listener.apply(thisArgs, args);
        this._emitter.on('fire', wrapped);
        const disposable = { dispose: () => this._emitter.removeListener('fire', wrapped) };
        if (disposables) disposables.push(disposable);
        return disposable;
      };
    }
    fire(data) { this._emitter.emit('fire', data); }
    dispose() { this._emitter.removeAllListeners(); }
  }

  // ── Uri ────────────────────────────────────────────────────────
  class Uri {
    constructor(scheme, authority, fsPath, query, fragment) {
      this.scheme = scheme || 'file';
      this.authority = authority || '';
      this.path = fsPath || '';
      this.fsPath = fsPath || '';
      this.query = query || '';
      this.fragment = fragment || '';
    }
    toString() {
      if (this.scheme === 'file') return `file://${this.fsPath}`;
      return `${this.scheme}://${this.authority}${this.path}${this.query ? '?' + this.query : ''}`;
    }
    with(change) {
      return new Uri(
        change.scheme ?? this.scheme, change.authority ?? this.authority,
        change.path ?? this.path, change.query ?? this.query, change.fragment ?? this.fragment
      );
    }
    toJSON() { return { scheme: this.scheme, authority: this.authority, path: this.path, fsPath: this.fsPath, query: this.query, fragment: this.fragment }; }
    static file(p) { return new Uri('file', '', p); }
    static parse(str) {
      try {
        const u = new URL(str);
        return new Uri(u.protocol.replace(':', ''), u.hostname, u.pathname, u.search.replace('?', ''), u.hash.replace('#', ''));
      } catch { return new Uri('file', '', str); }
    }
    static joinPath(base, ...segments) {
      return Uri.file(path.join(base.fsPath || base.path, ...segments));
    }
    static from(components) {
      return new Uri(components.scheme, components.authority, components.path, components.query, components.fragment);
    }
  }

  // ── Disposable ─────────────────────────────────────────────────
  class Disposable {
    constructor(callOnDispose) { this._callOnDispose = callOnDispose; }
    dispose() { if (this._callOnDispose) { this._callOnDispose(); this._callOnDispose = null; } }
    static from(...disposables) {
      return new Disposable(() => disposables.forEach(d => d && d.dispose && d.dispose()));
    }
  }

  // ── RelativePattern ────────────────────────────────────────────
  class RelativePattern {
    constructor(base, pattern) {
      this.baseUri = typeof base === 'string' ? Uri.file(base) : (base.uri || base);
      this.base = this.baseUri.fsPath;
      this.pattern = pattern;
    }
  }

  // ── Cancellation Token ─────────────────────────────────────────
  class CancellationTokenSource {
    constructor() {
      this._cancelled = false;
      this._emitter = new VscodeEventEmitter();
      this.token = {
        isCancellationRequested: false,
        onCancellationRequested: this._emitter.event,
      };
    }
    cancel() {
      this._cancelled = true;
      this.token.isCancellationRequested = true;
      this._emitter.fire();
    }
    dispose() { this._emitter.dispose(); }
  }

  // ── Enums ──────────────────────────────────────────────────────
  const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9 };
  const StatusBarAlignment = { Left: 1, Right: 2 };
  const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
  const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
  const FileChangeType = { Changed: 1, Created: 2, Deleted: 3 };
  const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 };
  const TextDocumentChangeReason = { Undo: 1, Redo: 2 };
  const UIKind = { Desktop: 1, Web: 2 };
  const EndOfLine = { LF: 1, CRLF: 2 };

  // ── Command Registry ───────────────────────────────────────────
  const commandRegistry = new Map();

  const commands = {
    registerCommand(id, handler, thisArg) {
      commandRegistry.set(id, { handler, thisArg });
      return new Disposable(() => commandRegistry.delete(id));
    },
    async executeCommand(id, ...args) {
      const cmd = commandRegistry.get(id);
      if (cmd) return cmd.handler.apply(cmd.thisArg, args);
      // Forward to Skillbox
      if (ipcBridge.executeCommand) return ipcBridge.executeCommand(id, ...args);
    },
  };

  // ── Webview registry ───────────────────────────────────────────
  const webviewProviders = new Map();
  const webviewPanelSerializers = new Map();

  function createWebview(extPath, options = {}) {
    const _onDidReceiveMessage = new VscodeEventEmitter();
    const _onDidDispose = new VscodeEventEmitter();
    let _html = '';
    return {
      get options() { return options; },
      set options(v) { Object.assign(options, v); },
      get html() { return _html; },
      set html(v) {
        _html = v;
        if (ipcBridge.onWebviewHtmlChanged) ipcBridge.onWebviewHtmlChanged(_html);
      },
      onDidReceiveMessage: _onDidReceiveMessage.event,
      _fireMessage(msg) { _onDidReceiveMessage.fire(msg); },
      postMessage(msg) {
        if (ipcBridge.postMessageToWebview) return ipcBridge.postMessageToWebview(msg);
        return Promise.resolve(true);
      },
      asWebviewUri(localUri) {
        const filePath = localUri.fsPath || localUri.path || localUri.toString();
        return Uri.parse(`file://${filePath}`);
      },
      cspSource: "'unsafe-inline' 'unsafe-eval' file: data: blob:",
      _onDidReceiveMessage,
      _onDidDispose,
    };
  }

  function createWebviewView(extPath, viewId) {
    const webview = createWebview(extPath);
    const _onDidChangeVisibility = new VscodeEventEmitter();
    const _onDidDispose = new VscodeEventEmitter();
    return {
      viewType: viewId,
      webview,
      visible: true,
      show(preserveFocus) {},
      onDidChangeVisibility: _onDidChangeVisibility.event,
      onDidDispose: _onDidDispose.event,
      _onDidChangeVisibility,
      _onDidDispose,
    };
  }

  function createWebviewPanel(viewType, title, showOptions, panelOptions = {}) {
    const webview = createWebview(extensionPath, panelOptions);
    const _onDidDispose = new VscodeEventEmitter();
    const _onDidChangeViewState = new VscodeEventEmitter();
    const panel = {
      viewType, title, webview,
      active: true, visible: true,
      viewColumn: typeof showOptions === 'number' ? showOptions : (showOptions?.viewColumn || ViewColumn.One),
      options: panelOptions,
      onDidDispose: _onDidDispose.event,
      onDidChangeViewState: _onDidChangeViewState.event,
      reveal(viewColumn, preserveFocus) {
        if (ipcBridge.revealWebviewPanel) ipcBridge.revealWebviewPanel(viewType, title);
      },
      dispose() { _onDidDispose.fire(); },
      _onDidDispose,
      _onDidChangeViewState,
    };
    if (ipcBridge.onWebviewPanelCreated) ipcBridge.onWebviewPanelCreated(panel);
    return panel;
  }

  // ── Window ─────────────────────────────────────────────────────
  const _onDidChangeActiveTextEditor = new VscodeEventEmitter();
  const _onDidChangeVisibleTextEditors = new VscodeEventEmitter();
  const _onDidChangeTextEditorSelection = new VscodeEventEmitter();

  const window = {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    tabGroups: { all: [], onDidChangeTabs: new VscodeEventEmitter().event, onDidChangeTabGroups: new VscodeEventEmitter().event },

    onDidChangeActiveTextEditor: _onDidChangeActiveTextEditor.event,
    onDidChangeVisibleTextEditors: _onDidChangeVisibleTextEditors.event,
    onDidChangeTextEditorSelection: _onDidChangeTextEditorSelection.event,

    createOutputChannel(name, options) {
      const ch = {
        name, append() {}, appendLine(line) { console.log(`[${name}]`, line); },
        clear() {}, show() {}, hide() {}, dispose() {}, replace() {},
        // LogOutputChannel methods (VS Code 1.74+)
        info(msg, ...args) { console.log(`[${name}] INFO:`, msg, ...args); },
        warn(msg, ...args) { console.warn(`[${name}] WARN:`, msg, ...args); },
        error(msg, ...args) { console.error(`[${name}] ERROR:`, msg, ...args); },
        debug(msg, ...args) { console.log(`[${name}] DEBUG:`, msg, ...args); },
        trace(msg, ...args) { console.log(`[${name}] TRACE:`, msg, ...args); },
        logUri: Uri.file('/dev/null'),
        onDidChangeLogLevel: new VscodeEventEmitter().event,
      };
      return ch;
    },

    createStatusBarItem(alignmentOrId, priorityOrAlignment, priority) {
      const item = {
        text: '', tooltip: '', command: '', color: '', backgroundColor: undefined,
        alignment: StatusBarAlignment.Left, priority: 0, visible: false, id: '',
        name: '', accessibilityInformation: undefined,
        show() { this.visible = true; if (ipcBridge.onStatusBarChanged) ipcBridge.onStatusBarChanged(item); },
        hide() { this.visible = false; if (ipcBridge.onStatusBarChanged) ipcBridge.onStatusBarChanged(item); },
        dispose() { this.visible = false; },
      };
      return item;
    },

    registerWebviewViewProvider(viewId, provider, options) {
      webviewProviders.set(viewId, { provider, options });
      return new Disposable(() => webviewProviders.delete(viewId));
    },

    registerWebviewPanelSerializer(viewType, serializer) {
      webviewPanelSerializers.set(viewType, serializer);
      return new Disposable(() => webviewPanelSerializers.delete(viewType));
    },

    createWebviewPanel,

    registerUriHandler(handler) {
      return new Disposable(() => {});
    },

    showInformationMessage(message, ...items) {
      if (ipcBridge.showMessage) ipcBridge.showMessage('info', message);
      return Promise.resolve(items[0]);
    },
    showWarningMessage(message, ...items) {
      if (ipcBridge.showMessage) ipcBridge.showMessage('warning', message);
      return Promise.resolve(items[0]);
    },
    showErrorMessage(message, ...items) {
      if (ipcBridge.showMessage) ipcBridge.showMessage('error', message);
      return Promise.resolve(items[0]);
    },
    showInputBox(options = {}) {
      if (ipcBridge.showInputBox) return ipcBridge.showInputBox(options);
      return Promise.resolve(undefined);
    },
    showTextDocument(doc, options) {
      // Notify renderer to open this file in Monaco
      const filePath = typeof doc === 'string' ? doc : doc?.uri?.fsPath || doc?.fileName;
      if (filePath && ipcBridge?.openFileInEditor) {
        ipcBridge.openFileInEditor(filePath);
      }
      return Promise.resolve(undefined);
    },
  };

  // ── Workspace ──────────────────────────────────────────────────
  const _onDidChangeConfiguration = new VscodeEventEmitter();
  const _onDidChangeTextDocument = new VscodeEventEmitter();
  const _onDidSaveTextDocument = new VscodeEventEmitter();
  const _onWillSaveTextDocument = new VscodeEventEmitter();
  const _onDidChangeWorkspaceFolders = new VscodeEventEmitter();
  const _onDidCreateFiles = new VscodeEventEmitter();
  const _onDidDeleteFiles = new VscodeEventEmitter();
  const _onDidRenameFiles = new VscodeEventEmitter();
  const _onDidOpenTextDocument = new VscodeEventEmitter();
  const _onDidCloseTextDocument = new VscodeEventEmitter();

  // Extension settings store
  const extensionSettings = {};

  const workspace = {
    workspaceFolders: [],
    textDocuments: [],
    name: undefined,
    fs: {
      stat(uri) {
        try {
          const s = fs.statSync(uri.fsPath);
          return Promise.resolve({ type: s.isDirectory() ? 2 : 1, ctime: s.ctimeMs, mtime: s.mtimeMs, size: s.size });
        } catch { return Promise.reject(new Error('File not found')); }
      },
      readFile(uri) { try { return Promise.resolve(Buffer.from(fs.readFileSync(uri.fsPath))); } catch { return Promise.reject(new Error('Cannot read')); } },
      writeFile(uri, content) { try { fs.writeFileSync(uri.fsPath, content); return Promise.resolve(); } catch { return Promise.reject(new Error('Cannot write')); } },
      readDirectory(uri) {
        try {
          const entries = fs.readdirSync(uri.fsPath, { withFileTypes: true });
          return Promise.resolve(entries.map(e => [e.name, e.isDirectory() ? 2 : 1]));
        } catch { return Promise.resolve([]); }
      },
      delete(uri) { try { fs.rmSync(uri.fsPath, { recursive: true, force: true }); return Promise.resolve(); } catch { return Promise.reject(); } },
      rename(oldUri, newUri) { try { fs.renameSync(oldUri.fsPath, newUri.fsPath); return Promise.resolve(); } catch { return Promise.reject(); } },
      createDirectory(uri) { try { fs.mkdirSync(uri.fsPath, { recursive: true }); return Promise.resolve(); } catch { return Promise.reject(); } },
    },

    onDidChangeConfiguration: _onDidChangeConfiguration.event,
    onDidChangeTextDocument: _onDidChangeTextDocument.event,
    onDidSaveTextDocument: _onDidSaveTextDocument.event,
    onWillSaveTextDocument: _onWillSaveTextDocument.event,
    onDidChangeWorkspaceFolders: _onDidChangeWorkspaceFolders.event,
    onDidCreateFiles: _onDidCreateFiles.event,
    onDidDeleteFiles: _onDidDeleteFiles.event,
    onDidRenameFiles: _onDidRenameFiles.event,
    onDidOpenTextDocument: _onDidOpenTextDocument.event,
    onDidCloseTextDocument: _onDidCloseTextDocument.event,

    getConfiguration(section, scope) {
      const config = extensionSettings[section] || {};
      return {
        get(key, defaultValue) {
          return config[key] !== undefined ? config[key] : defaultValue;
        },
        has(key) { return config[key] !== undefined; },
        inspect(key) {
          return {
            key: `${section}.${key}`,
            defaultValue: undefined,
            globalValue: config[key],
            workspaceValue: undefined,
            workspaceFolderValue: undefined,
          };
        },
        update(key, value, target, overrideInLanguage) {
          config[key] = value;
          extensionSettings[section] = config;
          _onDidChangeConfiguration.fire({ affectsConfiguration: (s) => s === `${section}.${key}` || s === section });
          if (ipcBridge.onConfigChanged) ipcBridge.onConfigChanged(section, key, value);
          return Promise.resolve();
        },
      };
    },

    getWorkspaceFolder(uri) { return workspace.workspaceFolders[0] || undefined; },
    asRelativePath(pathOrUri, includeWorkspaceFolder) {
      const p = typeof pathOrUri === 'string' ? pathOrUri : (pathOrUri.fsPath || pathOrUri.path);
      const root = workspace.workspaceFolders?.[0]?.uri?.fsPath;
      if (root && p.startsWith(root)) return p.slice(root.length + 1);
      return p;
    },

    findFiles(include, exclude, maxResults, token) {
      // Basic glob implementation using workspace root
      const root = workspace.workspaceFolders?.[0]?.uri?.fsPath;
      if (!root) return Promise.resolve([]);
      try {
        const results = [];
        const _walk = (dir, depth) => {
          if (depth > 10 || (maxResults && results.length >= maxResults)) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) _walk(full, depth + 1);
              else if (entry.isFile()) {
                results.push(Uri.file(full));
                if (maxResults && results.length >= maxResults) return;
              }
            }
          } catch {}
        };
        _walk(root, 0);
        return Promise.resolve(results);
      } catch { return Promise.resolve([]); }
    },
    openTextDocument(uriOrPath) {
      const filePath = typeof uriOrPath === 'string' ? uriOrPath : uriOrPath?.fsPath || uriOrPath?.path;
      if (!filePath) return Promise.resolve({ uri: Uri.file(''), getText: () => '', lineCount: 0, lineAt: () => ({ text: '' }) });
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        return Promise.resolve({
          uri: Uri.file(filePath),
          fileName: filePath,
          languageId: path.extname(filePath).slice(1) || 'plaintext',
          lineCount: lines.length,
          getText: (range) => range ? lines.slice(range.start?.line || 0, (range.end?.line || lines.length) + 1).join('\n') : content,
          lineAt: (lineOrPos) => {
            const ln = typeof lineOrPos === 'number' ? lineOrPos : lineOrPos.line;
            return { text: lines[ln] || '', lineNumber: ln, range: { start: { line: ln, character: 0 }, end: { line: ln, character: (lines[ln] || '').length } } };
          },
          positionAt: (offset) => {
            let line = 0, ch = 0;
            for (let i = 0; i < offset && i < content.length; i++) { if (content[i] === '\n') { line++; ch = 0; } else ch++; }
            return { line, character: ch };
          },
          offsetAt: (pos) => lines.slice(0, pos.line).reduce((a, l) => a + l.length + 1, 0) + pos.character,
          save: () => Promise.resolve(true),
          isDirty: false,
          isUntitled: false,
          version: 1,
        });
      } catch {
        return Promise.resolve({ uri: Uri.file(filePath), getText: () => '', lineCount: 0, lineAt: () => ({ text: '' }) });
      }
    },

    registerFileSystemProvider(scheme, provider, options) {
      return new Disposable(() => {});
    },
    registerTextDocumentContentProvider(scheme, provider) {
      return new Disposable(() => {});
    },
  };

  // ── Languages ──────────────────────────────────────────────────
  const _onDidChangeDiagnostics = new VscodeEventEmitter();
  const languages = {
    getDiagnostics(resource) { return []; },
    onDidChangeDiagnostics: _onDidChangeDiagnostics.event,
  };

  // ── Extensions ─────────────────────────────────────────────────
  const extensions = {
    getExtension(id) { return undefined; },
    all: [],
  };

  // ── Misc classes ───────────────────────────────────────────────
  class Position {
    constructor(line, character) { this.line = line; this.character = character; }
  }
  class Range {
    constructor(startLine, startChar, endLine, endChar) {
      if (startLine instanceof Position) {
        this.start = startLine; this.end = startChar;
      } else {
        this.start = new Position(startLine, startChar);
        this.end = new Position(endLine, endChar);
      }
    }
  }
  class Selection extends Range {
    constructor(anchor, active) { super(anchor, active); this.anchor = anchor; this.active = active; }
  }
  class Location {
    constructor(uri, rangeOrPosition) { this.uri = uri; this.range = rangeOrPosition; }
  }
  class Diagnostic {
    constructor(range, message, severity) { this.range = range; this.message = message; this.severity = severity || 0; }
  }
  class ThemeColor {
    constructor(id) { this.id = id; }
  }
  class ThemeIcon {
    constructor(id, color) { this.id = id; this.color = color; }
    static File = new ThemeIcon('file');
    static Folder = new ThemeIcon('folder');
  }
  class MarkdownString {
    constructor(value, supportThemeIcons) { this.value = value || ''; this.isTrusted = false; this.supportThemeIcons = supportThemeIcons; }
    appendMarkdown(v) { this.value += v; return this; }
    appendText(v) { this.value += v; return this; }
    appendCodeblock(v, lang) { this.value += '\n```' + (lang || '') + '\n' + v + '\n```\n'; return this; }
  }

  class TabInputWebview {
    constructor(viewType) { this.viewType = viewType; }
  }
  class TabInputTextDiff {
    constructor(original, modified) { this.original = original; this.modified = modified; }
  }

  class FileSystemError extends Error {
    constructor(messageOrUri) { super(typeof messageOrUri === 'string' ? messageOrUri : messageOrUri?.toString()); this.code = 'FileSystemError'; }
    static FileNotFound(uri) { const e = new FileSystemError(uri); e.code = 'FileNotFound'; return e; }
    static FileExists(uri) { const e = new FileSystemError(uri); e.code = 'FileExists'; return e; }
    static NoPermissions(uri) { const e = new FileSystemError(uri); e.code = 'NoPermissions'; return e; }
    static Unavailable(uri) { const e = new FileSystemError(uri); e.code = 'Unavailable'; return e; }
  }

  class NotebookCellOutputItem {
    constructor(data, mime) { this.data = data; this.mime = mime; }
    static text(value, mime) { return new NotebookCellOutputItem(Buffer.from(value), mime || 'text/plain'); }
    static json(value, mime) { return new NotebookCellOutputItem(Buffer.from(JSON.stringify(value)), mime || 'application/json'); }
    static stdout(value) { return new NotebookCellOutputItem(Buffer.from(value), 'application/vnd.code.notebook.stdout'); }
    static stderr(value) { return new NotebookCellOutputItem(Buffer.from(value), 'application/vnd.code.notebook.stderr'); }
    static error(err) { return new NotebookCellOutputItem(Buffer.from(JSON.stringify({ name: err?.name || 'Error', message: err?.message || String(err), stack: err?.stack })), 'application/vnd.code.notebook.error'); }
  }

  // ── The vscode module ──────────────────────────────────────────
  const vscodeModule = {
    // Core classes
    Uri, Disposable, EventEmitter: VscodeEventEmitter, RelativePattern,
    CancellationTokenSource, Position, Range, Selection, Location, Diagnostic,
    ThemeColor, ThemeIcon, MarkdownString, FileSystemError,
    TabInputWebview, TabInputTextDiff, NotebookCellOutputItem,

    // Enums
    ViewColumn, StatusBarAlignment, ConfigurationTarget,
    DiagnosticSeverity, FileChangeType, FileType,
    TextDocumentChangeReason, UIKind, EndOfLine,

    // Namespaces
    window, workspace, commands, languages, extensions,

    // Env
    env: {
      appName: 'Skillbox',
      appRoot: extensionPath,
      language: 'en',
      uiKind: UIKind.Desktop,
      machineId: 'skillbox-desktop',
      sessionId: require('node:crypto').randomUUID(),
      clipboard: {
        readText: () => Promise.resolve(''),
        writeText: (t) => Promise.resolve(),
      },
      openExternal(uri) {
        if (ipcBridge.openExternal) return ipcBridge.openExternal(uri.toString());
        return Promise.resolve(true);
      },
      createTelemetryLogger() {
        return { logUsage() {}, logError() {}, dispose() {}, onDidChangeEnableStates: new VscodeEventEmitter().event };
      },
    },

    // Version (VS Code 1.96 compatibility)
    version: '1.96.0',

    // Internal access for the extension host
    _internal: {
      webviewProviders,
      webviewPanelSerializers,
      commandRegistry,
      extensionSettings,
      createWebviewView,
      events: {
        onDidChangeConfiguration: _onDidChangeConfiguration,
        onDidChangeActiveTextEditor: _onDidChangeActiveTextEditor,
      },
      setWorkspaceFolders(folders) {
        const oldFolders = workspace.workspaceFolders || [];
        workspace.workspaceFolders = folders.map((f, i) => ({
          uri: Uri.file(f), name: path.basename(f), index: i,
        }));
        _onDidChangeWorkspaceFolders.fire({
          added: workspace.workspaceFolders,
          removed: oldFolders,
        });
      },
    },
  };

  return vscodeModule;
}

module.exports = { createVscodeShim };
