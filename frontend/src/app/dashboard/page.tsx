'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Plus, Play, Square, Trash2, Users } from 'lucide-react';

import {
  listWorkspaces, createWorkspace, deleteWorkspace,
  startWorkspace, stopWorkspace, type Workspace,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import ThreeDCard from '../../components/ui/ThreeDCard';
import { cn } from '../../lib/utils';

const LANGUAGES = [
  { id: 'python',     emoji: '🐍' },
  { id: 'cpp',        emoji: '⚡' },
  { id: 'javascript', emoji: '🟨' },
  { id: 'typescript', emoji: '🔷' },
  { id: 'go',         emoji: '🐹' },
  { id: 'rust',       emoji: '🦀' },
  { id: 'java',       emoji: '☕' },
  { id: 'bash',       emoji: '🐚' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { token, user, hydrated, clearSession } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('python');
  const [networkAccess, setNetworkAccess] = useState(false);
  const [filesystemWrite, setFilesystemWrite] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.push('/login'); return; }
    refresh();
  }, [token, hydrated]);

  async function refresh() {
    setLoading(true);
    try { setWorkspaces(await listWorkspaces()); }
    catch { clearSession(); router.push('/login'); }
    finally { setLoading(false); }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    await createWorkspace({
      name, language,
      network_access: networkAccess,
      filesystem_write: filesystemWrite,
    });
    setName(''); setShowCreate(false);
    refresh();
  }

  const owned   = workspaces.filter((w) => w.owner_id === user?.id);
  const shared  = workspaces.filter((w) => w.owner_id !== user?.id);

  return (
    <main className="min-h-screen relative">
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.08),_transparent_50%)]" />

      <header className="relative border-b border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-950/60 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="ASTRA-IDE" width={32} height={32} priority className="rounded" />
            <span className="text-lg font-bold tracking-tight">ASTRA<span className="text-astra-500">-IDE</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link href="/dashboard" className="px-3 py-1.5 rounded text-astra-300 bg-slate-800/60">
              Workspaces
            </Link>
            <Link href="/clusters" className="px-3 py-1.5 rounded text-slate-300 hover:bg-slate-800/40">
              Clusters
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">@{user?.username}</span>
          <button
            onClick={() => { clearSession(); router.push('/'); }}
            type="button"
            className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="relative max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My workspaces</h1>
            <p className="text-sm text-slate-400 mt-1">
              {owned.length} owned · {shared.length} shared with you
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreate(true)}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-astra-600 hover:bg-astra-700 font-medium shadow-lg shadow-astra-600/20"
          >
            <Plus size={16} /> New workspace
          </motion.button>
        </div>

        {loading && <p className="text-slate-400">Loading…</p>}

        {!loading && workspaces.length === 0 && (
          <div className="p-16 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
            <p className="text-slate-400 mb-2">No workspaces yet.</p>
            <p className="text-sm text-slate-500">Click "New workspace" to create your first one.</p>
          </div>
        )}

        {owned.length > 0 && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Owned</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {owned.map((ws) => (
                <WorkspaceCard key={ws.id} ws={ws} onChange={refresh} isOwner />
              ))}
            </div>
          </>
        )}

        {shared.length > 0 && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3 mt-8">Shared with you</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shared.map((ws) => (
                <WorkspaceCard key={ws.id} ws={ws} onChange={refresh} isOwner={false} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Create modal */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 z-50"
          onClick={() => setShowCreate(false)}
        >
          <motion.form
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onSubmit={onCreate} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl"
          >
            <h2 className="text-xl font-bold mb-1">Create workspace</h2>
            <p className="text-sm text-slate-500 mb-5">
              Sandbox tier auto-assigned by risk scorer.
            </p>

            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              required minLength={1} placeholder="my-project"
              className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700 focus:border-astra-500 outline-none text-sm"
            />

            <label className="block text-xs text-slate-400 mb-1">Language</label>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id} type="button"
                  onClick={() => setLanguage(l.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-2 py-2 rounded text-xs border transition-all',
                    language === l.id
                      ? 'bg-astra-600/20 border-astra-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600',
                  )}
                >
                  <span className="text-base leading-none">{l.emoji}</span>
                  <span>{l.id}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 mb-2 text-sm text-slate-300">
              <input type="checkbox" checked={networkAccess}
                     onChange={(e) => setNetworkAccess(e.target.checked)} />
              Network access (raises risk → gvisor or firecracker)
            </label>
            <label className="flex items-center gap-2 mb-6 text-sm text-slate-300">
              <input type="checkbox" checked={filesystemWrite}
                     onChange={(e) => setFilesystemWrite(e.target.checked)} />
              Filesystem write access
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)}
                      className="flex-1 py-2 rounded border border-slate-700 hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit"
                      className="flex-1 py-2 rounded bg-astra-600 hover:bg-astra-700 font-medium">
                Create
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </main>
  );
}

function WorkspaceCard({ ws, onChange, isOwner }:
  { ws: Workspace; onChange: () => void; isOwner: boolean }) {
  const tierColor: Record<string, string> = {
    runc:        'bg-emerald-900/60 text-emerald-300 border-emerald-700/40',
    gvisor:      'bg-amber-900/60   text-amber-300   border-amber-700/40',
    firecracker: 'bg-rose-900/60    text-rose-300    border-rose-700/40',
  };
  const statusColor: Record<string, string> = {
    PENDING:   'bg-slate-700/60 text-slate-300',
    PREWARMED: 'bg-blue-700/60  text-blue-200',
    RUNNING:   'bg-emerald-700  text-emerald-50',
    STOPPED:   'bg-slate-600/60 text-slate-300',
    FAILED:    'bg-red-700      text-red-100',
    ARCHIVED:  'bg-slate-800/60 text-slate-400',
  };

  return (
    <ThreeDCard intensity={6}>
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur hover:border-astra-600/60 transition-colors h-full flex flex-col">
        <div className="flex items-start justify-between mb-2 gap-2">
          <Link href={`/workspaces/${ws.id}`} className="font-semibold hover:text-astra-400 flex-1 truncate">
            {ws.name}
          </Link>
          <span className={cn('text-[10px] px-2 py-0.5 rounded font-medium', statusColor[ws.status])}>
            {ws.status}
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
          <span>{ws.language}</span>
          {!isOwner && (
            <span className="inline-flex items-center gap-1 text-astra-400">
              <Users size={11} /> shared
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', tierColor[ws.sandbox_tier])}>
            {ws.sandbox_tier}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/40">
            risk {ws.risk_score.toFixed(2)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/40">
            {ws.cpu_request} cpu · {ws.memory_request}MiB
          </span>
        </div>

        <div className="flex gap-1.5 text-xs mt-auto">
          {ws.status !== 'RUNNING' && (
            <button type="button"
                    onClick={async () => { await startWorkspace(ws.id); onChange(); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white">
              <Play size={11} /> Start
            </button>
          )}
          {ws.status === 'RUNNING' && (
            <button type="button"
                    onClick={async () => { await stopWorkspace(ws.id); onChange(); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
              <Square size={11} /> Stop
            </button>
          )}
          {isOwner && (
            <button type="button"
                    onClick={async () => {
                      if (confirm(`Delete workspace "${ws.name}"?`)) {
                        await deleteWorkspace(ws.id); onChange();
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 ml-auto">
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>
      </div>
    </ThreeDCard>
  );
}
