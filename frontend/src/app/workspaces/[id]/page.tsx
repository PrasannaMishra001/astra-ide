'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Box, ChevronDown, FileCode2, FolderTree, Loader2, Play,
  ShieldCheck, Square, TerminalSquare,
} from 'lucide-react';
import {
  getWorkspace, startWorkspace, stopWorkspace, updateWorkspace,
  type Workspace, type SandboxTier,
} from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { toast } from '../../../lib/toast';
import ThemeToggle from '../../../components/ThemeToggle';
import { cn } from '../../../lib/utils';

const CollabEditor = dynamic(() => import('../../../components/CollabEditor'), { ssr: false });
const FileManager  = dynamic(() => import('../../../components/FileManager'),  { ssr: false });
const Terminal     = dynamic(() => import('../../../components/Terminal'),     { ssr: false });

type View = 'files' | 'collab' | 'terminal';
const TABS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'files',    label: 'Files',    icon: <FolderTree size={14} /> },
  { id: 'collab',   label: 'Editor',   icon: <FileCode2 size={14} /> },
  { id: 'terminal', label: 'Terminal', icon: <TerminalSquare size={14} /> },
];

const TIER_BADGE: Record<string, string> = {
  runc:        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  gvisor:      'bg-amber-500/10  text-amber-700  dark:text-amber-300  border-amber-500/30',
  firecracker: 'bg-rose-500/10   text-rose-700   dark:text-rose-300   border-rose-500/30',
};
const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-faint', PREWARMED: 'bg-astra-500', RUNNING: 'bg-emerald-500',
  STOPPED: 'bg-faint', FAILED: 'bg-rose-500', ARCHIVED: 'bg-faint',
};

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, hydrated } = useAuth();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('files');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.push('/login'); return; }
    refresh();
  }, [token, hydrated]);

  async function refresh() {
    try { setWs(await getWorkspace(Number(params.id))); }
    catch (err: any) { setError(err?.response?.data?.detail || 'Failed to load workspace'); }
  }

  async function changeTier(tier: SandboxTier) {
    if (!ws) return;
    setBusy(true);
    try {
      const updated = await updateWorkspace(ws.id, { sandbox_override: tier });
      setWs(updated);
      toast.success('Sandbox tier updated', `Pinned to ${tier}`);
    } catch (e: any) {
      toast.error('Could not update tier', e?.response?.data?.detail || 'Server error');
    } finally { setBusy(false); }
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-8">
        <div className="text-center">
          <p className="text-rose-600 dark:text-rose-400 mb-3">{error}</p>
          <Link href="/dashboard" className="btn-outline"><ArrowLeft size={14} /> Back to dashboard</Link>
        </div>
      </main>
    );
  }
  if (!ws || !user) {
    return <main className="min-h-screen grid place-items-center text-muted">
      <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading workspace</span>
    </main>;
  }

  const isOwner = ws.owner_id === user.id;

  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className="border-b border-edge bg-surface px-3 sm:px-4 h-13 py-2 flex items-center gap-3 flex-wrap">
        <Link href="/dashboard" className="btn-ghost px-2"><ArrowLeft size={15} /></Link>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-semibold truncate max-w-[10rem] sm:max-w-xs">{ws.name}</h1>
          <span className="hidden sm:inline text-xs text-faint font-mono">{ws.language}</span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[ws.status],
                              ws.status === 'RUNNING' && 'animate-pulse')} aria-hidden="true" />
          {ws.status.toLowerCase()}
        </span>

        {/* Sandbox tier control */}
        {isOwner ? (
          <TierMenu tier={ws.sandbox_tier as SandboxTier} risk={ws.risk_score}
                    busy={busy} onChange={changeTier} />
        ) : (
          <span className={cn('text-[11px] px-2 py-1 rounded-md border font-medium', TIER_BADGE[ws.sandbox_tier])}>
            {ws.sandbox_tier}
          </span>
        )}

        {/* Tabs */}
        <div className="ml-1 inline-flex rounded-lg border border-edge bg-raised/60 p-0.5" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={view === t.id ? 'true' : 'false'}
                    onClick={() => setView(t.id)}
                    className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                      view === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
              {t.icon}<span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {ws.status !== 'RUNNING' ? (
            <button type="button" onClick={async () => { await startWorkspace(ws.id); refresh(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
              <Play size={14} /> <span className="hidden sm:inline">Start</span>
            </button>
          ) : (
            <button type="button" onClick={async () => { await stopWorkspace(ws.id); refresh(); }}
                    className="btn-outline px-3 py-1.5 text-sm">
              <Square size={14} /> <span className="hidden sm:inline">Stop</span>
            </button>
          )}
        </div>
      </header>

      <section className="flex-1 min-h-0" role="tabpanel">
        {view === 'files'    && <FileManager workspaceId={ws.id} />}
        {view === 'terminal' && <Terminal workspaceId={ws.id} />}
        {view === 'collab'   && (
          <CollabEditor
            workspaceId={ws.id} room={ws.yjs_room} language={ws.language}
            initialCode={undefined} username={user.username}
            isOwner={isOwner} status={ws.status} sandbox={ws.sandbox_tier}
          />
        )}
      </section>
    </div>
  );
}

function TierMenu({ tier, risk, busy, onChange }: {
  tier: SandboxTier; risk: number; busy: boolean; onChange: (t: SandboxTier) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const OPTS: { id: SandboxTier; label: string; sub: string; icon: React.ReactNode }[] = [
    { id: 'runc',        label: 'runc',        sub: 'fastest, shared kernel',  icon: <Box size={14} /> },
    { id: 'gvisor',      label: 'gVisor',      sub: 'user-space kernel',       icon: <ShieldCheck size={14} /> },
    { id: 'firecracker', label: 'Firecracker', sub: 'dedicated microVM',       icon: <ShieldCheck size={14} /> },
  ];

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={busy}
              aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'}
              title={`Sandbox tier (risk ${risk.toFixed(2)}). Click to re-pin.`}
              className={cn('inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border font-medium',
                            TIER_BADGE[tier])}>
        {busy ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
        {tier}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div role="menu"
             className="absolute left-0 top-full mt-1.5 z-50 w-56 card p-1.5 shadow-pop">
          <div className="px-2.5 py-1.5 text-[11px] text-faint border-b border-edge mb-1">
            Adaptive policy scored risk <span className="font-mono text-ink">{risk.toFixed(2)}</span>.
            Pin a tier to override:
          </div>
          {OPTS.map((o) => (
            <button key={o.id} type="button" role="menuitem"
                    onClick={() => { onChange(o.id); setOpen(false); }}
                    className={cn('w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-raised',
                                  tier === o.id && 'bg-astra-500/10')}>
              <span className="text-muted">{o.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] text-faint">{o.sub}</span>
              </span>
              {tier === o.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-astra-500" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
