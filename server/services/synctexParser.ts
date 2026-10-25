import * as zlib from 'node:zlib';
import * as fs from 'node:fs';

// Coordinates are TeX scaled points; 65536 sp = 1 TeX pt, 72.27 TeX pt = 72 PDF bp.
const SP_TO_BP = 72 / 72.27 / 65536;

export interface SyncRecord {
  file: string; // as written in the synctex Input: line (usually absolute)
  line: number;
  page: number;
  x: number; // PDF points from page left
  y: number; // PDF points from page top (baseline)
  box: boolean; // `[`/`(` box records: span many lines, so reverse sync skips them
}

export class SyncTexService {
  private records: SyncRecord[] = [];
  private loaded = { path: '', mtimeMs: 0 };

  /** Load `<stem>.synctex.gz` (or plain .synctex); reparses only when the file changed. */
  public loadFromFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const { mtimeMs } = fs.statSync(filePath);
      if (this.loaded.path === filePath && this.loaded.mtimeMs === mtimeMs) return this.records.length > 0;
      this.loaded = { path: filePath, mtimeMs };
      const raw = fs.readFileSync(filePath);
      this.load(filePath.endsWith('.gz') ? zlib.gunzipSync(raw).toString('utf-8') : raw.toString('utf-8'));
      return this.records.length > 0;
    } catch (e) {
      console.warn('Could not parse synctex file:', e);
      this.records = [];
      this.loaded = { path: '', mtimeMs: 0 };
      return false;
    }
  }

  public load(content: string) {
    const files = new Map<number, string>();
    this.records = [];
    let page = 0;

    for (const line of content.split(/\r?\n/)) {
      const input = line.match(/^Input:(\d+):(.+)$/);
      if (input) {
        files.set(Number(input[1]), input[2]!);
        continue;
      }
      const pageMatch = line.match(/^\{(\d+)/);
      if (pageMatch) {
        page = Number(pageMatch[1]);
        continue;
      }
      // Boxes and nodes: `[tag,line:x,y:...`, `(tag,line:x,y:...`, `x`, `k`, `g`, `$`, `h`, `v`
      const rec = line.match(/^[[(xkg$hv](\d+),(\d+):(-?\d+),(-?\d+)/);
      if (rec && page > 0) {
        const file = files.get(Number(rec[1]));
        if (!file) continue;
        this.records.push({
          file,
          line: Number(rec[2]),
          page,
          x: Number(rec[3]) * SP_TO_BP,
          y: Number(rec[4]) * SP_TO_BP,
          box: line[0] === '[' || line[0] === '(',
        });
      }
    }
  }

  /** Source line -> PDF location. `file` may be relative; matched by path suffix. */
  public forward(file: string, line: number): { page: number; x: number; y: number } | null {
    const norm = file.replace(/^\.?\//, '');
    let best: SyncRecord | null = null;
    for (const rec of this.records) {
      if (!(rec.file === norm || rec.file.endsWith('/' + norm))) continue;
      if (!best || Math.abs(rec.line - line) < Math.abs(best.line - line)) best = rec;
    }
    return best && { page: best.page, x: best.x, y: best.y };
  }

  /** PDF click (points from top-left) -> source file + line. */
  public reverse(page: number, x: number, y: number): { file: string; line: number } | null {
    let best: SyncRecord | null = null;
    let bestDist = Infinity;
    for (const rec of this.records) {
      if (rec.page !== page || rec.box) continue;
      // Weight vertical distance heavily: lines matter more than horizontal position.
      const dist = Math.abs(rec.y - y) * 4 + Math.abs(rec.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = rec;
      }
    }
    return best && { file: best.file, line: best.line };
  }
}
