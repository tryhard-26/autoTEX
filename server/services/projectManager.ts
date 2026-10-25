import * as path from 'node:path';
import * as fs from 'node:fs';
import { TEMPLATES, ProjectTemplate } from './templateService';
import { extractZip, detectMainFile } from './archive';

export interface ProjectMetadata {
  id: string;
  name: string;
  template: string;
  mainFile: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectItem extends ProjectMetadata {
  fileCount: number;
  rootPath: string;
}

export class ProjectManager {
  private baseStorageDir: string;
  private activeProjectId: string = '';

  constructor(appRootDir: string, storageDir = path.join(appRootDir, 'projects')) {
    this.baseStorageDir = storageDir;
    if (!fs.existsSync(this.baseStorageDir)) {
      fs.mkdirSync(this.baseStorageDir, { recursive: true });
    }
    this.ensureSeedProjects();
    this.loadActiveProject();
  }

  public getStorageDir(): string {
    return this.baseStorageDir;
  }

  /**
   * Seed default user projects if no projects exist.
   */
  public ensureSeedProjects(): void {
    const existing = this.listProjects();
    if (existing.length > 0) return;

    // Seed 1: Sample Research Paper
    this.createProject('Research Paper', 'article', 'sample-paper');
    // Seed 2: Sample Beamer Slide Deck
    this.createProject('Beamer Presentation', 'beamer', 'sample-beamer');
  }

  private loadActiveProject(): void {
    const stateFile = path.join(this.baseStorageDir, '.active');
    if (fs.existsSync(stateFile)) {
      const savedId = fs.readFileSync(stateFile, 'utf-8').trim();
      const projectDir = path.join(this.baseStorageDir, savedId);
      if (fs.existsSync(projectDir)) {
        this.activeProjectId = savedId;
        return;
      }
    }

    // Default to first project
    const projects = this.listProjects();
    if (projects.length > 0) {
      this.setActiveProject(projects[0].id);
    }
  }

  /**
   * List all user projects in storage.
   */
  public listProjects(): ProjectItem[] {
    if (!fs.existsSync(this.baseStorageDir)) return [];
    return fs
      .readdirSync(this.baseStorageDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({ ...this.readProject(e.name), updatedAt: lastModified(path.join(this.baseStorageDir, e.name)) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private readProject(id: string): ProjectItem {
    const projectDir = path.join(this.baseStorageDir, id);
    let meta: ProjectMetadata = { id, name: id, template: 'blank', mainFile: 'main.tex', createdAt: 0, updatedAt: 0 };
    try {
      meta = { ...meta, ...JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf-8')) };
    } catch {}
    let fileCount = 0;
    try {
      fileCount = fs.readdirSync(projectDir).filter((f) => !f.startsWith('.') && f !== 'project.json').length;
    } catch {}
    return { ...meta, fileCount, rootPath: projectDir };
  }

  /**
   * Get active project or fallback.
   */
  public getActiveProject(): ProjectItem {
    // Fast path: called on every request, so read only the active project.
    if (this.activeProjectId && fs.existsSync(path.join(this.baseStorageDir, this.activeProjectId))) {
      return this.readProject(this.activeProjectId);
    }
    const projects = this.listProjects();
    const active = projects.find(p => p.id === this.activeProjectId);
    if (active) return active;

    if (projects.length > 0) {
      this.activeProjectId = projects[0].id;
      return projects[0];
    }

    // If none exist, create one
    return this.createProject('My LaTeX Project', 'article', 'default-project');
  }

  /**
   * Set active project by ID.
   */
  public setActiveProject(id: string): boolean {
    const projectDir = resolveInProject(this.baseStorageDir, id);
    if (!projectDir || projectDir === this.baseStorageDir || !fs.existsSync(projectDir)) return false;

    this.activeProjectId = id;
    const stateFile = path.join(this.baseStorageDir, '.active');
    fs.writeFileSync(stateFile, id, 'utf-8');
    return true;
  }

  /**
   * Create a new project from a template.
   */
  public createProject(name: string, templateId: string = 'article', customId?: string): ProjectItem {
    const slug = (customId || name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'project') +
      (customId ? '' : `-${Date.now().toString(36)}`);

    const projectDir = path.join(this.baseStorageDir, slug);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

    // Write template files
    for (const [filename, content] of Object.entries(template.files)) {
      const targetFile = path.join(projectDir, filename);
      const parentDir = path.dirname(targetFile);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetFile, content, 'utf-8');
    }

    const meta: ProjectMetadata = {
      id: slug,
      name,
      template: templateId,
      mainFile: template.mainFile || 'main.tex',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');
    this.setActiveProject(slug);

    return {
      ...meta,
      fileCount: Object.keys(template.files).length,
      rootPath: projectDir,
    };
  }

  /** Absolute directory of a project id, or null if unknown/unsafe. */
  public getProjectDir(id: string): string | null {
    const dir = resolveInProject(this.baseStorageDir, id);
    return dir && dir !== this.baseStorageDir && fs.existsSync(dir) ? dir : null;
  }

  /** Create a project from a zip archive and make it active. */
  public importProject(name: string, zip: Uint8Array): ProjectItem {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'project'}-${Date.now().toString(36)}`;
    const projectDir = path.join(this.baseStorageDir, slug);
    fs.mkdirSync(projectDir, { recursive: true });
    let files: string[];
    try {
      files = extractZip(zip, projectDir);
    } catch (e) {
      fs.rmSync(projectDir, { recursive: true, force: true });
      throw e;
    }
    const meta: ProjectMetadata = {
      id: slug,
      name,
      template: 'imported',
      mainFile: detectMainFile(projectDir, files),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');
    this.setActiveProject(slug);
    return this.readProject(slug);
  }

  /**
   * Delete a project.
   */
  public deleteProject(id: string): boolean {
    const projectDir = resolveInProject(this.baseStorageDir, id);
    if (!projectDir || projectDir === this.baseStorageDir || !fs.existsSync(projectDir)) return false;

    fs.rmSync(projectDir, { recursive: true, force: true });

    if (this.activeProjectId === id) {
      const remaining = this.listProjects();
      if (remaining.length > 0) {
        this.setActiveProject(remaining[0].id);
      } else {
        this.createProject('My LaTeX Project', 'article', 'default-project');
      }
    }

    return true;
  }
}

/** Latest file modification time in a folder (recursive), so the project list reflects real activity. */
function lastModified(dir: string): number {
  let latest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? lastModified(full) : fs.statSync(full).mtimeMs);
  }
  return latest;
}

/** Resolve a project-relative path, or null if it escapes the project root. */
export function resolveInProject(root: string, relPath: string): string | null {
  const full = path.resolve(root, relPath);
  const rel = path.relative(root, full);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)) ? full : null;
}
