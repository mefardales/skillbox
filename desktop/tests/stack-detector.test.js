import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Stack Detector', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbox-stack-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Minimal stack detector matching main.js logic
  function detectStack(projectPath) {
    const detected = [];
    const rules = [
      { name: 'React', deps: ['react'], skillIds: ['frontend/react-components', 'frontend/react-patterns'] },
      { name: 'Next.js', files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], skillIds: ['frontend/nextjs-app-router'] },
      { name: 'Tailwind CSS', files: ['tailwind.config.js', 'tailwind.config.ts'], skillIds: ['frontend/tailwind-css'] },
      { name: 'Express', deps: ['express'], skillIds: ['backend/node-express-api'] },
      { name: 'Django', files: ['manage.py'], skillIds: ['backend/django'] },
      { name: 'Docker', files: ['Dockerfile', 'docker-compose.yml'], skillIds: ['devops/docker-compose'] },
      { name: 'GitHub Actions', files: ['.github/workflows'], skillIds: ['devops/github-actions'] },
      { name: 'Terraform', exts: ['.tf'], skillIds: ['devops/terraform'] },
    ];

    let npmDeps = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
      npmDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
    } catch { /* skip */ }

    let exts = new Set();
    try {
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile()) exts.add(path.extname(e.name).toLowerCase());
      }
    } catch { /* skip */ }

    for (const rule of rules) {
      let matched = false;

      if (rule.files) {
        for (const f of rule.files) {
          if (fs.existsSync(path.join(projectPath, f))) { matched = true; break; }
        }
      }

      if (!matched && rule.deps) {
        for (const d of rule.deps) {
          if (npmDeps.includes(d)) { matched = true; break; }
        }
      }

      if (!matched && rule.exts) {
        for (const e of rule.exts) {
          if (exts.has(e)) { matched = true; break; }
        }
      }

      if (matched) detected.push({ name: rule.name, skillIds: rule.skillIds });
    }

    return detected;
  }

  it('should detect React from package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    }));
    const detected = detectStack(tmpDir);
    const names = detected.map(d => d.name);
    expect(names).toContain('React');
  });

  it('should detect Express from package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.0' },
    }));
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Express');
  });

  it('should detect Next.js from config file', () => {
    fs.writeFileSync(path.join(tmpDir, 'next.config.js'), 'module.exports = {}');
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Next.js');
  });

  it('should detect Tailwind from config file', () => {
    fs.writeFileSync(path.join(tmpDir, 'tailwind.config.js'), 'module.exports = {}');
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Tailwind CSS');
  });

  it('should detect Django from manage.py', () => {
    fs.writeFileSync(path.join(tmpDir, 'manage.py'), '#!/usr/bin/env python');
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Django');
  });

  it('should detect Docker from Dockerfile', () => {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:18');
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Docker');
  });

  it('should detect GitHub Actions from .github/workflows', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('GitHub Actions');
  });

  it('should detect Terraform from .tf files', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.tf'), 'resource "aws_instance" "example" {}');
    const detected = detectStack(tmpDir);
    expect(detected.map(d => d.name)).toContain('Terraform');
  });

  it('should detect multiple technologies', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', express: '^4.18.0' },
    }));
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:18');
    const detected = detectStack(tmpDir);
    expect(detected.length).toBeGreaterThanOrEqual(3);
    const names = detected.map(d => d.name);
    expect(names).toContain('React');
    expect(names).toContain('Express');
    expect(names).toContain('Docker');
  });

  it('should return empty for a bare directory', () => {
    const detected = detectStack(tmpDir);
    expect(detected).toEqual([]);
  });

  it('should return skill IDs for each detection', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' },
    }));
    const detected = detectStack(tmpDir);
    const react = detected.find(d => d.name === 'React');
    expect(react.skillIds).toContain('frontend/react-components');
    expect(react.skillIds).toContain('frontend/react-patterns');
  });

  it('should not crash on malformed package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), 'not json');
    expect(() => detectStack(tmpDir)).not.toThrow();
    const detected = detectStack(tmpDir);
    expect(Array.isArray(detected)).toBe(true);
  });

  it('should not crash on unreadable directory', () => {
    expect(() => detectStack('/nonexistent/path')).not.toThrow();
  });
});
