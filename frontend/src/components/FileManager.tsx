'use client';
import { useEffect, useState } from 'react';
import { listFiles, readFile, writeFile, importRepo, type WsFile } from '../lib/api';

/**
 * Workspace file manager: a file tree + "Import GitHub repo" + a view/edit pane.
 * Backed by the /workspaces/:id/files API. (The collaborative Monaco editor is a
 * separate tab; this is the project's actual files, e.g. a cloned repo.)
 */
export default function FileManager({ workspaceId }: { workspaceId: number }) {
  const [files, setFiles] = useState<WsFile[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function refresh() { try { setFiles(await listFiles(workspaceId)); } catch { /* ignore */ } }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [workspaceId]);

  async function open(path: string) {
    setSel(path); setMsg('');
    try { setContent(await readFile(workspaceId, path)); }
    catch { setMsg('cannot open file'); setContent(''); }
  }
  async function save() {
    if (!sel) return;
    setBusy(true);
    try { await writeFile(workspaceId, sel, content); setMsg('saved ✓'); }
    catch { setMsg('save failed'); }
    setBusy(false);
  }
  async function doImport() {
    const url = window.prompt('Public GitHub / GitLab repo URL:',
      'https://github.com/octocat/Hello-World');
    if (!url) return;
    setBusy(true); setMsg('cloning…');
    try { const r = await importRepo(workspaceId, url); setMsg(`imported ${r.file_count} files`); await refresh(); }
    catch (e: any) { setMsg(e?.response?.data?.detail || 'import failed'); }
    setBusy(false);
  }

  return (
    <div className="flex h-full">
      <aside className="w-60 border-r border-slate-800 bg-slate-900/60 flex flex-col">
        <div className="p-2 border-b border-slate-800">
          <button onClick={doImport} disabled={busy}
            className="w-full text-xs px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
            ⬇ Import GitHub repo
          </button>
        </div>
        <div className="flex-1 overflow-auto text-xs py-1">
          {files.length === 0 &&
            <p className="p-3 text-slate-500">No files yet — import a repo or create one.</p>}
          {files.map(f => (
            <button key={f.path}
              onClick={() => f.type === 'file' && open(f.path)}
              title={f.path}
              className={`block w-full text-left px-2 py-0.5 truncate hover:bg-slate-800
                ${sel === f.path ? 'bg-slate-800 text-blue-300' : f.type === 'dir' ? 'text-slate-500' : 'text-slate-300'}`}
              style={{ paddingLeft: 8 + (f.path.split('/').length - 1) * 10 }}>
              {f.type === 'dir' ? '📁' : '📄'} {f.path.split('/').pop()}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-1.5 border-b border-slate-800 flex items-center gap-3 text-xs bg-slate-900">
          <span className="text-slate-400 truncate">{sel || 'select a file from the tree'}</span>
          {sel && (
            <button onClick={save} disabled={busy}
              className="ml-auto px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600">Save</button>
          )}
          {msg && <span className="text-slate-500">{msg}</span>}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} spellCheck={false}
          className="flex-1 bg-slate-950 text-slate-200 font-mono text-sm p-3 outline-none resize-none"
          placeholder={sel ? '' : 'Open a file from the tree, or click "Import GitHub repo" to clone one.'} />
      </div>
    </div>
  );
}
