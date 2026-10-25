/** Shared helpers for file uploads and drag-and-drop. */

export interface UploadItem {
  file: File;
  path: string; // relative path, preserves dropped folder structure
}

export const INTERNAL_DRAG_TYPE = 'application/x-autotex-path';

/** Collect files from a drop, walking into dropped folders. */
export async function filesFromDrop(dt: DataTransfer): Promise<UploadItem[]> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return [...dt.files].map((file) => ({ file, path: file.name }));

  const out: UploadItem[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      if (file.name !== '.DS_Store') out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns batches; keep reading until empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const entry of entries) await walk(entry, '');
  return out;
}

/** Files from an <input type="file">; folder inputs carry webkitRelativePath. */
export function filesFromInput(list: FileList | null): UploadItem[] {
  return [...(list ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}

const IMAGE = /\.(png|jpe?g|gif|svg|webp|pdf|eps)$/i;

/** LaTeX snippet that references a project file, relative to the main file's folder. */
export function latexSnippetFor(filePath: string, mainFile: string): string | null {
  const mainDir = mainFile.includes('/') ? mainFile.slice(0, mainFile.lastIndexOf('/') + 1) : '';
  const rel = mainDir && filePath.startsWith(mainDir) ? filePath.slice(mainDir.length) : filePath;
  const stem = rel.replace(/\.[^./]+$/, '');
  if (IMAGE.test(filePath)) {
    const label = stem.split('/').pop()!.replace(/[^\w-]+/g, '-');
    return `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${rel}}\n  \\caption{}\n  \\label{fig:${label}}\n\\end{figure}\n`;
  }
  if (/\.tex$/i.test(filePath)) return `\\input{${stem}}\n`;
  if (/\.bib$/i.test(filePath)) return `\\bibliography{${stem}}\n`;
  return null;
}

export const isFigureFile = (p: string) => IMAGE.test(p);
