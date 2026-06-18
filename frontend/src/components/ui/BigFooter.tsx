'use client';
// Aceternity-style footer: a giant translucent "ASTRA-IDE" wordmark fills the
// background, with the real footer line + links layered in front. Links shift
// color on hover.

import Link from 'next/link';
import { Github } from 'lucide-react';

export default function BigFooter() {
  return (
    <footer className="relative border-t border-edge bg-bg overflow-hidden">
      {/* Giant background wordmark */}
      <div className="select-none pointer-events-none flex justify-center pt-10">
        <span
          className="font-extrabold tracking-tighter leading-none text-transparent
                     bg-clip-text bg-gradient-to-b from-ink/10 to-ink/[0.02]
                     text-[22vw] sm:text-[18vw] lg:text-[15rem]"
        >
          ASTRA-IDE
        </span>
      </div>

      {/* Foreground content overlaps the bottom of the wordmark */}
      <div className="relative z-10 -mt-[8vw] sm:-mt-[6vw] lg:-mt-28 pb-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-4">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="text-muted hover:text-astra-500 transition-colors">Workspaces</Link>
            <Link href="/clusters" className="text-muted hover:text-purple-500 transition-colors">Clusters</Link>
            <Link href="/benchmarks" className="text-muted hover:text-pink-500 transition-colors">Benchmarks</Link>
            <Link href="/platform" className="text-muted hover:text-emerald-500 transition-colors">Platform</Link>
          </nav>
          <div className="text-xs text-faint flex items-center gap-2">
            <span className="hover:text-ink transition-colors">ASTRA-IDE</span>
            <span aria-hidden="true">&middot;</span>
            <span className="hover:text-ink transition-colors">2026</span>
            <span aria-hidden="true">&middot;</span>
            <a href="https://github.com/PrasannaMishra001/astra-ide"
               className="inline-flex items-center gap-1 hover:text-astra-500 transition-colors">
              <Github size={12} /> GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
