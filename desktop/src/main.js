const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const os = require('node:os');
const crypto = require('node:crypto');
const pty = require('@lydell/node-pty');
const { ExtensionHost } = require('./extension-host/host');
const mcpServer = require('./mcp-server');
const mcpClient = require('./mcp-client');

let mainWindow;
let extensionHost;

// ── Paths ───────────────────────────────────────────────────────
const SKILLS_ROOT = path.resolve(__dirname, '..', '..', 'skills');
const REGISTRY_PATH = path.join(SKILLS_ROOT, 'registry.json');
const AI_TOOL_FILES = {
  claude: 'CLAUDE.md',
  cursor: '.cursorrules',
  copilot: '.github/copilot-instructions.md',
  windsurf: '.windsurfrules',
  generic: 'AGENTS.md',
};

// ── Database (sql.js) ───────────────────────────────────────────
let db;
let DATA_DIR;

function getDataDir() {
  if (!DATA_DIR) {
    DATA_DIR = path.join(app.getPath('userData'), 'skillbox-data');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return DATA_DIR;
}

async function initDatabase() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const dbPath = path.join(getDataDir(), 'skillbox.db');

  // Load existing DB or create new
  let dbBuffer;
  try {
    dbBuffer = fs.readFileSync(dbPath);
  } catch { /* new db */ }

  db = dbBuffer ? new SQL.Database(dbBuffer) : new SQL.Database();

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    skills TEXT DEFAULT '[]',
    environments TEXT DEFAULT '{}',
    active_env TEXT DEFAULT 'DEV',
    analysis TEXT DEFAULT NULL,
    last_analyzed TEXT DEFAULT NULL,
    teams TEXT DEFAULT '[]',
    connected_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    members TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    detail TEXT NOT NULL,
    project TEXT DEFAULT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS custom_skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    version TEXT DEFAULT '1.0',
    content TEXT DEFAULT '',
    source TEXT DEFAULT 'local',
    repo_url TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS github_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token TEXT DEFAULT NULL,
    username TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    connected_at TEXT DEFAULT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS terminal_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cwd TEXT NOT NULL,
    shell TEXT DEFAULT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_path TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo',
    assignee TEXT DEFAULT NULL,
    priority TEXT DEFAULT 'medium',
    labels TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    order_index INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    project_path TEXT,
    task_id TEXT DEFAULT NULL,
    author TEXT DEFAULT 'You',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  // Migrate from JSON files if they exist
  migrateFromJson();

  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(getDataDir(), 'skillbox.db'), buffer);
}

function migrateFromJson() {
  // Migrate projects.json
  const projectsFile = path.join(getDataDir(), 'projects.json');
  if (fs.existsSync(projectsFile)) {
    try {
      const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
      const existing = db.exec('SELECT COUNT(*) FROM projects');
      if (existing[0]?.values[0][0] === 0 && projects.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO projects (id, name, path, skills, environments, active_env, analysis, last_analyzed, teams, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const p of projects) {
          stmt.run([p.id, p.name, p.path, JSON.stringify(p.skills || []), JSON.stringify(p.environments || {}), p.activeEnv || 'DEV', JSON.stringify(p.analysis || null), p.lastAnalyzed || null, JSON.stringify(p.teams || []), p.connectedAt || new Date().toISOString()]);
        }
        stmt.free();
      }
      fs.renameSync(projectsFile, projectsFile + '.bak');
    } catch { /* skip */ }
  }

  // Migrate teams.json
  const teamsFile = path.join(getDataDir(), 'teams.json');
  if (fs.existsSync(teamsFile)) {
    try {
      const teams = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));
      const existing = db.exec('SELECT COUNT(*) FROM teams');
      if (existing[0]?.values[0][0] === 0 && teams.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO teams (id, name, description, members, created_at) VALUES (?, ?, ?, ?, ?)');
        for (const t of teams) {
          stmt.run([t.id, t.name, t.description || '', JSON.stringify(t.members || []), t.createdAt || new Date().toISOString()]);
        }
        stmt.free();
      }
      fs.renameSync(teamsFile, teamsFile + '.bak');
    } catch { /* skip */ }
  }

  // Migrate history.json
  const historyFile = path.join(getDataDir(), 'history.json');
  if (fs.existsSync(historyFile)) {
    try {
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      const existing = db.exec('SELECT COUNT(*) FROM history');
      if (existing[0]?.values[0][0] === 0 && history.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO history (id, timestamp, type, detail, project) VALUES (?, ?, ?, ?, ?)');
        for (const h of history) {
          stmt.run([h.id, h.timestamp, h.type, h.detail, h.project || null]);
        }
        stmt.free();
      }
      fs.renameSync(historyFile, historyFile + '.bak');
    } catch { /* skip */ }
  }

  saveDb();
}

// ── DB Helpers ──────────────────────────────────────────────────
function uid() { return crypto.randomUUID(); }

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows[0] || null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function addHistory(type, detail, projectPath) {
  dbRun('INSERT INTO history (id, timestamp, type, detail, project) VALUES (?, ?, ?, ?, ?)',
    [uid(), new Date().toISOString(), type, detail, projectPath || null]);
  // Prune old entries
  db.run('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY timestamp DESC LIMIT 500)');
  saveDb();
}

function projectRowToObj(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    skills: JSON.parse(row.skills || '[]'),
    environments: JSON.parse(row.environments || '{}'),
    activeEnv: row.active_env,
    analysis: row.analysis ? JSON.parse(row.analysis) : null,
    lastAnalyzed: row.last_analyzed,
    teams: JSON.parse(row.teams || '[]'),
    connectedAt: row.connected_at,
  };
}

function loadProjects() {
  return dbAll('SELECT * FROM projects ORDER BY connected_at DESC').map(projectRowToObj);
}

function teamRowToObj(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    members: JSON.parse(row.members || '[]'),
    createdAt: row.created_at,
  };
}

function loadTeams() {
  return dbAll('SELECT * FROM teams ORDER BY created_at DESC').map(teamRowToObj);
}

// ── Window ──────────────────────────────────────────────────────
function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Skillbox',
    backgroundColor: '#09090b',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#0f1117',
      symbolColor: '#9ca3af',
      height: 38,
    } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  // Load React UI — Vite dev server in dev mode, built files in production
  const isDev = process.argv.includes('--dev');
  const useVite = process.argv.includes('--vite');

  if (useVite) {
    // Vite dev server mode — hot reload
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(path.join(__dirname, '..', 'dist-ui', 'index.html'))) {
    // Production — load built React UI
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-ui', 'index.html'));
  } else {
    // Fallback — legacy vanilla JS UI
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // Notify renderer of fullscreen changes (macOS traffic lights)
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });

  if (isDev || useVite) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  // Register custom protocol for extension webview assets
  protocol.registerFileProtocol('skillbox-ext', (request, callback) => {
    try {
      // URL format: skillbox-ext://ext/relative/path
      const url = new URL(request.url);
      const relPath = decodeURIComponent(url.pathname.replace(/^\//, ''));
      // Find the extension that owns this asset
      const extDir = getExtensionsDir();
      // Try to resolve from any installed extension
      const dirs = fs.readdirSync(extDir);
      for (const d of dirs) {
        const full = path.join(extDir, d, relPath);
        if (fs.existsSync(full)) { callback({ path: full }); return; }
      }
      callback({ statusCode: 404 });
    } catch { callback({ statusCode: 404 }); }
  });

  await initDatabase();
  createWindow();
  extensionHost = new ExtensionHost(mainWindow);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Cleanup terminals on quit
app.on('before-quit', () => {
  for (const [id, proc] of terminalProcesses) {
    try { proc.kill(); } catch {}
  }
});

// ── IPC: Registry ───────────────────────────────────────────────
ipcMain.handle('get-registry', async () => {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const registry = JSON.parse(raw);
    // Merge custom skills
    const customSkills = dbAll('SELECT * FROM custom_skills ORDER BY created_at DESC');
    for (const cs of customSkills) {
      registry.skills.push({
        id: `custom/${cs.id}`,
        name: cs.name,
        category: cs.category,
        description: cs.description,
        tags: JSON.parse(cs.tags || '[]'),
        version: cs.version,
        isCustom: true,
        source: cs.source,
        repoUrl: cs.repo_url,
      });
    }
    return registry;
  } catch {
    return { version: '1', skills: [] };
  }
});

// ── IPC: Skill Content ──────────────────────────────────────────
ipcMain.handle('get-skill-content', async (_e, skillId) => {
  // Check custom skills first
  if (skillId.startsWith('custom/')) {
    const realId = skillId.replace('custom/', '');
    const row = dbGet('SELECT content FROM custom_skills WHERE id = ?', [realId]);
    return row?.content || null;
  }
  const mdPath = path.join(SKILLS_ROOT, skillId, 'SKILL.md');
  try {
    return fs.readFileSync(mdPath, 'utf8');
  } catch {
    return null;
  }
});

// ── IPC: Projects ───────────────────────────────────────────────
ipcMain.handle('get-projects', async () => loadProjects());

ipcMain.handle('add-project', async (_e, dirPath) => {
  const existing = dbGet('SELECT id FROM projects WHERE path = ?', [dirPath]);
  if (existing) return { projects: loadProjects(), isNew: false };

  const name = path.basename(dirPath);
  const id = uid();
  dbRun('INSERT INTO projects (id, name, path, skills, environments, active_env, teams, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, dirPath, '[]', JSON.stringify({ DEV: {}, QA: {}, PROD: {} }), 'DEV', '[]', new Date().toISOString()]);

  addHistory('project_added', `Connected project: ${name}`, dirPath);
  return { projects: loadProjects(), isNew: true, projectId: id };
});

ipcMain.handle('remove-project', async (_e, dirPath) => {
  const project = dbGet('SELECT name FROM projects WHERE path = ?', [dirPath]);
  dbRun('DELETE FROM projects WHERE path = ?', [dirPath]);
  if (project) addHistory('project_removed', `Disconnected project: ${project.name}`, dirPath);

  // Clean context files if enabled
  const s1 = { ...DEFAULT_SETTINGS, ...readUserSettings() };
  if (s1['context.cleanOnRemove']) {
    try {
      const skillboxDir = path.join(dirPath, '.skillbox');
      if (fs.existsSync(skillboxDir)) fs.rmSync(skillboxDir, { recursive: true, force: true });
      const aiTools = s1['context.aiTools'] || ['claude'];
      for (const tool of aiTools) {
        const fileName = AI_TOOL_FILES[tool];
        if (!fileName) continue;
        const fp = path.join(dirPath, fileName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    } catch {}
  }

  return loadProjects();
});

ipcMain.handle('toggle-project-skill', async (_e, projectPath, skillId) => {
  const row = dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const skills = JSON.parse(row.skills || '[]');
  const idx = skills.indexOf(skillId);
  if (idx >= 0) {
    skills.splice(idx, 1);
    addHistory('skill_deactivated', `Deactivated skill: ${skillId}`, projectPath);
  } else {
    skills.push(skillId);
    addHistory('skill_activated', `Activated skill: ${skillId}`, projectPath);
  }
  dbRun('UPDATE projects SET skills = ? WHERE path = ?', [JSON.stringify(skills), projectPath]);
  return loadProjects();
});

ipcMain.handle('install-skill-to-project', async (_e, projectPath, skillId) => {
  let mdContent;
  if (skillId.startsWith('custom/')) {
    const realId = skillId.replace('custom/', '');
    const row = dbGet('SELECT content FROM custom_skills WHERE id = ?', [realId]);
    mdContent = row?.content;
  } else {
    const mdPath = path.join(SKILLS_ROOT, skillId, 'SKILL.md');
    try { mdContent = fs.readFileSync(mdPath, 'utf8'); } catch {}
  }

  if (!mdContent) return { installed: 0, projects: loadProjects() };

  const targets = ['.claude/skills', '.cursor/skills', '.codex/skills'];
  let installed = 0;
  const skillName = skillId.split('/').pop();

  for (const target of targets) {
    const destDir = path.join(projectPath, target, skillName);
    try {
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'SKILL.md'), mdContent);
      installed++;
    } catch { /* skip */ }
  }

  const row = dbGet('SELECT skills FROM projects WHERE path = ?', [projectPath]);
  if (row) {
    const skills = JSON.parse(row.skills || '[]');
    if (!skills.includes(skillId)) {
      skills.push(skillId);
      dbRun('UPDATE projects SET skills = ? WHERE path = ?', [JSON.stringify(skills), projectPath]);
    }
  }
  addHistory('skill_installed', `Installed skill ${skillId} to project`, projectPath);
  return { installed, projects: loadProjects() };
});

// ── IPC: Browse folder dialog ────────────────────────────────────
ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('read-directory', async (_e, dirPath, depth = 1) => {
  const ignoreDirs = new Set([
    'node_modules', '.git', '__pycache__', '.venv', 'venv', '.next', '.nuxt',
    'dist', 'build', '.cache', '.parcel-cache', 'coverage', '.turbo',
    '.svelte-kit', '.output', 'target', 'vendor', '.gradle', '.idea',
    '.vscode', '.DS_Store', 'Thumbs.db',
  ]);
  function scan(dir, currentDepth) {
    const entries = [];
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.') || e.name === '.env' || e.name === '.gitignore')
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
      for (const item of items) {
        if (ignoreDirs.has(item.name)) continue;
        const fullPath = path.join(dir, item.name);
        const isDir = item.isDirectory();
        const entry = { name: item.name, path: fullPath, isDir };
        if (isDir && currentDepth < depth) {
          entry.children = scan(fullPath, currentDepth + 1);
        }
        entries.push(entry);
      }
    } catch { /* skip */ }
    return entries;
  }
  return scan(dirPath, 0);
});

// ── IPC: Environments ───────────────────────────────────────────
ipcMain.handle('get-environments', async (_e, projectPath) => {
  const row = dbGet('SELECT environments, active_env FROM projects WHERE path = ?', [projectPath]);
  if (!row) return { environments: {}, activeEnv: 'DEV' };
  return { environments: JSON.parse(row.environments || '{}'), activeEnv: row.active_env || 'DEV' };
});

ipcMain.handle('save-environment', async (_e, projectPath, envName, vars) => {
  const row = dbGet('SELECT environments FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const envs = JSON.parse(row.environments || '{}');
  envs[envName] = vars;
  dbRun('UPDATE projects SET environments = ? WHERE path = ?', [JSON.stringify(envs), projectPath]);
  addHistory('env_updated', `Updated environment: ${envName}`, projectPath);
  return loadProjects();
});

ipcMain.handle('add-environment', async (_e, projectPath, envName) => {
  const row = dbGet('SELECT environments FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const envs = JSON.parse(row.environments || '{}');
  if (!envs[envName]) {
    envs[envName] = {};
    dbRun('UPDATE projects SET environments = ? WHERE path = ?', [JSON.stringify(envs), projectPath]);
    addHistory('env_created', `Created environment: ${envName}`, projectPath);
  }
  return loadProjects();
});

ipcMain.handle('remove-environment', async (_e, projectPath, envName) => {
  const row = dbGet('SELECT environments, active_env FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const envs = JSON.parse(row.environments || '{}');
  delete envs[envName];
  let activeEnv = row.active_env;
  if (activeEnv === envName) activeEnv = Object.keys(envs)[0] || 'DEV';
  dbRun('UPDATE projects SET environments = ?, active_env = ? WHERE path = ?', [JSON.stringify(envs), activeEnv, projectPath]);
  addHistory('env_removed', `Removed environment: ${envName}`, projectPath);
  return loadProjects();
});

ipcMain.handle('set-active-environment', async (_e, projectPath, envName) => {
  dbRun('UPDATE projects SET active_env = ? WHERE path = ?', [envName, projectPath]);
  addHistory('env_switched', `Switched to environment: ${envName}`, projectPath);
  return loadProjects();
});

ipcMain.handle('sync-env-file', async (_e, projectPath, envName) => {
  const row = dbGet('SELECT environments FROM projects WHERE path = ?', [projectPath]);
  if (!row) return false;
  const envs = JSON.parse(row.environments || '{}');
  const vars = envs[envName];
  if (!vars) return false;
  const envPath = path.join(projectPath, '.env');
  const content = Object.entries(vars).filter(([k]) => k.trim()).map(([k, v]) => `${k}=${v}`).join('\n');
  fs.writeFileSync(envPath, content + '\n');
  addHistory('env_synced', `Synced .env file with ${envName} environment`, projectPath);
  return true;
});

ipcMain.handle('import-env-file', async (_e, projectPath, envName) => {
  const envPath = path.join(projectPath, '.env');
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    const row = dbGet('SELECT environments FROM projects WHERE path = ?', [projectPath]);
    if (row) {
      const envs = JSON.parse(row.environments || '{}');
      envs[envName] = vars;
      dbRun('UPDATE projects SET environments = ? WHERE path = ?', [JSON.stringify(envs), projectPath]);
    }
    return vars;
  } catch {
    return {};
  }
});

// ── IPC: Teams ──────────────────────────────────────────────────
ipcMain.handle('get-teams', async () => loadTeams());

ipcMain.handle('create-team', async (_e, teamData) => {
  const id = uid();
  dbRun('INSERT INTO teams (id, name, description, members, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, teamData.name, teamData.description || '', JSON.stringify(teamData.members || []), new Date().toISOString()]);
  addHistory('team_created', `Created team: ${teamData.name}`);
  return loadTeams();
});

ipcMain.handle('update-team', async (_e, teamId, teamData) => {
  dbRun('UPDATE teams SET name = ?, description = ?, members = ? WHERE id = ?',
    [teamData.name, teamData.description || '', JSON.stringify(teamData.members || []), teamId]);
  addHistory('team_updated', `Updated team: ${teamData.name}`);
  return loadTeams();
});

ipcMain.handle('delete-team', async (_e, teamId) => {
  const team = dbGet('SELECT name FROM teams WHERE id = ?', [teamId]);
  dbRun('DELETE FROM teams WHERE id = ?', [teamId]);
  if (team) addHistory('team_deleted', `Deleted team: ${team.name}`);
  return loadTeams();
});

ipcMain.handle('assign-team-to-project', async (_e, projectPath, teamId) => {
  const row = dbGet('SELECT teams FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const teams = JSON.parse(row.teams || '[]');
  if (!teams.includes(teamId)) {
    teams.push(teamId);
    dbRun('UPDATE projects SET teams = ? WHERE path = ?', [JSON.stringify(teams), projectPath]);
    const team = dbGet('SELECT name FROM teams WHERE id = ?', [teamId]);
    addHistory('team_assigned', `Assigned team "${team?.name}" to project`, projectPath);

    // Auto-sync context if enabled
    const s1 = { ...DEFAULT_SETTINGS, ...readUserSettings() };
    if (s1['context.autoSync']) {
      try {
        const proj = projectRowToObj(dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]));
        const allT = loadTeams();
        const reg = (() => { try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { return { skills: [] }; } })();
        const ctx = generateCompactContext(proj, allT, reg);
        const markdown = contextToMarkdown(ctx);
        const skillboxDir = path.join(projectPath, '.skillbox');
        if (!fs.existsSync(skillboxDir)) fs.mkdirSync(skillboxDir, { recursive: true });
        fs.writeFileSync(path.join(skillboxDir, 'context.json'), JSON.stringify(ctx, null, 2), 'utf8');
        const aiTools = s1['context.aiTools'] || ['claude'];
        for (const tool of aiTools) {
          const fileName = AI_TOOL_FILES[tool];
          if (!fileName) continue;
          const fp = path.join(projectPath, fileName);
          const dir = path.dirname(fp);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fp, markdown, 'utf8');
        }
      } catch {}
    }
  }
  return loadProjects();
});

ipcMain.handle('unassign-team-from-project', async (_e, projectPath, teamId) => {
  const row = dbGet('SELECT teams FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const teams = JSON.parse(row.teams || '[]').filter(t => t !== teamId);
  dbRun('UPDATE projects SET teams = ? WHERE path = ?', [JSON.stringify(teams), projectPath]);

  // Auto-sync context if enabled
  const s1 = { ...DEFAULT_SETTINGS, ...readUserSettings() };
  if (s1['context.autoSync']) {
    try {
      const proj = projectRowToObj(dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]));
      const allT = loadTeams();
      const reg = (() => { try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { return { skills: [] }; } })();
      const ctx = generateCompactContext(proj, allT, reg);
      const markdown = contextToMarkdown(ctx);
      const skillboxDir = path.join(projectPath, '.skillbox');
      if (!fs.existsSync(skillboxDir)) fs.mkdirSync(skillboxDir, { recursive: true });
      fs.writeFileSync(path.join(skillboxDir, 'context.json'), JSON.stringify(ctx, null, 2), 'utf8');
      const aiTools = s1['context.aiTools'] || ['claude'];
      for (const tool of aiTools) {
        const fileName = AI_TOOL_FILES[tool];
        if (!fileName) continue;
        const fp = path.join(projectPath, fileName);
        const dir = path.dirname(fp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fp, markdown, 'utf8');
      }
    } catch {}
  }

  return loadProjects();
});

// ── IPC: History ────────────────────────────────────────────────
ipcMain.handle('get-history', async (_e, projectPath) => {
  if (projectPath) {
    return dbAll('SELECT * FROM history WHERE project = ? ORDER BY timestamp DESC LIMIT 500', [projectPath]);
  }
  return dbAll('SELECT * FROM history ORDER BY timestamp DESC LIMIT 500');
});

// ── IPC: Deep Analysis (with progress) ──────────────────────────
ipcMain.handle('analyze-project', async (event, projectPath) => {
  const sendProgress = (step, total, label) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-progress', { projectPath, step, total, label });
    }
  };

  const totalSteps = 8;
  const result = {
    stack: [],
    dependencies: { npm: [], python: [], ruby: [], java: [] },
    services: [],
    systemRequirements: [],
    scripts: {},
    fileStats: { total: 0, byExt: {} },
  };

  // Step 1: Read package.json
  sendProgress(1, totalSteps, 'Reading package.json...');
  let npmDeps = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    npmDeps = Object.keys(deps);
    result.dependencies.npm = Object.entries(deps).map(([name, version]) => ({ name, version }));
    if (pkg.scripts) result.scripts = pkg.scripts;
  } catch { /* no package.json */ }

  // Step 2: Read Python deps
  sendProgress(2, totalSteps, 'Scanning Python dependencies...');
  let pyDeps = [];
  try {
    const req = fs.readFileSync(path.join(projectPath, 'requirements.txt'), 'utf8');
    pyDeps = req.split('\n').map(l => l.split('==')[0].split('>=')[0].split('<=')[0].trim().toLowerCase()).filter(Boolean);
    result.dependencies.python = req.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
      const parts = l.split(/[=><]/);
      return { name: parts[0].trim(), version: l.replace(parts[0], '').trim() };
    });
  } catch { /* no requirements.txt */ }

  // Step 3: Read Ruby deps
  sendProgress(3, totalSteps, 'Scanning Ruby dependencies...');
  let gems = [];
  try {
    const gemfile = fs.readFileSync(path.join(projectPath, 'Gemfile'), 'utf8');
    const gemMatches = gemfile.matchAll(/gem ['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/g);
    for (const m of gemMatches) {
      gems.push(m[1]);
      result.dependencies.ruby.push({ name: m[1], version: m[2] || '' });
    }
  } catch { /* no Gemfile */ }

  // Step 4: Docker/services
  sendProgress(4, totalSteps, 'Detecting services...');
  try {
    const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml'];
    for (const cf of composeFiles) {
      const composePath = path.join(projectPath, cf);
      if (fs.existsSync(composePath)) {
        const raw = fs.readFileSync(composePath, 'utf8');
        const servicePatterns = [
          { pattern: /postgres/i, name: 'PostgreSQL', type: 'database' },
          { pattern: /mysql/i, name: 'MySQL', type: 'database' },
          { pattern: /mongo/i, name: 'MongoDB', type: 'database' },
          { pattern: /redis/i, name: 'Redis', type: 'cache' },
          { pattern: /rabbitmq/i, name: 'RabbitMQ', type: 'queue' },
          { pattern: /kafka/i, name: 'Kafka', type: 'queue' },
          { pattern: /elasticsearch/i, name: 'Elasticsearch', type: 'search' },
          { pattern: /nginx/i, name: 'Nginx', type: 'proxy' },
          { pattern: /minio/i, name: 'MinIO', type: 'storage' },
        ];
        for (const sp of servicePatterns) {
          if (sp.pattern.test(raw)) {
            result.services.push({ name: sp.name, type: sp.type, source: cf });
          }
        }
        break;
      }
    }
  } catch { /* skip */ }

  // Step 5: File stats
  sendProgress(5, totalSteps, 'Scanning file structure...');
  const exts = new Set();
  function scanDir(dir, depth = 0) {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__' || e.name === 'venv' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
        if (e.isFile()) {
          result.fileStats.total++;
          const ext = path.extname(e.name).toLowerCase() || '(no ext)';
          exts.add(ext);
          result.fileStats.byExt[ext] = (result.fileStats.byExt[ext] || 0) + 1;
        }
        if (e.isDirectory() && depth < 3) {
          scanDir(path.join(dir, e.name), depth + 1);
        }
      }
    } catch { /* skip */ }
  }
  scanDir(projectPath);

  // Step 6: System requirements
  sendProgress(6, totalSteps, 'Detecting system requirements...');
  if (npmDeps.length > 0 || fs.existsSync(path.join(projectPath, 'package.json'))) {
    result.systemRequirements.push({ name: 'Node.js', type: 'runtime' });
  }
  if (pyDeps.length > 0 || fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'setup.py'))) {
    result.systemRequirements.push({ name: 'Python', type: 'runtime' });
  }
  if (gems.length > 0) result.systemRequirements.push({ name: 'Ruby', type: 'runtime' });
  if (fs.existsSync(path.join(projectPath, 'pom.xml')) || fs.existsSync(path.join(projectPath, 'build.gradle'))) {
    result.systemRequirements.push({ name: 'Java/JDK', type: 'runtime' });
  }
  if (fs.existsSync(path.join(projectPath, 'Dockerfile')) || fs.existsSync(path.join(projectPath, 'docker-compose.yml'))) {
    result.systemRequirements.push({ name: 'Docker', type: 'tool' });
  }

  // Step 7: Stack matching
  sendProgress(7, totalSteps, 'Matching technology stack...');
  const rules = [
    { name: 'React', files: ['package.json'], deps: ['react'], skillIds: ['frontend/react-components', 'frontend/react-patterns'], icon: 'react' },
    { name: 'Next.js', files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], skillIds: ['frontend/nextjs-app-router'], icon: 'nextjs' },
    { name: 'Tailwind CSS', files: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], skillIds: ['frontend/tailwind-css'], icon: 'tailwind' },
    { name: 'Express', deps: ['express'], skillIds: ['backend/node-express-api'], icon: 'express' },
    { name: 'FastAPI', pyDeps: ['fastapi'], skillIds: ['backend/python-fastapi'], icon: 'python' },
    { name: 'Django', pyDeps: ['django', 'Django'], files: ['manage.py'], skillIds: ['backend/django', 'frontend/django-templates'], icon: 'django' },
    { name: 'Rails', files: ['Gemfile'], gems: ['rails'], skillIds: ['backend/ruby-on-rails'], icon: 'rails' },
    { name: 'Spring Boot', files: ['pom.xml', 'build.gradle'], skillIds: ['backend/spring-boot'], icon: 'java' },
    { name: 'Docker', files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml'], skillIds: ['devops/docker-compose'], icon: 'docker' },
    { name: 'Kubernetes', files: ['k8s/', 'kubernetes/'], exts: ['.yaml'], skillIds: ['devops/kubernetes'], icon: 'k8s' },
    { name: 'Terraform', exts: ['.tf'], skillIds: ['devops/terraform'], icon: 'terraform' },
    { name: 'GitHub Actions', files: ['.github/workflows'], skillIds: ['devops/github-actions'], icon: 'github' },
    { name: 'GitLab CI', files: ['.gitlab-ci.yml'], skillIds: ['devops/gitlab-ci'], icon: 'gitlab' },
    { name: 'PostgreSQL', deps: ['pg', 'knex', 'prisma'], pyDeps: ['psycopg2', 'asyncpg'], skillIds: ['data/postgresql'], icon: 'postgres' },
    { name: 'MongoDB', deps: ['mongoose', 'mongodb'], pyDeps: ['pymongo', 'motor'], skillIds: ['data/mongodb'], icon: 'mongodb' },
    { name: 'Redis', deps: ['redis', 'ioredis'], pyDeps: ['redis'], skillIds: ['data/redis'], icon: 'redis' },
    { name: 'Jest/Vitest', deps: ['jest', 'vitest', '@jest/core'], skillIds: ['testing/unit-testing'], icon: 'test' },
    { name: 'Playwright', deps: ['@playwright/test', 'playwright'], skillIds: ['testing/e2e-playwright'], icon: 'test' },
    { name: 'TypeScript', files: ['tsconfig.json'], skillIds: [], icon: 'typescript' },
    { name: 'Vue.js', deps: ['vue'], skillIds: [], icon: 'vue' },
    { name: 'Angular', deps: ['@angular/core'], skillIds: [], icon: 'angular' },
    { name: 'Svelte', deps: ['svelte'], skillIds: [], icon: 'svelte' },
    { name: 'GraphQL', deps: ['graphql', 'apollo-server', '@apollo/server'], skillIds: [], icon: 'graphql' },
  ];

  for (const rule of rules) {
    let matched = false;
    if (rule.files) {
      for (const f of rule.files) {
        if (fs.existsSync(path.join(projectPath, f))) { matched = true; break; }
      }
    }
    if (!matched && rule.deps) {
      for (const d of rule.deps) { if (npmDeps.includes(d)) { matched = true; break; } }
    }
    if (!matched && rule.pyDeps) {
      for (const d of rule.pyDeps) { if (pyDeps.includes(d.toLowerCase())) { matched = true; break; } }
    }
    if (!matched && rule.gems) {
      for (const g of rule.gems) { if (gems.includes(g)) { matched = true; break; } }
    }
    if (!matched && rule.exts) {
      for (const e of rule.exts) { if (exts.has(e)) { matched = true; break; } }
    }
    if (matched) result.stack.push({ name: rule.name, skillIds: rule.skillIds, icon: rule.icon });
  }

  // Step 8: Save
  sendProgress(8, totalSteps, 'Saving analysis...');
  dbRun('UPDATE projects SET analysis = ?, last_analyzed = ? WHERE path = ?',
    [JSON.stringify(result), new Date().toISOString(), projectPath]);

  addHistory('project_analyzed', `Deep analysis completed: ${result.stack.map(s => s.name).join(', ')}`, projectPath);

  sendProgress(totalSteps, totalSteps, 'Complete');
  return result;
});

// ── IPC: Generate MD Directives ─────────────────────────────────
ipcMain.handle('generate-directives', async (_e, projectPath) => {
  const row = dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]);
  if (!row) return null;
  const project = projectRowToObj(row);
  const allTeams = loadTeams();
  const assignedTeams = (project.teams || []).map(tid => allTeams.find(t => t.id === tid)).filter(Boolean);
  const registry = (() => { try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { return { skills: [] }; } })();

  let md = `# Skillbox Project Directives\n`;
  md += `> Auto-generated by Skillbox on ${new Date().toISOString().split('T')[0]}\n`;
  md += `> Project: ${project.name}\n\n`;

  const activeEnv = project.activeEnv || 'DEV';
  const envVars = project.environments?.[activeEnv] || {};
  md += `## Active Environment: ${activeEnv}\n\n`;
  if (Object.keys(envVars).length > 0) {
    md += `Environment variables configured for this context:\n`;
    for (const [k] of Object.entries(envVars)) md += `- \`${k}\` is set\n`;
    md += `\n`;
  }

  if (project.analysis?.stack?.length) {
    md += `## Detected Stack\n\n`;
    for (const s of project.analysis.stack) md += `- **${s.name}**\n`;
    md += `\n`;
  }
  if (project.analysis?.services?.length) {
    md += `## Required Services\n\n`;
    for (const s of project.analysis.services) md += `- ${s.name} (${s.type})\n`;
    md += `\n`;
  }
  if (assignedTeams.length > 0) {
    md += `## Agent Teams\n\n`;
    for (const team of assignedTeams) {
      md += `### ${team.name}\n`;
      if (team.description) md += `${team.description}\n\n`;
      if (team.members?.length) {
        for (const m of team.members) {
          md += `- **${m.name}** (${m.role})`;
          if (m.skills?.length) {
            const skillNames = m.skills.map(sid => {
              const skill = registry.skills.find(s => s.id === sid);
              return skill ? skill.name : sid;
            });
            md += ` — Skills: ${skillNames.join(', ')}`;
          }
          md += `\n`;
        }
      }
      md += `\n`;
    }
  }
  // Tasks
  const projectTasks = dbAll('SELECT * FROM tasks WHERE project_path = ? ORDER BY order_index', [projectPath]);
  if (projectTasks.length > 0) {
    md += `## Tasks\n\n`;
    const statusGroups = { todo: 'To Do', in_progress: 'In Progress', review: 'In Review', done: 'Done' };
    for (const [status, label] of Object.entries(statusGroups)) {
      const group = projectTasks.filter(t => t.status === status);
      if (group.length === 0) continue;
      md += `### ${label}\n\n`;
      for (const t of group) {
        const assignee = t.assignee ? ` → ${t.assignee}` : '';
        const priority = t.priority !== 'medium' ? ` [${t.priority.toUpperCase()}]` : '';
        md += `- ${t.title}${priority}${assignee}\n`;
        if (t.description) md += `  ${t.description.split('\n')[0]}\n`;
      }
      md += `\n`;
    }
  }

  if (project.skills?.length) {
    md += `## Active Skills\n\n`;
    md += `The following skills are activated for this project. Follow their directives:\n\n`;
    for (const sid of project.skills) {
      const skill = registry.skills.find(s => s.id === sid);
      md += `- **${skill?.name || sid}**: ${skill?.description || ''}\n`;
    }
    md += `\n`;
  }

  const directivesPath = path.join(projectPath, '.skillbox', 'DIRECTIVES.md');
  const dirDir = path.dirname(directivesPath);
  if (!fs.existsSync(dirDir)) fs.mkdirSync(dirDir, { recursive: true });
  fs.writeFileSync(directivesPath, md);

  addHistory('directives_generated', `Generated DIRECTIVES.md`, projectPath);
  return md;
});

// ── IPC: Detect stack ────────────────────────────────────────────
ipcMain.handle('detect-stack', async (_e, projectPath) => {
  const detected = [];
  const rules = [
    { name: 'React', files: ['package.json'], deps: ['react'], skillIds: ['frontend/react-components', 'frontend/react-patterns'] },
    { name: 'Next.js', files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], skillIds: ['frontend/nextjs-app-router'] },
    { name: 'Tailwind CSS', files: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], skillIds: ['frontend/tailwind-css'] },
    { name: 'Express', deps: ['express'], skillIds: ['backend/node-express-api'] },
    { name: 'Django', pyDeps: ['django', 'Django'], files: ['manage.py'], skillIds: ['backend/django', 'frontend/django-templates'] },
    { name: 'Docker', files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml'], skillIds: ['devops/docker-compose'] },
  ];
  let npmDeps = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    npmDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  } catch {}
  for (const rule of rules) {
    let matched = false;
    if (rule.files) { for (const f of rule.files) { if (fs.existsSync(path.join(projectPath, f))) { matched = true; break; } } }
    if (!matched && rule.deps) { for (const d of rule.deps) { if (npmDeps.includes(d)) { matched = true; break; } } }
    if (matched) detected.push({ name: rule.name, skillIds: rule.skillIds });
  }
  return detected;
});

// ── IPC: Custom Skills ──────────────────────────────────────────
ipcMain.handle('create-skill', async (_e, skillData) => {
  const id = uid();
  const now = new Date().toISOString();
  dbRun('INSERT INTO custom_skills (id, name, category, description, tags, version, content, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, skillData.name, skillData.category || 'general', skillData.description || '', JSON.stringify(skillData.tags || []), skillData.version || '1.0', skillData.content || '', 'local', now, now]);
  addHistory('skill_created', `Created custom skill: ${skillData.name}`);
  return { id, success: true };
});

ipcMain.handle('update-skill', async (_e, skillId, skillData) => {
  dbRun('UPDATE custom_skills SET name = ?, category = ?, description = ?, tags = ?, version = ?, content = ?, updated_at = ? WHERE id = ?',
    [skillData.name, skillData.category || 'general', skillData.description || '', JSON.stringify(skillData.tags || []), skillData.version || '1.0', skillData.content || '', new Date().toISOString(), skillId]);
  return { success: true };
});

ipcMain.handle('delete-skill', async (_e, skillId) => {
  const skill = dbGet('SELECT name FROM custom_skills WHERE id = ?', [skillId]);
  dbRun('DELETE FROM custom_skills WHERE id = ?', [skillId]);
  if (skill) addHistory('skill_deleted', `Deleted custom skill: ${skill.name}`);
  return { success: true };
});

ipcMain.handle('get-custom-skills', async () => {
  return dbAll('SELECT * FROM custom_skills ORDER BY created_at DESC');
});

// ── IPC: Clone skill from Git ───────────────────────────────────
ipcMain.handle('clone-skill-from-git', async (_e, repoUrl) => {
  const tempDir = path.join(getDataDir(), 'temp-clone-' + uid());
  try {
    execSync(`git clone --depth 1 "${repoUrl}" "${tempDir}"`, { timeout: 60000, encoding: 'utf8' });

    // Look for SKILL.md or skills in the repo
    const skills = [];
    function findSkills(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name === '.git') continue;
          const fullPath = path.join(dir, e.name);
          if (e.isFile() && e.name === 'SKILL.md') {
            const content = fs.readFileSync(fullPath, 'utf8');
            const nameMatch = content.match(/^#\s+(.+)$/m);
            const descMatch = content.match(/^>\s*(.+)$/m) || content.match(/^##.*\n+(.+)$/m);
            skills.push({
              name: nameMatch?.[1] || path.basename(path.dirname(fullPath)),
              content,
              description: descMatch?.[1] || '',
              folder: path.relative(tempDir, path.dirname(fullPath)),
            });
          }
          if (e.isDirectory()) findSkills(fullPath);
        }
      } catch {}
    }
    findSkills(tempDir);

    // Import found skills
    const imported = [];
    const now = new Date().toISOString();
    for (const skill of skills) {
      const id = uid();
      dbRun('INSERT INTO custom_skills (id, name, category, description, tags, version, content, source, repo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, skill.name, 'general', skill.description, '[]', '1.0', skill.content, 'git', repoUrl, now, now]);
      imported.push({ id, name: skill.name });
    }

    // Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true, force: true });

    addHistory('skills_imported', `Imported ${imported.length} skills from ${repoUrl}`);
    return { success: true, imported };
  } catch (err) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return { success: false, error: err.message || 'Clone failed' };
  }
});

// ── IPC: GitHub Integration ─────────────────────────────────────
ipcMain.handle('github-connect', async (_e, token) => {
  try {
    // Verify token by calling GitHub API
    const https = require('node:https');
    const userData = await new Promise((resolve, reject) => {
      const req = https.get('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'Skillbox-Desktop', 'Accept': 'application/vnd.github.v3+json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) resolve(JSON.parse(data));
          else reject(new Error(`GitHub API returned ${res.statusCode}`));
        });
      });
      req.on('error', reject);
    });

    dbRun('INSERT OR REPLACE INTO github_config (id, token, username, avatar_url, connected_at) VALUES (1, ?, ?, ?, ?)',
      [token, userData.login, userData.avatar_url, new Date().toISOString()]);

    addHistory('github_connected', `Connected GitHub account: ${userData.login}`);
    return { success: true, username: userData.login, avatarUrl: userData.avatar_url };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github-disconnect', async () => {
  dbRun('DELETE FROM github_config WHERE id = 1');
  addHistory('github_disconnected', 'Disconnected GitHub account');
  return { success: true };
});

ipcMain.handle('github-get-status', async () => {
  const row = dbGet('SELECT * FROM github_config WHERE id = 1');
  if (!row || !row.token) return { connected: false };
  return { connected: true, username: row.username, avatarUrl: row.avatar_url };
});

ipcMain.handle('github-list-repos', async (_e, query) => {
  const config = dbGet('SELECT token FROM github_config WHERE id = 1');
  if (!config?.token) return { success: false, error: 'Not connected' };

  const https = require('node:https');
  const endpoint = query
    ? `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=20`
    : 'https://api.github.com/user/repos?per_page=30&sort=updated';

  const data = await new Promise((resolve, reject) => {
    const req = https.get(endpoint, {
      headers: { 'Authorization': `Bearer ${config.token}`, 'User-Agent': 'Skillbox-Desktop', 'Accept': 'application/vnd.github.v3+json' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });

  const repos = query ? (data.items || []) : data;
  return {
    success: true,
    repos: (repos || []).map(r => ({
      name: r.full_name,
      description: r.description,
      url: r.clone_url,
      stars: r.stargazers_count,
      language: r.language,
      updatedAt: r.updated_at,
    })),
  };
});

ipcMain.handle('github-clone-repo', async (_e, repoUrl, destPath) => {
  try {
    if (!destPath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select destination folder',
      });
      if (result.canceled || !result.filePaths.length) return { success: false, error: 'Cancelled' };
      destPath = path.join(result.filePaths[0], repoUrl.split('/').pop().replace('.git', ''));
    }
    execSync(`git clone "${repoUrl}" "${destPath}"`, { timeout: 120000, encoding: 'utf8' });
    addHistory('github_clone', `Cloned repo: ${repoUrl}`, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Terminal (real PTY via node-pty) ────────────────────────
const terminalProcesses = new Map();

function getDefaultShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

ipcMain.handle('terminal-create', async (_e, options = {}) => {
  const id = uid();
  const cwd = options.cwd || process.env.HOME || process.env.USERPROFILE || 'C:\\';
  const shellCmd = options.shell || getDefaultShell();
  const name = options.name || `Terminal ${terminalProcesses.size + 1}`;
  const cols = options.cols || 120;
  const rows = options.rows || 30;

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;

  const ptyProc = pty.spawn(shellCmd, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env,
    useConpty: process.platform === 'win32',
  });

  ptyProc.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-data', { id, data });
    }
  });

  ptyProc.onExit(({ exitCode }) => {
    terminalProcesses.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-exit', { id, code: exitCode });
    }
  });

  terminalProcesses.set(id, ptyProc);

  dbRun('INSERT INTO terminal_sessions (id, name, cwd, shell, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, cwd, shellCmd, new Date().toISOString()]);

  return { id, name, cwd, shell: shellCmd };
});

ipcMain.handle('terminal-write', async (_e, id, data) => {
  const proc = terminalProcesses.get(id);
  if (proc) {
    proc.write(data);
    return true;
  }
  return false;
});

ipcMain.handle('terminal-resize', async (_e, id, cols, rows) => {
  const proc = terminalProcesses.get(id);
  if (proc) {
    try { proc.resize(cols, rows); } catch {}
    return true;
  }
  return false;
});

ipcMain.handle('terminal-kill', async (_e, id) => {
  const proc = terminalProcesses.get(id);
  if (proc) {
    proc.kill();
    terminalProcesses.delete(id);
  }
  dbRun('DELETE FROM terminal_sessions WHERE id = ?', [id]);
  return true;
});

ipcMain.handle('terminal-list', async () => {
  return Array.from(terminalProcesses.keys()).map(id => {
    const session = dbGet('SELECT * FROM terminal_sessions WHERE id = ?', [id]);
    return session || { id, name: 'Terminal', cwd: '' };
  });
});

// ── IPC: Run CLI command ─────────────────────────────────────
ipcMain.handle('run-command', async (_e, cmd) => {
  try {
    const cliPath = path.resolve(__dirname, '..', '..', 'cli');
    const result = execSync(`node ${path.join(cliPath, 'dist', 'index.js')} ${cmd}`, {
      encoding: 'utf8',
      timeout: 30000,
      cwd: SKILLS_ROOT,
    });
    return { ok: true, output: result };
  } catch (err) {
    return { ok: false, output: err.stderr || err.message || 'Command failed' };
  }
});

// ── IPC: Open external ──────────────────────────────────────────
ipcMain.handle('open-external', async (_e, url) => {
  shell.openExternal(url);
});

// ── IPC: File Operations (Explorer) ─────────────────────────────
ipcMain.handle('reveal-in-finder', async (_e, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('copy-path', async (_e, filePath) => {
  const { clipboard } = require('electron');
  clipboard.writeText(filePath);
});

ipcMain.handle('copy-relative-path', async (_e, filePath, basePath) => {
  const { clipboard } = require('electron');
  clipboard.writeText(path.relative(basePath, filePath));
});

ipcMain.handle('read-file', async (_e, filePath) => {
  return fs.readFileSync(filePath, 'utf-8');
});

// File watchers for open editor tabs
const _fileWatchers = new Map();
ipcMain.handle('watch-file', (_e, filePath) => {
  if (_fileWatchers.has(filePath)) return;
  try {
    const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === 'change' && mainWindow && !mainWindow.isDestroyed()) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          mainWindow.webContents.send('file-changed', { filePath, content });
        } catch {}
      }
    });
    _fileWatchers.set(filePath, watcher);
  } catch {}
});
ipcMain.handle('unwatch-file', (_e, filePath) => {
  const w = _fileWatchers.get(filePath);
  if (w) { w.close(); _fileWatchers.delete(filePath); }
});

ipcMain.handle('write-file', async (_e, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8');
});

ipcMain.handle('create-file', async (_e, filePath) => {
  fs.writeFileSync(filePath, '', 'utf-8');
});

ipcMain.handle('create-folder', async (_e, dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
});

ipcMain.handle('rename-path', async (_e, oldPath, newPath) => {
  fs.renameSync(oldPath, newPath);
});

ipcMain.handle('move-path', async (_e, srcPath, destDir) => {
  const name = path.basename(srcPath);
  const dest = path.join(destDir, name);
  if (fs.existsSync(dest)) throw new Error(`"${name}" already exists in destination`);
  fs.renameSync(srcPath, dest);
  return dest;
});

ipcMain.handle('delete-path', async (_e, targetPath) => {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
});

// Native context menu (like VS Code)
ipcMain.handle('show-context-menu', async (_e, menuTemplate) => {
  return new Promise((resolve) => {
    const buildItems = (items) => items.map(item => {
      if (item.type === 'separator') return { type: 'separator' };
      const menuItem = {
        label: item.label,
        enabled: item.enabled !== false,
        click: () => resolve(item.action),
      };
      if (item.accelerator) menuItem.accelerator = item.accelerator;
      return menuItem;
    });
    const menu = Menu.buildFromTemplate(buildItems(menuTemplate));
    menu.popup({ window: mainWindow });
    menu.on('menu-will-close', () => {
      setTimeout(() => resolve(null), 100);
    });
  });
});

// ── IPC: DB Stats ───────────────────────────────────────────────
ipcMain.handle('get-db-stats', async () => {
  const projects = db.exec('SELECT COUNT(*) FROM projects')[0]?.values[0][0] || 0;
  const teams = db.exec('SELECT COUNT(*) FROM teams')[0]?.values[0][0] || 0;
  const history = db.exec('SELECT COUNT(*) FROM history')[0]?.values[0][0] || 0;
  const skills = db.exec('SELECT COUNT(*) FROM custom_skills')[0]?.values[0][0] || 0;
  const dbPath = path.join(getDataDir(), 'skillbox.db');
  let dbSize = 0;
  try { dbSize = fs.statSync(dbPath).size; } catch {}
  return { projects, teams, history, customSkills: skills, dbSizeBytes: dbSize };
});

ipcMain.handle('get-system-stats', () => {
  const cpus = os.cpus();
  // Average CPU usage across cores (idle vs total)
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  const cpuUsage = Math.round(((totalTick - totalIdle) / totalTick) * 100);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Count active terminal sessions
  const activeTerminals = terminalProcesses ? terminalProcesses.size : 0;

  // Git branch of active project (best-effort)
  let gitBranch = null;
  try {
    const projects = loadProjects();
    if (projects.length > 0) {
      const headPath = path.join(projects[0].path, '.git', 'HEAD');
      if (fs.existsSync(headPath)) {
        const head = fs.readFileSync(headPath, 'utf8').trim();
        gitBranch = head.startsWith('ref: refs/heads/') ? head.replace('ref: refs/heads/', '') : head.slice(0, 8);
      }
    }
  } catch {}

  return {
    cpuUsage,
    memUsed: usedMem,
    memTotal: totalMem,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    uptime: Math.floor(process.uptime()),
    hostname: os.hostname(),
    activeTerminals,
    gitBranch,
  };
});

// ── IPC: Tasks ──────────────────────────────────────────────────
ipcMain.handle('get-tasks', async (_e, projectPath) => {
  if (projectPath) {
    return dbAll('SELECT * FROM tasks WHERE project_path = ? ORDER BY order_index ASC, created_at DESC', [projectPath]);
  }
  return dbAll('SELECT * FROM tasks ORDER BY order_index ASC, created_at DESC');
});

ipcMain.handle('create-task', async (_e, taskData) => {
  const id = uid();
  const now = new Date().toISOString();
  const maxOrder = dbGet('SELECT MAX(order_index) as m FROM tasks WHERE project_path = ? AND status = ?', [taskData.projectPath, taskData.status || 'todo']);
  const orderIndex = (maxOrder?.m ?? -1) + 1;
  dbRun('INSERT INTO tasks (id, project_path, title, description, status, assignee, priority, labels, created_at, updated_at, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, taskData.projectPath, taskData.title, taskData.description || '', taskData.status || 'todo', taskData.assignee || null, taskData.priority || 'medium', JSON.stringify(taskData.labels || []), now, now, orderIndex]);
  addHistory('task_created', `Created task: ${taskData.title}`, taskData.projectPath);
  return { id, success: true };
});

ipcMain.handle('update-task', async (_e, taskId, updates) => {
  const existing = dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!existing) return { success: false };
  const title = updates.title ?? existing.title;
  const description = updates.description ?? existing.description;
  const status = updates.status ?? existing.status;
  const assignee = updates.assignee ?? existing.assignee;
  const priority = updates.priority ?? existing.priority;
  const labels = updates.labels ? JSON.stringify(updates.labels) : existing.labels;
  const orderIndex = updates.order_index ?? existing.order_index;
  dbRun('UPDATE tasks SET title = ?, description = ?, status = ?, assignee = ?, priority = ?, labels = ?, order_index = ?, updated_at = ? WHERE id = ?',
    [title, description, status, assignee, priority, labels, orderIndex, new Date().toISOString(), taskId]);
  if (updates.status && updates.status !== existing.status) {
    addHistory('task_status', `Moved "${title}" to ${updates.status}`, existing.project_path);
  }
  return { success: true };
});

ipcMain.handle('delete-task', async (_e, taskId) => {
  const task = dbGet('SELECT title, project_path FROM tasks WHERE id = ?', [taskId]);
  dbRun('DELETE FROM tasks WHERE id = ?', [taskId]);
  if (task) addHistory('task_deleted', `Deleted task: ${task.title}`, task.project_path);
  return { success: true };
});

// ── IPC: Messages / Chat ────────────────────────────────────────
ipcMain.handle('get-messages', async (_e, projectPath, taskId) => {
  if (taskId) {
    return dbAll('SELECT * FROM messages WHERE task_id = ? ORDER BY created_at ASC', [taskId]);
  }
  if (projectPath) {
    return dbAll('SELECT * FROM messages WHERE project_path = ? AND task_id IS NULL ORDER BY created_at ASC', [projectPath]);
  }
  return dbAll('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200');
});

ipcMain.handle('send-message', async (_e, msgData) => {
  const id = uid();
  const now = new Date().toISOString();
  dbRun('INSERT INTO messages (id, project_path, task_id, author, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, msgData.projectPath || null, msgData.taskId || null, msgData.author || 'You', msgData.content, now]);
  return { id, success: true, created_at: now };
});

ipcMain.handle('delete-message', async (_e, msgId) => {
  dbRun('DELETE FROM messages WHERE id = ?', [msgId]);
  return { success: true };
});

// ── IPC: Settings ────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  "editor.fontFamily": "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  "editor.fontSize": 14,
  "editor.tabSize": 2,
  "editor.lineHeight": 22,
  "editor.minimap": true,
  "editor.wordWrap": "off",
  "editor.lineNumbers": "on",
  "editor.bracketPairColorization": true,
  "editor.fontLigatures": true,
  "editor.renderWhitespace": "selection",
  "editor.cursorBlinking": "smooth",
  "editor.smoothScrolling": true,
  "terminal.fontFamily": "'Cascadia Code', 'Fira Code', 'SF Mono', Menlo, monospace",
  "terminal.fontSize": 13,
  "terminal.lineHeight": 1.3,
  "terminal.cursorBlink": true,
  "terminal.scrollback": 5000,
  "terminal.theme": "default",
  "workbench.colorTheme": "Skillbox Dark",
  "workbench.primaryColor": "#0090ff",
  "workbench.mode": "dark",
  "workbench.accent": "blue",
  "workbench.gray": "slate",
  "workbench.sidebarWidth": 220,
  "workbench.rightPanelWidth": 260,
  "workbench.activityBar.visible": true,
  "general.language": "en",
  "extensions.autoUpdate": true,
  "context.aiTools": ["claude"],
  "context.autoSync": true,
  "context.maxCacheAgeDays": 30,
  "context.cleanOnRemove": true,
  "mcp.serverEnabled": false,
  "mcp.serverPort": 0,
  "mcp.serverToken": "",
  "mcp.savedConnections": [],
};

function getSettingsPath() { return path.join(getDataDir(), 'settings.json'); }

function readUserSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf-8'));
  } catch { return {}; }
}

function writeUserSettings(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

ipcMain.handle('get-default-settings', () => DEFAULT_SETTINGS);

ipcMain.handle('get-settings', () => {
  const user = readUserSettings();
  return { ...DEFAULT_SETTINGS, ...user };
});

ipcMain.handle('save-settings', (_e, newSettings) => {
  // Only save values that differ from defaults
  const overrides = {};
  for (const [key, val] of Object.entries(newSettings)) {
    if (JSON.stringify(val) !== JSON.stringify(DEFAULT_SETTINGS[key])) {
      overrides[key] = val;
    }
  }
  writeUserSettings(overrides);
  return { ...DEFAULT_SETTINGS, ...overrides };
});

// ── IPC: Extensions ──────────────────────────────────────────────
function getExtensionsDir() {
  const dir = path.join(getDataDir(), 'extensions');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('get-installed-extensions', () => {
  const extDir = getExtensionsDir();
  const results = [];
  try {
    const dirs = fs.readdirSync(extDir).filter(d => {
      return fs.statSync(path.join(extDir, d)).isDirectory();
    });
    for (const dir of dirs) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(extDir, dir, 'package.json'), 'utf-8'));
        results.push({
          id: dir,
          name: pkg.displayName || pkg.name || dir,
          version: pkg.version || '0.0.0',
          description: pkg.description || '',
          publisher: pkg.publisher || 'Unknown',
          icon: pkg.icon ? path.join(extDir, dir, pkg.icon) : null,
          enabled: true,
          path: path.join(extDir, dir),
          categories: pkg.categories || [],
          contributes: pkg.contributes || {},
        });
      } catch { /* skip invalid */ }
    }
  } catch { /* no extensions */ }
  return results;
});

ipcMain.handle('install-extension-vsix', async (_e, vsixPath) => {
  // Extract .vsix (which is a .zip) to extensions dir
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(vsixPath);
  const entries = zip.getEntries();

  // Find package.json inside extension/ folder
  const pkgEntry = entries.find(e => e.entryName.match(/^extension\/package\.json$/));
  if (!pkgEntry) return { success: false, error: 'Invalid VSIX: no package.json found' };

  const pkg = JSON.parse(pkgEntry.getData().toString('utf-8'));
  const extId = `${pkg.publisher || 'unknown'}.${pkg.name || 'extension'}`;
  const destDir = path.join(getExtensionsDir(), extId);

  // Extract extension/ contents to dest
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of entries) {
    if (entry.entryName.startsWith('extension/') && !entry.isDirectory) {
      const relPath = entry.entryName.replace(/^extension\//, '');
      const filePath = path.join(destDir, relPath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, entry.getData());
    }
  }

  return { success: true, id: extId, name: pkg.displayName || pkg.name };
});

ipcMain.handle('uninstall-extension', async (_e, extId) => {
  const extPath = path.join(getExtensionsDir(), extId);
  if (fs.existsSync(extPath)) {
    fs.rmSync(extPath, { recursive: true });
    return { success: true };
  }
  return { success: false, error: 'Extension not found' };
});

ipcMain.handle('browse-vsix', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'VS Code Extensions', extensions: ['vsix'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-extensions-dir', () => {
  shell.openPath(getExtensionsDir());
});

// Import extension from a directory (e.g., from VS Code extensions folder)
ipcMain.handle('install-extension-from-dir', async (_e, srcDir) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(srcDir, 'package.json'), 'utf-8'));
    const extId = path.basename(srcDir);
    const destDir = path.join(getExtensionsDir(), extId);

    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true });

    // Recursive copy
    const copyDir = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
      }
    };
    copyDir(srcDir, destDir);

    return { success: true, id: extId, name: pkg.displayName || pkg.name || extId };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// List VS Code extensions available for import
ipcMain.handle('list-vscode-extensions', () => {
  const results = [];
  const vscodeDirs = [
    path.join(app.getPath('home'), '.vscode', 'extensions'),
    path.join(app.getPath('home'), '.cursor', 'extensions'),
    path.join(app.getPath('home'), '.vscode-insiders', 'extensions'),
  ];
  const installedDir = getExtensionsDir();
  const installed = new Set();
  try {
    fs.readdirSync(installedDir).forEach(d => installed.add(d));
  } catch {}

  for (const extRoot of vscodeDirs) {
    if (!fs.existsSync(extRoot)) continue;
    const source = extRoot.includes('.cursor') ? 'Cursor' : extRoot.includes('insiders') ? 'VS Code Insiders' : 'VS Code';
    try {
      const dirs = fs.readdirSync(extRoot).filter(d => {
        try { return fs.statSync(path.join(extRoot, d)).isDirectory(); } catch { return false; }
      });
      for (const dir of dirs) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(extRoot, dir, 'package.json'), 'utf-8'));
          results.push({
            id: dir,
            name: pkg.displayName || pkg.name || dir,
            version: pkg.version || '0.0.0',
            description: pkg.description || '',
            publisher: pkg.publisher || 'Unknown',
            source,
            path: path.join(extRoot, dir),
            installed: installed.has(dir),
          });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return results;
});

// ── IPC: Extension Host ──────────────────────────────────────────
ipcMain.handle('activate-extension', async (_e, extId) => {
  if (!extensionHost) return { success: false, error: 'Extension host not ready' };
  const extDir = path.join(getExtensionsDir(), extId);
  if (!fs.existsSync(extDir)) return { success: false, error: 'Extension not installed' };
  return extensionHost.activate(extDir, extId);
});

ipcMain.handle('deactivate-extension', async (_e, extId) => {
  if (!extensionHost) return { success: false, error: 'Extension host not ready' };
  return extensionHost.deactivate(extId);
});

ipcMain.handle('resolve-extension-webview', async (_e, extId, viewId) => {
  if (!extensionHost) return { success: false, error: 'Extension host not ready' };
  return extensionHost.resolveWebviewView(extId, viewId);
});

ipcMain.handle('extension-webview-msg', (_e, extId, viewId, message) => {
  if (!extensionHost) return;
  extensionHost.forwardMessageToExtension(extId, viewId, message);
});

ipcMain.handle('execute-extension-command', async (_e, extId, commandId, ...args) => {
  if (!extensionHost) return;
  return extensionHost.executeCommand(extId, commandId, ...args);
});

ipcMain.handle('get-extension-config-schema', (_e, extId) => {
  if (!extensionHost) return null;
  return extensionHost.getConfigSchema(extId);
});

ipcMain.handle('update-extension-config', (_e, extId, section, key, value) => {
  if (!extensionHost) return;
  extensionHost.updateConfig(extId, section, key, value);
});

ipcMain.handle('set-extension-workspace', (_e, projectPath) => {
  if (!extensionHost) return;
  extensionHost.setWorkspace(projectPath);
});

ipcMain.handle('re-resolve-extension-webview', async (_e, extId, viewId) => {
  if (!extensionHost) return { success: false, error: 'No extension host' };
  return extensionHost.reResolveWebviewView(extId, viewId);
});

ipcMain.handle('get-extension-detail', (_e, extId) => {
  const extDir = path.join(getExtensionsDir(), extId);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(extDir, 'package.json'), 'utf-8'));
    const iconPath = pkg.icon ? path.join(extDir, pkg.icon) : null;
    let resolvedIcon = iconPath && fs.existsSync(iconPath) ? iconPath : null;
    if (!resolvedIcon) {
      const candidates = ['resources/claude-logo.svg', 'resources/icon.png', 'icon.png', 'icon.svg'];
      for (const c of candidates) {
        const p = path.join(extDir, c);
        if (fs.existsSync(p)) { resolvedIcon = p; break; }
      }
    }
    const contributes = pkg.contributes || {};
    const config = contributes.configuration;
    const configProps = config ? (Array.isArray(config) ? config[0] : config)?.properties || {} : {};
    return {
      id: extId,
      name: pkg.displayName || pkg.name || extId,
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      publisher: pkg.publisher || 'Unknown',
      icon: resolvedIcon,
      main: pkg.main,
      hasWebview: !!(contributes.views || contributes.viewsContainers),
      commands: (contributes.commands || []).map(c => ({ id: c.command, title: c.title })),
      configProperties: Object.entries(configProps).map(([key, schema]) => ({
        key, type: schema.type, default: schema.default, description: schema.description || schema.markdownDescription || '',
        enum: schema.enum, enumDescriptions: schema.enumDescriptions,
      })),
      keybindings: contributes.keybindings || [],
      viewIds: Object.values(contributes.views || {}).flat().map(v => v.id),
      activationEvents: pkg.activationEvents || [],
    };
  } catch (e) {
    return null;
  }
});

// ── Project Context Files (.skillbox/project/context/) ──────────

const CONTEXT_DIR = '.skillbox/project/context';
const CONTEXT_FILES = ['context.md', 'stack.md', 'services.md', 'dependencies.md', 'environment.md', 'team.md', 'scripts.md', 'testing.md'];

function parseContextFile(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const fm = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      // Simple YAML: strings, arrays (inline [...]), booleans, numbers
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d+$/.test(val)) val = parseInt(val, 10);
      else if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      } else {
        val = val.replace(/^['"]|['"]$/g, '');
      }
      fm[key] = val;
    }
  });
  return { frontmatter: fm, body: match[2].trim() };
}

function buildContextFile(frontmatter, body) {
  let yaml = '---\n';
  for (const [k, v] of Object.entries(frontmatter)) {
    if (Array.isArray(v)) {
      yaml += `${k}: [${v.map(s => `"${s}"`).join(', ')}]\n`;
    } else {
      yaml += `${k}: ${v}\n`;
    }
  }
  yaml += '---\n\n';
  return yaml + body + '\n';
}

function getContextDir(projectPath) {
  return path.join(projectPath, CONTEXT_DIR);
}

ipcMain.handle('get-project-context', (_e, projectPath) => {
  const ctxDir = getContextDir(projectPath);
  if (!fs.existsSync(ctxDir)) return { initialized: false, files: {} };
  const result = { initialized: true, files: {} };
  for (const fname of CONTEXT_FILES) {
    const fp = path.join(ctxDir, fname);
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, 'utf8');
      result.files[fname] = { raw, ...parseContextFile(raw) };
    }
  }
  return result;
});

ipcMain.handle('save-context-file', (_e, projectPath, fileName, content) => {
  const ctxDir = getContextDir(projectPath);
  if (!fs.existsSync(ctxDir)) fs.mkdirSync(ctxDir, { recursive: true });
  fs.writeFileSync(path.join(ctxDir, fileName), content, 'utf8');
  return { success: true };
});

ipcMain.handle('init-project-context', async (_e, projectPath) => {
  const ctxDir = getContextDir(projectPath);
  fs.mkdirSync(ctxDir, { recursive: true });

  // Get existing analysis data
  const row = dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]);
  const project = row ? projectRowToObj(row) : null;
  const analysis = project?.analysis || {};
  const projectName = project?.name || path.basename(projectPath);

  const now = new Date().toISOString();

  // ── context.md (main hub) ──
  const contextBody = `# ${projectName}

## Overview
Project located at \`${projectPath}\`

## Quick Links
- [Stack](stack.md) - Technology stack
- [Services](services.md) - Infrastructure services
- [Dependencies](dependencies.md) - Libraries and packages
- [Environment](environment.md) - Environment variable descriptions
- [Team](team.md) - Team members and roles
- [Scripts](scripts.md) - Available commands
- [Testing](testing.md) - Test configuration

## Notes
_Add project notes here. Your AI assistant will update this file as it learns more about the project._`;

  fs.writeFileSync(path.join(ctxDir, 'context.md'), buildContextFile({
    version: '1.0',
    project: projectName,
    updated_at: now,
    files: CONTEXT_FILES.filter(f => f !== 'context.md'),
  }, contextBody));

  // ── stack.md ──
  const stackItems = (analysis.stack || []).map(s => `- **${s.name}**`).join('\n') || '_Run analysis to detect stack_';
  fs.writeFileSync(path.join(ctxDir, 'stack.md'), buildContextFile({
    type: 'stack',
    updated_at: now,
    auto_detected: true,
  }, `# Tech Stack\n\n${stackItems}`));

  // ── services.md ──
  const svcItems = (analysis.services || []).map(s =>
    `### ${s.name}\n- **Type:** ${s.type}\n- **Source:** ${s.source || 'unknown'}`
  ).join('\n\n') || '_No services detected_';
  fs.writeFileSync(path.join(ctxDir, 'services.md'), buildContextFile({
    type: 'services',
    updated_at: now,
  }, `# Services\n\n${svcItems}`));

  // ── dependencies.md ──
  let depBody = '# Dependencies\n\n';
  for (const [mgr, list] of Object.entries(analysis.dependencies || {})) {
    if (!list?.length) continue;
    const label = { npm: 'npm', python: 'pip', ruby: 'gem', java: 'maven' }[mgr] || mgr;
    depBody += `## ${label}\n\n| Package | Version |\n|---------|--------|\n`;
    list.forEach(d => { depBody += `| ${d.name} | ${d.version || 'latest'} |\n`; });
    depBody += '\n';
  }
  if (!Object.values(analysis.dependencies || {}).some(l => l?.length)) depBody += '_Run analysis to detect dependencies_\n';
  fs.writeFileSync(path.join(ctxDir, 'dependencies.md'), buildContextFile({
    type: 'dependencies',
    updated_at: now,
  }, depBody));

  // ── environment.md (names + descriptions only, NO actual values) ──
  const envData = project?.environments || {};
  const allEnvKeys = new Set();
  Object.values(envData).forEach(vars => Object.keys(vars).forEach(k => allEnvKeys.add(k)));
  let envBody = '# Environment Variables\n\n';
  envBody += '> This file describes environment variables. It does NOT contain actual values or secrets.\n\n';
  if (allEnvKeys.size > 0) {
    envBody += '| Variable | Description | Required |\n|----------|-------------|----------|\n';
    for (const k of allEnvKeys) {
      const sensitive = /secret|password|token|key|api_key|auth/i.test(k);
      envBody += `| ${k} | ${sensitive ? 'Sensitive credential' : '_describe purpose_'} | yes |\n`;
    }
  } else {
    envBody += '_No environment variables configured yet_\n';
  }
  fs.writeFileSync(path.join(ctxDir, 'environment.md'), buildContextFile({
    type: 'environment',
    updated_at: now,
    env_files: ['.env', '.env.local'],
  }, envBody));

  // ── team.md ──
  const allTeams = loadTeams();
  const projectTeams = allTeams.filter(t => {
    const assigned = typeof t.projects === 'string' ? JSON.parse(t.projects || '[]') : (t.projects || []);
    return assigned.includes(projectPath);
  });
  let teamBody = '# Team\n\n';
  if (projectTeams.length) {
    projectTeams.forEach(t => {
      const members = typeof t.members === 'string' ? JSON.parse(t.members || '[]') : (t.members || []);
      teamBody += `## ${t.name}\n\n`;
      if (members.length) {
        teamBody += '| Name | Role |\n|------|------|\n';
        members.forEach(m => { teamBody += `| ${m.name} | ${m.role || ''} |\n`; });
      }
      teamBody += '\n';
    });
  } else {
    teamBody += '_No team assigned_\n';
  }
  fs.writeFileSync(path.join(ctxDir, 'team.md'), buildContextFile({
    type: 'team',
    updated_at: now,
  }, teamBody));

  // ── scripts.md ──
  const scripts = analysis.scripts || {};
  let scriptBody = '# Scripts\n\n';
  const scriptEntries = Object.entries(scripts);
  if (scriptEntries.length) {
    scriptBody += '| Command | Script | Description |\n|---------|--------|-------------|\n';
    scriptEntries.forEach(([name, cmd]) => {
      scriptBody += `| \`npm run ${name}\` | \`${cmd}\` | _describe_ |\n`;
    });
  } else {
    scriptBody += '_No scripts detected_\n';
  }
  fs.writeFileSync(path.join(ctxDir, 'scripts.md'), buildContextFile({
    type: 'scripts',
    updated_at: now,
  }, scriptBody));

  // ── testing.md ──
  let testBody = '# Testing\n\n';
  testBody += '_Run test detection to populate this section_\n';
  fs.writeFileSync(path.join(ctxDir, 'testing.md'), buildContextFile({
    type: 'testing',
    updated_at: now,
  }, testBody));

  // Add .skillbox to .gitignore if not already there (env vars are in DB, not in these files)
  // Actually, context files SHOULD be committed — they're the project brain. No secrets.
  addHistory('context_initialized', `Project context files created in .skillbox/project/context/`, projectPath);

  return { success: true, path: ctxDir };
});

ipcMain.handle('get-context-file-path', (_e, projectPath, fileName) => {
  return path.join(getContextDir(projectPath), fileName);
});

// ── Git Info ─────────────────────────────────────────────────────

ipcMain.handle('get-git-info', (_e, projectPath) => {
  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }).trim();
    } catch { return ''; }
  };

  try {
    const rawBranch = run('git rev-parse --abbrev-ref HEAD');
    if (!rawBranch) return { error: 'Not a git repository' };

    // Detect detached HEAD — display name differs from real ref used for git ops
    const detached = rawBranch === 'HEAD';
    let branch = rawBranch;
    let displayBranch = rawBranch;
    if (detached) {
      const shortHash = run('git rev-parse --short HEAD');
      displayBranch = shortHash ? `detached @ ${shortHash}` : 'HEAD (detached)';
    }

    const localBranches = run('git branch --format="%(refname:short)"').split('\n').filter(Boolean);
    const remoteBranches = run('git branch -r --format="%(refname:short)"').split('\n').filter(Boolean);

    const logRaw = run('git log -25 --format="%H|%an|%aI|%s" --shortstat');
    const commits = [];
    const lines = logRaw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('|')) {
        const [hash, author, date, ...msgParts] = line.split('|');
        const message = msgParts.join('|');
        let insertions = 0, deletions = 0;
        const statLine = lines[i + 1] || '';
        const insMatch = statLine.match(/(\d+) insertion/);
        const delMatch = statLine.match(/(\d+) deletion/);
        if (insMatch) insertions = parseInt(insMatch[1], 10);
        if (delMatch) deletions = parseInt(delMatch[1], 10);
        if (insMatch || delMatch) i++;
        commits.push({ hash, author, date, message, insertions, deletions });
      }
    }

    const totalCommits = parseInt(run('git rev-list --count HEAD') || '0', 10);
    const remoteUrl = run('git remote get-url origin');

    // Ahead/behind remote tracking branch (skip for detached HEAD — no upstream)
    let ahead = 0, behind = 0;
    if (!detached) {
      const tracking = run(`git rev-parse --abbrev-ref ${branch}@{upstream}`);
      if (tracking) {
        const ab = run(`git rev-list --left-right --count ${branch}...${tracking}`);
        if (ab) {
          const parts = ab.split(/\s+/);
          ahead = parseInt(parts[0], 10) || 0;
          behind = parseInt(parts[1], 10) || 0;
        }
      }
    }

    // Last fetch/pull time
    let lastFetch = null;
    try {
      const fetchHeadPath = require('node:path').join(projectPath, '.git', 'FETCH_HEAD');
      if (require('node:fs').existsSync(fetchHeadPath)) {
        lastFetch = require('node:fs').statSync(fetchHeadPath).mtime.toISOString();
      }
    } catch {}

    return {
      branch: displayBranch,
      detached,
      branches: { local: localBranches, remote: remoteBranches },
      commits,
      totalCommits,
      remoteUrl,
      ahead,
      behind,
      lastFetch,
    };
  } catch (e) {
    return { error: e.message };
  }
});

// ── Git Status (change count) ────────────────────────────────────

ipcMain.handle('get-git-status', (_e, projectPath) => {
  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }).trim();
    } catch { return ''; }
  };
  try {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (!branch) return { error: 'Not a git repo', changes: 0, files: [] };

    const statusRaw = run('git status --porcelain');
    const files = statusRaw ? statusRaw.split('\n').filter(Boolean).map(line => ({
      status: line.substring(0, 2).trim(),
      file: line.substring(3),
    })) : [];

    return { branch, changes: files.length, files };
  } catch (e) {
    return { error: e.message, changes: 0, files: [] };
  }
});

// ── Git Checkout (switch branch) ─────────────────────────────────

ipcMain.handle('git-checkout', async (_e, projectPath, branchName) => {
  try {
    execSync(`git checkout "${branchName}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 15000 });
    const newBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }).trim();
    return { ok: true, branch: newBranch };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Create Branch ────────────────────────────────────────────

ipcMain.handle('git-create-branch', (_e, projectPath, branchName, fromRef) => {
  try {
    const base = fromRef ? `"${fromRef}"` : '';
    execSync(`git checkout -b "${branchName}" ${base}`.trim(), { cwd: projectPath, encoding: 'utf-8', timeout: 15000 });
    const newBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }).trim();
    return { ok: true, branch: newBranch };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Merge ────────────────────────────────────────────────────

ipcMain.handle('git-merge', (_e, projectPath, branchName) => {
  try {
    const result = execSync(`git merge "${branchName}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 60000 });
    return { ok: true, output: result };
  } catch (e) {
    const err = e.stderr || e.stdout || e.message;
    const hasConflict = err.includes('CONFLICT') || err.includes('Automatic merge failed');
    return { ok: false, error: err, conflict: hasConflict };
  }
});

// ── Git Merge Abort ──────────────────────────────────────────────

ipcMain.handle('git-merge-abort', (_e, projectPath) => {
  try {
    execSync('git merge --abort', { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Delete Branch ────────────────────────────────────────────

ipcMain.handle('git-delete-branch', (_e, projectPath, branchName, force) => {
  try {
    const flag = force ? '-D' : '-d';
    execSync(`git branch ${flag} "${branchName}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Stage / Unstage ──────────────────────────────────────────

ipcMain.handle('git-stage', (_e, projectPath, files) => {
  try {
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      execSync(`git add -- "${f}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

ipcMain.handle('git-stage-all', (_e, projectPath) => {
  try {
    execSync('git add -A', { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

ipcMain.handle('git-unstage', (_e, projectPath, files) => {
  try {
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      execSync(`git reset HEAD -- "${f}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

ipcMain.handle('git-unstage-all', (_e, projectPath) => {
  try {
    execSync('git reset HEAD', { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Commit ───────────────────────────────────────────────────

ipcMain.handle('git-commit', (_e, projectPath, message) => {
  try {
    // Use stdin to avoid shell escaping issues with commit messages
    const result = execSync('git commit -m "' + message.replace(/"/g, '\\"') + '"', {
      cwd: projectPath, encoding: 'utf-8', timeout: 30000,
    });
    const hash = execSync('git rev-parse --short HEAD', { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }).trim();
    return { ok: true, hash, output: result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Push / Pull / Fetch ──────────────────────────────────────

ipcMain.handle('git-push', (_e, projectPath, remote, branch) => {
  try {
    const r = remote || 'origin';
    const b = branch || '';
    const cmd = b ? `git push ${r} ${b}` : `git push`;
    const result = execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 60000 });
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

ipcMain.handle('git-pull', (_e, projectPath, remote, branch) => {
  try {
    const r = remote || 'origin';
    const b = branch || '';
    const cmd = b ? `git pull ${r} ${b}` : `git pull`;
    const result = execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 60000 });
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

ipcMain.handle('git-fetch', (_e, projectPath) => {
  try {
    const result = execSync('git fetch --all --prune', { cwd: projectPath, encoding: 'utf-8', timeout: 60000 });
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Diff ─────────────────────────────────────────────────────

ipcMain.handle('git-diff', (_e, projectPath, file, staged) => {
  const run = (cmd) => {
    try { return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 15000 }).trim(); }
    catch { return ''; }
  };
  try {
    const flag = staged ? '--cached' : '';
    const target = file ? `-- "${file}"` : '';
    const diff = run(`git diff ${flag} ${target}`.trim());
    return { ok: true, diff };
  } catch (e) {
    return { ok: false, error: e.message, diff: '' };
  }
});

// ── Git Stash ────────────────────────────────────────────────────

ipcMain.handle('git-stash', (_e, projectPath, action, message) => {
  const run = (cmd) => {
    try { return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 15000 }).trim(); }
    catch (e) { throw e; }
  };
  try {
    switch (action) {
      case 'push': {
        const msg = message ? `git stash push -m "${message.replace(/"/g, '\\"')}"` : 'git stash push';
        const result = run(msg);
        return { ok: true, output: result };
      }
      case 'pop': {
        const result = run('git stash pop');
        return { ok: true, output: result };
      }
      case 'list': {
        const raw = run('git stash list');
        const stashes = raw ? raw.split('\n').filter(Boolean) : [];
        return { ok: true, stashes };
      }
      case 'drop': {
        const result = run('git stash drop');
        return { ok: true, output: result };
      }
      default:
        return { ok: false, error: `Unknown stash action: ${action}` };
    }
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Discard Changes ──────────────────────────────────────────

ipcMain.handle('git-discard', (_e, projectPath, files) => {
  try {
    const fileList = Array.isArray(files) ? files : [files];
    for (const f of fileList) {
      execSync(`git checkout -- "${f}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
});

// ── Git Enhanced Status (staged + unstaged separated) ────────────

ipcMain.handle('get-git-status-detailed', (_e, projectPath) => {
  const run = (cmd) => {
    try { return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }).trim(); }
    catch { return ''; }
  };
  try {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (!branch) return { error: 'Not a git repo', staged: [], unstaged: [], untracked: [] };

    const statusRaw = run('git status --porcelain');
    const staged = [], unstaged = [], untracked = [];

    if (statusRaw) {
      for (const line of statusRaw.split('\n').filter(Boolean)) {
        const x = line[0]; // index status
        const y = line[1]; // working tree status
        const file = line.substring(3);

        if (x === '?' && y === '?') {
          untracked.push({ file, status: 'untracked' });
        } else {
          if (x !== ' ' && x !== '?') {
            const statusMap = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied' };
            staged.push({ file, status: statusMap[x] || x });
          }
          if (y !== ' ' && y !== '?') {
            const statusMap = { M: 'modified', D: 'deleted' };
            unstaged.push({ file, status: statusMap[y] || y });
          }
        }
      }
    }

    return { branch, staged, unstaged, untracked };
  } catch (e) {
    return { error: e.message, staged: [], unstaged: [], untracked: [] };
  }
});

// ── Project Ports ────────────────────────────────────────────────

ipcMain.handle('get-project-ports', (_e, projectPath) => {
  const result = { dockerPorts: [], serviceUrls: {} };

  try {
    const composePath = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
      .map(f => path.join(projectPath, f))
      .find(f => fs.existsSync(f));

    if (composePath) {
      const content = fs.readFileSync(composePath, 'utf-8');
      const portMatches = content.matchAll(/ports:\s*\n((?:\s+-\s*.+\n?)+)/g);
      for (const match of portMatches) {
        const block = match[1];
        const mappings = block.matchAll(/["']?(\d+):(\d+)["']?/g);
        for (const m of mappings) {
          result.dockerPorts.push({ host: parseInt(m[1], 10), container: parseInt(m[2], 10) });
        }
      }
    }
  } catch { /* ignore */ }

  try {
    const envPath = path.join(projectPath, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const urlKeys = ['DATABASE_URL', 'REDIS_URL', 'MONGO_URL', 'MONGODB_URI', 'POSTGRES_URL', 'MYSQL_URL', 'AMQP_URL', 'RABBITMQ_URL', 'ELASTICSEARCH_URL'];
      for (const line of envContent.split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (urlKeys.includes(key) && val) {
          result.serviceUrls[key] = val;
        }
      }
    }
  } catch { /* ignore */ }

  return result;
});

// ── IPC: Context Sync (Compact JSON + AI tool outputs) ──────────

function generateCompactContext(project, allTeams, registry) {
  const assignedTeamIds = project.teams || [];
  const agents = assignedTeamIds
    .map(tid => allTeams.find(t => t.id === tid))
    .filter(Boolean)
    .map(agent => {
      const skills = (agent.members || []).map(s => {
        const name = typeof s === 'string' ? s : s?.name || s?.id || '';
        return name.includes('/') ? name.split('/').pop() : name;
      });
      return {
        name: agent.name,
        role: agent.description || 'General Assistant',
        skills,
      };
    });

  const stack = (project.analysis?.stack || []).map(s => s.name);
  const services = (project.analysis?.services || []).map(s => s.name);
  const scripts = project.analysis?.scripts || {};

  const activeSkills = (project.skills || []).map(sid => {
    const skill = (registry.skills || []).find(s => s.id === sid);
    return skill ? (skill.name || sid) : sid;
  });

  return {
    project: project.name,
    path: project.path,
    stack,
    services,
    env: project.activeEnv || 'DEV',
    agents,
    activeSkills,
    scripts,
    updated: new Date().toISOString(),
  };
}

function contextToMarkdown(ctx) {
  let md = `# Project: ${ctx.project}\n`;
  if (ctx.stack.length) md += `Stack: ${ctx.stack.join(', ')}\n`;
  if (ctx.services.length) md += `Services: ${ctx.services.join(', ')}\n`;
  md += `Env: ${ctx.env}\n`;

  if (ctx.agents.length) {
    md += `\n## Team\n`;
    for (const a of ctx.agents) {
      md += `- ${a.name} (${a.role})`;
      if (a.skills.length) md += ` — skills: ${a.skills.join(', ')}`;
      md += `\n`;
    }
  }

  if (ctx.activeSkills.length) {
    md += `\n## Active Skills\n`;
    for (const s of ctx.activeSkills) md += `- ${s}\n`;
  }

  const scriptEntries = Object.entries(ctx.scripts);
  if (scriptEntries.length) {
    md += `\n## Scripts\n`;
    for (const [name, cmd] of scriptEntries.slice(0, 10)) {
      md += `- ${name}: \`${cmd}\`\n`;
    }
  }

  return md;
}

ipcMain.handle('generate-context-sync', async (_e, projectPath) => {
  const row = dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]);
  if (!row) return null;
  const project = projectRowToObj(row);
  const allTeams = loadTeams();
  const registry = (() => { try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { return { skills: [] }; } })();

  const ctx = generateCompactContext(project, allTeams, registry);
  const markdown = contextToMarkdown(ctx);

  // Write context.json
  const skillboxDir = path.join(projectPath, '.skillbox');
  if (!fs.existsSync(skillboxDir)) fs.mkdirSync(skillboxDir, { recursive: true });
  fs.writeFileSync(path.join(skillboxDir, 'context.json'), JSON.stringify(ctx, null, 2), 'utf8');

  // Write AI tool files based on settings
  const settings = { ...DEFAULT_SETTINGS, ...readUserSettings() };
  const aiTools = settings['context.aiTools'] || ['claude'];

  const writtenFiles = [];
  for (const tool of aiTools) {
    const fileName = AI_TOOL_FILES[tool];
    if (!fileName) continue;
    const filePath = path.join(projectPath, fileName);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, markdown, 'utf8');
    writtenFiles.push(fileName);
  }

  addHistory('context_synced', `Synced context: ${writtenFiles.join(', ')}`, projectPath);

  return { context: ctx, markdown, writtenFiles, updated: ctx.updated };
});

ipcMain.handle('get-context-preview', async (_e, projectPath) => {
  const row = dbGet('SELECT * FROM projects WHERE path = ?', [projectPath]);
  if (!row) return null;
  const project = projectRowToObj(row);
  const allTeams = loadTeams();
  const registry = (() => { try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch { return { skills: [] }; } })();

  const ctx = generateCompactContext(project, allTeams, registry);
  const markdown = contextToMarkdown(ctx);

  // Check which files exist
  const settings = { ...DEFAULT_SETTINGS, ...readUserSettings() };
  const aiTools = settings['context.aiTools'] || ['claude'];
  const fileStatus = {};
  for (const tool of aiTools) {
    const fileName = AI_TOOL_FILES[tool];
    if (!fileName) continue;
    const filePath = path.join(projectPath, fileName);
    fileStatus[fileName] = {
      exists: fs.existsSync(filePath),
      lastModified: null,
    };
    if (fileStatus[fileName].exists) {
      try { fileStatus[fileName].lastModified = fs.statSync(filePath).mtime.toISOString(); } catch {}
    }
  }

  // Rough token count (~4 chars per token for English)
  const tokenEstimate = Math.ceil(markdown.length / 4);

  return { context: ctx, markdown, fileStatus, tokenEstimate };
});

// ── IPC: Storage Stats & Cleanup ───────────────────────────────

ipcMain.handle('get-storage-stats', async () => {
  const dbPath = path.join(getDataDir(), 'skillbox.db');
  let dbSize = 0;
  try { dbSize = fs.statSync(dbPath).size; } catch {}

  const projects = loadProjects();
  const projectStats = [];

  for (const project of projects) {
    const skillboxDir = path.join(project.path, '.skillbox');
    let contextSize = 0;
    let cacheSize = 0;
    const files = [];
    let lastSync = null;
    const projectExists = fs.existsSync(project.path);

    if (fs.existsSync(skillboxDir)) {
      try {
        const entries = fs.readdirSync(skillboxDir);
        for (const entry of entries) {
          const fp = path.join(skillboxDir, entry);
          try {
            const stat = fs.statSync(fp);
            if (stat.isFile()) {
              contextSize += stat.size;
              files.push(entry);
              if (!lastSync || stat.mtime > new Date(lastSync)) {
                lastSync = stat.mtime.toISOString();
              }
            } else if (stat.isDirectory() && entry === 'cache') {
              cacheSize += getDirSize(fp);
            } else if (stat.isDirectory() && entry === 'project') {
              cacheSize += getDirSize(fp);
            }
          } catch {}
        }
      } catch {}
    }

    // Check for AI tool files in project root
    for (const [, fileName] of Object.entries(AI_TOOL_FILES)) {
      const fp = path.join(project.path, fileName);
      try {
        if (fs.existsSync(fp)) {
          const stat = fs.statSync(fp);
          contextSize += stat.size;
          files.push(fileName);
          if (!lastSync || stat.mtime > new Date(lastSync)) {
            lastSync = stat.mtime.toISOString();
          }
        }
      } catch {}
    }

    projectStats.push({
      projectPath: project.path,
      projectName: project.name,
      projectExists,
      contextSize,
      cacheSize,
      totalSize: contextSize + cacheSize,
      files,
      lastSync,
    });
  }

  const totalContext = projectStats.reduce((s, p) => s + p.contextSize, 0);
  const totalCache = projectStats.reduce((s, p) => s + p.cacheSize, 0);

  return { dbSize, dbPath, projectStats, totalContext, totalCache };
});

function getDirSize(dirPath) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fp = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        try { size += fs.statSync(fp).size; } catch {}
      } else if (entry.isDirectory()) {
        size += getDirSize(fp);
      }
    }
  } catch {}
  return size;
}

ipcMain.handle('clean-project-context', async (_e, projectPath) => {
  // Remove .skillbox dir
  const skillboxDir = path.join(projectPath, '.skillbox');
  if (fs.existsSync(skillboxDir)) {
    fs.rmSync(skillboxDir, { recursive: true, force: true });
  }
  // Remove AI tool files
  for (const [, fileName] of Object.entries(AI_TOOL_FILES)) {
    const fp = path.join(projectPath, fileName);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
  }
  addHistory('context_cleaned', `Cleaned context files`, projectPath);
  return { success: true };
});

ipcMain.handle('clean-project-cache', async (_e, projectPath) => {
  const cacheDir = path.join(projectPath, '.skillbox', 'cache');
  if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  const contextDir = path.join(projectPath, '.skillbox', 'project');
  if (fs.existsSync(contextDir)) fs.rmSync(contextDir, { recursive: true, force: true });
  return { success: true };
});

ipcMain.handle('clean-all-stale-cache', async (_e, maxAgeDays) => {
  const s1 = { ...DEFAULT_SETTINGS, ...readUserSettings() };
  const maxAge = (maxAgeDays || s1['context.maxCacheAgeDays'] || 30) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const projects = loadProjects();
  let cleaned = 0;

  for (const project of projects) {
    const skillboxDir = path.join(project.path, '.skillbox');
    if (!fs.existsSync(skillboxDir)) continue;
    try {
      const stat = fs.statSync(skillboxDir);
      if (now - stat.mtime.getTime() > maxAge) {
        fs.rmSync(skillboxDir, { recursive: true, force: true });
        cleaned++;
      }
    } catch {}
  }

  return { cleaned };
});

// ── Test Detection ───────────────────────────────────────────────

ipcMain.handle('detect-tests', (_e, projectPath) => {
  const result = { frameworks: [], testFileCount: 0, hasTestScript: false };

  const exists = (f) => fs.existsSync(path.join(projectPath, f));

  // Package.json checks
  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
  } catch { /* no package.json */ }

  if (pkg) {
    const scripts = pkg.scripts || {};
    result.hasTestScript = !!scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1';
    const devDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (devDeps.jest || exists('jest.config.js') || exists('jest.config.ts')) result.frameworks.push('jest');
    if (devDeps.mocha || exists('.mocharc.yml') || exists('.mocharc.json')) result.frameworks.push('mocha');
    if (devDeps.cypress || exists('cypress.config.js') || exists('cypress.config.ts')) result.frameworks.push('cypress');
    if (devDeps['@playwright/test'] || exists('playwright.config.js') || exists('playwright.config.ts')) result.frameworks.push('playwright');
    if (devDeps.vitest || exists('vitest.config.js') || exists('vitest.config.ts')) result.frameworks.push('vitest');
  }

  // Python
  if (exists('pytest.ini') || exists('pyproject.toml') || exists('setup.cfg')) {
    try {
      const pyproject = exists('pyproject.toml') ? fs.readFileSync(path.join(projectPath, 'pyproject.toml'), 'utf-8') : '';
      if (pyproject.includes('pytest') || exists('pytest.ini')) result.frameworks.push('pytest');
    } catch { /* ignore */ }
  }

  // Ruby
  if (exists('Gemfile')) {
    try {
      const gemfile = fs.readFileSync(path.join(projectPath, 'Gemfile'), 'utf-8');
      if (gemfile.includes('rspec')) result.frameworks.push('rspec');
    } catch { /* ignore */ }
  }

  // Go
  if (exists('go.mod')) result.frameworks.push('go test');

  // Rust
  if (exists('Cargo.toml')) result.frameworks.push('cargo test');

  // Count test files (cross-platform, no shell commands)
  try {
    const testPatterns = [/\.test\./, /\.spec\./, /^test_.*\.py$/, /.*_test\.go$/, /.*_test\.rb$/];
    const skipDirs = new Set(['node_modules', '.git', 'vendor', 'dist', 'build']);
    let testCount = 0;
    const walk = (dir, depth) => {
      if (depth > 5) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.isDirectory()) {
          if (!skipDirs.has(e.name)) walk(path.join(dir, e.name), depth + 1);
        } else if (testPatterns.some(p => p.test(e.name))) {
          testCount++;
        }
      }
    };
    walk(projectPath, 0);
    result.testFileCount = testCount;
  } catch { /* ignore */ }

  return result;
});

// ── IPC: MCP (Model Context Protocol) ─────────────────────────────

// Helper: get git status (reused by MCP server)
function getGitStatusDetailedFn(projectPath) {
  const run = (cmd) => {
    try { return execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }).trim(); }
    catch { return ''; }
  };
  try {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (!branch) return { error: 'Not a git repo', staged: [], unstaged: [], untracked: [] };
    const statusRaw = run('git status --porcelain');
    const staged = [], unstaged = [], untracked = [];
    if (statusRaw) {
      for (const line of statusRaw.split('\n').filter(Boolean)) {
        const x = line[0], y = line[1], file = line.substring(3);
        if (x === '?' && y === '?') {
          untracked.push({ file, status: 'untracked' });
        } else {
          if (x !== ' ' && x !== '?') {
            const map = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied' };
            staged.push({ file, status: map[x] || x });
          }
          if (y !== ' ' && y !== '?') {
            const map = { M: 'modified', D: 'deleted' };
            unstaged.push({ file, status: map[y] || y });
          }
        }
      }
    }
    return { branch, staged, unstaged, untracked };
  } catch (e) {
    return { error: e.message, staged: [], unstaged: [], untracked: [] };
  }
}

// MCP Server handlers
ipcMain.handle('mcp-server-start', async (_e, opts = {}) => {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...readUserSettings() };
    const port = opts.port || settings['mcp.serverPort'] || 0;
    const token = opts.token || settings['mcp.serverToken'] || null;

    const result = await mcpServer.startServer({
      port,
      token: token || null,
      dbHelpers: { dbAll, dbGet, dbRun },
      gitHelpers: { getGitStatusDetailed: getGitStatusDetailedFn },
      projectHelpers: {},
      onApproval: (req) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp-approval-request', req);
        }
      },
      onStatus: (status) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp-server-status', status);
        }
      },
      onToolInvoked: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp-tool-invoked', info);
        }
      },
    });
    addHistory('mcp', `MCP server started on port ${result.port}`);
    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-server-stop', async () => {
  try {
    await mcpServer.stopServer();
    addHistory('mcp', 'MCP server stopped');
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-server-status', () => {
  return mcpServer.getStatus();
});

ipcMain.handle('mcp-resolve-approval', (_e, id, approved) => {
  return mcpServer.resolveApproval(id, approved);
});

ipcMain.handle('mcp-get-pending-approvals', () => {
  return mcpServer.getPendingApprovals();
});

// MCP Client handlers
ipcMain.handle('mcp-client-connect-http', async (_e, config) => {
  try {
    const result = await mcpClient.connectHttp(config);
    addHistory('mcp', `Connected to MCP server: ${config.name} (${config.url})`);
    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-client-connect-stdio', async (_e, config) => {
  try {
    const result = await mcpClient.connectStdio(config);
    addHistory('mcp', `Connected to MCP server: ${config.name} via ${config.command}`);
    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-client-disconnect', async (_e, id) => {
  try {
    await mcpClient.disconnect(id);
    addHistory('mcp', `Disconnected from MCP server: ${id}`);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-client-call-tool', async (_e, connectionId, toolName, args) => {
  try {
    return await mcpClient.callTool(connectionId, toolName, args);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-client-refresh-tools', async (_e, connectionId) => {
  try {
    return await mcpClient.refreshTools(connectionId);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('mcp-client-list', () => {
  return mcpClient.listConnections();
});

ipcMain.handle('mcp-client-all-tools', () => {
  return mcpClient.getAllTools();
});

// Notify renderer on client connection changes
mcpClient.setOnConnectionChange(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mcp-connections-changed', mcpClient.listConnections());
  }
});

// Auto-start MCP server if enabled in settings
app.whenReady().then(async () => {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...readUserSettings() };
    if (settings['mcp.serverEnabled']) {
      const port = settings['mcp.serverPort'] || 0;
      const token = settings['mcp.serverToken'] || null;
      await mcpServer.startServer({
        port,
        token: token || null,
        dbHelpers: { dbAll, dbGet, dbRun },
        gitHelpers: { getGitStatusDetailed: getGitStatusDetailedFn },
        projectHelpers: {},
        onApproval: (req) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mcp-approval-request', req);
          }
        },
        onStatus: (status) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mcp-server-status', status);
          }
        },
        onToolInvoked: (info) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mcp-tool-invoked', info);
          }
        },
      });
    }
  } catch (e) {
    console.error('MCP auto-start failed:', e.message);
  }
});

// Clean up MCP on quit
app.on('before-quit', async () => {
  try {
    await mcpServer.stopServer();
    await mcpClient.disconnectAll();
  } catch { /* ignore */ }
});
