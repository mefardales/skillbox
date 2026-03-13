/**
 * Skillbox MCP Client Manager
 *
 * Connects to external MCP servers so Skillbox agents can call
 * external tools during execution (e.g., databases, APIs, custom tools).
 *
 * Each connection is tracked by a unique ID and stores discovered tools.
 */

const { Client } = require('@modelcontextprotocol/sdk/client');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// Active connections: id -> { client, transport, config, tools, status }
const connections = new Map();

let onConnectionChange = null;

/**
 * Connect to an external MCP server via HTTP/SSE.
 *
 * @param {object} config
 * @param {string} config.name - Display name for this connection
 * @param {string} config.url - Server URL (e.g., http://localhost:3001/mcp)
 * @param {string|null} config.authToken - Bearer token for auth
 * @returns {{ id, name, tools, status }}
 */
async function connectHttp(config) {
  const id = crypto.randomUUID();

  try {
    const headers = {};
    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    const transport = new StreamableHTTPClientTransport(
      new URL(config.url),
      { requestInit: { headers } }
    );

    const client = new Client(
      { name: 'skillbox-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    // Discover available tools
    let tools = [];
    try {
      const result = await client.listTools();
      tools = (result.tools || []).map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
      }));
    } catch { /* server may not expose tools */ }

    const entry = {
      client,
      transport,
      config: { name: config.name, url: config.url, type: 'http' },
      tools,
      status: 'connected',
      connectedAt: new Date().toISOString(),
    };

    connections.set(id, entry);
    if (onConnectionChange) onConnectionChange();

    return {
      id,
      name: config.name,
      url: config.url,
      type: 'http',
      tools,
      status: 'connected',
    };
  } catch (e) {
    throw new Error(`Failed to connect to ${config.url}: ${e.message}`);
  }
}

/**
 * Connect to an external MCP server via stdio (spawns a child process).
 *
 * @param {object} config
 * @param {string} config.name - Display name
 * @param {string} config.command - Command to run (e.g., "npx", "python")
 * @param {string[]} config.args - Arguments (e.g., ["-m", "my_mcp_server"])
 * @param {object} config.env - Extra environment variables
 * @returns {{ id, name, tools, status }}
 */
async function connectStdio(config) {
  const id = crypto.randomUUID();

  try {
    // We need StdioClientTransport for stdio connections
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...(config.env || {}) },
    });

    const client = new Client(
      { name: 'skillbox-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    let tools = [];
    try {
      const result = await client.listTools();
      tools = (result.tools || []).map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
      }));
    } catch { /* ignore */ }

    const entry = {
      client,
      transport,
      config: { name: config.name, command: config.command, args: config.args, type: 'stdio' },
      tools,
      status: 'connected',
      connectedAt: new Date().toISOString(),
    };

    connections.set(id, entry);
    if (onConnectionChange) onConnectionChange();

    return {
      id,
      name: config.name,
      type: 'stdio',
      command: config.command,
      tools,
      status: 'connected',
    };
  } catch (e) {
    throw new Error(`Failed to start ${config.command}: ${e.message}`);
  }
}

/**
 * Disconnect from an external MCP server.
 */
async function disconnect(id) {
  const entry = connections.get(id);
  if (!entry) return false;

  try {
    await entry.client.close();
  } catch { /* ignore */ }

  connections.delete(id);
  if (onConnectionChange) onConnectionChange();
  return true;
}

/**
 * Disconnect all connections.
 */
async function disconnectAll() {
  const ids = [...connections.keys()];
  for (const id of ids) {
    await disconnect(id);
  }
}

/**
 * Call a tool on a connected external MCP server.
 *
 * @param {string} connectionId - Connection ID
 * @param {string} toolName - Tool name to call
 * @param {object} args - Tool arguments
 * @returns {object} - Tool result
 */
async function callTool(connectionId, toolName, args = {}) {
  const entry = connections.get(connectionId);
  if (!entry) throw new Error(`Connection ${connectionId} not found`);
  if (entry.status !== 'connected') throw new Error(`Connection ${connectionId} is not connected`);

  const result = await entry.client.callTool({ name: toolName, arguments: args });
  return result;
}

/**
 * Refresh the tool list for a connected server.
 */
async function refreshTools(connectionId) {
  const entry = connections.get(connectionId);
  if (!entry) throw new Error(`Connection ${connectionId} not found`);

  const result = await entry.client.listTools();
  entry.tools = (result.tools || []).map(t => ({
    name: t.name,
    description: t.description || '',
    inputSchema: t.inputSchema || {},
  }));

  if (onConnectionChange) onConnectionChange();
  return entry.tools;
}

/**
 * Get all connections with their status and tools.
 */
function listConnections() {
  const result = [];
  for (const [id, entry] of connections) {
    result.push({
      id,
      name: entry.config.name,
      type: entry.config.type,
      url: entry.config.url || null,
      command: entry.config.command || null,
      status: entry.status,
      tools: entry.tools,
      connectedAt: entry.connectedAt,
    });
  }
  return result;
}

/**
 * Get all available tools across all connected servers.
 * Returns tools prefixed with connection name for disambiguation.
 */
function getAllTools() {
  const allTools = [];
  for (const [id, entry] of connections) {
    if (entry.status !== 'connected') continue;
    for (const tool of entry.tools) {
      allTools.push({
        connectionId: id,
        connectionName: entry.config.name,
        ...tool,
      });
    }
  }
  return allTools;
}

/**
 * Set callback for connection state changes.
 */
function setOnConnectionChange(cb) {
  onConnectionChange = cb;
}

module.exports = {
  connectHttp,
  connectStdio,
  disconnect,
  disconnectAll,
  callTool,
  refreshTools,
  listConnections,
  getAllTools,
  setOnConnectionChange,
};
