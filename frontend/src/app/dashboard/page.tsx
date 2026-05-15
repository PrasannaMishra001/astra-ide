'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  startWorkspace,
  stopWorkspace,
  type Workspace,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';

const LANGUAGES = ['python', 'javascript', 'go', 'rust', 'java', 'cpp', 'bash'];

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

  useEffect(() => {
    // Wait for Zustand to load persisted state from localStorage before
    // deciding whether the user is logged in. Otherwise refresh = log-out.
    if (!hydrated) return;
    if (!token) {
      router.push('/login');
      return;
    }
    refresh();
  }, [token, hydrated]);

  async function refresh() {
    setLoading(true);
    try {
      setWorkspaces(await listWorkspaces());
    } catch {
      // 401 → token expired
      clearSession();
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    await createWorkspace({ name, language, network_access: networkAccess });
    setName(''); setShowCreate(false);
    refresh();
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-astra-500">ASTRA-IDE</Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">@{user?.username}</span>
          <button onClick={() => { clearSession(); router.push('/'); }}
                  className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900">
            Log out
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My workspaces</h1>
          <button onClick={() => setShowCreate(true)}
                  className="px-4 py-2 rounded bg-astra-600 hover:bg-astra-700 font-medium">
            + New workspace
          </button>
        </div>

        {loading && <p className="text-slate-400">Loading…</p>}

        {!loading && workspaces.length === 0 && (
          <div className="p-12 text-center rounded-lg border border-dashed border-slate-800">
            <p className="text-slate-400">No workspaces yet. Create your first one.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} ws={ws} onChange={refresh} />
          ))}
        </div>
      </section>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
             onClick={() => setShowCreate(false)}>
          <form onSubmit={onCreate} onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md p-6 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-xl font-bold mb-4">Create workspace</h2>

            <label className="block text-sm mb-1 text-slate-400">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={1}
                   className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700" />

            <label className="block text-sm mb-1 text-slate-400">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
                    className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>

            <label className="flex items-center gap-2 mb-6 text-sm">
              <input type="checkbox" checked={networkAccess}
                     onChange={(e) => setNetworkAccess(e.target.checked)} />
              <span>Allow network access (raises risk score)</span>
            </label>

            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCreate(false)}
                      className="flex-1 py-2 rounded border border-slate-700">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded bg-astra-600 hover:bg-astra-700">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function WorkspaceCard({ ws, onChange }: { ws: Workspace; onChange: () => void }) {
  const tierColor: Record<string, string> = {
    runc:        'bg-emerald-900 text-emerald-300',
    gvisor:      'bg-amber-900 text-amber-300',
    firecracker: 'bg-rose-900 text-rose-300',
  };
  const statusColor: Record<string, string> = {
    PENDING:          'bg-slate-700',
    PREWARMED:        'bg-blue-700',
    RUNNING:          'bg-emerald-700',
    STOPPED:          'bg-slate-600',
    FAILED:           'bg-red-700',
    ARCHIVED:         'bg-slate-800',
  };

  return (
    <div className="p-4 rounded-lg border border-slate-800 hover:border-astra-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <Link href={`/workspaces/${ws.id}`} className="font-semibold hover:text-astra-500">
          {ws.name}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded ${statusColor[ws.status] || 'bg-slate-700'}`}>
          {ws.status}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-3">{ws.language}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierColor[ws.sandbox_tier]}`}>
          {ws.sandbox_tier}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          risk {ws.risk_score.toFixed(2)}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {ws.cpu_request} cpu · {ws.memory_request}MiB
        </span>
      </div>

      <div className="flex gap-1.5 text-xs">
        {ws.status !== 'RUNNING' && (
          <button onClick={async () => { await startWorkspace(ws.id); onChange(); }}
                  className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600">Start</button>
        )}
        {ws.status === 'RUNNING' && (
          <button onClick={async () => { await stopWorkspace(ws.id); onChange(); }}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">Stop</button>
        )}
        <button onClick={async () => {
                  if (confirm(`Delete workspace "${ws.name}"?`)) {
                    await deleteWorkspace(ws.id); onChange();
                  }
                }}
                className="px-2 py-1 rounded bg-rose-900 hover:bg-rose-800 ml-auto">Delete</button>
      </div>
    </div>
  );
}
