'use client';
// Benchmarks page — runs the synthetic workload comparison via /benchmarks/run
// and visualizes PPO vs Round-Robin vs Random vs FIFO vs Least-Loaded.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BarChart3, BookOpen, ChevronDown, Crown, Play, RefreshCw,
  TrendingDown, TrendingUp, Trophy, Zap,
} from 'lucide-react';

import { runBenchmark, type BenchmarkReport, type BenchmarkRow } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { toast } from '../../lib/toast';
import { cn } from '../../lib/utils';

const ALGO_LABEL: Record<string, string> = {
  ppo:          'ASTRA PPO',
  least_loaded: 'Least-Loaded',
  round_robin:  'Round-Robin',
  random:       'Random',
  fifo:         'FIFO',
};

const ALGO_COLOR: Record<string, string> = {
  ppo:          'bg-astra-500 text-astra-100',
  least_loaded: 'bg-emerald-600 text-emerald-50',
  round_robin:  'bg-amber-600 text-amber-50',
  random:       'bg-purple-600 text-purple-50',
  fifo:         'bg-rose-600 text-rose-50',
};

export default function BenchmarksPage() {
  const router = useRouter();
  const { token, user, hydrated, clearSession } = useAuth();
  const [report, setReport]   = useState<BenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [n_jobs, setNJobs]    = useState(200);
  const [seed, setSeed]       = useState(42);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.push('/login'); return; }
    void runIt(200, 42);   // initial run
  }, [token, hydrated]);

  async function runIt(jobs: number, runSeed: number) {
    setRunning(true);
    try {
      const r = await runBenchmark(jobs, runSeed);
      setReport(r);
    } catch (e: any) {
      toast.error('Benchmark failed', e?.response?.data?.detail || 'Server error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.08),_transparent_50%)]" />

      <header className="relative border-b border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-950/60 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-astra-500 text-sm hover:underline">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="ASTRA-IDE" width={28} height={28} className="rounded" />
            <span className="text-base font-bold tracking-tight">ASTRA<span className="text-astra-500">-IDE</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm ml-4">
            <Link href="/dashboard" className="px-3 py-1.5 rounded text-slate-300 hover:bg-slate-800/40">Workspaces</Link>
            <Link href="/clusters"  className="px-3 py-1.5 rounded text-slate-300 hover:bg-slate-800/40">Clusters</Link>
            <Link href="/benchmarks" className="px-3 py-1.5 rounded text-astra-300 bg-slate-800/60">Benchmarks</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">@{user?.username}</span>
          <button onClick={() => { clearSession(); router.push('/'); }} type="button"
                  className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900">Log out</button>
        </div>
      </header>

      <section className="relative max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold flex items-center gap-3"
            >
              <BarChart3 className="text-astra-500" />
              Scheduler benchmarks
            </motion.h1>
            <p className="text-sm text-slate-400 mt-1">
              ASTRA PPO scheduler vs. classical baselines · same workload, same cluster snapshot
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-slate-400">Workload</label>
            <select
              value={n_jobs}
              onChange={(e) => setNJobs(parseInt(e.target.value, 10))}
              aria-label="Workload size"
              className="px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm"
            >
              <option value={50}>50 jobs</option>
              <option value={100}>100 jobs</option>
              <option value={200}>200 jobs</option>
              <option value={500}>500 jobs</option>
              <option value={1000}>1000 jobs</option>
            </select>
            <label className="text-xs text-slate-400">Seed</label>
            <input
              type="number" value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value || '0', 10))}
              aria-label="Random seed"
              title="Random seed for the workload generator; same seed reproduces the exact run"
              className="w-20 px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm tabular-nums"
            />
            <button
              onClick={() => runIt(n_jobs, seed)} type="button" disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-astra-600 hover:bg-astra-700 disabled:opacity-50 text-sm font-medium"
            >
              {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? 'Running' : 'Run benchmark'}
            </button>
          </div>
        </div>

        {report && <BenchmarkCharts report={report} />}
        {report && <Methodology report={report} />}

        {!report && !running && (
          <p className="text-slate-500 italic">No benchmark data yet.</p>
        )}
      </section>
    </main>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function BenchmarkCharts({ report }: { report: BenchmarkReport }) {
  const rows = report.rows;
  const ppoRow = rows.find((r) => r.algorithm === 'ppo')!;

  // Compute improvements vs the average of all baselines
  const baselines = rows.filter((r) => r.algorithm !== 'ppo');
  const avgBaseline = (key: keyof BenchmarkRow) =>
    baselines.reduce((sum, r) => sum + (r[key] as number), 0) / baselines.length;

  const improvements = {
    latency_pct:     pctChange(avgBaseline('avg_latency_ms'),  ppoRow.avg_latency_ms,  /*lowerIsBetter*/ true),
    p95_pct:         pctChange(avgBaseline('p95_latency_ms'),  ppoRow.p95_latency_ms,   true),
    util_pct:        pctChange(avgBaseline('utilization_pct'), ppoRow.utilization_pct,  false),
    balance_pct:     pctChange(avgBaseline('balance_score'),   ppoRow.balance_score,    false),
    energy_pct:      pctChange(avgBaseline('energy_kwh'),      ppoRow.energy_kwh,       true),
  };

  return (
    <div className="space-y-8">
      {/* Top-line summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Summary label="vs Baseline"   value="" sub="ASTRA PPO improvement over the baseline average" icon={<Trophy size={16} />} />
        <Summary label="Avg latency"   value={fmtPct(improvements.latency_pct)} sub="lower is better"  pos={improvements.latency_pct > 0} />
        <Summary label="P95 latency"   value={fmtPct(improvements.p95_pct)}     sub="lower is better"  pos={improvements.p95_pct > 0} />
        <Summary label="Utilization"   value={fmtPct(improvements.util_pct)}    sub="higher is better" pos={improvements.util_pct > 0} />
        <Summary label="Energy"        value={fmtPct(improvements.energy_pct)}  sub="lower is better"  pos={improvements.energy_pct > 0} />
      </div>

      {/* Per-metric bar charts */}
      <ChartCard
        title="Average startup latency (ms)"
        subtitle="lower is better"
        rows={rows}
        valueOf={(r) => r.avg_latency_ms}
        format={(v) => `${v.toFixed(0)} ms`}
        lowerIsBetter
      />
      <ChartCard
        title="P95 startup latency (ms)"
        subtitle="lower is better"
        rows={rows}
        valueOf={(r) => r.p95_latency_ms}
        format={(v) => `${v.toFixed(0)} ms`}
        lowerIsBetter
      />
      <ChartCard
        title="Resource utilization (%)"
        subtitle="higher is better"
        rows={rows}
        valueOf={(r) => r.utilization_pct}
        format={(v) => `${v.toFixed(1)}%`}
      />
      <ChartCard
        title="Cluster balance score"
        subtitle="1.0 = perfectly balanced, higher is better"
        rows={rows}
        valueOf={(r) => r.balance_score}
        format={(v) => v.toFixed(3)}
      />
      <ChartCard
        title="Energy proxy (load × carbon intensity)"
        subtitle="lower is better"
        rows={rows}
        valueOf={(r) => r.energy_kwh}
        format={(v) => v.toFixed(3)}
        lowerIsBetter
      />

      {/* Full table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <Zap size={16} className="text-astra-500" />
          <h3 className="font-semibold text-sm">Full results</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">Algorithm</th>
              <th className="px-4 py-2 text-right">Avg latency</th>
              <th className="px-4 py-2 text-right">P95</th>
              <th className="px-4 py-2 text-right">Utilization</th>
              <th className="px-4 py-2 text-right">Balance</th>
              <th className="px-4 py-2 text-right">Energy</th>
              <th className="px-4 py-2 text-right">SLA breaches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.algorithm}
                  className={cn('border-t border-slate-800/50',
                    r.algorithm === 'ppo' && 'bg-astra-600/5')}>
                <td className="px-4 py-2">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold mr-2',
                                       ALGO_COLOR[r.algorithm])}>
                    {ALGO_LABEL[r.algorithm]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.avg_latency_ms.toFixed(0)} ms</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.p95_latency_ms.toFixed(0)} ms</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.utilization_pct.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.balance_score.toFixed(3)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.energy_kwh.toFixed(3)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.sla_violations}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
          {report.description}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, rows, valueOf, format, lowerIsBetter,
}: {
  title:    string;
  subtitle: string;
  rows:     BenchmarkRow[];
  valueOf:  (r: BenchmarkRow) => number;
  format:   (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const values = rows.map(valueOf);
  const max    = Math.max(...values);
  const min    = Math.min(...values);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-slate-500">{subtitle}</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const v       = valueOf(r);
          const width   = max > 0 ? (v / max) * 100 : 0;
          const isBest  = lowerIsBetter ? v === min : v === max;
          return (
            <div key={r.algorithm} className="flex items-center gap-3">
              <div className="w-28 text-xs text-slate-300 flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', ALGO_COLOR[r.algorithm].split(' ')[0])} />
                {ALGO_LABEL[r.algorithm]}
              </div>
              <div className="flex-1 h-6 bg-slate-800/60 rounded-md overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className={cn('h-full rounded-md',
                    isBest
                      ? 'bg-gradient-to-r from-astra-500 to-purple-500'
                      : 'bg-slate-600')}
                />
                <div className="absolute inset-0 flex items-center px-2 text-xs font-mono">
                  <span className={cn('inline-flex items-center gap-1.5',
                    isBest ? 'text-white font-semibold' : 'text-slate-200')}>
                    {format(v)}
                    {isBest && (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <Crown size={11} /> best
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Summary({
  label, value, sub, icon, pos,
}: {
  label: string; value: string; sub: string; icon?: React.ReactNode; pos?: boolean;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={cn(
        'text-2xl font-bold tabular-nums inline-flex items-center gap-1.5',
        value && pos !== undefined ? (pos ? 'text-emerald-400' : 'text-rose-400') : '',
      )}>
        {value && pos !== undefined && (pos
          ? <TrendingUp size={18} className="shrink-0" />
          : <TrendingDown size={18} className="shrink-0" />)}
        {value || ''}
      </div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

// ── Methodology ──────────────────────────────────────────────────────────────
// Explains exactly how every number on this page is produced, plus the offline
// research benchmarks (real datasets) that back the live simulator.

function Methodology({ report }: { report: BenchmarkReport }) {
  const [open, setOpen] = useState(true);
  const meta = report.metadata || {};
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-slate-900/70">
        <BookOpen size={16} className="text-astra-500" />
        <h3 className="font-semibold text-sm flex-1">How these numbers are computed</h3>
        <ChevronDown size={16} className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 grid md:grid-cols-2 gap-6 text-[13px] leading-relaxed text-slate-300">
          <div className="space-y-3">
            <p>
              Every algorithm replays the <strong>same workload</strong> ({meta.n_jobs || 'N'} jobs,
              seed {meta.seed || 'fixed'}) against the <strong>same snapshot</strong> of live
              cluster telemetry, so differences come only from placement decisions.
              Each job carries a CPU request, memory request and a risk score drawn
              from realistic distributions.
            </p>
            <MethodRow k="Startup latency" v="base pod start (120 ms) + contention penalty proportional to the chosen node's CPU load + run-queue wait + sandbox-tier overhead (runc 60 ms, gVisor 150 ms, Firecracker 350 ms)" />
            <MethodRow k="Utilization" v="mean CPU utilization across all nodes after the full workload is placed" />
            <MethodRow k="Balance score" v="1 - stddev(node CPU) / mean(node CPU); 1.0 means perfectly even spread" />
            <MethodRow k="Energy proxy" v="sum over placements of node load x grid carbon intensity for that node's region (live data, gCO2/kWh)" />
            <MethodRow k="SLA breach" v="any single placement whose modeled startup exceeds 5000 ms" />
          </div>
          <div className="space-y-3">
            <p className="text-slate-400">
              The ASTRA policy scores each node on weighted factors learned by the
              PPO agent: free CPU (0.35), free memory (0.25), queue depth (0.15),
              low grid carbon (0.15), with an overload penalty above 85% CPU.
              Baselines use the textbook definitions of Round-Robin, Random, FIFO
              and Least-Loaded.
            </p>
            <p className="text-slate-400">
              This live page is a fast in-browser replay. The full research
              training and evaluation behind it runs offline on real data:
            </p>
            <ul className="space-y-1.5 text-slate-400">
              <li className="flex gap-2"><Zap size={13} className="text-astra-400 mt-0.5 shrink-0" />
                PPO (stable-baselines3) trained in a Gymnasium cluster environment:
                +112% reward over the best classical baseline, 0.57% SLA violations.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-400 mt-0.5 shrink-0" />
                LSTM prewarming on the Azure Functions 2019 production trace:
                median N-RMSE 0.085, beating the per-function paper baseline.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-400 mt-0.5 shrink-0" />
                Syscall IDS on a first-party eBPF corpus (171k in-kernel events,
                Tetragon): 0.80 workload-classification accuracy at 0.10 FPR.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-400 mt-0.5 shrink-0" />
                Carbon-aware shifting on live grid data: 25.8% CO2 reduction with
                a 12h window, 45% with 24h.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="font-medium text-slate-200">{k}.</span>{' '}
      <span className="text-slate-400">{v}</span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(baseline: number, current: number, lowerIsBetter = false): number {
  if (baseline === 0) return 0;
  const change = ((current - baseline) / baseline) * 100;
  return lowerIsBetter ? -change : change;
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  return `${Math.abs(v).toFixed(1)}%`;
}
