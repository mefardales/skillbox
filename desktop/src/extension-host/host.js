/**
 * Skillbox Extension Host
 * Loads and manages VS Code compatible extensions
 */
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const { createVscodeShim } = require('./vscode-shim');

class ExtensionHost {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.extensions = new Map(); // extId -> { pkg, shim, api, activated, extPath }
    this._originalResolve = null;
  }

  /** Load an extension from its directory */
  async activate(extPath, extId) {
    if (this.extensions.has(extId) && this.extensions.get(extId).activated) {
      return { success: true, already: true };
    }

    try {
      const pkgPath = path.join(extPath, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const mainFile = pkg.main || './extension.js';
      const mainPath = path.resolve(extPath, mainFile);

      if (!fs.existsSync(mainPath)) {
        return { success: false, error: `Main file not found: ${mainFile}` };
      }

      // Create IPC bridge for this extension
      const ipcBridge = this._createIpcBridge(extId);

      // Create vscode shim
      const shim = createVscodeShim(extPath, ipcBridge);

      // Set workspace folders from active project if available
      if (this.mainWindow) {
        this.mainWindow.webContents.send('extension-request-workspace');
      }

      // Initialize extension settings from package.json contributes.configuration
      const config = pkg.contributes?.configuration;
      if (config) {
        const props = (Array.isArray(config) ? config[0] : config)?.properties || {};
        for (const [key, schema] of Object.entries(props)) {
          const parts = key.split('.');
          const section = parts[0];
          const prop = parts.slice(1).join('.');
          if (!shim._internal.extensionSettings[section]) shim._internal.extensionSettings[section] = {};
          if (schema.default !== undefined) {
            shim._internal.extensionSettings[section][prop] = schema.default;
          }
        }
      }

      // Hook require to intercept 'vscode'
      const origResolve = Module._resolveFilename;
      Module._resolveFilename = function(request, parent, ...rest) {
        if (request === 'vscode') return 'vscode';
        return origResolve.call(this, request, parent, ...rest);
      };
      const origCache = Module._cache['vscode'];
      const fakeModule = new Module('vscode');
      fakeModule.exports = shim;
      fakeModule.loaded = true;
      Module._cache['vscode'] = fakeModule;

      // Create ExtensionContext
      const globalStoragePath = path.join(extPath, '.storage');
      fs.mkdirSync(globalStoragePath, { recursive: true });

      const context = {
        subscriptions: [],
        extensionPath: extPath,
        extensionUri: shim.Uri.file(extPath),
        globalStoragePath,
        globalStorageUri: shim.Uri.file(globalStoragePath),
        storagePath: globalStoragePath,
        storageUri: shim.Uri.file(globalStoragePath),
        logPath: globalStoragePath,
        logUri: shim.Uri.file(globalStoragePath),
        extensionMode: 1, // Production
        extension: {
          id: pkg.publisher ? `${pkg.publisher}.${pkg.name}` : extId,
          extensionUri: shim.Uri.file(extPath),
          extensionPath: extPath,
          isActive: true,
          packageJSON: pkg,
          extensionKind: 1,
          exports: undefined,
        },
        globalState: this._createMemento(),
        workspaceState: this._createMemento(),
        secrets: {
          get: (key) => Promise.resolve(undefined),
          store: (key, value) => Promise.resolve(),
          delete: (key) => Promise.resolve(),
          onDidChange: new shim.EventEmitter().event,
        },
        environmentVariableCollection: {
          persistent: true,
          description: '',
          replace() {}, append() {}, prepend() {}, get() {}, forEach() {},
          clear() {}, delete() {},
          [Symbol.iterator]: function* () {},
          getScoped: () => ({
            persistent: true, replace() {}, append() {}, prepend() {}, get() {},
            forEach() {}, clear() {}, delete() {},
            [Symbol.iterator]: function* () {},
          }),
        },
        asAbsolutePath: (rel) => path.join(extPath, rel),
      };

      // Load and activate the extension
      let extModule;
      try {
        // Clear any cached version of this extension
        delete require.cache[mainPath];
        extModule = require(mainPath);
      } catch (e) {
        // Restore require hook
        Module._resolveFilename = origResolve;
        if (origCache) Module._cache['vscode'] = origCache;
        else delete Module._cache['vscode'];
        return { success: false, error: `Failed to load extension: ${e.message}` };
      }

      let api;
      try {
        api = await (extModule.activate || extModule.default?.activate)?.(context);
      } catch (e) {
        Module._resolveFilename = origResolve;
        if (origCache) Module._cache['vscode'] = origCache;
        else delete Module._cache['vscode'];
        return { success: false, error: `Failed to activate extension: ${e.message}` };
      }

      // Keep the require hook active for this extension's ongoing needs
      // but save reference for cleanup
      const extData = {
        pkg, shim, api, context, extPath, activated: true,
        origResolve, origCache, ipcBridge,
        webviewViews: new Map(),
      };
      this.extensions.set(extId, extData);

      // Collect contributed info
      const contributes = this._getContributedInfo(extId, pkg, shim);

      return { success: true, contributes };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /** Deactivate an extension */
  async deactivate(extId) {
    const ext = this.extensions.get(extId);
    if (!ext) return { success: false, error: 'Not activated' };

    try {
      // Call extension's deactivate
      const mainPath = path.resolve(ext.extPath, ext.pkg.main || './extension.js');
      const extModule = require.cache[mainPath]?.exports;
      if (extModule?.deactivate) await extModule.deactivate();

      // Dispose subscriptions
      for (const sub of ext.context.subscriptions) {
        try { sub.dispose?.(); } catch {}
      }

      // Restore require hook
      Module._resolveFilename = ext.origResolve;
      if (ext.origCache) Module._cache['vscode'] = ext.origCache;
      else delete Module._cache['vscode'];

      // Clear cache
      delete require.cache[mainPath];

      ext.activated = false;
      this.extensions.delete(extId);

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /** Resolve a webview view (trigger the provider to build the webview HTML) */
  async resolveWebviewView(extId, viewId) {
    const ext = this.extensions.get(extId);
    if (!ext) return { success: false, error: 'Extension not activated' };

    const providerEntry = ext.shim._internal.webviewProviders.get(viewId);
    if (!providerEntry) return { success: false, error: `No provider for view: ${viewId}` };

    // Dispose old webview view if exists (project switch)
    const oldView = ext.webviewViews.get(viewId);
    if (oldView && oldView._onDidDispose) {
      oldView._onDidDispose.fire();
      ext.webviewViews.delete(viewId);
    }

    const webviewView = ext.shim._internal.createWebviewView(ext.extPath, viewId);

    // Set up message forwarding
    webviewView.webview._onDidReceiveMessage.event((msg) => {
      // Extension received message from webview - handled internally
    });

    console.log('[ext-host] resolveWebviewView workspace:', JSON.stringify(ext.shim.workspace.workspaceFolders?.map(f => f.uri.fsPath)));
    try {
      await providerEntry.provider.resolveWebviewView(webviewView, {}, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) });
    } catch (e) {
      return { success: false, error: `resolveWebviewView failed: ${e.message}` };
    }

    ext.webviewViews.set(viewId, webviewView);

    // Process webview HTML to fix asset paths
    let html = webviewView.webview.html;
    html = this._processWebviewHtml(html, ext.extPath, extId);

    // Write processed HTML to a temp file so it can be loaded as file:// URL
    const tmpDir = path.join(ext.extPath, '.webview-tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `${viewId}.html`);
    fs.writeFileSync(tmpFile, html, 'utf-8');

    const preloadPath = path.join(__dirname, 'webview-preload.js');
    return { success: true, html, viewId, htmlPath: tmpFile, extPath: ext.extPath, preloadPath };
  }

  /** Forward a message from the renderer webview to the extension */
  forwardMessageToExtension(extId, viewId, message) {
    const ext = this.extensions.get(extId);
    if (!ext) return;
    const view = ext.webviewViews.get(viewId);
    if (view) {
      view.webview._onDidReceiveMessage.fire(message);
    }
  }

  /** Execute a registered command */
  async executeCommand(extId, commandId, ...args) {
    const ext = this.extensions.get(extId);
    if (!ext) return;
    return ext.shim.commands.executeCommand(commandId, ...args);
  }

  /** Get extension configuration schema */
  getConfigSchema(extId) {
    const ext = this.extensions.get(extId);
    if (!ext) return null;
    const config = ext.pkg.contributes?.configuration;
    if (!config) return null;
    return Array.isArray(config) ? config[0] : config;
  }

  /** Update extension configuration */
  updateConfig(extId, section, key, value) {
    const ext = this.extensions.get(extId);
    if (!ext) return;
    if (!ext.shim._internal.extensionSettings[section]) ext.shim._internal.extensionSettings[section] = {};
    ext.shim._internal.extensionSettings[section][key] = value;
    ext.shim._internal.events.onDidChangeConfiguration.fire({
      affectsConfiguration: (s) => s === `${section}.${key}` || s === section,
    });
  }

  /** Set the active workspace */
  setWorkspace(projectPath) {
    console.log('[ext-host] setWorkspace:', projectPath);
    for (const [, ext] of this.extensions) {
      ext.shim._internal.setWorkspaceFolders(projectPath ? [projectPath] : []);
    }
  }

  /** Re-resolve a webview view (dispose old, create fresh with current workspace) */
  async reResolveWebviewView(extId, viewId) {
    const ext = this.extensions.get(extId);
    if (!ext) return { success: false, error: 'Extension not activated' };

    // Dispose old webview view if it exists
    const oldView = ext.webviewViews.get(viewId);
    if (oldView && oldView._onDidDispose) {
      oldView._onDidDispose.fire();
    }
    ext.webviewViews.delete(viewId);

    // Re-resolve with current workspace folders
    return this.resolveWebviewView(extId, viewId);
  }

  // ── Private ────────────────────────────────────────────────────

  _createIpcBridge(extId) {
    const self = this;
    return {
      onWebviewHtmlChanged(html) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('extension-webview-html', { extId, html });
        }
      },
      postMessageToWebview(msg) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('extension-webview-message', { extId, message: msg });
        }
        return Promise.resolve(true);
      },
      openFileInEditor(filePath) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('open-file-in-editor', { filePath });
        }
      },
      showMessage(type, message) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('extension-toast', { type, message });
        }
      },
      showInputBox(options) {
        return new Promise((resolve) => {
          if (self.mainWindow && !self.mainWindow.isDestroyed()) {
            self.mainWindow.webContents.send('extension-input-box', { extId, options });
            // TODO: wait for response
            resolve(undefined);
          } else resolve(undefined);
        });
      },
      openExternal(url) {
        const { shell } = require('electron');
        shell.openExternal(url);
        return Promise.resolve(true);
      },
      onStatusBarChanged(item) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('extension-statusbar', { extId, item: { text: item.text, tooltip: item.tooltip, visible: item.visible, command: item.command } });
        }
      },
      onConfigChanged(section, key, value) {
        if (self.mainWindow && !self.mainWindow.isDestroyed()) {
          self.mainWindow.webContents.send('extension-config-changed', { extId, section, key, value });
        }
      },
      executeCommand(id, ...args) {
        // Check all extensions for the command
        for (const [, ext] of self.extensions) {
          const cmd = ext.shim._internal.commandRegistry.get(id);
          if (cmd) return cmd.handler.apply(cmd.thisArg, args);
        }
      },
    };
  }

  _createMemento() {
    const store = {};
    return {
      keys: () => Object.keys(store),
      get: (key, defaultValue) => store[key] !== undefined ? store[key] : defaultValue,
      update: (key, value) => { store[key] = value; return Promise.resolve(); },
      setKeysForSync: () => {},
    };
  }

  _getContributedInfo(extId, pkg, shim) {
    const contributes = pkg.contributes || {};
    const result = {
      commands: (contributes.commands || []).map(c => ({ id: c.command, title: c.title, icon: c.icon })),
      configuration: contributes.configuration,
      viewsContainers: contributes.viewsContainers,
      views: contributes.views,
      keybindings: contributes.keybindings,
      webviewProviders: [...shim._internal.webviewProviders.keys()],
      statusBarItems: [],
    };
    return result;
  }

  _processWebviewHtml(html, extPath, extId) {
    if (!html) return '';
    // Replace skillbox-ext:// with file:// pointing to extension dir
    html = html.replace(/skillbox-ext:\/\/ext\//g, `file://${extPath}/`);
    // Replace vscode-resource: and https://file+.vscode-resource.vscode-cdn.net URLs
    html = html.replace(/https:\/\/file\+\.vscode-resource\.vscode-cdn\.net([^"'\s]*)/g, (m, p) => `file://${p}`);
    html = html.replace(/vscode-resource:/g, 'file://');
    // Remove the restrictive CSP entirely so scripts/styles can load from file://
    html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/gi, '');

    // Inject VS Code theme CSS variables (dark theme mapped to Skillbox colors)
    const themeVars = `<style>
:root {
  --vscode-foreground: #e0ddd5;
  --vscode-descriptionForeground: #9a9689;
  --vscode-disabledForeground: #6b6560;
  --vscode-errorForeground: #f87171;
  --vscode-focusBorder: #3b82f6;
  --vscode-contrastBorder: transparent;
  --vscode-contrastActiveBorder: transparent;
  --vscode-editor-background: #1a1625;
  --vscode-editor-foreground: #e0ddd5;
  --vscode-editor-font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  --vscode-editor-font-size: 15px;
  --vscode-editor-font-weight: normal;
  --vscode-editor-selectionBackground: #3b82f644;
  --vscode-editor-inactiveSelectionBackground: #3b82f622;
  --vscode-editor-lineHighlightBackground: #ffffff08;
  --vscode-editor-placeholder-foreground: #6b6560;
  --vscode-sideBar-background: #0f1117;
  --vscode-sideBarSectionHeader-border: #252830;
  --vscode-sideBarActivityBarTop-border: #252830;
  --vscode-panel-border: #252830;
  --vscode-input-background: #181a20;
  --vscode-input-foreground: #e0ddd5;
  --vscode-input-placeholderForeground: #6b6560;
  --vscode-inlineChatInput-border: #252830;
  --vscode-inputOption-activeBorder: #3b82f6;
  --vscode-inputOption-hoverBackground: #3b82f622;
  --vscode-inputValidation-infoBorder: #3b82f6;
  --vscode-button-background: #3b82f6;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #2563eb;
  --vscode-button-secondaryBackground: #252830;
  --vscode-button-secondaryForeground: #e0ddd5;
  --vscode-button-secondaryHoverBackground: #3d3555;
  --vscode-button-border: transparent;
  --vscode-button-separator: #ffffff33;
  --vscode-badge-background: #3b82f6;
  --vscode-badge-foreground: #ffffff;
  --vscode-list-hoverBackground: #ffffff0a;
  --vscode-list-activeSelectionBackground: #3b82f633;
  --vscode-list-activeSelectionForeground: #ffffff;
  --vscode-list-focusHighlightForeground: #3b82f6;
  --vscode-list-highlightForeground: #3b82f6;
  --vscode-menu-background: #181a20;
  --vscode-menu-foreground: #e0ddd5;
  --vscode-menu-selectionBackground: #3b82f633;
  --vscode-menu-selectionForeground: #ffffff;
  --vscode-menu-border: #252830;
  --vscode-menu-selectionBorder: transparent;
  --vscode-notifications-background: #181a20;
  --vscode-progressBar-background: #3b82f6;
  --vscode-scrollbarSlider-background: #ffffff15;
  --vscode-scrollbarSlider-hoverBackground: #ffffff25;
  --vscode-scrollbarSlider-activeBackground: #ffffff35;
  --vscode-scrollbar-shadow: #00000044;
  --vscode-textLink-foreground: #93c5fd;
  --vscode-textLink-activeForeground: #93c5fd;
  --vscode-textCodeBlock-background: #181a20;
  --vscode-icon-foreground: #9a9689;
  --vscode-toolbar-hoverBackground: #ffffff0a;
  --vscode-widget-border: #252830;
  --vscode-widget-shadow: #00000044;
  --vscode-editorWidget-background: #181a20;
  --vscode-editorWidget-foreground: #e0ddd5;
  --vscode-editorWidget-border: #252830;
  --vscode-editorHoverWidget-background: #181a20;
  --vscode-editorHoverWidget-foreground: #e0ddd5;
  --vscode-editorHoverWidget-border: #252830;
  --vscode-editorHoverWidget-statusBarBackground: #0f1117;
  --vscode-editorCursor-foreground: #3b82f6;
  --vscode-editorLineNumber-foreground: #3b3f4a;
  --vscode-editorLineNumber-activeForeground: #9a9689;
  --vscode-editorWhitespace-foreground: #252830;
  --vscode-editorLink-activeForeground: #93c5fd;
  --vscode-editorRuler-foreground: #252830;
  --vscode-editorGutter-background: transparent;
  --vscode-editorGutter-foldingControlForeground: #9a9689;
  --vscode-editorGutter-commentRangeForeground: #6b6560;
  --vscode-editorError-background: transparent;
  --vscode-editorError-border: transparent;
  --vscode-editorWarning-background: transparent;
  --vscode-editorWarning-border: transparent;
  --vscode-editorInfo-background: transparent;
  --vscode-editorInfo-border: transparent;
  --vscode-editorBracketMatch-background: #3b82f622;
  --vscode-editorBracketMatch-border: #3b82f644;
  --vscode-editorSuggestWidget-background: #181a20;
  --vscode-editorSuggestWidget-border: #252830;
  --vscode-editorSuggestWidget-foreground: #e0ddd5;
  --vscode-editorSuggestWidget-highlightForeground: #3b82f6;
  --vscode-editorSuggestWidget-focusHighlightForeground: #93c5fd;
  --vscode-editorSuggestWidget-selectedForeground: #ffffff;
  --vscode-editorSuggestWidget-selectedIconForeground: #ffffff;
  --vscode-keybindingLabel-background: #252830;
  --vscode-keybindingLabel-foreground: #e0ddd5;
  --vscode-keybindingLabel-border: #3d3555;
  --vscode-keybindingLabel-bottomBorder: #181a20;
  --vscode-chat-font-size: 15px;
  --vscode-font-size: 15px;
  --vscode-chat-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  --vscode-diffEditor-insertedTextBackground: #22c55e22;
  --vscode-diffEditor-removedTextBackground: #ef444422;
  --vscode-diffEditor-insertedLineBackground: #22c55e11;
  --vscode-diffEditor-removedLineBackground: #ef444411;
  --vscode-diffEditor-border: #252830;
  --vscode-diffEditor-diagonalFill: #25283066;
  --vscode-diffEditorGutter-insertedLineBackground: #22c55e22;
  --vscode-diffEditorGutter-removedLineBackground: #ef444422;
  --vscode-gitDecoration-addedResourceForeground: #22c55e;
  --vscode-gitDecoration-deletedResourceForeground: #ef4444;
  --vscode-problemsErrorIcon-foreground: #f87171;
  --vscode-problemsWarningIcon-foreground: #fbbf24;
  --vscode-problemsInfoIcon-foreground: #60a5fa;
  --vscode-charts-blue: #60a5fa;
  --vscode-charts-green: #22c55e;
  --vscode-actionBar-toggledBackground: #3b82f633;
  --vscode-sash-size: 4px;
  --vscode-sash-hoverBorder: #3b82f6;
  --vscode-banner-background: #3b82f6;
  --vscode-banner-foreground: #ffffff;
  --vscode-banner-iconForeground: #ffffff;
  --vscode-symbolIcon-classForeground: #fbbf24;
  --vscode-symbolIcon-functionForeground: #93c5fd;
  --vscode-symbolIcon-variableForeground: #60a5fa;
  --vscode-symbolIcon-stringForeground: #fb923c;
  --vscode-symbolIcon-numberForeground: #34d399;
  --vscode-symbolIcon-booleanForeground: #60a5fa;
  --vscode-symbolIcon-keyForeground: #60a5fa;
  --vscode-symbolIcon-keywordForeground: #f472b6;
  --vscode-symbolIcon-methodForeground: #93c5fd;
  --vscode-symbolIcon-propertyForeground: #60a5fa;
  --vscode-symbolIcon-fileForeground: #9a9689;
  --vscode-symbolIcon-folderForeground: #fbbf24;
  --vscode-symbolIcon-moduleForeground: #fb923c;
  --vscode-symbolIcon-constantForeground: #34d399;
  --vscode-symbolIcon-interfaceForeground: #60a5fa;
  --vscode-symbolIcon-enumeratorForeground: #fbbf24;
  --vscode-symbolIcon-enumeratorMemberForeground: #60a5fa;
  --vscode-symbolIcon-constructorForeground: #93c5fd;
  --vscode-symbolIcon-eventForeground: #fbbf24;
  --vscode-symbolIcon-fieldForeground: #60a5fa;
  --vscode-symbolIcon-objectForeground: #fb923c;
  --vscode-symbolIcon-operatorForeground: #9a9689;
  --vscode-symbolIcon-packageForeground: #fb923c;
  --vscode-symbolIcon-referenceForeground: #60a5fa;
  --vscode-symbolIcon-snippetForeground: #9a9689;
  --vscode-symbolIcon-textForeground: #9a9689;
  --vscode-symbolIcon-typeParameterForeground: #60a5fa;
  --vscode-symbolIcon-unitForeground: #60a5fa;
  --vscode-symbolIcon-arrayForeground: #fb923c;
  --vscode-symbolIcon-nullForeground: #6b6560;
  --vscode-symbolIcon-namespaceForeground: #fbbf24;
  --vscode-symbolIcon-structForeground: #fbbf24;
  --vscode-symbolIcon-colorForeground: #fb923c;
  --vscode-editorStickyScroll-background: #0f1117;
  --vscode-editorStickyScroll-border: #252830;
  --vscode-editorStickyScroll-shadow: #00000044;
  --vscode-editorStickyScrollHover-background: #181a20;
  --vscode-minimapSlider-background: #ffffff10;
  --vscode-minimapSlider-hoverBackground: #ffffff20;
  --vscode-minimapSlider-activeBackground: #ffffff30;
  --vscode-peekViewEditor-background: #181a20;
  --vscode-peekViewResult-background: #0f1117;
  --vscode-peekViewResult-fileForeground: #e0ddd5;
  --vscode-peekViewResult-lineForeground: #9a9689;
  --vscode-peekViewResult-selectionBackground: #3b82f633;
  --vscode-peekViewResult-selectionForeground: #ffffff;
  --vscode-peekViewResult-matchHighlightBackground: #3b82f644;
  --vscode-peekViewEditor-matchHighlightBackground: #3b82f644;
  --vscode-editorActionList-background: #181a20;
  --vscode-editorActionList-foreground: #e0ddd5;
  --vscode-editorActionList-focusBackground: #3b82f633;
  --vscode-editorActionList-focusForeground: #ffffff;
  --vscode-multiDiffEditor-background: #0f1117;
  --vscode-multiDiffEditor-border: #252830;
  --vscode-multiDiffEditor-headerBackground: #181a20;
  --vscode-diffEditor-unchangedRegionBackground: #181a20;
  --vscode-diffEditor-unchangedRegionForeground: #9a9689;
  --vscode-diffEditor-unchangedRegionShadow: #00000044;
  --vscode-diffEditor-unchangedCodeBackground: transparent;
  --vscode-editor-findMatchBackground: #3b82f644;
  --vscode-editor-findMatchHighlightBackground: #3b82f622;
  --vscode-editor-findMatchBorder: #3b82f6;
  --vscode-editor-findRangeHighlightBackground: #3b82f611;
  --vscode-editor-foldBackground: #3b82f611;
  --vscode-editor-foldPlaceholderForeground: #9a9689;
  --vscode-editor-hoverHighlightBackground: #3b82f611;
  --vscode-editor-linkedEditingBackground: #3b82f622;
  --vscode-editor-rangeHighlightBackground: #3b82f611;
  --vscode-editor-rangeHighlightBorder: transparent;
  --vscode-editor-selectionHighlightBackground: #3b82f622;
  --vscode-editor-selectionHighlightBorder: transparent;
  --vscode-editor-snippetTabstopHighlightBackground: #3b82f622;
  --vscode-editor-snippetTabstopHighlightBorder: transparent;
  --vscode-editor-snippetFinalTabstopHighlightBackground: transparent;
  --vscode-editor-snippetFinalTabstopHighlightBorder: #3b82f644;
  --vscode-editor-symbolHighlightBackground: #3b82f622;
  --vscode-editor-symbolHighlightBorder: transparent;
  --vscode-editor-wordHighlightBackground: #3b82f622;
  --vscode-editor-wordHighlightBorder: transparent;
  --vscode-editor-wordHighlightStrongBackground: #3b82f633;
  --vscode-editor-wordHighlightStrongBorder: transparent;
  --vscode-editor-wordHighlightTextBackground: #3b82f622;
  --vscode-editor-wordHighlightTextBorder: transparent;
  --vscode-editorGhostText-foreground: #6b6560;
  --vscode-editorGhostText-background: transparent;
  --vscode-editorGhostText-border: transparent;
  --vscode-editorHint-border: transparent;
  --vscode-editorLightBulb-foreground: #fbbf24;
  --vscode-editorLightBulbAi-foreground: #93c5fd;
  --vscode-editorLightBulbAutoFix-foreground: #22c55e;
  --vscode-editorUnicodeHighlight-background: transparent;
  --vscode-editorUnicodeHighlight-border: #fbbf24;
  --vscode-editorUnnecessaryCode-border: transparent;
  --vscode-editorCodeLens-foreground: #6b6560;
  --vscode-editorCodeLens-fontFamily: inherit;
  --vscode-editorCodeLens-fontFamilyDefault: inherit;
  --vscode-editorCodeLens-fontSize: 12px;
  --vscode-editorCodeLens-lineHeight: 1.4;
  --vscode-editorCodeLens-fontFeatureSettings: normal;
  --vscode-editorWidget-resizeBorder: #3b82f6;
  --vscode-hover-maxWidth: 500px;
  --vscode-hover-whiteSpace: normal;
  --vscode-hover-sourceWhiteSpace: pre-wrap;
  --vscode-editorStickyScroll-foldingOpacityTransition: opacity 0.5s;
  --vscode-editorStickyScroll-scrollableWidth: 100%;
  --vscode-sash-hover-size: 4px;
  --vscode-parameterHintsWidget-editorFontFamily: inherit;
  --vscode-parameterHintsWidget-editorFontFamilyDefault: inherit;
  --vscode-icon-x-content: '\\ea76';
  --vscode-icon-x-font-family: codicon;
  --vscode-diffEditor-move-border: #3b82f644;
  --vscode-diffEditor-moveActive-border: #3b82f6;
  --vscode-diffEditor-insertedTextBorder: transparent;
  --vscode-diffEditor-removedTextBorder: transparent;
  --vscode-peekViewEditor-matchHighlightBorder: transparent;
  --vscode-peekViewEditorGutter-background: transparent;
  --vscode-peekViewEditorStickyScroll-background: #181a20;
  --vscode-editorSuggestWidgetStatus-foreground: #6b6560;
}
html {
  font-size: 15px;
}
body {
  font-size: 15px;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  margin: 0;
  padding: 0;
}
textarea, input, select, button { font-size: 15px !important; }
pre, code { font-size: 14px !important; }
/* Skillbox-style scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
::-webkit-scrollbar-corner { background: transparent; }
</style>`;

    // Inject acquireVsCodeApi shim directly into the page so it's available before module scripts
    const acquireShim = `<script>
(function() {
  const vscodeApi = {
    postMessage(msg) {
      window.parent.postMessage({ type: 'webview-message', data: msg }, '*');
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
  // Listen for messages from extension host
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'extension-to-webview') {
      window.dispatchEvent(new MessageEvent('message', { data: e.data.data }));
    }
  });
})();
</script>`;

    // Insert theme vars and acquireVsCodeApi shim right after <head>
    const headInsert = themeVars + acquireShim;
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head>' + headInsert);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', headInsert + '</head>');
    } else {
      html = headInsert + html;
    }

    return html;
  }
}

module.exports = { ExtensionHost };
