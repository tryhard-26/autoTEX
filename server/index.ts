import * as path from 'node:path';
import * as fs from 'node:fs';
import { LatexCompiler } from './services/latexCompiler';
import { AgentRunner } from "./services/agentRunner";
import { listOpencodeModels } from "./services/opencodeRunner";
import { SyncTexService } from './services/synctexParser';
import { TEMPLATES } from './services/templateService';
import { ProjectManager, resolveInProject } from './services/projectManager';
import { zipPath, extractZip } from './services/archive';
import { FileNode, FileType } from '../src/types/project';
import { CompileRequest } from '../src/types/compiler';
import { AgentProjectContext } from '../src/types/agent';

const APP_ROOT = process.cwd();
const PORT = parseInt(process.env.PORT || '3001', 10);

// PROJECTS_DIR lets tests run against a throwaway folder instead of the user's projects.
const projectManager = new ProjectManager(APP_ROOT, process.env.PROJECTS_DIR || path.join(APP_ROOT, 'projects'));
const initialProject = projectManager.getActiveProject();

const compiler = new LatexCompiler(initialProject.rootPath);
const agentRunner = new AgentRunner(initialProject.rootPath, APP_ROOT);
const synctex = new SyncTexService();

function getActiveRoot(): string {
  return projectManager.getActiveProject().rootPath;
}

function syncServicesWithActiveProject() {
  const activeRoot = getActiveRoot();
  compiler.setProjectRoot(activeRoot);
  agentRunner.setProjectRoot(activeRoot);
}

function getFileType(fileName: string, isDirectory: boolean): FileType {
  if (isDirectory) return 'dir';
  const ext = path.extname(fileName).toLowerCase().slice(1);
  if (['tex', 'bib', 'sty', 'cls', 'bst'].includes(ext)) {
    return ext as FileType;
  }
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  return 'text';
}

// LaTeX intermediates: hidden from the explorer (the PDF stays visible).
const BUILD_ARTIFACT = /\.(synctex\.gz|aux|log|out|toc|nav|snm|vrb|fls|fdb_latexmk|bbl|blg|bcf|run\.xml|xdv|lof|lot|idx|ilg|ind)$/i;

function buildFileTree(dir: string, baseDir: string): FileNode[] {
  const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store', '.build', 'project.json']);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith('.') || BUILD_ARTIFACT.test(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    const isDir = entry.isDirectory();

    const node: FileNode = {
      name: entry.name,
      path: relPath,
      type: isDir ? 'directory' : 'file',
      fileType: getFileType(entry.name, isDir),
    };

    if (isDir) {
      node.children = buildFileTree(fullPath, baseDir);
    } else {
      try {
        const stat = fs.statSync(fullPath);
        node.size = stat.size;
      } catch {
        // ignore
      }
    }

    nodes.push(node);
  }

  // Sort: directories first, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

function logRequest(method: string, pathname: string, status: number, durationMs: number) {
  const time = new Date().toLocaleTimeString();
  let statusColor = '\x1b[32m'; // green
  if (status >= 300 && status < 400) statusColor = '\x1b[36m'; // cyan
  if (status >= 400 && status < 500) statusColor = '\x1b[33m'; // yellow
  if (status >= 500) statusColor = '\x1b[31m'; // red

  console.log(
    `\x1b[90m${time}\x1b[0m \x1b[1m\x1b[36m[API]\x1b[0m ${statusColor}${status}\x1b[0m \x1b[35m${method.padEnd(6)}\x1b[0m ${pathname} \x1b[90m(${durationMs.toFixed(1)}ms)\x1b[0m`
  );
}

// ==========================================
// Agent jobs: an agent run is decoupled from the HTTP connection that started it,
// so a dropped browser connection doesn't kill the agent. Only /api/agent/cancel stops it.
// ==========================================
// Agent log: what the agent is doing (requests, tools, opencode output), viewable in the UI.
// ponytail: in-memory ring buffer, lost on restart; .logs/server.log keeps the [AGENT LOG] lines.
const AGENT_LOG_MAX = 2000;
const agentLog: { seq: number; t: number; text: string }[] = [];
let agentLogSeq = 0;
function logAgent(text: string) {
  agentLog.push({ seq: agentLogSeq++, t: Date.now(), text });
  if (agentLog.length > AGENT_LOG_MAX) agentLog.shift();
  console.log(`\x1b[90m[AGENT LOG]\x1b[0m ${text}`);
}
agentRunner.on('log', logAgent);

type AgentEvent = { event: string; data: unknown };
interface AgentJob {
  events: AgentEvent[];
  done: boolean;
  listeners: Set<() => void>;
}
let agentJob: AgentJob | null = null;

function startAgentJob(run: () => Promise<unknown>) {
  const job: AgentJob = { events: [], done: false, listeners: new Set() };
  agentJob = job;
  const push = (event: string, data: unknown) => {
    job.events.push({ event, data });
    job.listeners.forEach((l) => l());
  };
  const forward: Record<string, (d: any) => void> = {
    token: (token) => push('token', { token }),
    thinking: (text) => push('thinking', { text }),
    tool_start: (tool) => push('tool_start', tool),
    tool_finish: (tool) => push('tool_finish', tool),
    edit_created: (edit) => {
      console.log(`\x1b[35m[AGENT EDIT]\x1b[0m ${edit.file}: +${edit.additions} -${edit.deletions}`);
      push('edit_created', edit);
    },
  };
  for (const [ev, fn] of Object.entries(forward)) agentRunner.on(ev, fn);

  run()
    .then((message: any) => {
      logAgent(`Done in ${((message.durationMs ?? 0) / 1000).toFixed(1)}s: ${message.toolCalls?.length || 0} tools, ${message.edits?.length || 0} edits, ${message.totalTokens ?? '?'} tokens`);
      push('complete', message);
    })
    .catch((err: Error) => {
      logAgent(`ERROR: ${err.message}`);
      push('error', { message: err.message });
    })
    .finally(() => {
      for (const [ev, fn] of Object.entries(forward)) agentRunner.off(ev, fn);
      job.done = true;
      job.listeners.forEach((l) => l());
    });
}

/** SSE stream of a job's events starting at index `from`; each event carries its index as `id`. */
function streamAgentJob(job: AgentJob, from: number, signal: AbortSignal, headers: Record<string, string>) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let next = from;
      let closed = false;
      const flush = () => {
        if (closed) return;
        try {
          while (next < job.events.length) {
            const { event, data } = job.events[next]!;
            controller.enqueue(encoder.encode(`id: ${next}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            next++;
          }
          if (job.done) {
            closed = true;
            cleanup();
            controller.close();
          }
        } catch {
          closed = true;
          cleanup();
        }
      };
      // Heartbeat keeps proxies from treating a long silent agent turn as idle.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          cleanup();
        }
      }, 4000);
      cleanup = () => {
        clearInterval(heartbeat);
        job.listeners.delete(flush);
      };
      job.listeners.add(flush);
      signal.addEventListener('abort', () => {
        closed = true;
        cleanup();
        if (!job.done) console.log(`\x1b[35m[AGENT]\x1b[0m Client disconnected; agent keeps running`);
      });
      controller.enqueue(encoder.encode(': connected\n\n')); // send headers + first byte immediately
      flush();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { ...headers, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}

function zipResponse(data: Uint8Array, filename: string, headers: Record<string, string>) {
  return new Response(data as BodyInit, {
    headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}

const server = Bun.serve({
  maxRequestBodySize: 200 * 1024 * 1024, // project zips with figures
  port: PORT,
  idleTimeout: 255, // Set max idle timeout to prevent SSE connection drop
  async fetch(req) {
    const startTime = performance.now();
    const url = new URL(req.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const respond = (res: Response) => {
      const duration = performance.now() - startTime;
      if (pathname.startsWith('/api') && pathname !== '/api/health') {
        logRequest(req.method, pathname, res.status, duration);
      }
      return res;
    };

    syncServicesWithActiveProject();
    const activeProject = projectManager.getActiveProject();
    const projectRoot = activeProject.rootPath;

    // Route Handler Execution
    try {
      // Health check
      if (pathname === '/api/health') {
        return respond(Response.json({
          status: 'ok',
          appRoot: APP_ROOT,
          projectRoot,
          activeProject: activeProject.name,
          agent: { available: agentRunner.isAvailable(), model: agentRunner.getModel() },
          time: Date.now(),
        }, { headers: corsHeaders }));
      }

      // ==========================================
      // Project Management APIs
      // ==========================================

      // List all user projects
      if (pathname === '/api/projects' && req.method === 'GET') {
        const projects = projectManager.listProjects();
        return respond(Response.json({
          projects,
          activeId: activeProject.id,
        }, { headers: corsHeaders }));
      }

      // Get currently active project
      if (pathname === '/api/projects/active' && req.method === 'GET') {
        return respond(Response.json({
          project: activeProject,
        }, { headers: corsHeaders }));
      }

      // Switch active project
      if (pathname === '/api/projects/select' && req.method === 'POST') {
        const body = await req.json();
        const { projectId } = body;
        if (!projectId) {
          return respond(new Response('Missing projectId', { status: 400, headers: corsHeaders }));
        }
        const success = projectManager.setActiveProject(projectId);
        if (!success) {
          return respond(new Response('Project not found', { status: 404, headers: corsHeaders }));
        }
        syncServicesWithActiveProject();
        const active = projectManager.getActiveProject();
        console.log(`\x1b[33m[PROJECT]\x1b[0m Switched to "${active.name}" (${active.rootPath})`);
        return respond(Response.json({
          success: true,
          project: active,
        }, { headers: corsHeaders }));
      }

      // Create new project
      if (pathname === '/api/projects/create' && req.method === 'POST') {
        const body = await req.json();
        const { name, template } = body;
        if (!name || !name.trim()) {
          return respond(new Response('Missing project name', { status: 400, headers: corsHeaders }));
        }
        const newProj = projectManager.createProject(name.trim(), template || 'article');
        syncServicesWithActiveProject();
        console.log(`\x1b[33m[PROJECT]\x1b[0m Created new project "${newProj.name}" with template "${newProj.template}"`);
        return respond(Response.json({
          success: true,
          project: newProj,
        }, { headers: corsHeaders }));
      }

      // Download a project as .zip
      if (pathname === '/api/projects/download' && req.method === 'GET') {
        const id = url.searchParams.get('id') || activeProject.id;
        const dir = projectManager.getProjectDir(id);
        if (!dir) return respond(new Response('Project not found', { status: 404, headers: corsHeaders }));
        return respond(zipResponse(zipPath(dir), `${id}.zip`, corsHeaders));
      }

      // Import a project from an uploaded .zip (multipart: file, name)
      if (pathname === '/api/projects/import' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof Blob)) return respond(new Response('Missing zip file', { status: 400, headers: corsHeaders }));
        const fileName = (file as File).name || 'project.zip';
        const name = String(form.get('name') || fileName.replace(/\.zip$/i, '')).trim() || 'Imported project';
        const project = projectManager.importProject(name, new Uint8Array(await file.arrayBuffer()));
        syncServicesWithActiveProject();
        console.log(`\x1b[33m[PROJECT]\x1b[0m Imported "${project.name}" (${project.fileCount} files, main: ${project.mainFile})`);
        return respond(Response.json({ success: true, project }, { headers: corsHeaders }));
      }

      // Delete a project
      if (pathname.startsWith('/api/projects/') && req.method === 'DELETE') {
        const projectId = decodeURIComponent(pathname.replace('/api/projects/', ''));
        const success = projectManager.deleteProject(projectId);
        syncServicesWithActiveProject();
        console.log(`\x1b[33m[PROJECT]\x1b[0m Deleted project ID "${projectId}"`);
        return respond(Response.json({
          success,
          activeProject: projectManager.getActiveProject(),
        }, { headers: corsHeaders }));
      }

      // ==========================================
      // File Management APIs (Scoped to active project)
      // ==========================================

      // Get file tree
      if (pathname === '/api/files/tree' && req.method === 'GET') {
        const tree = buildFileTree(projectRoot, projectRoot);
        return respond(Response.json({
          tree,
          root: projectRoot,
          project: activeProject,
        }, { headers: corsHeaders }));
      }

      // Read file
      if (pathname === '/api/files/read' && (req.method === 'GET' || req.method === 'HEAD')) {
        const relPath = url.searchParams.get('path');
        if (!relPath) {
          return respond(new Response('Missing path parameter', { status: 400, headers: corsHeaders }));
        }

        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || !fs.existsSync(fullPath)) {
          return respond(new Response('File not found or access denied', { status: 404, headers: corsHeaders }));
        }

        const fileType = getFileType(relPath, false);
        if (fileType === 'image' || fileType === 'pdf') {
          const file = Bun.file(fullPath);
          return respond(new Response(file, { headers: corsHeaders }));
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        return respond(Response.json({ path: relPath, content }, { headers: corsHeaders }));
      }

      // Write file
      if (pathname === '/api/files/write' && req.method === 'POST') {
        const body = await req.json();
        const { path: relPath, content } = body;
        if (!relPath) {
          return respond(new Response('Missing path', { status: 400, headers: corsHeaders }));
        }

        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || fullPath === projectRoot) {
          return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content ?? '', 'utf-8');
        return respond(Response.json({ success: true, path: relPath }, { headers: corsHeaders }));
      }

      // Create file
      if (pathname === '/api/files/create' && req.method === 'POST') {
        const body = await req.json();
        const { path: relPath, content = '' } = body;
        if (!relPath) {
          return respond(new Response('Missing path', { status: 400, headers: corsHeaders }));
        }

        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || fullPath === projectRoot) {
          return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(fullPath)) {
          return respond(new Response('File already exists', { status: 409, headers: corsHeaders }));
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        return respond(Response.json({ success: true, path: relPath }, { headers: corsHeaders }));
      }

      // Download a file, or a folder (or the whole project when path is empty) as .zip
      if (pathname === '/api/files/download' && req.method === 'GET') {
        const relPath = url.searchParams.get('path') || '';
        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || !fs.existsSync(fullPath)) {
          return respond(new Response('Not found', { status: 404, headers: corsHeaders }));
        }
        if (fs.statSync(fullPath).isFile()) {
          return respond(new Response(Bun.file(fullPath), {
            headers: { ...corsHeaders, 'Content-Disposition': `attachment; filename="${path.basename(fullPath)}"` },
          }));
        }
        const name = relPath ? path.basename(fullPath) : activeProject.id;
        return respond(zipResponse(zipPath(fullPath), `${name}.zip`, corsHeaders));
      }

      // Upload files into a folder (multipart: files[] + paths JSON). `extract=1` unpacks .zip files.
      if (pathname === '/api/files/upload' && req.method === 'POST') {
        const destDir = url.searchParams.get('dir') || '';
        const extract = url.searchParams.get('extract') === '1';
        const destAbs = resolveInProject(projectRoot, destDir);
        if (!destAbs) return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));

        const form = await req.formData();
        const files = form.getAll('files').filter((f): f is File => f instanceof Blob);
        const paths: string[] = JSON.parse(String(form.get('paths') || '[]'));
        const written: string[] = [];
        for (const [i, file] of files.entries()) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const rel = path.posix.join(destDir, paths[i] || file.name);
          if (extract && /\.zip$/i.test(rel)) {
            written.push(...extractZip(bytes, projectRoot, destDir));
            continue;
          }
          const full = resolveInProject(projectRoot, rel);
          if (!full || full === projectRoot) return respond(new Response(`Access denied: ${rel}`, { status: 403, headers: corsHeaders }));
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, bytes);
          written.push(path.relative(projectRoot, full));
        }
        console.log(`\x1b[33m[FILES]\x1b[0m Uploaded ${written.length} file(s) to /${destDir}`);
        return respond(Response.json({ success: true, files: written }, { headers: corsHeaders }));
      }

      // Create directory
      if (pathname === '/api/files/mkdir' && req.method === 'POST') {
        const body = await req.json();
        const { path: relPath } = body;
        if (!relPath) {
          return respond(new Response('Missing path', { status: 400, headers: corsHeaders }));
        }

        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || fullPath === projectRoot) {
          return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));
        }

        fs.mkdirSync(fullPath, { recursive: true });
        return respond(Response.json({ success: true, path: relPath }, { headers: corsHeaders }));
      }

      // Rename file or directory
      if (pathname === '/api/files/rename' && req.method === 'POST') {
        const body = await req.json();
        const { oldPath: relOld, newPath: relNew } = body;
        if (!relOld || !relNew) {
          return respond(new Response('Missing oldPath or newPath', { status: 400, headers: corsHeaders }));
        }

        const fullOld = resolveInProject(projectRoot, relOld);
        const fullNew = resolveInProject(projectRoot, relNew);

        if (!fullOld || !fullNew || fullOld === projectRoot || fullNew === projectRoot) {
          return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));
        }

        if (!fs.existsSync(fullOld)) {
          return respond(new Response('Source file does not exist', { status: 404, headers: corsHeaders }));
        }
        if (fs.existsSync(fullNew)) {
          return respond(new Response('Target already exists', { status: 409, headers: corsHeaders }));
        }

        const targetDir = path.dirname(fullNew);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.renameSync(fullOld, fullNew);
        return respond(Response.json({ success: true, oldPath: relOld, newPath: relNew }, { headers: corsHeaders }));
      }

      // Delete file or directory
      if (pathname === '/api/files/delete' && req.method === 'POST') {
        const body = await req.json();
        const { path: relPath } = body;
        if (!relPath) {
          return respond(new Response('Missing path', { status: 400, headers: corsHeaders }));
        }

        const fullPath = resolveInProject(projectRoot, relPath);
        if (!fullPath || fullPath === projectRoot) {
          return respond(new Response('Access denied', { status: 403, headers: corsHeaders }));
        }

        if (!fs.existsSync(fullPath)) {
          return respond(new Response('File not found', { status: 404, headers: corsHeaders }));
        }

        fs.rmSync(fullPath, { recursive: true, force: true });
        return respond(Response.json({ success: true, path: relPath }, { headers: corsHeaders }));
      }

      // ==========================================
      // LaTeX Compilation APIs
      // ==========================================

      // Detect available compiler engines
      if (pathname === '/api/compiler/engines' && req.method === 'GET') {
        const engines = await compiler.detectAvailableEngines();
        return respond(Response.json({ engines }, { headers: corsHeaders }));
      }

      // Compile document
      if (pathname === '/api/compiler/compile' && req.method === 'POST') {
        const body = await req.json();
        const compileReq = body as CompileRequest;
        const engineName = compileReq.engine || 'tectonic';
        console.log(`\x1b[34m[COMPILER]\x1b[0m Compiling ${compileReq.mainFile} with ${engineName}...`);

        const result = await compiler.compile(compileReq);
        const statusText = result.success ? '\x1b[32mSUCCESS\x1b[0m' : '\x1b[31mERRORS\x1b[0m';
        console.log(`\x1b[34m[COMPILER]\x1b[0m Result: ${statusText} in ${result.executionTimeMs}ms (${result.errors.length} errors, ${result.warnings.length} warnings)`);

        return respond(Response.json(result, { headers: corsHeaders }));
      }

      // Serve generated PDF
      if (pathname === '/api/compiler/pdf' && (req.method === 'GET' || req.method === 'HEAD')) {
        const mainFile = url.searchParams.get('file') || activeProject.mainFile || 'main.tex';
        const baseName = path.basename(mainFile).replace(/\.tex$/i, '');
        const pdfPath = resolveInProject(projectRoot, mainFile.replace(/\.tex$/i, '.pdf'));

        if (!pdfPath || !fs.existsSync(pdfPath)) {
          return respond(new Response('PDF not found. Please compile the document first.', {
            status: 404,
            headers: corsHeaders,
          }));
        }

        const pdfFile = Bun.file(pdfPath);
        return respond(new Response(pdfFile, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${baseName}.pdf"`,
            'Cache-Control': 'no-cache',
          },
        }));
      }

      // SyncTeX: both directions load <main>.synctex.gz written by the last compile
      if (pathname.startsWith('/api/compiler/synctex/') && req.method === 'POST') {
        const body = await req.json();
        const mainFile: string = body.mainFile || activeProject.mainFile || 'main.tex';
        const mainAbs = resolveInProject(projectRoot, mainFile);
        if (!mainAbs || !synctex.loadFromFile(mainAbs.replace(/\.tex$/i, '.synctex.gz'))) {
          return respond(Response.json({ error: 'No SyncTeX data. Compile the document first.' }, { status: 404, headers: corsHeaders }));
        }

        if (pathname.endsWith('/forward')) {
          const result = synctex.forward(body.file, Number(body.line));
          return respond(Response.json(result ?? { error: 'No match' }, { status: result ? 200 : 404, headers: corsHeaders }));
        }
        if (pathname.endsWith('/reverse')) {
          const result = synctex.reverse(Number(body.page), Number(body.x), Number(body.y));
          if (!result) return respond(Response.json({ error: 'No match' }, { status: 404, headers: corsHeaders }));
          const abs = path.isAbsolute(result.file) ? result.file : path.join(path.dirname(mainAbs), result.file);
          const rel = path.relative(projectRoot, abs);
          if (rel.startsWith('..')) return respond(Response.json({ error: 'Source outside project' }, { status: 404, headers: corsHeaders }));
          return respond(Response.json({ file: rel, line: result.line }, { headers: corsHeaders }));
        }
      }

      // ==========================================
      // Templates & Inbaked Skills
      // ==========================================

      if (pathname === '/api/templates' && req.method === 'GET') {
        return respond(Response.json({ templates: TEMPLATES }, { headers: corsHeaders }));
      }

      if (pathname === '/api/agent/skills' && req.method === 'GET') {
        const skills = agentRunner.getSkills();
        return respond(Response.json({ skills }, { headers: corsHeaders }));
      }

      // Apply template into current project
      if (pathname === '/api/templates/apply' && req.method === 'POST') {
        const body = await req.json();
        const { templateId } = body;
        const template = TEMPLATES.find((t) => t.id === templateId);
        if (!template) {
          return respond(new Response('Template not found', { status: 404, headers: corsHeaders }));
        }

        for (const [filename, content] of Object.entries(template.files)) {
          const fullPath = path.join(projectRoot, filename); // template filenames are trusted constants
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, content, 'utf-8');
        }

        console.log(`\x1b[33m[TEMPLATE]\x1b[0m Applied template "${template.name}" to active project`);
        return respond(Response.json({ success: true, mainFile: template.mainFile }, { headers: corsHeaders }));
      }

      // ==========================================
      // Agent Chat SSE / Streaming (Robust & Keep-Alive)
      // ==========================================
      // Models from every provider opencode is logged into
      if (pathname === '/api/agent/models' && req.method === 'GET') {
        const models = await listOpencodeModels().catch(() => []);
        return respond(Response.json({ default: agentRunner.getModel(), models }, { headers: corsHeaders }));
      }
      if (pathname === '/api/agent/logs' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? -1);
        return respond(
          Response.json({ lines: agentLog.filter((l) => l.seq > since), running: !!agentJob && !agentJob.done }, { headers: corsHeaders })
        );
      }

      if (pathname === '/api/agent/chat' && req.method === 'POST') {
        const body = await req.json();
        const { prompt, context, mainFile, engine, model } = body as {
          prompt: string;
          context: AgentProjectContext;
          mainFile?: string;
          engine?: string;
          model?: string;
        };

        if (!prompt) {
          return respond(new Response('Missing prompt', { status: 400, headers: corsHeaders }));
        }
        if (agentJob && !agentJob.done) {
          return respond(new Response('The agent is already running a request', { status: 409, headers: corsHeaders }));
        }

        logAgent(`Prompt: "${prompt.slice(0, 120)}${prompt.length > 120 ? '…' : ''}"`);
        startAgentJob(() =>
          agentRunner.sendMessage(
            prompt,
            { ...context, projectTree: context?.projectTree ?? [], recentErrors: context?.recentErrors ?? [] },
            mainFile || activeProject.mainFile || 'main.tex',
            engine || 'tectonic',
            { model: typeof model === 'string' && /^\w[\w./:-]{0,99}$/.test(model) ? model : undefined }
          )
        );
        return respond(streamAgentJob(agentJob!, 0, req.signal, corsHeaders));
      }

      // Stored chat transcript for the active project (session memory).
      if (pathname === '/api/agent/session') {
        if (req.method === 'GET') return respond(Response.json({ messages: agentRunner.readChat() }, { headers: corsHeaders }));
        if (req.method === 'PUT') {
          const { messages } = await req.json();
          agentRunner.writeChat(Array.isArray(messages) ? messages : []);
          return respond(Response.json({ success: true }, { headers: corsHeaders }));
        }
        // Only ever called from an explicit, confirmed user action in Settings.
        if (req.method === 'DELETE') {
          agentRunner.deleteStoredSessions();
          console.log(`\x1b[33m[AGENT]\x1b[0m Saved conversations deleted by user for "${activeProject.name}"`);
          return respond(Response.json({ success: true }, { headers: corsHeaders }));
        }
      }

      // Re-attach to the running (or just finished) agent job after a dropped connection.
      if (pathname === '/api/agent/stream' && req.method === 'GET') {
        if (!agentJob) return respond(new Response('No agent job', { status: 404, headers: corsHeaders }));
        const from = Number(url.searchParams.get('from') || 0);
        return respond(streamAgentJob(agentJob, from, req.signal, corsHeaders));
      }

      // Cancel Agent Generation
      if (pathname === '/api/agent/cancel' && req.method === 'POST') {
        agentRunner.cancel();
        return respond(Response.json({ success: true }, { headers: corsHeaders }));
      }

      // Start a fresh agent conversation (previous one is archived in .autotex/sessions/)
      if (pathname === '/api/agent/reset' && req.method === 'POST') {
        agentRunner.resetConversation();
        return respond(Response.json({ success: true }, { headers: corsHeaders }));
      }

      // Serve static files in production if dist exists
      const distPath = path.join(APP_ROOT, 'dist');
      if (fs.existsSync(distPath)) {
        const reqPath = pathname === '/' ? 'index.html' : pathname.slice(1);
        const filePath = path.join(distPath, reqPath);
        if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
          return respond(new Response(Bun.file(filePath)));
        }
        // Fallback for SPA routing
        return respond(new Response(Bun.file(path.join(distPath, 'index.html'))));
      }

      return respond(new Response('Not Found', { status: 404, headers: corsHeaders }));
    } catch (err: any) {
      console.error(`\x1b[31m[UNHANDLED ERROR]\x1b[0m ${req.method} ${pathname}:`, err);
      return respond(new Response(err.message || 'Internal Server Error', { status: 500, headers: corsHeaders }));
    }
  },
});

console.log(`\x1b[1m\x1b[32m✓ AutoTEX Backend running at http://localhost:${server.port}\x1b[0m`);
console.log(`\x1b[90mActive Project: ${initialProject.name} (${initialProject.rootPath})\x1b[0m`);
