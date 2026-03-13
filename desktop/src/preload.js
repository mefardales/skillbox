const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('skillbox', {
  // Registry & Skills
  getRegistry: () => ipcRenderer.invoke('get-registry'),
  getSkillContent: (id) => ipcRenderer.invoke('get-skill-content', id),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  addProject: (dir) => ipcRenderer.invoke('add-project', dir),
  removeProject: (dir) => ipcRenderer.invoke('remove-project', dir),
  toggleProjectSkill: (p, s) => ipcRenderer.invoke('toggle-project-skill', p, s),
  installSkillToProject: (p, s) => ipcRenderer.invoke('install-skill-to-project', p, s),
  browseFolder: () => ipcRenderer.invoke('browse-folder'),
  readDirectory: (dir, depth) => ipcRenderer.invoke('read-directory', dir, depth),
  analyzeProject: (dir) => ipcRenderer.invoke('analyze-project', dir),
  generateDirectives: (dir) => ipcRenderer.invoke('generate-directives', dir),
  detectStack: (dir) => ipcRenderer.invoke('detect-stack', dir),
  getGitInfo: (p) => ipcRenderer.invoke('get-git-info', p),
  getGitStatus: (p) => ipcRenderer.invoke('get-git-status', p),
  getGitStatusDetailed: (p) => ipcRenderer.invoke('get-git-status-detailed', p),
  gitCheckout: (p, branch) => ipcRenderer.invoke('git-checkout', p, branch),
  gitCreateBranch: (p, name, from) => ipcRenderer.invoke('git-create-branch', p, name, from),
  gitMerge: (p, branch) => ipcRenderer.invoke('git-merge', p, branch),
  gitMergeAbort: (p) => ipcRenderer.invoke('git-merge-abort', p),
  gitDeleteBranch: (p, branch, force) => ipcRenderer.invoke('git-delete-branch', p, branch, force),
  gitStage: (p, files) => ipcRenderer.invoke('git-stage', p, files),
  gitStageAll: (p) => ipcRenderer.invoke('git-stage-all', p),
  gitUnstage: (p, files) => ipcRenderer.invoke('git-unstage', p, files),
  gitUnstageAll: (p) => ipcRenderer.invoke('git-unstage-all', p),
  gitCommit: (p, msg) => ipcRenderer.invoke('git-commit', p, msg),
  gitPush: (p, remote, branch) => ipcRenderer.invoke('git-push', p, remote, branch),
  gitPull: (p, remote, branch) => ipcRenderer.invoke('git-pull', p, remote, branch),
  gitFetch: (p) => ipcRenderer.invoke('git-fetch', p),
  gitDiff: (p, file, staged) => ipcRenderer.invoke('git-diff', p, file, staged),
  gitStash: (p, action, msg) => ipcRenderer.invoke('git-stash', p, action, msg),
  gitDiscard: (p, files) => ipcRenderer.invoke('git-discard', p, files),
  getProjectPorts: (p) => ipcRenderer.invoke('get-project-ports', p),
  detectTests: (p) => ipcRenderer.invoke('detect-tests', p),

  // Project Context (.skillbox/project/context/)
  getProjectContext: (p) => ipcRenderer.invoke('get-project-context', p),
  saveContextFile: (p, name, content) => ipcRenderer.invoke('save-context-file', p, name, content),
  initProjectContext: (p) => ipcRenderer.invoke('init-project-context', p),
  getContextFilePath: (p, name) => ipcRenderer.invoke('get-context-file-path', p, name),

  // Environments
  getEnvironments: (p) => ipcRenderer.invoke('get-environments', p),
  saveEnvironment: (p, env, vars) => ipcRenderer.invoke('save-environment', p, env, vars),
  addEnvironment: (p, env) => ipcRenderer.invoke('add-environment', p, env),
  removeEnvironment: (p, env) => ipcRenderer.invoke('remove-environment', p, env),
  setActiveEnvironment: (p, env) => ipcRenderer.invoke('set-active-environment', p, env),
  syncEnvFile: (p, env) => ipcRenderer.invoke('sync-env-file', p, env),
  importEnvFile: (p, env) => ipcRenderer.invoke('import-env-file', p, env),

  // Teams
  getTeams: () => ipcRenderer.invoke('get-teams'),
  createTeam: (data) => ipcRenderer.invoke('create-team', data),
  updateTeam: (id, data) => ipcRenderer.invoke('update-team', id, data),
  deleteTeam: (id) => ipcRenderer.invoke('delete-team', id),
  assignTeamToProject: (p, tid) => ipcRenderer.invoke('assign-team-to-project', p, tid),
  unassignTeamFromProject: (p, tid) => ipcRenderer.invoke('unassign-team-from-project', p, tid),

  // Context Sync
  generateContextSync: (p) => ipcRenderer.invoke('generate-context-sync', p),
  getContextPreview: (p) => ipcRenderer.invoke('get-context-preview', p),

  // Storage
  getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),
  cleanProjectContext: (p) => ipcRenderer.invoke('clean-project-context', p),
  cleanProjectCache: (p) => ipcRenderer.invoke('clean-project-cache', p),
  cleanAllStaleCache: (days) => ipcRenderer.invoke('clean-all-stale-cache', days),

  // History
  getHistory: (p) => ipcRenderer.invoke('get-history', p),

  // Custom Skills
  createSkill: (data) => ipcRenderer.invoke('create-skill', data),
  updateSkill: (id, data) => ipcRenderer.invoke('update-skill', id, data),
  deleteSkill: (id) => ipcRenderer.invoke('delete-skill', id),
  getCustomSkills: () => ipcRenderer.invoke('get-custom-skills'),
  cloneSkillFromGit: (url) => ipcRenderer.invoke('clone-skill-from-git', url),

  // GitHub
  githubConnect: (token) => ipcRenderer.invoke('github-connect', token),
  githubDisconnect: () => ipcRenderer.invoke('github-disconnect'),
  githubGetStatus: () => ipcRenderer.invoke('github-get-status'),
  githubListRepos: (q) => ipcRenderer.invoke('github-list-repos', q),
  githubCloneRepo: (url, dest) => ipcRenderer.invoke('github-clone-repo', url, dest),

  // Terminal
  terminalCreate: (opts) => ipcRenderer.invoke('terminal-create', opts),
  terminalWrite: (id, data) => ipcRenderer.invoke('terminal-write', id, data),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', id, cols, rows),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', id),
  terminalList: () => ipcRenderer.invoke('terminal-list'),
  onTerminalData: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('terminal-data', handler);
    return () => ipcRenderer.removeListener('terminal-data', handler);
  },
  onTerminalExit: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('terminal-exit', handler);
    return () => ipcRenderer.removeListener('terminal-exit', handler);
  },

  // Analysis progress
  onAnalysisProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('analysis-progress', handler);
    return () => ipcRenderer.removeListener('analysis-progress', handler);
  },

  // Messages / Chat
  getMessages: (projectPath, taskId) => ipcRenderer.invoke('get-messages', projectPath, taskId),
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
  deleteMessage: (id) => ipcRenderer.invoke('delete-message', id),

  // CLI
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),

  // File Operations (Editor)
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, c) => ipcRenderer.invoke('write-file', p, c),
  watchFile: (p) => ipcRenderer.invoke('watch-file', p),
  unwatchFile: (p) => ipcRenderer.invoke('unwatch-file', p),
  onFileChanged: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('file-changed', handler);
    return () => ipcRenderer.removeListener('file-changed', handler);
  },

  // File Operations (Explorer)
  revealInFinder: (p) => ipcRenderer.invoke('reveal-in-finder', p),
  copyPath: (p) => ipcRenderer.invoke('copy-path', p),
  copyRelativePath: (p, base) => ipcRenderer.invoke('copy-relative-path', p, base),
  createFile: (p) => ipcRenderer.invoke('create-file', p),
  createFolder: (p) => ipcRenderer.invoke('create-folder', p),
  renamePath: (old, neu) => ipcRenderer.invoke('rename-path', old, neu),
  movePath: (src, destDir) => ipcRenderer.invoke('move-path', src, destDir),
  deletePath: (p) => ipcRenderer.invoke('delete-path', p),
  showContextMenu: (template) => ipcRenderer.invoke('show-context-menu', template),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getDefaultSettings: () => ipcRenderer.invoke('get-default-settings'),

  // Extensions
  getInstalledExtensions: () => ipcRenderer.invoke('get-installed-extensions'),
  installExtensionVsix: (p) => ipcRenderer.invoke('install-extension-vsix', p),
  uninstallExtension: (id) => ipcRenderer.invoke('uninstall-extension', id),
  browseVsix: () => ipcRenderer.invoke('browse-vsix'),
  openExtensionsDir: () => ipcRenderer.invoke('open-extensions-dir'),
  installExtensionFromDir: (p) => ipcRenderer.invoke('install-extension-from-dir', p),
  listVscodeExtensions: () => ipcRenderer.invoke('list-vscode-extensions'),

  // Extension Host
  activateExtension: (id) => ipcRenderer.invoke('activate-extension', id),
  deactivateExtension: (id) => ipcRenderer.invoke('deactivate-extension', id),
  resolveExtensionWebview: (extId, viewId) => ipcRenderer.invoke('resolve-extension-webview', extId, viewId),
  extensionWebviewMsg: (extId, viewId, msg) => ipcRenderer.invoke('extension-webview-msg', extId, viewId, msg),
  executeExtensionCommand: (extId, cmdId, ...args) => ipcRenderer.invoke('execute-extension-command', extId, cmdId, ...args),
  getExtensionConfigSchema: (extId) => ipcRenderer.invoke('get-extension-config-schema', extId),
  updateExtensionConfig: (extId, section, key, value) => ipcRenderer.invoke('update-extension-config', extId, section, key, value),
  setExtensionWorkspace: (p) => ipcRenderer.invoke('set-extension-workspace', p),
  reResolveExtensionWebview: (extId, viewId) => ipcRenderer.invoke('re-resolve-extension-webview', extId, viewId),
  getExtensionDetail: (id) => ipcRenderer.invoke('get-extension-detail', id),
  onOpenFileInEditor: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('open-file-in-editor', handler);
    return () => ipcRenderer.removeListener('open-file-in-editor', handler);
  },
  onExtensionWebviewMessage: (cb) => {
    ipcRenderer.removeAllListeners('extension-webview-message');
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('extension-webview-message', handler);
    return () => ipcRenderer.removeListener('extension-webview-message', handler);
  },
  onExtensionToast: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('extension-toast', handler);
    return () => ipcRenderer.removeListener('extension-toast', handler);
  },
  onExtensionStatusBar: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('extension-statusbar', handler);
    return () => ipcRenderer.removeListener('extension-statusbar', handler);
  },

  // MCP Server
  mcpServerStart: (opts) => ipcRenderer.invoke('mcp-server-start', opts),
  mcpServerStop: () => ipcRenderer.invoke('mcp-server-stop'),
  mcpServerStatus: () => ipcRenderer.invoke('mcp-server-status'),
  mcpResolveApproval: (id, approved) => ipcRenderer.invoke('mcp-resolve-approval', id, approved),
  mcpGetPendingApprovals: () => ipcRenderer.invoke('mcp-get-pending-approvals'),
  onMcpApprovalRequest: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mcp-approval-request', handler);
    return () => ipcRenderer.removeListener('mcp-approval-request', handler);
  },
  onMcpServerStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mcp-server-status', handler);
    return () => ipcRenderer.removeListener('mcp-server-status', handler);
  },
  onMcpToolInvoked: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mcp-tool-invoked', handler);
    return () => ipcRenderer.removeListener('mcp-tool-invoked', handler);
  },

  // MCP Client
  mcpClientConnectHttp: (config) => ipcRenderer.invoke('mcp-client-connect-http', config),
  mcpClientConnectStdio: (config) => ipcRenderer.invoke('mcp-client-connect-stdio', config),
  mcpClientDisconnect: (id) => ipcRenderer.invoke('mcp-client-disconnect', id),
  mcpClientCallTool: (connId, tool, args) => ipcRenderer.invoke('mcp-client-call-tool', connId, tool, args),
  mcpClientRefreshTools: (connId) => ipcRenderer.invoke('mcp-client-refresh-tools', connId),
  mcpClientList: () => ipcRenderer.invoke('mcp-client-list'),
  mcpClientAllTools: () => ipcRenderer.invoke('mcp-client-all-tools'),
  onMcpConnectionsChanged: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('mcp-connections-changed', handler);
    return () => ipcRenderer.removeListener('mcp-connections-changed', handler);
  },

  // Misc
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  platform: process.platform,
  onFullscreenChange: (cb) => {
    const handler = (_e, isFullscreen) => cb(isFullscreen);
    ipcRenderer.on('fullscreen-change', handler);
    return () => ipcRenderer.removeListener('fullscreen-change', handler);
  },
});
