import * as path from 'node:path';
import * as fs from 'node:fs';
import { zipSync, unzipSync, Zippable } from 'fflate';
import { resolveInProject } from './projectManager';

// Not worth shipping in archives: OS junk, app session data, LaTeX intermediates.
const SKIP = /^project\.json$|(^|\/)(\.DS_Store|__MACOSX|\.autotex|\.git|node_modules)(\/|$)|\.(aux|log|out|toc|nav|snm|vrb|fls|fdb_latexmk|blg|bcf|run\.xml|xdv|synctex\.gz)$/i;

/** Zip a directory (or a single file) into memory. Paths inside the zip are relative to `dir`. */
export function zipPath(target: string): Uint8Array {
  const files: Zippable = {};
  const add = (abs: string, rel: string) => {
    if (SKIP.test(rel)) return;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(abs)) add(path.join(abs, name), rel ? `${rel}/${name}` : name);
    } else if (stat.isFile()) {
      files[rel] = new Uint8Array(fs.readFileSync(abs));
    }
  };
  const stat = fs.statSync(target);
  if (stat.isDirectory()) add(target, '');
  else add(target, path.basename(target));
  return zipSync(files, { level: 6 });
}

/**
 * Extract a zip into `root/destRel`. Every entry path is validated against `root`, so a crafted
 * archive (`../../x`, absolute paths) cannot write outside it. A single top-level folder is stripped,
 * so "paper.zip" containing "paper/main.tex" lands as "main.tex". Returns the written relative paths.
 */
export function extractZip(data: Uint8Array, root: string, destRel = ''): string[] {
  const entries = Object.entries(unzipSync(data)).filter(([name]) => !name.endsWith('/') && !SKIP.test(name));
  const tops = new Set(entries.map(([name]) => name.split('/')[0]));
  const strip = tops.size === 1 && entries.every(([name]) => name.includes('/')) ? `${[...tops][0]}/` : '';

  const written: string[] = [];
  for (const [name, bytes] of entries) {
    const rel = path.posix.join(destRel, name.slice(strip.length));
    const full = resolveInProject(root, rel);
    if (!full || full === root) throw new Error(`Unsafe path in archive: ${name}`);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
    written.push(path.relative(root, full));
  }
  return written;
}

/** Best guess at a project's main file: main.tex, else the first .tex with \documentclass. */
export function detectMainFile(root: string, files: string[]): string {
  const tex = files.filter((f) => f.endsWith('.tex')).sort((a, b) => a.split('/').length - b.split('/').length);
  if (tex.includes('main.tex')) return 'main.tex';
  return tex.find((f) => /\\documentclass/.test(fs.readFileSync(path.join(root, f), 'utf-8'))) ?? tex[0] ?? 'main.tex';
}
