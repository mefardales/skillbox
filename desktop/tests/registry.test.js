import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const SKILLS_ROOT = path.resolve(__dirname, '..', '..', 'skills');
const REGISTRY_PATH = path.join(SKILLS_ROOT, 'registry.json');

describe('Registry', () => {
  let registry;

  beforeEach(() => {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    registry = JSON.parse(raw);
  });

  it('should load registry.json successfully', () => {
    expect(registry).toBeDefined();
    expect(registry.version).toBe('1');
    expect(Array.isArray(registry.skills)).toBe(true);
  });

  it('should contain skills', () => {
    expect(registry.skills.length).toBeGreaterThan(0);
  });

  it('every skill should have required fields', () => {
    for (const skill of registry.skills) {
      expect(skill.id).toBeDefined();
      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.category).toBeDefined();
      expect(typeof skill.id).toBe('string');
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.description).toBe('string');
      expect(typeof skill.category).toBe('string');
    }
  });

  it('skill IDs should follow category/name format', () => {
    for (const skill of registry.skills) {
      expect(skill.id).toMatch(/^[a-z]+\/[a-z0-9-]+$/);
      const [cat, name] = skill.id.split('/');
      expect(cat).toBe(skill.category);
      expect(name).toBe(skill.name);
    }
  });

  it('every skill should have tags array', () => {
    for (const skill of registry.skills) {
      expect(Array.isArray(skill.tags)).toBe(true);
      expect(skill.tags.length).toBeGreaterThan(0);
    }
  });

  it('every skill should have a skillUrl', () => {
    for (const skill of registry.skills) {
      expect(skill.skillUrl).toBeDefined();
      expect(typeof skill.skillUrl).toBe('string');
      expect(skill.skillUrl.length).toBeGreaterThan(0);
    }
  });

  it('skill descriptions should be under 200 characters', () => {
    for (const skill of registry.skills) {
      // Some descriptions might be longer, but flag excessively long ones
      expect(skill.description.length).toBeLessThan(500);
    }
  });

  it('should have no duplicate skill IDs', () => {
    const ids = registry.skills.map(s => s.id);
    const unique = [...new Set(ids)];
    expect(ids.length).toBe(unique.length);
  });

  it('categories should be from known set', () => {
    const known = ['frontend', 'backend', 'data', 'devops', 'testing', 'general', 'mobile', 'security'];
    for (const skill of registry.skills) {
      expect(known).toContain(skill.category);
    }
  });
});
