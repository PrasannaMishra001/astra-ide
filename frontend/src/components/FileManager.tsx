'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Folder, FolderPlus, FilePlus, FileCode2, FileText, FileJson, FileTerminal,
  GitBranch, RefreshCw, Save, Trash2, Loader2, X, Check,
} from 'lucide-react';

import {
  listFiles, readFile, writeFile, importRepo, makeDir, deletePath, type WsFile,
} from '../lib/api';
import { toast } from '../lib/toast';
import { cn } from '../lib/utils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

/**
 * Workspace file explorer: tree sidebar (create / delete / GitHub import) plus
 * a Monaco editing pane with full syntax highlighting, bracket-pair colors and
 * indentation guides. Backed by the /workspaces/:id/files API.
 */

// File extension to Monaco language for syntax highlighting.
const EXT_LANG: Record<string, string> = {
  py: 'python', cpp: 'cpp', cc: 'cpp', h: 'cpp', hpp: 'cpp', c: 'c',
  js: 'javascript', mjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', md: 'markdown', sh: 'shell', bash: 'shell',
  yml: 'yaml', yaml: 'yaml', html: 'html', css: 'css', go: 'go',
  rs: 'rust', java: 'java', sql: 'sql', toml: 'ini', txt: 'plaintext',
};

function langFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? 'plaintext';
}

function FileIcon({ path }: { path: string }) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'json') return <FileJson size={13} className="text-amber-400 shrink-0" />;
  if (ext === 'md' || ext === 'txt') return <FileText size={13} className="text-slate-400 shrink-0" />;
  if (ext === 'sh' || ext === 'bash') return <FileTerminal size={13} className="text-emerald-400 shrink-0" />;
  return <FileCode2 size={13} className="text-astra-400 shrink-0" />;
}

type Prompt = { kind: 'file' | 'folder' | 'import' } | null;

export default function FileManager({ workspaceId }: { workspaceId: number }) {
  const [files, setFiles] = useState<WsFile[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [promptValue, setPromptValue] = useState('');

  async function refresh() {
    try { setFiles(await listFiles(workspaceId)); } catch { /* not fatal */ }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [workspaceId]);

  async function open(path: string) {
    setSel(path); setDirty(false);
    try { setContent(await readFile(workspaceId, path)); }
    catch { setContent(''); toast.error('Cannot open file', path); }
  }

  async function save() {
    if (!sel) return;
    setBusy(true);
    try { await writeFile(workspaceId, sel, content); setDirty(false); toast.success('Saved', sel); }
    catch (e: any) { toast.error('Save failed', e?.response?.data?.detail || 'Server error'); }
    setBusy(false);
  }

  async function confirmPrompt() {
    const v = promptValue.trim();
    if (!v) return;
    setBusy(true);
    try {
      if (prompt?.kind === 'file') {
        await writeFile(workspaceId, v, '');
        await refresh(); await open(v);
        toast.success('File created', v);
      } else if (prompt?.kind === 'folder') {
        await makeDir(workspaceId, v);
        await refresh();
        toast.success('Folder created', v);
      } else if (prompt?.kind === 'import') {
        toast.info('Cloning repository', 'This can take a few seconds');
        const r = await importRepo(workspaceId, v);
        await refresh();
        toast.success('Repository imported', `${r.file_count} files`);
      }
      setPrompt(null); setPromptValue('');
    } catch (e: any) {
      toast.error('Action failed', e?.response?.data?.detail || 'Server error');
    }
    setBusy(false);
  }

  async function remove(path: string) {
    if (!confirm(`Delete "${path}"?`)) return;
    try {
      await deletePath(workspaceId, path);
      if (sel === path) { setSel(null); setContent(''); }
      await refresh();
      toast.success('Deleted', path);
    } catch (e: any) {
      toast.error('Delete failed', e?.response?.data?.detail || 'Server error');
    }
  }

  const promptLabel = useMemo(() => ({
    file:   { title: 'New file',   placeholder: 'src/main.py', hint: 'Path inside the workspace; folders are created automatically.' },
    folder: { title: 'New folder', placeholder: 'src/utils',   hint: 'Nested paths are allowed.' },
    import: { title: 'Import a public repository', placeholder: 'https://github.com/owner/repo', hint: 'GitHub, GitLab or Bitbucket over HTTPS. Replaces current workspace files.' },
  }), []);

  return (
    <div className="flex h-full bg-slate-950">
      {/* Tree sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-1">
            Explorer
          </span>
          <IconBtn title="New file"   onClick={() => { setPrompt({ kind: 'file' }); setPromptValue(''); }}><FilePlus size={14} /></IconBtn>
          <IconBtn title="New folder" onClick={() => { setPrompt({ kind: 'folder' }); setPromptValue(''); }}><FolderPlus size={14} /></IconBtn>
          <IconBtn title="Import Git repository" onClick={() => { setPrompt({ kind: 'import' }); setPromptValue(''); }}><GitBranch size={14} /></IconBtn>
          <IconBtn title="Refresh" onClick={refresh}><RefreshCw size={13} /></IconBtn>
        </div>

        <div className="flex-1 overflow-auto py-1 text-[13px]">
          {files.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-500 text-xs leading-relaxed">
                No files yet.<br />Create a file or import a Git repository.
              </p>
            </div>
          )}
          {files.map((f) => (
            <div key={f.path}
                 className={cn(
                   'group flex items-center gap-1.5 pr-1 hover:bg-slate-800/70',
                   sel === f.path && 'bg-slate-800 text-astra-300',
                 )}
                 style={{ paddingLeft: 10 + (f.path.split('/').length - 1) * 14 }}>
              <button type="button"
                      onClick={() => f.type === 'file' && open(f.path)}
                      title={f.path}
                      className="flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left">
                {f.type === 'dir'
                  ? <Folder size={13} className="text-slate-500 shrink-0" />
                  : <FileIcon path={f.path} />}
                <span className={cn('truncate', f.type === 'dir' ? 'text-slate-400' : 'text-slate-300')}>
                  {f.path.split('/').pop()}
                </span>
              </button>
              <button type="button" title={`Delete ${f.path}`}
                      onClick={() => remove(f.path)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-500 hover:text-rose-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 h-9 border-b border-slate-800 flex items-center gap-3 text-xs bg-slate-900/70">
          {sel ? (
            <>
              <FileIcon path={sel} />
              <span className="text-slate-300 truncate">{sel}</span>
              {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
              <button type="button" onClick={save} disabled={busy || !dirty}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-medium">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save
              </button>
            </>
          ) : (
            <span className="text-slate-500">Select a file from the explorer</span>
          )}
        </div>

        <div className="flex-1 min-h-0">
          {sel ? (
            <MonacoEditor
              height="100%"
              theme="vs-dark"
              path={sel}
              language={langFor(sel)}
              value={content}
              onChange={(v) => { setContent(v ?? ''); setDirty(true); }}
              options={{
                fontSize: 13.5,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
                renderLineHighlight: 'all',
                smoothScrolling: true,
                fontLigatures: true,
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Consolas, monospace',
                padding: { top: 10 },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <Folder size={36} className="mx-auto text-slate-700 mb-3" />
                <p className="text-sm text-slate-400 mb-1">Your project files</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Create files, organize folders, or bring an existing project
                  in from GitHub. Everything here is available to the Terminal
                  and the Run pipeline.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline prompt dialog (replaces window.prompt) */}
      {prompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-32 px-4"
             onClick={() => setPrompt(null)}>
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{promptLabel[prompt.kind].title}</h3>
              <button type="button" onClick={() => setPrompt(null)} title="Close" aria-label="Close"
                      className="p-1 rounded text-slate-500 hover:text-slate-300"><X size={14} /></button>
            </div>
            <input
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmPrompt(); if (e.key === 'Escape') setPrompt(null); }}
              placeholder={promptLabel[prompt.kind].placeholder}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-astra-500 outline-none text-sm font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-2">{promptLabel[prompt.kind].hint}</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setPrompt(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm">Cancel</button>
              <button type="button" onClick={confirmPrompt} disabled={busy || !promptValue.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-astra-600 hover:bg-astra-700 disabled:opacity-50 text-sm font-medium">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, children }:
  { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800">
      {children}
    </button>
  );
}
