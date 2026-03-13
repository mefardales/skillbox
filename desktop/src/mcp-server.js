/**
 * Skillbox MCP Server
 *
 * Exposes Skillbox capabilities as MCP tools so external LLMs
 * (Claude Code, Cursor, etc.) can manage the app environment.
 *
 * Uses @modelcontextprotocol/sdk with StreamableHTTP transport on a dynamic port.
 */

const http = require('node:http');
const crypto = require('node:crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

// ── State ──
let mcpServer = null;
let httpServer = null;
let transport = null;
let serverPort = null;
let authToken = null;

// Rate limiting
const rateLimiter = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT = 60;         // requests per window
const RATE_WINDOW = 60_000;    // 1 minute

// Sensitive operations that need human approval
const SENSITIVE_OPS = new Set(['query_database', 'run_service']);

// Pending approval queue: id -> { resolve, reject, toolName, args }
const pendingApprovals = new Map();

// Callback set by main process
let onApprovalRequest = null;
let onStatusChange = null;
let onToolInvoked = null;

// ── Helpers ──
function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW };
    rateLimiter.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function verifyAuth(req) {
  if (!authToken) return true; // No auth configured
  const header = req.headers['authorization'];
  if (!header) return false;
  const token = header.replace(/^Bearer\s+/i, '');
  return token === authToken;
}

/**
 * Request human approval for sensitive operations.
 * Returns a promise that resolves when the user approves/denies.
 */
function requestApproval(toolName, args) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pendingApprovals.set(id, { resolve, reject, toolName, args });
    if (onApprovalRequest) {
      onApprovalRequest({ id, toolName, args });
    }
    // Auto-deny after 30 seconds
    setTimeout(() => {
      if (pendingApprovals.has(id)) {
        pendingApprovals.delete(id);
        resolve(false);
      }
    }, 30_000);
  });
}

/**
 * Initialize and start the MCP server.
 *
 * @param {object} opts
 * @param {number} opts.port - Desired port (0 for dynamic)
 * @param {string|null} opts.token - Auth token (null to disable)
 * @param {object} opts.dbHelpers - { dbAll, dbGet, dbRun } from main process
 * @param {object} opts.gitHelpers - { getGitStatusDetailed } from main process
 * @param {object} opts.projectHelpers - { getProjects, getEnvironments }
 * @param {function} opts.onApproval - Callback when sensitive op needs approval
 * @param {function} opts.onStatus - Callback for status changes
 */
async function startServer(opts) {
  if (mcpServer) {
    throw new Error('MCP server is already running');
  }

  const { port = 0, token = null, dbHelpers, gitHelpers, projectHelpers } = opts;
  authToken = token;
  onApprovalRequest = opts.onApproval || null;
  onStatusChange = opts.onStatus || null;
  onToolInvoked = opts.onToolInvoked || null;

  // Track last client IP for tool invocation logs
  let lastClientIp = 'unknown';

  // ── Create McpServer ──
  mcpServer = new McpServer(
    { name: 'skillbox', version: '1.0.0' },
    {
      capabilities: {
        tools: { listChanged: true },
      },
      instructions: 'Skillbox MCP server. Provides tools to query project data, agents, git status, environment variables, and run services.',
    }
  );

  // ── Register Tools ──

  // Helper: wrap tool handler to emit invocation events
  function wrapTool(name, description, schema, handler) {
    mcpServer.tool(name, description, schema, async (...args) => {
      const startTime = Date.now();
      try {
        const result = await handler(...args);
        const elapsed = Date.now() - startTime;
        if (onToolInvoked) {
          onToolInvoked({ toolName: name, success: true, elapsed, clientIp: lastClientIp, timestamp: new Date().toISOString() });
        }
        return result;
      } catch (e) {
        const elapsed = Date.now() - startTime;
        if (onToolInvoked) {
          onToolInvoked({ toolName: name, success: false, error: e.message, elapsed, clientIp: lastClientIp, timestamp: new Date().toISOString() });
        }
        throw e;
      }
    });
  }

  // 1. get_project_env_vars
  wrapTool(
    'get_project_env_vars',
    'Get environment variables for a project',
    { projectPath: z.string().describe('Absolute path to the project') },
    async ({ projectPath }) => {
      try {
        const row = dbHelpers.dbGet('SELECT environments, active_env FROM projects WHERE path = ?', [projectPath]);
        if (!row) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }) }] };
        const envs = JSON.parse(row.environments || '{}');
        const activeEnv = row.active_env || 'DEV';
        return {
          content: [{ type: 'text', text: JSON.stringify({ activeEnv, environments: envs }, null, 2) }],
        };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 2. list_agents
  wrapTool(
    'list_agents',
    'List all AI agents configured in Skillbox',
    {},
    async () => {
      try {
        const rows = dbHelpers.dbAll('SELECT id, name, description, members FROM teams');
        const agents = rows.map(r => ({
          id: r.id,
          name: r.name,
          role: r.description || '',
          skills: JSON.parse(r.members || '[]'),
        }));
        return { content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 3. list_projects
  wrapTool(
    'list_projects',
    'List all projects registered in Skillbox',
    {},
    async () => {
      try {
        const rows = dbHelpers.dbAll('SELECT id, name, path, skills, active_env, teams FROM projects');
        const projects = rows.map(r => ({
          id: r.id,
          name: r.name,
          path: r.path,
          skills: JSON.parse(r.skills || '[]'),
          activeEnv: r.active_env,
          agents: JSON.parse(r.teams || '[]'),
        }));
        return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 4. git_status
  wrapTool(
    'git_status',
    'Get git status for a project',
    { projectPath: z.string().describe('Absolute path to the project') },
    async ({ projectPath }) => {
      try {
        const status = await gitHelpers.getGitStatusDetailed(projectPath);
        if (status && status.error) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: status.error }) }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 5. query_database (sensitive — requires approval)
  wrapTool(
    'query_database',
    'Run a read-only SQL query against the Skillbox database (requires approval)',
    { sqlQuery: z.string().describe('SQL SELECT query to execute') },
    async ({ sqlQuery }) => {
      // Security: only allow SELECT statements
      const trimmed = sqlQuery.trim().toUpperCase();
      if (!trimmed.startsWith('SELECT')) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Only SELECT queries are allowed' }) }], isError: true };
      }

      // Request human approval
      const approved = await requestApproval('query_database', { sqlQuery });
      if (!approved) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Query denied by user' }) }], isError: true };
      }

      try {
        const rows = dbHelpers.dbAll(sqlQuery);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 6. run_service (sensitive — requires approval)
  wrapTool(
    'run_service',
    'Manage a project service (start/stop/logs) — requires approval',
    {
      projectPath: z.string().describe('Absolute path to the project'),
      serviceName: z.string().describe('Name of the service (npm script name)'),
      action: z.enum(['start', 'stop', 'logs']).describe('Action to perform'),
    },
    async ({ projectPath, serviceName, action }) => {
      const approved = await requestApproval('run_service', { projectPath, serviceName, action });
      if (!approved) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Action denied by user' }) }], isError: true };
      }

      try {
        const { execSync } = require('node:child_process');
        let result;
        if (action === 'start') {
          // Non-blocking start
          const { exec } = require('node:child_process');
          exec(`npm run ${serviceName}`, { cwd: projectPath });
          result = { status: 'started', service: serviceName };
        } else if (action === 'stop') {
          // Best-effort kill by name
          try {
            if (process.platform === 'win32') {
              execSync(`taskkill /FI "WINDOWTITLE eq ${serviceName}" /F`, { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
            } else {
              execSync(`pkill -f "${serviceName}"`, { cwd: projectPath, encoding: 'utf-8', timeout: 5000 });
            }
          } catch { /* process may not exist */ }
          result = { status: 'stopped', service: serviceName };
        } else if (action === 'logs') {
          // Return last 50 lines of npm output (best-effort)
          result = { status: 'logs', service: serviceName, message: 'Use the integrated terminal to view live logs' };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // 7. get_skill_content
  wrapTool(
    'get_skill_content',
    'Get the content of a skill from the registry',
    { skillId: z.string().describe('Skill ID (e.g., "frontend/react-components")') },
    async ({ skillId }) => {
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const skillsRoot = path.resolve(__dirname, '..', '..', 'skills');
        const skillPath = path.join(skillsRoot, skillId, 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Skill not found' }) }], isError: true };
        }
        const content = fs.readFileSync(skillPath, 'utf-8');
        return { content: [{ type: 'text', text: content }] };
      } catch (e) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true };
      }
    }
  );

  // ── HTTP Server with auth + rate limiting middleware ──
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limiting
    const ip = req.socket.remoteAddress || 'unknown';
    lastClientIp = ip.replace('::ffff:', ''); // Normalize IPv4-mapped IPv6
    if (!checkRateLimit(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    // Auth check
    if (!verifyAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    // Route to MCP transport
    if (req.url === '/mcp' || req.url === '/mcp/') {
      await transport.handleRequest(req, res);
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', tools: 7 }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp for MCP protocol or /health for status.' }));
    }
  });

  await mcpServer.connect(transport);

  return new Promise((resolve, reject) => {
    httpServer.listen(port, '127.0.0.1', () => {
      serverPort = httpServer.address().port;
      if (onStatusChange) onStatusChange({ running: true, port: serverPort });
      resolve({ port: serverPort });
    });
    httpServer.on('error', (err) => {
      mcpServer = null;
      httpServer = null;
      transport = null;
      reject(err);
    });
  });
}

/**
 * Stop the MCP server.
 */
async function stopServer() {
  if (!mcpServer) return;

  try {
    await mcpServer.close();
  } catch { /* ignore */ }

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  mcpServer = null;
  httpServer = null;
  transport = null;
  serverPort = null;
  authToken = null;

  if (onStatusChange) onStatusChange({ running: false, port: null });
}

/**
 * Get current server status.
 */
function getStatus() {
  return {
    running: !!mcpServer,
    port: serverPort,
    hasAuth: !!authToken,
  };
}

/**
 * Resolve a pending approval request.
 */
function resolveApproval(id, approved) {
  const entry = pendingApprovals.get(id);
  if (entry) {
    pendingApprovals.delete(id);
    entry.resolve(approved);
    return true;
  }
  return false;
}

/**
 * Get pending approval requests.
 */
function getPendingApprovals() {
  const result = [];
  for (const [id, entry] of pendingApprovals) {
    result.push({ id, toolName: entry.toolName, args: entry.args });
  }
  return result;
}

module.exports = {
  startServer,
  stopServer,
  getStatus,
  resolveApproval,
  getPendingApprovals,
};
