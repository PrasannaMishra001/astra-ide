'use client';
// Scheduler comparison: the selectable placement algorithms and how they compare
// on makespan (benchmarks/b1_scheduler, lower is better). Bars animate in on
// scroll. No external assets.
//
// These are the CORRECTED numbers. The earlier set was produced before two
// defects in the scheduling environment were fixed - one that let a task be
// scheduled repeatedly and leak its resources, and one whose time model made
// makespan nearly independent of placement. Under that broken environment the
// RL policy scored 106.3 against HEFT's 29.7 and the page reported that the
// heuristics led. On the corrected environment CP-PPO leads at 15 tasks.

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

// 15 tasks / 4 VMs, 100 identical DAGs at a fixed seed (mean +/- sd across DAGs).
// Rows marked best-of-32 get the same rollout budget, so the comparison isolates
// the learned prior from the value of search.
const MAKESPAN: { name: string; value: number; kind: 'rl' | 'heuristic' | 'naive' }[] = [
  { name: 'CP-PPO (best-of-32)',  value: 68.5,  kind: 'rl' },
  { name: 'HEFT + best-of-32',    value: 70.2,  kind: 'heuristic' },
  { name: 'CP-PPO (greedy)',      value: 71.3,  kind: 'rl' },
  { name: 'HEFT (upward rank)',   value: 72.7,  kind: 'heuristic' },
  { name: 'Min-Min + best-of-32', value: 76.8,  kind: 'heuristic' },
  { name: 'Max-Min',              value: 86.0,  kind: 'heuristic' },
  { name: 'Min-Min',              value: 88.2,  kind: 'heuristic' },
  { name: 'Random',               value: 131.1, kind: 'naive' },
];
const MAX = 131.1;

const ALGOS = [
  'Multi-objective heuristic', 'CP-PPO (deep RL)', 'HEFT', 'Min-Min',
  'Least loaded', 'Carbon-aware', 'Round robin', 'Random',
];

const BAR = {
  heuristic: 'bg-emerald-500',
  rl:        'bg-indigo-500',
  naive:     'bg-slate-400 dark:bg-slate-600',
} as const;

export default function SchedulerCompare() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true),
      { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid gap-8 lg:grid-cols-2 items-start">
      {/* selectable algorithms */}
      <div>
        <h3 className="text-lg font-semibold text-ink">Pick your scheduler</h3>
        <p className="text-muted text-sm mt-1 mb-4">
          The control plane ships eight placement strategies. Choose per deployment,
          or compare them live on any workload.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALGOS.map((a, i) => (
            <span key={a}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                i === 1
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'border-edge bg-surface text-muted hover:border-emerald-500/40 hover:text-ink')}>
              {a}
            </span>
          ))}
        </div>
        <p className="text-xs text-faint mt-5 leading-relaxed">
          Honest result: at 15 tasks CP-PPO leads both with and without rollout search,
          beating HEFT by 5.8% and by 2.5% when HEFT is given the same search budget. At
          40 tasks that margin disappears and an equal-budget HEFT edges it out
          (169.6 vs 170.5). We report both scales rather than only the flattering one.
        </p>
      </div>

      {/* makespan bars (lower is better) */}
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Makespan by algorithm</h3>
          <span className="text-xs text-faint">lower is better</span>
        </div>
        <div className="space-y-3">
          {MAKESPAN.map((m) => (
            <div key={m.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-ink">{m.name}</span>
                <span className="text-faint tabular-nums">{m.value.toFixed(1)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-raised overflow-hidden">
                <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-out', BAR[m.kind])}
                     style={{ width: shown ? `${(m.value / MAX) * 100}%` : '0%' }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-faint mt-4">
          benchmarks/b1_scheduler - 15 tasks, 4 VMs, 100 identical DAGs at a fixed seed.
          The priority-order Greedy rule (243.2) is omitted from the chart: it serialises
          the DAG onto one VM, which also gives it the lowest energy.
        </p>
      </div>
    </div>
  );
}
