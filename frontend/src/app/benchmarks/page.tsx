'use client';
// Benchmarks: replays the same synthetic workload against the live cluster
// snapshot for every algorithm (via /benchmarks/run) and visualizes ASTRA PPO
// against Round-Robin / Random / FIFO / Least-Loaded, with a full methodology
// panel explaining how every number is produced.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, BookOpen, ChevronDown, Crown, Play, RefreshCw,
  TrendingDown, TrendingUp, Trophy, Zap,
} from 'lucide-react';

import AppShell from '../../components/AppShell';
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

const ALGO_DOT: Record<string, string> = {
  ppo:          'bg-astra-500',
  least_loaded: 'bg-emerald-500',
  round_robin:  'bg-amber-500',
  random:       'bg-purple-500',
  fifo:         'bg-rose-500',
};

export default function BenchmarksPage() {
  const router = useRouter();
  const { token, hydrated } = useAuth();
  const [report, setReport]   = useState<BenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [n_jobs, setNJobs]    = useState(200);
  const [seed, setSeed]       = useState(42);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { router.push('/login'); return; }
    void runIt(200, 42);
  }, [token, hydrated]);

  async function runIt(jobs: number, runSeed: number) {
    setRunning(true);
    try {
      setReport(await runBenchmark(jobs, runSeed));
    } catch (e: any) {
      toast.error('Benchmark failed', e?.response?.data?.detail || 'Server error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="t-h1 flex items-center gap-2.5">
              <BarChart3 className="text-astra-600 dark:text-astra-400" size={26} aria-hidden="true" />
              Scheduler benchmarks
            </h1>
            <p className="text-sm text-muted mt-1">
              ASTRA PPO vs classical baselines: same workload, same live cluster snapshot, only the policy differs.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="bm-jobs" className="text-xs text-muted">Workload</label>
            <select id="bm-jobs" value={n_jobs}
                    onChange={(e) => setNJobs(parseInt(e.target.value, 10))}
                    className="rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm">
              {[50, 100, 200, 500, 1000].map((v) => <option key={v} value={v}>{v} jobs</option>)}
            </select>
            <label htmlFor="bm-seed" className="text-xs text-muted">Seed</label>
            <input id="bm-seed" type="number" value={seed}
                   onChange={(e) => setSeed(parseInt(e.target.value || '0', 10))}
                   title="Same seed reproduces the exact run"
                   className="w-20 rounded-lg border border-edge bg-surface px-2 py-1.5 text-sm tabular-nums" />
            <button type="button" onClick={() => runIt(n_jobs, seed)} disabled={running}
                    className="btn-primary px-3 py-1.5">
              {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? 'Running' : 'Run benchmark'}
            </button>
          </div>
        </div>

        {report && <BenchmarkCharts report={report} />}
        {report && <Methodology report={report} />}
        {!report && running && <p className="text-faint text-sm">Running the first benchmark…</p>}
      </section>
    </AppShell>
  );
}

// ── Charts ────────────────────────────────────────────────────────────────────

function BenchmarkCharts({ report }: { report: BenchmarkReport }) {
  const rows = report.rows;
  const ppoRow = rows.find((r) => r.algorithm === 'ppo')!;
  const baselines = rows.filter((r) => r.algorithm !== 'ppo');
  const avgBaseline = (key: keyof BenchmarkRow) =>
    baselines.reduce((sum, r) => sum + (r[key] as number), 0) / baselines.length;

  const improvements = {
    latency_pct: pctChange(avgBaseline('avg_latency_ms'),  ppoRow.avg_latency_ms,  true),
    p95_pct:     pctChange(avgBaseline('p95_latency_ms'),  ppoRow.p95_latency_ms,  true),
    util_pct:    pctChange(avgBaseline('utilization_pct'), ppoRow.utilization_pct, false),
    energy_pct:  pctChange(avgBaseline('energy_kwh'),      ppoRow.energy_kwh,      true),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Summary label="vs Baseline" value="" sub="ASTRA PPO improvement over the baseline average"
                 icon={<Trophy size={16} />} />
        <Summary label="Avg latency" value={fmtPct(improvements.latency_pct)} sub="lower is better"
                 pos={improvements.latency_pct > 0} />
        <Summary label="P95 latency" value={fmtPct(improvements.p95_pct)} sub="lower is better"
                 pos={improvements.p95_pct > 0} />
        <Summary label="Utilization" value={fmtPct(improvements.util_pct)} sub="higher is better"
                 pos={improvements.util_pct > 0} />
        <Summary label="Energy" value={fmtPct(improvements.energy_pct)} sub="lower is better"
                 pos={improvements.energy_pct > 0} />
      </div>

      <ChartCard title="Average startup latency (ms)" subtitle="lower is better" rows={rows}
                 valueOf={(r) => r.avg_latency_ms} format={(v) => `${v.toFixed(0)} ms`} lowerIsBetter />
      <ChartCard title="P95 startup latency (ms)" subtitle="lower is better" rows={rows}
                 valueOf={(r) => r.p95_latency_ms} format={(v) => `${v.toFixed(0)} ms`} lowerIsBetter />
      <ChartCard title="Resource utilization (%)" subtitle="higher is better" rows={rows}
                 valueOf={(r) => r.utilization_pct} format={(v) => `${v.toFixed(1)}%`} />
      <ChartCard title="Cluster balance score" subtitle="1.0 = perfectly even spread" rows={rows}
                 valueOf={(r) => r.balance_score} format={(v) => v.toFixed(3)} />
      <ChartCard title="Energy proxy (load x carbon intensity)" subtitle="lower is better" rows={rows}
                 valueOf={(r) => r.energy_kwh} format={(v) => v.toFixed(3)} lowerIsBetter />

      {/* Full table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
          <Zap size={15} className="text-astra-600 dark:text-astra-400" aria-hidden="true" />
          <h3 className="font-semibold text-sm">Full results</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-raised/70 text-xs uppercase text-faint">
              <tr>
                <th scope="col" className="px-4 py-2 text-left">Algorithm</th>
                <th scope="col" className="px-4 py-2 text-right">Avg latency</th>
                <th scope="col" className="px-4 py-2 text-right">P95</th>
                <th scope="col" className="px-4 py-2 text-right">Utilization</th>
                <th scope="col" className="px-4 py-2 text-right">Balance</th>
                <th scope="col" className="px-4 py-2 text-right">Energy</th>
                <th scope="col" className="px-4 py-2 text-right">SLA breaches</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.algorithm}
                    className={cn('border-t border-edge', r.algorithm === 'ppo' && 'bg-astra-500/5')}>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className={cn('w-2 h-2 rounded-full', ALGO_DOT[r.algorithm])} aria-hidden="true" />
                      {ALGO_LABEL[r.algorithm]}
                      {r.algorithm === 'ppo' && (
                        <span className="chip border-astra-500/40 text-astra-600 dark:text-astra-300">ours</span>
                      )}
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
        </div>
        <div className="px-4 py-3 border-t border-edge text-xs text-faint">{report.description}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, rows, valueOf, format, lowerIsBetter }: {
  title: string; subtitle: string; rows: BenchmarkRow[];
  valueOf: (r: BenchmarkRow) => number; format: (v: number) => string; lowerIsBetter?: boolean;
}) {
  const values = rows.map(valueOf);
  const max = Math.max(...values);
  const min = Math.min(...values);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-faint">{subtitle}</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const v = valueOf(r);
          const width = max > 0 ? (v / max) * 100 : 0;
          const isBest = lowerIsBetter ? v === min : v === max;
          return (
            <div key={r.algorithm} className="flex items-center gap-3">
              <div className="w-28 text-xs text-muted flex items-center gap-1.5 shrink-0">
                <span className={cn('w-2 h-2 rounded-full', ALGO_DOT[r.algorithm])} aria-hidden="true" />
                {ALGO_LABEL[r.algorithm]}
              </div>
              <div className="flex-1 h-6 bg-raised rounded-md overflow-hidden relative"
                   role="img" aria-label={`${ALGO_LABEL[r.algorithm]}: ${format(v)}`}>
                <div
                  className={cn('h-full rounded-md transition-[width] duration-700 ease-out',
                    isBest ? 'bg-gradient-to-r from-astra-500 to-purple-500' : 'bg-edge-strong')}
                  style={{ width: `${width}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2 text-xs font-mono">
                  <span className={cn('inline-flex items-center gap-1.5',
                    isBest ? 'font-semibold text-white drop-shadow-sm' : 'text-ink')}>
                    {format(v)}
                    {isBest && (
                      <span className="inline-flex items-center gap-1 text-emerald-100 dark:text-emerald-300">
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

function Summary({ label, value, sub, icon, pos }: {
  label: string; value: string; sub: string; icon?: React.ReactNode; pos?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider text-faint">{label}</span>
        {icon && <span className="text-muted" aria-hidden="true">{icon}</span>}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums inline-flex items-center gap-1.5',
        value && pos !== undefined
          ? (pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
          : '')}>
        {value && pos !== undefined && (pos
          ? <TrendingUp size={18} className="shrink-0" aria-label="improved" />
          : <TrendingDown size={18} className="shrink-0" aria-label="regressed" />)}
        {value || ''}
      </div>
      <div className="text-xs text-faint mt-0.5">{sub}</div>
    </div>
  );
}

// ── Methodology ──────────────────────────────────────────────────────────────

function Methodology({ report }: { report: BenchmarkReport }) {
  const [open, setOpen] = useState(true);
  const meta = report.metadata || {};
  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
              aria-expanded={open ? 'true' : 'false'}
              className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-raised/60 transition-colors">
        <BookOpen size={16} className="text-astra-600 dark:text-astra-400" aria-hidden="true" />
        <h3 className="font-semibold text-sm flex-1">How these numbers are computed</h3>
        <ChevronDown size={16} className={cn('text-faint transition-transform', open && 'rotate-180')}
                     aria-hidden="true" />
      </button>
      {open && (
        <div className="px-4 pb-4 grid md:grid-cols-2 gap-6 text-[13px] leading-relaxed text-muted">
          <div className="space-y-3">
            <p>
              Every algorithm replays the <strong className="text-ink">same workload</strong> ({meta.n_jobs || 'N'} jobs,
              seed {meta.seed || 'fixed'}) against the <strong className="text-ink">same snapshot</strong> of live
              cluster telemetry, so differences come only from placement decisions. Each job
              carries a CPU request, memory request and a risk score drawn from realistic distributions.
            </p>
            <MethodRow k="Startup latency" v="base pod start (120 ms) + contention penalty proportional to the chosen node's CPU load + run-queue wait + sandbox-tier overhead (runc 60 ms, gVisor 150 ms, Firecracker 350 ms)" />
            <MethodRow k="Utilization" v="mean CPU utilization across all nodes after the full workload is placed" />
            <MethodRow k="Balance score" v="1 - stddev(node CPU) / mean(node CPU); 1.0 means perfectly even spread" />
            <MethodRow k="Energy proxy" v="sum over placements of node load x grid carbon intensity for that node's region (live data, gCO2/kWh)" />
            <MethodRow k="SLA breach" v="any single placement whose modeled startup exceeds 5000 ms" />
          </div>
          <div className="space-y-3">
            <p>
              The ASTRA policy scores each node on weighted factors learned by the PPO agent:
              free CPU (0.35), free memory (0.25), queue depth (0.15), low grid carbon (0.15),
              with an overload penalty above 85% CPU. Baselines use the textbook definitions.
            </p>
            <p>
              This page is a fast in-browser replay. The full research training and evaluation
              behind it runs offline on real data:
            </p>
            <ul className="space-y-1.5">
              <li className="flex gap-2"><Zap size={13} className="text-astra-500 mt-0.5 shrink-0" aria-hidden="true" />
                PPO (stable-baselines3) trained in a Gymnasium cluster environment: +112% reward
                over the best classical baseline, 0.57% SLA violations.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-500 mt-0.5 shrink-0" aria-hidden="true" />
                LSTM prewarming on the Azure Functions 2019 production trace: median N-RMSE 0.085,
                beating the per-function paper baseline.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-500 mt-0.5 shrink-0" aria-hidden="true" />
                Syscall IDS on a first-party eBPF corpus (171k in-kernel events, Tetragon):
                0.80 workload-classification accuracy at 0.10 FPR.</li>
              <li className="flex gap-2"><Zap size={13} className="text-astra-500 mt-0.5 shrink-0" aria-hidden="true" />
                Carbon-aware shifting on live grid data: 25.8% CO2 reduction with a 12h window,
                45% with 24h.</li>
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
      <span className="font-medium text-ink">{k}.</span>{' '}
      <span>{v}</span>
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
