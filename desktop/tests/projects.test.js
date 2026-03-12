import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Projects Manager', () => {
  let tmpDir;
  let projectsFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbox-proj-test-'));
    projectsFile = path.join(tmpDir, 'projects.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Simulated project operations (matching main.js logic)
  function loadProjects() {
    try {
      return JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
    } catch {
      return [];
    }
  }

  function saveProjects(projects) {
    fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
  }

  function addProject(dirPath) {
    const projects = loadProjects();
    if (projects.find(p => p.path === dirPath)) return projects;
    projects.push({ name: path.basename(dirPath), path: dirPath, skills: [] });
    saveProjects(projects);
    return loadProjects();
  }

  function removeProject(dirPath) {
    let projects = loadProjects();
    projects = projects.filter(p => p.path !== dirPath);
    saveProjects(projects);
    return loadProjects();
  }

  function toggleProjectSkill(projectPath, skillId) {
    const projects = loadProjects();
    const project = projects.find(p => p.path === projectPath);
    if (!project) return projects;
    const idx = project.skills.indexOf(skillId);
    if (idx >= 0) {
      project.skills.splice(idx, 1);
    } else {
      project.skills.push(skillId);
    }
    saveProjects(projects);
    return loadProjects();
  }

  it('should start with empty projects list', () => {
    expect(loadProjects()).toEqual([]);
  });

  it('should add a project', () => {
    const projects = addProject('/home/user/myapp');
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe('myapp');
    expect(projects[0].path).toBe('/home/user/myapp');
    expect(projects[0].skills).toEqual([]);
  });

  it('should not add duplicate project', () => {
    addProject('/home/user/myapp');
    const projects = addProject('/home/user/myapp');
    expect(projects.length).toBe(1);
  });

  it('should add multiple different projects', () => {
    addProject('/home/user/project-a');
    addProject('/home/user/project-b');
    const projects = addProject('/home/user/project-c');
    expect(projects.length).toBe(3);
  });

  it('should remove a project', () => {
    addProject('/home/user/keep');
    addProject('/home/user/remove-me');
    const projects = removeProject('/home/user/remove-me');
    expect(projects.length).toBe(1);
    expect(projects[0].path).toBe('/home/user/keep');
  });

  it('should handle removing non-existent project', () => {
    addProject('/home/user/existing');
    const projects = removeProject('/home/user/nonexistent');
    expect(projects.length).toBe(1);
  });

  it('should toggle skill on a project (add)', () => {
    addProject('/home/user/myapp');
    const projects = toggleProjectSkill('/home/user/myapp', 'frontend/react-components');
    expect(projects[0].skills).toContain('frontend/react-components');
  });

  it('should toggle skill on a project (remove)', () => {
    addProject('/home/user/myapp');
    toggleProjectSkill('/home/user/myapp', 'frontend/react-components');
    const projects = toggleProjectSkill('/home/user/myapp', 'frontend/react-components');
    expect(projects[0].skills).not.toContain('frontend/react-components');
  });

  it('should handle toggling skill on non-existent project', () => {
    addProject('/home/user/myapp');
    const projects = toggleProjectSkill('/non/existent', 'frontend/react-components');
    expect(projects[0].skills).toEqual([]);
  });

  it('should persist between load calls', () => {
    addProject('/home/user/myapp');
    toggleProjectSkill('/home/user/myapp', 'backend/django');
    // Simulate fresh load
    const projects = loadProjects();
    expect(projects.length).toBe(1);
    expect(projects[0].skills).toContain('backend/django');
  });

  it('should handle Windows paths', () => {
    const projects = addProject('C:\\Users\\user\\Desktop\\myproject');
    expect(projects[0].name).toBe('myproject');
    expect(projects[0].path).toBe('C:\\Users\\user\\Desktop\\myproject');
  });

  it('should handle paths with spaces', () => {
    const projects = addProject('/home/user/My Projects/awesome app');
    expect(projects[0].name).toBe('awesome app');
  });
});
