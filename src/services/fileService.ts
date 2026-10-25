import { FileNode } from '../types/project';

export class FileService {
  private baseUrl = '';

  public async getTree(): Promise<FileNode[]> {
    const res = await fetch(`${this.baseUrl}/api/files/tree`);
    if (!res.ok) throw new Error('Failed to fetch file tree');
    const data = await res.json();
    return data.tree ?? [];
  }

  public async readFile(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/files/read?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`Failed to read file: ${path}`);
    const data = await res.json();
    return data.content ?? '';
  }

  public async writeFile(path: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`Failed to save file: ${path}`);
  }

  public async createItem(path: string, type: 'file' | 'directory', content?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/files/${type === 'directory' ? 'mkdir' : 'create'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`Failed to create ${type}: ${path}`);
  }

  public async renameItem(oldPath: string, newPath: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!res.ok) throw new Error(`Failed to rename: ${oldPath}`);
  }

  public async deleteItem(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error(`Failed to delete: ${path}`);
  }

  /** Upload files into `dir`. Each item's `path` is relative to `dir` (keeps folder structure). */
  public async upload(dir: string, items: { file: File; path: string }[], extract = false): Promise<string[]> {
    const form = new FormData();
    for (const { file } of items) form.append('files', file);
    form.append('paths', JSON.stringify(items.map((i) => i.path)));
    const res = await fetch(`${this.baseUrl}/api/files/upload?dir=${encodeURIComponent(dir)}${extract ? '&extract=1' : ''}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    return (await res.json()).files ?? [];
  }

  /** URL that downloads a file, or a folder as .zip ('' = whole project). */
  public downloadUrl(path: string): string {
    return `${this.baseUrl}/api/files/download?path=${encodeURIComponent(path)}`;
  }
}

export const fileService = new FileService();
