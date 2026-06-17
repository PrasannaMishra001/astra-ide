'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import {
  Folder, FolderPlus, FilePlus, FileCode2, FileText, FileJson, FileTerminal,
  GitBranch, RefreshCw, Save, Trash2, Loader2, X, Check, Palette,
} from 'lucide-react';

import {
  listFiles, readFile, writeFile, importRepo, makeDir, deletePath, type WsFile,
} from '../lib/api';
import { toast } from '../lib/toast';
import { cn } from '../lib/utils';
import ThemePicker from './ThemePicker';
import {
  applyEditorTheme, getSavedTheme, saveTheme, themeById, resolveMonacoName,
} from '../lib/editorThemes';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Extension -> Monaco language (syntax highlighting).
const EXT_LANG: Record<string, string> = {
  py: 'python', cpp: 'cpp', cc: 'cpp', h: 'cpp', hpp: 'cpp', c: 'c',
  js: 'javascript', mjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json', md: 'markdown', sh: 'shell', bash: 'shell',
  yml: 'yaml', yaml: 'yaml', html: 'html', css: 'css', scss: 'scss', go: 'go',
  rs: 'rust', java: 'java', sql: 'sql', toml: 'ini', txt: 'plaintext',
};

// Firebase/Glitch-style colour coding by extension. Each colour set is written
// as literal Tailwind classes so the JIT compiler keeps them.
const COLORS = {
  red:     { text: 'text-rose-400',    selBg: 'bg-rose-500/10',    border: 'border-rose-500'    },
  yellow:  { text: 'text-yellow-400',  selBg: 'bg-yellow-500/10',  border: 'border-yellow-500'  },
  sky:     { text: 'text-sky-400',     selBg: 'bg-sky-500/10',     border: 'border-sky-500'     },
  fuchsia: { text: 'text-fuchsia-400', selBg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500' },
  orange:  { text: 'text-orange-400',  selBg: 'bg-orange-500/10',  border: 'border-orange-500'  },
  emerald: { text: 'text-emerald-400', selBg: 'bg-emerald-500/10', border: 'border-emerald-500' },
  cyan:    { text: 'text-cyan-400',    selBg: 'bg-cyan-500/10',    border: 'border-cyan-500'    },
  purple:  { text: 'text-purple-400',  selBg: 'bg-purple-500/10',  border: 'border-purple-500'  },
  slate:   { text: 'text-faint',       selBg: 'bg-slate-500/10',   border: 'border-slate-400'   },
};
type ColorKey = keyof typeof COLORS;
const EXT_COLOR: Record<string, ColorKey> = {
  json: 'red', js: 'yellow', mjs: 'yellow', jsx: 'yellow', ts: 'sky', tsx: 'sky',
  css: 'fuchsia', scss: 'fuchsia', html: 'orange', xml: 'orange',
  md: 'slate', txt: 'slate', lock: 'slate', gitignore: 'slate',
  py: 'emerald', sh: 'emerald', bash: 'emerald',
  go: 'cyan', rs: 'orange', java: 'red', c: 'sky', cpp: 'sky', h: 'sky',
  yml: 'purple', yaml: 'purple', toml: 'purple',
};

function extOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  if (base.startsWith('.')) return base.slice(1).toLowerCase();   // .gitignore -> gitignore
  return base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
}
function colorOf(path: string) { return COLORS[EXT_COLOR[extOf(path)] ?? 'slate']; }
function langFor(path: string): string { return EXT_LANG[extOf(path)] ?? 'plaintext'; }

function FileIcon({ path }: { path: string }) {
  const e = extOf(path);
  const c = colorOf(path).text;
  if (e === 'json') return <FileJson size={13} className={cn('shrink-0', c)} />;
  if (e === 'md' || e === 'txt') return <FileText size={13} className={cn('shrink-0', c)} />;
  if (e === 'sh' || e === 'bash') return <FileTerminal size={13} className={cn('shrink-0', c)} />;
  return <FileCode2 size={13} className={cn('shrink-0', c)} />;
}

// Render the filename with the extension portion coloured (Glitch style).
function FileName({ path }: { path: string }) {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  const color = colorOf(path).text;
  if (dot <= 0) return <span className="truncate">{base}</span>;
  return (
    <span className="truncate">
      {base.slice(0, dot)}<span className={color}>{base.slice(dot)}</span>
    </span>
  );
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

  // Editor theme (shared with the Collab editor via localStorage).
  const [themeId, setThemeId] = useState<string>(getSavedTheme);
  const [monacoTheme, setMonacoTheme] = useState<string>(() => resolveMonacoName(getSavedTheme()));
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [monaco, setMonaco] = useState<Monaco | null>(null);

  async function refresh() {
    try { setFiles(await listFiles(workspaceId)); } catch { /* not fatal */ }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [workspaceId]);

  async function pickTheme(id: string) {
    setThemeId(id); saveTheme(id);
    if (monaco) setMonacoTheme(await applyEditorTheme(monaco, id));
    setShowThemePicker(false);
    toast.success('Theme applied', themeById(id).label);
  }

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
      if (prompt?.kind === 'file')   { await writeFile(workspaceId, v, ''); await refresh(); await open(v); toast.success('File created', v); }
      else if (prompt?.kind === 'folder') { await makeDir(workspaceId, v); await refresh(); toast.success('Folder created', v); }
      else if (prompt?.kind === 'import') {
        toast.info('Cloning repository', 'This can take a few seconds');
        const r = await importRepo(workspaceId, v); await refresh();
        toast.success('Repository imported', `${r.file_count} files`);
      }
      setPrompt(null); setPromptValue('');
    } catch (e: any) { toast.error('Action failed', e?.response?.data?.detail || 'Server error'); }
    setBusy(false);
  }
  async function remove(path: string) {
    if (!confirm(`Delete "${path}"?`)) return;
    try {
      await deletePath(workspaceId, path);
      if (sel === path) { setSel(null); setContent(''); }
      await refresh(); toast.success('Deleted', path);
    } catch (e: any) { toast.error('Delete failed', e?.response?.data?.detail || 'Server error'); }
  }

  const promptLabel = useMemo(() => ({
    file:   { title: 'New file',   placeholder: 'src/main.py', hint: 'Path inside the workspace; folders are created automatically.' },
    folder: { title: 'New folder', placeholder: 'src/utils',   hint: 'Nested paths are allowed.' },
    import: { title: 'Import a public repository', placeholder: 'https://github.com/owner/repo', hint: 'GitHub, GitLab or Bitbucket over HTTPS. Replaces current workspace files.' },
  }), []);

  return (
    <div className="flex h-full bg-surface">
      {/* Explorer sidebar */}
      <aside className="w-64 border-r border-edge bg-raised/40 flex flex-col">
        <div className="px-3 py-2 border-b border-edge flex items-center gap-1">
          <span className="t-overline text-faint flex-1">Explorer</span>
          <IconBtn title="New file"   onClick={() => { setPrompt({ kind: 'file' }); setPromptValue(''); }}><FilePlus size={14} /></IconBtn>
          <IconBtn title="New folder" onClick={() => { setPrompt({ kind: 'folder' }); setPromptValue(''); }}><FolderPlus size={14} /></IconBtn>
          <IconBtn title="Import Git repository" onClick={() => { setPrompt({ kind: 'import' }); setPromptValue(''); }}><GitBranch size={14} /></IconBtn>
          <IconBtn title="Refresh" onClick={refresh}><RefreshCw size={13} /></IconBtn>
        </div>

        <div className="flex-1 overflow-auto py-1 text-[13px]">
          {files.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-faint text-xs leading-relaxed">No files yet.<br />Create a file or import a Git repository.</p>
            </div>
          )}
          {files.map((f) => {
            const selected = sel === f.path;
            const c = colorOf(f.path);
            return (
              <div key={f.path}
                   className={cn('group flex items-center gap-1.5 pr-1 border-l-2 transition-colors',
                     selected ? cn(c.selBg, c.border) : 'border-transparent hover:bg-raised')}
                   style={{ paddingLeft: 8 + (f.path.split('/').length - 1) * 14 }}>
                <button type="button"
                        onClick={() => f.type === 'file' && open(f.path)}
                        title={f.path}
                        className="flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left">
                  {f.type === 'dir'
                    ? <Folder size={13} className="text-faint shrink-0" />
                    : <FileIcon path={f.path} />}
                  {f.type === 'dir'
                    ? <span className="truncate text-muted">{f.path.split('/').pop()}</span>
                    : <span className={cn(selected ? 'text-ink font-medium' : 'text-muted')}><FileName path={f.path} /></span>}
                </button>
                <button type="button" title={`Delete ${f.path}`} onClick={() => remove(f.path)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-faint hover:text-rose-400">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Editor pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 h-9 border-b border-edge flex items-center gap-3 text-xs bg-raised/40">
          {sel ? (
            <>
              <FileIcon path={sel} />
              <span className="text-muted truncate"><FileName path={sel} /></span>
              {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />}
            </>
          ) : (
            <span className="text-faint">Select a file from the explorer</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setShowThemePicker(true)} title="Editor theme (VS Code themes)"
                    className="btn-ghost px-2 py-1 text-xs">
              <Palette size={13} /> <span className="hidden lg:inline">{themeById(themeId).label}</span>
            </button>
            {sel && (
              <button type="button" onClick={save} disabled={busy || !dirty}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {sel ? (
            <MonacoEditor
              height="100%" theme={monacoTheme} path={sel} language={langFor(sel)} value={content}
              onMount={(_e, m) => { setMonaco(m); applyEditorTheme(m, themeId).then(setMonacoTheme).catch(() => {}); }}
              onChange={(v) => { setContent(v ?? ''); setDirty(true); }}
              options={{
                fontSize: 13.5, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: 'on',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
                renderLineHighlight: 'all', smoothScrolling: true, fontLigatures: true,
                fontFamily: '"Source Code Pro", "JetBrains Mono", Menlo, Consolas, monospace',
                padding: { top: 10 },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <Folder size={36} className="mx-auto text-edge-strong mb-3" />
                <p className="t-subtitle text-muted mb-1">Your project files</p>
                <p className="text-xs text-faint leading-relaxed">
                  Create files, organize folders, or bring an existing project in from GitHub.
                  Everything here is available to the Terminal and the Run pipeline.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline prompt dialog */}
      {prompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-32 px-4"
             onClick={() => setPrompt(null)}>
          <div className="w-full max-w-md card p-4 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="t-h3">{promptLabel[prompt.kind].title}</h3>
              <button type="button" onClick={() => setPrompt(null)} title="Close" aria-label="Close" className="btn-ghost p-1.5"><X size={14} /></button>
            </div>
            <input autoFocus value={promptValue} onChange={(e) => setPromptValue(e.target.value)}
                   onKeyDown={(e) => { if (e.key === 'Enter') confirmPrompt(); if (e.key === 'Escape') setPrompt(null); }}
                   placeholder={promptLabel[prompt.kind].placeholder} className="input-base font-mono" />
            <p className="text-[11px] text-faint mt-2">{promptLabel[prompt.kind].hint}</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setPrompt(null)} className="btn-outline">Cancel</button>
              <button type="button" onClick={confirmPrompt} disabled={busy || !promptValue.trim()} className="btn-primary">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showThemePicker && (
        <ThemePicker current={themeId} onPick={pickTheme} onClose={() => setShowThemePicker(false)} />
      )}
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="btn-ghost p-1.5">{children}</button>
  );
}
