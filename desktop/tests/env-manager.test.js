import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Environment Manager', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbox-env-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── .env Parser ─────────────────────────────────────────
  function parseEnv(raw) {
    const vars = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars.push({ key: trimmed.slice(0, eq), value: trimmed.slice(eq + 1) });
    }
    return vars;
  }

  function serializeEnv(vars) {
    return vars.filter(v => v.key.trim()).map(v => `${v.key}=${v.value}`).join('\n') + '\n';
  }

  it('should parse a simple .env file', () => {
    const raw = 'DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=mydb';
    const vars = parseEnv(raw);
    expect(vars).toEqual([
      { key: 'DB_HOST', value: 'localhost' },
      { key: 'DB_PORT', value: '5432' },
      { key: 'DB_NAME', value: 'mydb' },
    ]);
  });

  it('should skip comments and empty lines', () => {
    const raw = '# comment\n\nDB_HOST=localhost\n# another\nDB_PORT=5432\n';
    const vars = parseEnv(raw);
    expect(vars.length).toBe(2);
    expect(vars[0].key).toBe('DB_HOST');
  });

  it('should handle values with = sign', () => {
    const raw = 'URL=https://example.com?foo=bar&baz=qux';
    const vars = parseEnv(raw);
    expect(vars[0].key).toBe('URL');
    expect(vars[0].value).toBe('https://example.com?foo=bar&baz=qux');
  });

  it('should handle empty values', () => {
    const raw = 'EMPTY=\nANOTHER=value';
    const vars = parseEnv(raw);
    expect(vars[0].value).toBe('');
    expect(vars[1].value).toBe('value');
  });

  it('should handle lines without = sign', () => {
    const raw = 'VALID=value\nINVALIDLINE\nANOTHER=ok';
    const vars = parseEnv(raw);
    expect(vars.length).toBe(2);
  });

  it('should serialize env vars correctly', () => {
    const vars = [
      { key: 'DB_HOST', value: 'localhost' },
      { key: 'DB_PORT', value: '5432' },
      { key: '', value: 'empty_key' }, // should be filtered
    ];
    const output = serializeEnv(vars);
    expect(output).toBe('DB_HOST=localhost\nDB_PORT=5432\n');
  });

  it('should roundtrip parse -> serialize', () => {
    const original = 'DB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=abc123\n';
    const vars = parseEnv(original);
    const serialized = serializeEnv(vars);
    expect(serialized).toBe(original);
  });

  it('should write and read .env file', () => {
    const envPath = path.join(tmpDir, '.env');
    const vars = [
      { key: 'HOST', value: '0.0.0.0' },
      { key: 'PORT', value: '3000' },
    ];
    fs.writeFileSync(envPath, serializeEnv(vars));

    const raw = fs.readFileSync(envPath, 'utf8');
    const parsed = parseEnv(raw);
    expect(parsed).toEqual(vars);
  });

  it('should handle missing .env file gracefully', () => {
    const envPath = path.join(tmpDir, '.env');
    expect(fs.existsSync(envPath)).toBe(false);
    // Simulate what main.js does
    let vars = [];
    try {
      vars = parseEnv(fs.readFileSync(envPath, 'utf8'));
    } catch {
      vars = [];
    }
    expect(vars).toEqual([]);
  });

  it('should handle special characters in values', () => {
    const raw = 'SECRET=p@$$w0rd!#%^&*\nPATH=/usr/local/bin:/usr/bin';
    const vars = parseEnv(raw);
    expect(vars[0].value).toBe('p@$$w0rd!#%^&*');
    expect(vars[1].value).toBe('/usr/local/bin:/usr/bin');
  });
});
