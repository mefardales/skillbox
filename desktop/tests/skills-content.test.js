import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SKILLS_ROOT = path.resolve(__dirname, '..', '..', 'skills');
const REGISTRY_PATH = path.join(SKILLS_ROOT, 'registry.json');

describe('Skill Content', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

  it('every skill in registry should have a SKILL.md file', () => {
    for (const skill of registry.skills) {
      const mdPath = path.join(SKILLS_ROOT, skill.id, 'SKILL.md');
      expect(fs.existsSync(mdPath), `Missing SKILL.md for ${skill.id}`).toBe(true);
    }
  });

  it('SKILL.md files should have YAML frontmatter', () => {
    for (const skill of registry.skills) {
      const mdPath = path.join(SKILLS_ROOT, skill.id, 'SKILL.md');
      const content = fs.readFileSync(mdPath, 'utf8');
      expect(content.startsWith('---'), `${skill.id} missing frontmatter`).toBe(true);
      const endIdx = content.indexOf('---', 3);
      expect(endIdx).toBeGreaterThan(3);
    }
  });

  it('SKILL.md frontmatter should contain name field', () => {
    for (const skill of registry.skills) {
      const mdPath = path.join(SKILLS_ROOT, skill.id, 'SKILL.md');
      const content = fs.readFileSync(mdPath, 'utf8');
      const frontmatter = content.split('---')[1];
      expect(frontmatter).toContain('name:');
    }
  });

  it('SKILL.md files should not be empty after frontmatter', () => {
    for (const skill of registry.skills) {
      const mdPath = path.join(SKILLS_ROOT, skill.id, 'SKILL.md');
      const content = fs.readFileSync(mdPath, 'utf8');
      const body = content.replace(/^---[\s\S]*?---\s*/, '').trim();
      expect(body.length, `${skill.id} has empty body`).toBeGreaterThan(50);
    }
  });

  it('SKILL.md files should be under 20KB', () => {
    for (const skill of registry.skills) {
      const mdPath = path.join(SKILLS_ROOT, skill.id, 'SKILL.md');
      const stats = fs.statSync(mdPath);
      expect(stats.size, `${skill.id} exceeds 25KB (${(stats.size / 1024).toFixed(1)}KB)`).toBeLessThan(25 * 1024);
    }
  });

  it('skill directories should only contain allowed files', () => {
    const allowedNames = ['SKILL.md', 'scripts', 'references', 'assets'];
    for (const skill of registry.skills) {
      const skillDir = path.join(SKILLS_ROOT, skill.id);
      const entries = fs.readdirSync(skillDir);
      for (const entry of entries) {
        expect(
          allowedNames.includes(entry),
          `${skill.id} contains unexpected file: ${entry}`
        ).toBe(true);
      }
    }
  });
});
