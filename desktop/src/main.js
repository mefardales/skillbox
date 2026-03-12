const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const pty = require('@lydell/node-pty');

let mainWindow;

// ── Paths ───────────────────────────────────────────────────────
const SKILLS_ROOT = path.resolve(__dirname, '..', '..', 'skills');
const REGISTRY_PATH = path.join(SKILLS_ROOT, 'registry.json');

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
    backgroundColor: '#1a1625',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#150f20',
      symbolColor: '#9ca3af',
      height: 38,
    } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();
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
  }
  return loadProjects();
});

ipcMain.handle('unassign-team-from-project', async (_e, projectPath, teamId) => {
  const row = dbGet('SELECT teams FROM projects WHERE path = ?', [projectPath]);
  if (!row) return loadProjects();
  const teams = JSON.parse(row.teams || '[]').filter(t => t !== teamId);
  dbRun('UPDATE projects SET teams = ? WHERE path = ?', [JSON.stringify(teams), projectPath]);
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
