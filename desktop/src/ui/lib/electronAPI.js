// Bridge to Electron's preload API (window.skillbox)
// In dev mode with Vite, window.skillbox won't exist, so we provide stubs

const api = typeof window !== 'undefined' && window.skillbox ? window.skillbox : null;

// Helper to safely call API methods
function call(method, ...args) {
  if (!api || !api[method]) {
    console.warn(`electronAPI.${method} not available`);
    return Promise.resolve(null);
  }
  return api[method](...args);
}

// Export all API methods
export const electronAPI = {
  // Registry & Skills
  getRegistry: () => call('getRegistry'),
  getSkillContent: (id) => call('getSkillContent', id),

  // Projects
  getProjects: () => call('getProjects'),
  addProject: (dir) => call('addProject', dir),
  removeProject: (dir) => call('removeProject', dir),
  toggleProjectSkill: (p, s) => call('toggleProjectSkill', p, s),
  installSkillToProject: (p, s) => call('installSkillToProject', p, s),
  browseFolder: () => call('browseFolder'),
  readDirectory: (dir, depth) => call('readDirectory', dir, depth),
  analyzeProject: (dir) => call('analyzeProject', dir),
  generateDirectives: (dir) => call('generateDirectives', dir),
  detectStack: (dir) => call('detectStack', dir),
  getGitInfo: (p) => call('getGitInfo', p),
  getProjectPorts: (p) => call('getProjectPorts', p),
  detectTests: (p) => call('detectTests', p),

  // Project Context
  getProjectContext: (p) => call('getProjectContext', p),
  saveContextFile: (p, name, content) => call('saveContextFile', p, name, content),
  initProjectContext: (p) => call('initProjectContext', p),
  getContextFilePath: (p, name) => call('getContextFilePath', p, name),

  // Environments
  getEnvironments: (p) => call('getEnvironments', p),
  saveEnvironment: (p, env, vars) => call('saveEnvironment', p, env, vars),
  addEnvironment: (p, env) => call('addEnvironment', p, env),
  removeEnvironment: (p, env) => call('removeEnvironment', p, env),
  setActiveEnvironment: (p, env) => call('setActiveEnvironment', p, env),
  syncEnvFile: (p, env) => call('syncEnvFile', p, env),
  importEnvFile: (p, env) => call('importEnvFile', p, env),

  // Teams
  getTeams: () => call('getTeams'),
  createTeam: (data) => call('createTeam', data),
  updateTeam: (id, data) => call('updateTeam', id, data),
  deleteTeam: (id) => call('deleteTeam', id),
  assignTeamToProject: (p, tid) => call('assignTeamToProject', p, tid),
  unassignTeamFromProject: (p, tid) => call('unassignTeamFromProject', p, tid),

  // History
  getHistory: (p) => call('getHistory', p),

  // Custom Skills
  createSkill: (data) => call('createSkill', data),
  updateSkill: (id, data) => call('updateSkill', id, data),
  deleteSkill: (id) => call('deleteSkill', id),
  getCustomSkills: () => call('getCustomSkills'),
  cloneSkillFromGit: (url) => call('cloneSkillFromGit', url),

  // GitHub
  githubConnect: (token) => call('githubConnect', token),
  githubDisconnect: () => call('githubDisconnect'),
  githubGetStatus: () => call('githubGetStatus'),
  githubListRepos: (q) => call('githubListRepos', q),
  githubCloneRepo: (url, dest) => call('githubCloneRepo', url, dest),

  // Terminal
  terminalCreate: (opts) => call('terminalCreate', opts),
  terminalWrite: (id, data) => call('terminalWrite', id, data),
  terminalResize: (id, cols, rows) => call('terminalResize', id, cols, rows),
  terminalKill: (id) => call('terminalKill', id),
  terminalList: () => call('terminalList'),
  onTerminalData: (cb) => api?.onTerminalData?.(cb),
  onTerminalExit: (cb) => api?.onTerminalExit?.(cb),

  // Analysis
  onAnalysisProgress: (cb) => api?.onAnalysisProgress?.(cb),

  // Tasks
  getTasks: (projectPath) => call('getTasks', projectPath),
  createTask: (data) => call('createTask', data),
  updateTask: (id, updates) => call('updateTask', id, updates),
  deleteTask: (id) => call('deleteTask', id),

  // Messages
  getMessages: (projectPath, taskId) => call('getMessages', projectPath, taskId),
  sendMessage: (data) => call('sendMessage', data),
  deleteMessage: (id) => call('deleteMessage', id),

  // CLI
  runCommand: (cmd) => call('runCommand', cmd),
  runScript: (projectPath, scriptName) => call('runScript', projectPath, scriptName),

  // File Operations
  readFile: (p) => call('readFile', p),
  writeFile: (p, c) => call('writeFile', p, c),
  watchFile: (p) => call('watchFile', p),
  unwatchFile: (p) => call('unwatchFile', p),
  onFileChanged: (cb) => api?.onFileChanged?.(cb),
  revealInFinder: (p) => call('revealInFinder', p),
  copyPath: (p) => call('copyPath', p),
  copyRelativePath: (p, base) => call('copyRelativePath', p, base),
  createFile: (p) => call('createFile', p),
  createFolder: (p) => call('createFolder', p),
  renamePath: (old, neu) => call('renamePath', old, neu),
  deletePath: (p) => call('deletePath', p),
  showContextMenu: (template) => call('showContextMenu', template),

  // Settings
  getSettings: () => call('getSettings'),
  saveSettings: (s) => call('saveSettings', s),
  getDefaultSettings: () => call('getDefaultSettings'),

  // Extensions
  getInstalledExtensions: () => call('getInstalledExtensions'),
  installExtensionVsix: (p) => call('installExtensionVsix', p),
  uninstallExtension: (id) => call('uninstallExtension', id),
  browseVsix: () => call('browseVsix'),
  openExtensionsDir: () => call('openExtensionsDir'),
  installExtensionFromDir: (p) => call('installExtensionFromDir', p),
  listVscodeExtensions: () => call('listVscodeExtensions'),
  activateExtension: (id) => call('activateExtension', id),
  deactivateExtension: (id) => call('deactivateExtension', id),
  resolveExtensionWebview: (extId, viewId) => call('resolveExtensionWebview', extId, viewId),
  extensionWebviewMsg: (extId, viewId, msg) => call('extensionWebviewMsg', extId, viewId, msg),
  executeExtensionCommand: (extId, cmdId, ...args) => call('executeExtensionCommand', extId, cmdId, ...args),
  getExtensionConfigSchema: (extId) => call('getExtensionConfigSchema', extId),
  updateExtensionConfig: (extId, section, key, value) => call('updateExtensionConfig', extId, section, key, value),
  setExtensionWorkspace: (p) => call('setExtensionWorkspace', p),
  reResolveExtensionWebview: (extId, viewId) => call('reResolveExtensionWebview', extId, viewId),
  getExtensionDetail: (id) => call('getExtensionDetail', id),
  onOpenFileInEditor: (cb) => api?.onOpenFileInEditor?.(cb),
  onExtensionWebviewMessage: (cb) => api?.onExtensionWebviewMessage?.(cb),
  onExtensionToast: (cb) => api?.onExtensionToast?.(cb),
  onExtensionStatusBar: (cb) => api?.onExtensionStatusBar?.(cb),

  // Misc
  openExternal: (url) => call('openExternal', url),
  getDbStats: () => call('getDbStats'),
  platform: api?.platform || 'unknown',
  onFullscreenChange: (cb) => api?.onFullscreenChange?.(cb),
};
