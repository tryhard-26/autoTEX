import { AgentSkillInfo } from '../types/agent';

export interface ProjectTemplateItem {
  id: string;
  name: string;
  description: string;
  mainFile: string;
}

export class SkillsService {
  private baseUrl = '';

  public async getSkills(): Promise<AgentSkillInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/agent/skills`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.skills ?? [];
    } catch {
      return [];
    }
  }

  public async getTemplates(): Promise<ProjectTemplateItem[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/templates`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.templates ?? [];
    } catch {
      return [];
    }
  }

  public async applyTemplate(templateId: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/templates/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    });
    if (!res.ok) throw new Error('Failed to apply template');
    const data = await res.json();
    return data.mainFile || 'main.tex';
  }
}

export const skillsService = new SkillsService();
