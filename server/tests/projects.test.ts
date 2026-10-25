import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectManager } from '../services/projectManager';

const TEST_ROOT = path.join(process.cwd(), '.test_projects_workspace');

describe('ProjectManager Service', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  });

  it('initializes and seeds default projects', () => {
    const pm = new ProjectManager(TEST_ROOT);
    const projects = pm.listProjects();

    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects.some(p => p.id.includes('sample-paper'))).toBe(true);
    expect(projects.some(p => p.id.includes('sample-beamer'))).toBe(true);
  });

  it('creates a new blank project and selects it', () => {
    const pm = new ProjectManager(TEST_ROOT);
    const proj = pm.createProject('My Dissertation', 'blank', 'dissertation');

    expect(proj.id).toBe('dissertation');
    expect(proj.name).toBe('My Dissertation');
    expect(proj.template).toBe('blank');

    const active = pm.getActiveProject();
    expect(active.id).toBe('dissertation');

    const mainTexPath = path.join(proj.rootPath, 'main.tex');
    expect(fs.existsSync(mainTexPath)).toBe(true);
    const content = fs.readFileSync(mainTexPath, 'utf-8');
    expect(content).toContain('\\documentclass');
  });

  it('switches between projects cleanly', () => {
    const pm = new ProjectManager(TEST_ROOT);
    const p1 = pm.createProject('Project A', 'article', 'proj-a');
    const p2 = pm.createProject('Project B', 'beamer', 'proj-b');

    expect(pm.getActiveProject().id).toBe('proj-b');

    pm.setActiveProject('proj-a');
    expect(pm.getActiveProject().id).toBe('proj-a');
  });

  it('deletes a project and falls back gracefully', () => {
    const pm = new ProjectManager(TEST_ROOT);
    const p = pm.createProject('Disposable', 'blank', 'disposable');
    expect(pm.getActiveProject().id).toBe('disposable');

    pm.deleteProject('disposable');
    expect(pm.listProjects().some(pr => pr.id === 'disposable')).toBe(false);
    expect(pm.getActiveProject().id).not.toBe('disposable');
  });
});
