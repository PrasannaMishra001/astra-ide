'use client';
// Cluster topology: the clusters this deployment schedules over, each with live
// health, region, grid carbon and pod count.
//
// Federation-specific language (a control plane, propagation, member failover)
// is rendered ONLY when the backend reports a real federation controller. With
// none running this is plain multi-cluster placement, and saying otherwise would
// describe behaviour the deployment does not have.

import { motion } from 'framer-motion';
import { Boxes, Leaf, Server, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import type { ClusterMetrics, FederationStatus } from '../lib/api';
import { cn } from '../lib/utils';

function carbonTone(c: number) {
  return c < 150 ? 'text-emerald-600 dark:text-emerald-400'
    : c < 400 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-600 dark:text-rose-400';
}

export default function FederationTopology(
  { clusters, federation }: { clusters: ClusterMetrics[]; federation?: FederationStatus },
) {
  const healthy = clusters.every((c) => c.nodes.some((n) => n.cpu_util < 0.95));
  const totalPods = clusters.reduce((s, c) => s + c.total_pods, 0);
  const federated = !!federation?.enabled;
  const controller = federation?.controller ?? null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <ShieldCheck size={15} className="text-astra-600 dark:text-astra-300" />
          {federated ? 'Federation topology' : 'Cluster topology'}
        </h2>
        <span className={cn('chip py-1', healthy
          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
          : 'border-rose-500/40 text-rose-700 dark:text-rose-300')}>
          {healthy ? <Wifi size={12} /> : <WifiOff size={12} />}
          {federated
            ? (healthy ? 'All members healthy' : `Degraded — ${controller} rerouting`)
            : (healthy ? `${clusters.length} cluster${clusters.length === 1 ? '' : 's'} reachable` : 'Cluster degraded')}
        </span>
      </div>

      {/* Control plane */}
      <div className="flex flex-col items-center">
        <div className="rounded-xl border border-astra-500/40 bg-astra-500/10 px-4 py-2.5 text-center">
          <div className="text-sm font-semibold text-astra-700 dark:text-astra-200">
            {federated ? `${controller} control plane` : 'CP-PPO scheduler'}
          </div>
          <div className="text-[11px] text-faint">
            {federated ? 'federated placement' : 'direct placement'} · {totalPods} pods across {clusters.length} region{clusters.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Connector */}
        <div className="relative w-full h-8" aria-hidden="true">
          <svg viewBox="0 0 800 40" className="w-full h-full" preserveAspectRatio="none">
            {clusters.map((_, i) => {
              const x = 800 * ((i + 0.5) / clusters.length);
              return (
                <line key={i} x1={400} y1={0} x2={x} y2={40}
                      stroke="currentColor" className="text-edge-strong" strokeWidth={1.5}
                      strokeDasharray="4 4">
                  <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.9s" repeatCount="indefinite" />
                </line>
              );
            })}
          </svg>
        </div>

        {/* Member clusters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          {clusters.map((c, i) => {
            const down = !c.nodes.some((n) => n.cpu_util < 0.95);
            return (
              <motion.div key={c.cluster_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn('rounded-xl border p-3 bg-surface/60',
                  down ? 'border-rose-500/40' : 'border-edge')}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('w-2 h-2 rounded-full', down ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500')} />
                  <span className="text-sm font-semibold">{c.cluster_id}</span>
                </div>
                <div className="text-[11px] text-faint mb-2">{c.location}</div>
                <div className="space-y-1 text-[11px]">
                  <Row icon={<Server size={11} />} label="nodes" value={c.nodes.length} />
                  <Row icon={<Boxes size={11} />} label="pods" value={c.total_pods} />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-faint"><Leaf size={11} /> carbon</span>
                    <span className={cn('font-mono', carbonTone(c.carbon_gco2))}>{c.carbon_gco2.toFixed(0)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-faint leading-relaxed mt-4">
        {federated ? (
          <>
            Workspaces are propagated across members by {controller}. If a member goes
            unhealthy its workloads are rescheduled onto the survivors, so the
            scheduler sees the federation as one pool.
          </>
        ) : (
          <>
            The scheduler places each workspace directly on one of these clusters,
            using live node telemetry and grid carbon intensity. No federation
            control plane is running, so workloads are not propagated or failed over
            between clusters automatically.
          </>
        )}
      </p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1 text-faint">{icon} {label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}
