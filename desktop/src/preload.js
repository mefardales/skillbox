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
  analyzeProject: (dir) => ipcRenderer.invoke('analyze-project', dir),
  generateDirectives: (dir) => ipcRenderer.invoke('generate-directives', dir),
  detectStack: (dir) => ipcRenderer.invoke('detect-stack', dir),

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
  onTerminalData: (cb) => ipcRenderer.on('terminal-data', (_e, data) => cb(data)),
  onTerminalExit: (cb) => ipcRenderer.on('terminal-exit', (_e, data) => cb(data)),

  // Analysis progress
  onAnalysisProgress: (cb) => ipcRenderer.on('analysis-progress', (_e, data) => cb(data)),

  // Tasks
  getTasks: (projectPath) => ipcRenderer.invoke('get-tasks', projectPath),
  createTask: (data) => ipcRenderer.invoke('create-task', data),
  updateTask: (id, updates) => ipcRenderer.invoke('update-task', id, updates),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),

  // Messages / Chat
  getMessages: (projectPath, taskId) => ipcRenderer.invoke('get-messages', projectPath, taskId),
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
  deleteMessage: (id) => ipcRenderer.invoke('delete-message', id),

  // CLI
  runCommand: (cmd) => ipcRenderer.invoke('run-command', cmd),

  // Misc
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getDbStats: () => ipcRenderer.invoke('get-db-stats'),
});
