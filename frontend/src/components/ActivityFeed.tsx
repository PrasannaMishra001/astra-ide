'use client';
// Activity feed — synthesizes realistic-looking scheduler events from the
// user's actual workspaces. Once the eBPF telemetry daemon is wired up
// (Phase 3+ of the project plan), this will swap to real events streamed
// over WebSocket.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Brain, Cpu, Network, Leaf, Shield } from 'lucide-react';
import type { Workspace } from '../lib/api';
import { cn } from '../lib/utils';

interface ActivityItem {
  id:       string;
  time:     Date;
  kind:     'scheduler' | 'sandbox' | 'carbon' | 'ebpf' | 'prewarm' | 'collab';
  title:    string;
  detail?:  string;
  cluster?: string;
}

const ICON_FOR: Record<ActivityItem['kind'], React.ReactNode> = {
  scheduler: <Brain    size={14} />,
  sandbox:   <Shield   size={14} />,
  carbon:    <Leaf     size={14} />,
  ebpf:      <Network  size={14} />,
  prewarm:   <Cpu      size={14} />,
  collab:    <Activity size={14} />,
};

const COLOR_FOR: Record<ActivityItem['kind'], string> = {
  scheduler: 'text-astra-400  bg-astra-500/10  border-astra-500/30',
  sandbox:   'text-rose-400   bg-rose-500/10   border-rose-500/30',
  carbon:    'text-lime-400   bg-lime-500/10   border-lime-500/30',
  ebpf:      'text-cyan-400   bg-cyan-500/10   border-cyan-500/30',
  prewarm:   'text-amber-400  bg-amber-500/10  border-amber-500/30',
  collab:    'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

interface Props {
  workspaces: Workspace[];
  className?: string;
}

export default function ActivityFeed({ workspaces, className }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Seed with a few synthetic events
    setItems(seedActivity(workspaces));

    // Push a new synthesized event every 4-7 seconds
    const interval = setInterval(() => {
      const ev = synthesizeEvent(workspaces);
      if (ev) {
        setItems((prev) => [ev, ...prev].slice(0, 30));
      }
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [workspaces]);

  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-astra-500" />
          <h3 className="font-semibold text-sm">Live activity</h3>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            scheduler · sandbox · eBPF · carbon
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>live</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 italic">No events yet — start a workspace.</p>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 px-4 py-2.5"
              >
                <div className={cn(
                  'shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center',
                  COLOR_FOR[it.kind],
                )}>
                  {ICON_FOR[it.kind]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200">{it.title}</div>
                  {it.detail && (
                    <div className="text-xs text-slate-500 mt-0.5 truncate font-mono">
                      {it.detail}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {formatTime(it.time)}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
        Events synthesized from your workspaces. Live eBPF stream arrives in Phase 3.
      </div>
    </div>
  );
}

// ── Synthesis ────────────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString();
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ev-${Date.now()}-${counter}`;
}

function seedActivity(workspaces: Workspace[]): ActivityItem[] {
  const now = Date.now();
  const seeds: ActivityItem[] = [
    {
      id: nextId(), time: new Date(now - 8000), kind: 'scheduler',
      title: 'PPO scheduler online',
      detail: 'policy=astra_ppo_v1 reward_weights=α0.35,β0.25,γ0.15',
    },
    {
      id: nextId(), time: new Date(now - 4000), kind: 'ebpf',
      title: 'Tetragon telemetry connected',
      detail: 'sched_switch, sys_enter_*, mm_page_fault probes loaded',
    },
    {
      id: nextId(), time: new Date(now - 1500), kind: 'carbon',
      title: 'Carbon API live',
      detail: 'electricityMaps · 5min cache · DK-DK1, IN-NO',
    },
  ];
  // One event per existing workspace (sandbox tier assigned)
  for (const w of workspaces.slice(0, 5)) {
    seeds.push({
      id: nextId(),
      time: new Date(now - Math.random() * 30_000),
      kind: 'sandbox',
      title: `Sandbox tier "${w.sandbox_tier}" assigned to ${w.name}`,
      detail: `risk=${w.risk_score.toFixed(2)} · ${w.language} · ${w.cluster_id}`,
      cluster: w.cluster_id,
    });
  }
  return seeds.sort((a, b) => b.time.getTime() - a.time.getTime());
}

function synthesizeEvent(workspaces: Workspace[]): ActivityItem | null {
  const now = new Date();
  const r = Math.random();
  const pickWs = () => workspaces[Math.floor(Math.random() * workspaces.length)];

  if (workspaces.length === 0) {
    // Without user workspaces, only emit system-level events
    if (r < 0.5) {
      return {
        id: nextId(), time: now, kind: 'ebpf',
        title: `eBPF telemetry tick`,
        detail: `cpu_util=${(Math.random() * 80).toFixed(1)}% net=${(Math.random() * 200).toFixed(0)}KiB/s`,
      };
    }
    return {
      id: nextId(), time: now, kind: 'carbon',
      title: `Carbon intensity update`,
      detail: `DK-DK1=${(40 + Math.random() * 80).toFixed(0)} IN-NO=${(300 + Math.random() * 400).toFixed(0)} gCO₂/kWh`,
    };
  }

  if (r < 0.25) {
    const w = pickWs();
    return {
      id: nextId(), time: now, kind: 'scheduler',
      title: `PPO placed ${w.name} on ${w.node_name || 'node-eu-2'}`,
      detail: `cluster=${w.cluster_id} · expected_latency=${(800 + Math.random() * 1500).toFixed(0)}ms`,
      cluster: w.cluster_id,
    };
  }
  if (r < 0.45) {
    const w = pickWs();
    return {
      id: nextId(), time: now, kind: 'ebpf',
      title: `sched_switch trace · pod ${w.pod_name || 'ws-1-abcd'}`,
      detail: `cpu=${Math.floor(Math.random() * 4)} run_q=${Math.floor(Math.random() * 8)} net=${(Math.random() * 500).toFixed(0)}KiB/s`,
      cluster: w.cluster_id,
    };
  }
  if (r < 0.6) {
    return {
      id: nextId(), time: now, kind: 'prewarm',
      title: `LSTM predicted session start`,
      detail: `confidence=${(0.7 + Math.random() * 0.25).toFixed(2)} · warming pool +1`,
    };
  }
  if (r < 0.78) {
    return {
      id: nextId(), time: now, kind: 'carbon',
      title: `Carbon-aware decision`,
      detail: `batch deferred 18min until DK-DK1 dips below 70 gCO₂/kWh`,
    };
  }
  if (r < 0.92) {
    const w = pickWs();
    return {
      id: nextId(), time: now, kind: 'sandbox',
      title: `Pod ${w.pod_name || 'ws-?'} running in ${w.sandbox_tier}`,
      detail: `risk=${w.risk_score.toFixed(2)} · overhead<1%`,
    };
  }
  return {
    id: nextId(), time: now, kind: 'collab',
    title: `Yjs CRDT sync flushed`,
    detail: `rooms=${workspaces.length} clients=${Math.floor(1 + Math.random() * 6)}`,
  };
}
