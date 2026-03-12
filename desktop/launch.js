#!/usr/bin/env node
// Launcher: finds the Electron binary and spawns it with the correct
// environment.  The key fix is removing ELECTRON_RUN_AS_NODE which
// VSCode (and other Electron hosts) set in their terminals — it causes
// the Electron binary to run as plain Node.js, skipping all Electron
// initialization.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Find electron binary ─────────────────────────────────────
function findElectron() {
  const locations = [
    path.join(__dirname, 'node_modules', 'electron'),
    path.join(__dirname, '..', 'node_modules', 'electron'),
  ];
  for (const dir of locations) {
    const pathFile = path.join(dir, 'path.txt');
    if (fs.existsSync(pathFile)) {
      const name = fs.readFileSync(pathFile, 'utf8').trim();
      const bin = path.join(dir, 'dist', name);
      if (fs.existsSync(bin)) return bin;
    }
  }
  throw new Error('Electron binary not found. Run: npm install');
}

const electronBin = findElectron();

// ── Build clean environment ──────────────────────────────────
// Remove env vars that force Electron into Node-only mode.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

// ── Launch ────────────────────────────────────────────────────
const args = ['.'];
if (process.argv.includes('--dev')) args.push('--dev');

const child = spawn(electronBin, args, {
  cwd: __dirname,
  stdio: 'inherit',
  env,
  windowsHide: false,
});

child.on('close', (code) => { process.exit(code || 0); });
child.on('error', (err) => { console.error(err); process.exit(1); });
['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, () => { if (!child.killed) child.kill(sig); });
});
