'use client';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Brain, Cpu, Eye, Shield, Network, Leaf, Users, Zap,
} from 'lucide-react';

import AuroraBackground   from '../components/ui/AuroraBackground';
import Spotlight          from '../components/ui/Spotlight';
import Sparkles           from '../components/ui/Sparkles';
import ThreeDCard         from '../components/ui/ThreeDCard';
import HoverBorderGradient from '../components/ui/HoverBorderGradient';
import TypewriterEffect   from '../components/ui/TypewriterEffect';
import AnimatedTerminal, { type TerminalLine } from '../components/ui/AnimatedTerminal';
import { BentoGrid, BentoCard } from '../components/ui/BentoGrid';

const DEMO_TERMINAL: TerminalLine[] = [
  { kind: 'comment', text: '# user requests a workspace' },
  { kind: 'cmd', prompt: '$', text: 'POST /api/v1/workspaces  language=bash network=true' },
  { kind: 'out', text: '⮑ risk scorer evaluating…' },
  { kind: 'ok',  text: '✓ language=bash         +0.30' },
  { kind: 'ok',  text: '✓ network_access=true   +0.20' },
  { kind: 'ok',  text: '✓ filesystem_write=true +0.20' },
  { kind: 'warn', text: '! suspicious "subprocess" found in code  +0.10' },
  { kind: 'out', text: '⮑ final risk = 0.80 → sandbox = firecracker' },
  { kind: 'cmd', prompt: '$', text: 'kubectl apply -f workspace.yaml  runtimeClassName=firecracker' },
  { kind: 'ok',  text: '✓ pod ws-7-a2c3 scheduled on node-eu-2 (lowest carbon)' },
  { kind: 'comment', text: '# eBPF telemetry feeds PPO scheduler state in real-time' },
  { kind: 'cmd', prompt: '$', text: 'tetragon trace --pod ws-7-a2c3' },
  { kind: 'out', text: 'sched_switch  cpu=2  run_q=3   net=124KiB/s' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ─────────── HERO ─────────── */}
      <AuroraBackground className="relative min-h-screen overflow-hidden">
        <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(168,85,247,0.7)" />
        <Sparkles density={0.4} color="#a5b4fc" />

        {/* Navbar */}
        <nav className="relative z-20 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="ASTRA-IDE" width={36} height={36} className="rounded" />
            <span className="text-xl font-bold tracking-tight">ASTRA-<span className="text-astra-500">IDE</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login"
                  className="px-3 py-1.5 text-sm rounded hover:bg-slate-800/70 text-slate-200">
              Log in
            </Link>
            <Link href="/register">
              <HoverBorderGradient containerClassName="text-sm">Sign up</HoverBorderGradient>
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          <div className="lg:col-span-3 space-y-7">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-astra-600/20 border border-astra-600/40 text-xs"
            >
              <Zap size={12} className="text-astra-400" />
              <span className="text-astra-300">BTech Final Year Project · 2025–26</span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              The cloud IDE that{' '}
              <span className="bg-gradient-to-r from-astra-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                schedules itself
              </span>.
            </h1>

            <div className="text-xl md:text-2xl text-slate-300 min-h-[3rem]">
              <TypewriterEffect
                text="DRL-PPO. eBPF telemetry. Adaptive sandboxing. LSTM prewarming."
                speed={28}
                className="font-medium"
              />
            </div>

            <p className="text-slate-400 leading-relaxed max-w-2xl">
              ASTRA-IDE combines reinforcement learning, kernel-level observability,
              hardware-isolated sandboxes, predictive cold-start elimination, multi-cluster
              federation, and conflict-free collaboration — all in one open research platform.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/register">
                <HoverBorderGradient containerClassName="text-base">
                  Get started — it's free →
                </HoverBorderGradient>
              </Link>
              <a
                href="https://github.com/PrasannaMishra001/astra-ide"
                className="px-5 py-2.5 rounded-full border border-slate-700 hover:border-slate-500 bg-slate-900/60 text-sm font-medium inline-flex items-center gap-2"
              >
                View on GitHub
              </a>
            </div>

            <div className="pt-6 grid grid-cols-3 gap-6 max-w-xl text-sm">
              <Stat value="< 2s"   label="Cold start (predicted)" />
              <Stat value="78%+"   label="Resource utilization" />
              <Stat value="< 20ms" label="Collab latency" />
            </div>
          </div>

          {/* Logo card */}
          <div className="lg:col-span-2 flex justify-center">
            <ThreeDCard className="w-full max-w-sm">
              <div className="rounded-2xl bg-slate-900/70 backdrop-blur p-8 border border-slate-800 shadow-2xl">
                <div className="relative w-full aspect-square">
                  <Image
                    src="/logo.png"
                    alt="ASTRA-IDE Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="text-center mt-4">
                  <div className="text-xs text-slate-400 font-mono">v0.1 · MIT — Coming soon</div>
                </div>
              </div>
            </ThreeDCard>
          </div>
        </section>
      </AuroraBackground>

      {/* ─────────── DEMO TERMINAL ─────────── */}
      <section className="bg-slate-950 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10 text-center">
            <p className="text-xs uppercase tracking-widest text-astra-400 mb-3">Live demo</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Adaptive sandboxing — in real time
            </h2>
            <p className="text-slate-400 mt-4 max-w-2xl mx-auto">
              When a user submits code, the risk scorer routes it to the right isolation tier:
              <span className="text-emerald-400"> runc </span>(low overhead),
              <span className="text-amber-400"> gVisor </span>(user-space kernel), or
              <span className="text-rose-400"> Firecracker </span>(hardware microVM).
            </p>
          </div>

          <AnimatedTerminal lines={DEMO_TERMINAL} title="astra-ide@scheduler" />
        </div>
      </section>

      {/* ─────────── BENTO GRID ─────────── */}
      <section className="bg-slate-950 py-24 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p className="text-xs uppercase tracking-widest text-astra-400 mb-3">Seven breakthroughs</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Built for research, designed for production
            </h2>
          </div>

          <BentoGrid>
            <BentoCard
              accent="astra"
              span="col-2"
              icon={<Brain size={28} />}
              title="DRL-PPO Scheduler"
              description="40-dim state vector. Multi-discrete action space. State-of-the-art Proximal Policy Optimization replaces Kubernetes' default scheduler — learns optimal pod placement from live telemetry."
            />
            <BentoCard
              accent="cyan"
              icon={<Eye size={28} />}
              title="eBPF Telemetry"
              description="Sub-second kernel-level signals via Tetragon + sched_ext. < 1% overhead."
            />
            <BentoCard
              accent="rose"
              icon={<Shield size={28} />}
              title="Adaptive Sandboxing"
              description="runc → gVisor → Firecracker, auto-selected by real-time risk scoring."
            />
            <BentoCard
              accent="emerald"
              icon={<Cpu size={28} />}
              title="LSTM Prewarming"
              description="Predicts user sessions 15 min ahead. Cold start eliminated for warm-pool hits."
            />
            <BentoCard
              accent="amber"
              icon={<Network size={28} />}
              title="Multi-Cluster"
              description="Karmada federation routes load across regions. PPO sees the global state."
            />
            <BentoCard
              accent="purple"
              icon={<Leaf size={28} />}
              title="Carbon-Aware"
              description="Real-time electricityMaps signal. Batch workloads defer to low-carbon windows."
            />
            <BentoCard
              accent="cyan"
              span="col-2"
              icon={<Users size={28} />}
              title="Yjs CRDT Collaboration"
              description="Real-time conflict-free editing inside Monaco. Awareness shows every cursor. < 20ms sync latency over WebSocket."
            />
          </BentoGrid>
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="bg-slate-950 py-24 border-t border-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to try the future of cloud IDEs?
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Spin up a workspace in seconds. Get a private Monaco editor with collaborative editing,
            real-time risk-tier assignment, and one-click code execution.
          </p>
          <Link href="/register">
            <HoverBorderGradient containerClassName="text-base">
              Create your free account →
            </HoverBorderGradient>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-6 text-xs text-slate-500 text-center">
        ASTRA-IDE — BTech Final Year Project (2025–26) ·{' '}
        <a href="https://github.com/PrasannaMishra001/astra-ide"
           className="text-slate-400 hover:text-slate-200">GitHub</a>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-astra-400">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}
