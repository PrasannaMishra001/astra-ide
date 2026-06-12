'use client';
// Shared application chrome: top navigation, theme toggle, account menu, and a
// consistent page container. Used by every authenticated page so the product
// feels like one app (Codespaces/Replit-style persistent header).

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User } from 'lucide-react';

import { useAuth } from '../lib/auth';
import ThemeToggle from './ThemeToggle';
import { cn } from '../lib/utils';

const NAV = [
  { href: '/dashboard',  label: 'Workspaces' },
  { href: '/clusters',   label: 'Clusters' },
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/platform',   label: 'Platform' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="ambient" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-edge bg-surface/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="" width={28} height={28} priority className="rounded" />
            <span className="text-[15px] font-bold tracking-tight">
              ASTRA<span className="text-astra-600 dark:text-astra-400">-IDE</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 ml-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                    aria-current={pathname?.startsWith(n.href) ? 'page' : undefined}
                    className={pathname?.startsWith(n.href) ? 'nav-pill-active' : 'nav-pill'}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuOpen}
                className="btn-ghost pl-2 pr-1.5"
              >
                <span className="w-6 h-6 rounded-full bg-astra-600 text-white text-[11px] font-semibold
                                 flex items-center justify-center" aria-hidden="true">
                  {(user?.username?.[0] ?? '?').toUpperCase()}
                </span>
                <span className="hidden sm:block max-w-[10rem] truncate">{user?.username}</span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <>
                  <button type="button" aria-label="Close menu" tabIndex={-1}
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={() => setMenuOpen(false)} />
                  <div role="menu"
                       className="absolute right-0 top-full mt-1.5 z-50 w-52 card p-1.5 shadow-pop">
                    <div className="px-2.5 py-2 border-b border-edge mb-1">
                      <div className="text-sm font-medium truncate">{user?.username}</div>
                      <div className="text-xs text-faint truncate">{user?.email}</div>
                    </div>
                    <div className="px-2.5 py-1.5 flex items-center justify-between text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5"><User size={12} /> Trust score</span>
                      <span className="font-mono">{user?.trust_score?.toFixed(2)}</span>
                    </div>
                    <button
                      type="button" role="menuitem"
                      onClick={() => { clearSession(); router.push('/'); }}
                      className="w-full mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm
                                 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <LogOut size={14} /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav aria-label="Primary mobile" className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
                  className={cn('whitespace-nowrap',
                    pathname?.startsWith(n.href) ? 'nav-pill-active' : 'nav-pill')}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
