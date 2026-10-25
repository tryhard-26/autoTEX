import { ProjectSummary } from '../types/project';

class ProjectService {
  public async getProjects(): Promise<{ projects: ProjectSummary[]; activeId: string }> {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  }

  public async getActiveProject(): Promise<ProjectSummary> {
    const res = await fetch('/api/projects/active');
    if (!res.ok) throw new Error('Failed to fetch active project');
    const data = await res.json();
    return data.project;
  }

  public async selectProject(projectId: string): Promise<ProjectSummary> {
    const res = await fetch('/api/projects/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) throw new Error('Failed to switch project');
    const data = await res.json();
    return data.project;
  }

  public async createProject(name: string, template: string): Promise<ProjectSummary> {
    const res = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, template }),
    });
    if (!res.ok) throw new Error('Failed to create project');
    const data = await res.json();
    return data.project;
  }

  public async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
  }

  public async importZip(file: File, name?: string): Promise<ProjectSummary> {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    const res = await fetch('/api/projects/import', { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Import failed: ${await res.text()}`);
    return (await res.json()).project;
  }

  public downloadUrl(projectId: string): string {
    return `/api/projects/download?id=${encodeURIComponent(projectId)}`;
  }
}

export const projectService = new ProjectService();
