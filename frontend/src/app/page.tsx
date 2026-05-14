import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-astra-500">ASTRA-IDE</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 ml-2">v0.1</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login"
                className="px-3 py-1.5 text-sm rounded hover:bg-slate-800">Log in</Link>
          <Link href="/register"
                className="px-3 py-1.5 text-sm rounded bg-astra-600 hover:bg-astra-700">Sign up</Link>
        </nav>
      </header>

      <section className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-12 px-8 py-20 max-w-6xl mx-auto">
        <div>
          <h1 className="text-5xl font-extrabold leading-tight">
            Cloud IDE that <span className="text-astra-500">schedules itself</span>.
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            ASTRA-IDE combines DRL-PPO scheduling, eBPF kernel telemetry, adaptive
            sandboxing, LSTM-based predictive prewarming, multi-cluster federation,
            and CRDT collaboration in one open-source platform.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/register"
                  className="px-5 py-3 rounded bg-astra-600 hover:bg-astra-700 font-medium">
              Get started
            </Link>
            <a href="https://github.com/PrasannaMishra001/astra-ide"
               className="px-5 py-3 rounded border border-slate-700 hover:bg-slate-900 font-medium">
              View on GitHub
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Feature title="DRL-PPO scheduler"
                   desc="State-of-the-art reinforcement learning chooses where pods land." />
          <Feature title="eBPF telemetry"
                   desc="Sub-second kernel-level signals feed the scheduler in real time." />
          <Feature title="Adaptive sandboxing"
                   desc="runc → gVisor → Firecracker, chosen by automated risk scoring." />
          <Feature title="LSTM prewarming"
                   desc="Predict the user's next session 15 min ahead; warm pods proactively." />
          <Feature title="Multi-cluster"
                   desc="Karmada federation routes load across data centers." />
          <Feature title="Yjs collaboration"
                   desc="Real-time CRDT editing in Monaco, conflict-free." />
        </div>
      </section>

      <footer className="border-t border-slate-800 px-8 py-4 text-xs text-slate-500">
        ASTRA-IDE — BTech Final Year Project (2025–26)
      </footer>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 rounded-lg border border-slate-800 hover:border-astra-600 transition-colors">
      <h3 className="font-semibold text-astra-500">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{desc}</p>
    </div>
  );
}
