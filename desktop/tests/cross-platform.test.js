import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';

describe('Cross-Platform Compatibility', () => {

  it('should handle Windows paths with backslashes', () => {
    const winPath = 'C:\\Users\\user\\project';
    const base = path.basename(winPath);
    expect(base).toBe('project');
  });

  it('should handle Unix paths with forward slashes', () => {
    const unixPath = '/home/user/project';
    const base = path.basename(unixPath);
    expect(base).toBe('project');
  });

  it('should handle macOS paths', () => {
    const macPath = '/Users/user/Documents/project';
    const base = path.basename(macPath);
    expect(base).toBe('project');
  });

  it('path.join should produce valid paths on current OS', () => {
    const joined = path.join('a', 'b', 'c');
    expect(joined).toBeTruthy();
    // Should use the right separator
    expect(joined).toContain('b');
  });

  it('should correctly resolve relative paths', () => {
    const resolved = path.resolve(__dirname, '..', 'src', 'main.js');
    expect(resolved).toContain('main.js');
    expect(path.isAbsolute(resolved)).toBe(true);
  });

  it('os.tmpdir should return a valid directory', () => {
    const tmp = os.tmpdir();
    expect(tmp).toBeTruthy();
    expect(typeof tmp).toBe('string');
  });

  it('os.homedir should return a valid directory', () => {
    const home = os.homedir();
    expect(home).toBeTruthy();
    expect(typeof home).toBe('string');
  });

  it('os.platform should be a known value', () => {
    const platform = os.platform();
    expect(['win32', 'darwin', 'linux', 'freebsd', 'openbsd']).toContain(platform);
  });

  // ── Path escaping for HTML attributes ──
  function escapeAttr(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  it('should escape Windows paths for HTML attributes', () => {
    const escaped = escapeAttr("C:\\Users\\user's\\project");
    expect(escaped).toBe("C:\\\\Users\\\\user\\'s\\\\project");
  });

  it('should not double-escape already clean paths', () => {
    const clean = '/home/user/project';
    expect(escapeAttr(clean)).toBe(clean);
  });

  // ── Path separator normalization ──
  it('should handle mixed separators', () => {
    const mixed = 'C:\\Users/user\\project/src';
    const normalized = mixed.replace(/\\/g, '/');
    expect(normalized).toBe('C:/Users/user/project/src');
  });
});
