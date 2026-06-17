'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Camera, ChevronDown, Loader2, LogOut, User } from 'lucide-react';

import { useAuth } from '../lib/auth';
import { uploadToImgbb, updateProfile } from '../lib/api';
import { toast } from '../lib/toast';
import ThemeToggle from './ThemeToggle';
import { Avatar } from './AvatarInline';
import Tooltip from './ui/Tooltip';
import { cn } from '../lib/utils';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/clusters',   label: 'Clusters' },
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/platform',   label: 'Platform' },
];

export default function Navbar({ variant = 'default' }: { variant?: 'default' | 'hero' }) {
  const pathname = usePathname();
  const { token, user, hydrated, setUser, clearSession } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loggedIn = hydrated && !!token && !!user;

  const isHero = variant === 'hero';

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large', 'Max 5 MB'); return; }
    setUploading(true);
    try {
      const url = await uploadToImgbb(file);
      const updated = await updateProfile(url);
      setUser(updated);
      toast.success('Profile photo updated');
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Try a different image');
    } finally { setUploading(false); }
  }

  return (
    <nav className={cn(
      'sticky top-0 z-40 w-full',
      isHero ? 'px-4 sm:px-6 py-3' : 'border-b border-edge',
    )}>
      <div className={cn(
        'flex items-center gap-4',
        isHero
          ? 'mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl px-5 py-2.5 shadow-lg'
          : 'mx-auto max-w-6xl px-4 sm:px-6 h-14 bg-surface/80 backdrop-blur',
      )}>
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="ASTRA-IDE" width={28} height={28} priority className="rounded" />
          <span className={cn('text-[15px] font-bold tracking-tight',
            isHero ? 'text-white' : '')}>
            ASTRA-<span className={isHero ? 'text-astra-400' : 'text-astra-600 dark:text-astra-400'}>IDE</span>
          </span>
        </Link>

        {loggedIn && (
          <div className="hidden md:flex items-center gap-1 ml-2" role="navigation" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                    aria-current={pathname?.startsWith(n.href) ? 'page' : undefined}
                    className={cn(
                      isHero
                        ? 'px-3 py-1.5 rounded-lg text-sm transition-colors'
                        : '',
                      isHero
                        ? (pathname?.startsWith(n.href)
                            ? 'text-white bg-white/10 font-medium'
                            : 'text-white/70 hover:text-white hover:bg-white/10')
                        : (pathname?.startsWith(n.href)
                            ? 'nav-pill-active'
                            : 'nav-pill'),
                    )}>
                {n.label}
              </Link>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle className={isHero ? '!text-white/70 hover:!text-white hover:!bg-white/10' : ''} />

          {!loggedIn ? (
            <>
              <Link href="/login"
                    className={cn('px-3 py-1.5 text-sm rounded-lg transition-colors',
                      isHero ? 'text-white/80 hover:text-white hover:bg-white/10' : 'nav-pill')}>
                Log in
              </Link>
              <Link href="/register"
                    className="px-4 py-1.5 text-sm rounded-lg bg-astra-600 text-white font-medium hover:bg-astra-700 transition-colors">
                Sign up
              </Link>
            </>
          ) : (
            <div className="relative">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                     aria-label="Upload profile photo" onChange={onAvatarPick} />
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuOpen}
                className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors',
                  isHero ? 'text-white/80 hover:text-white hover:bg-white/10' : 'btn-ghost pl-2 pr-1.5')}>
                <Avatar user={user} size={24} />
                <span className="hidden sm:inline max-w-[8rem] truncate">{user?.username}</span>
                <ChevronDown size={14} />
              </button>

              {menuOpen && (
                <>
                  <button type="button" tabIndex={-1} aria-label="Close menu"
                          className="fixed inset-0 z-40 cursor-default"
                          onClick={() => setMenuOpen(false)} />
                  <div role="menu"
                       className={cn('absolute right-0 top-full mt-1.5 z-50 w-56 p-1.5 shadow-pop',
                         isHero
                           ? 'rounded-xl border border-white/10 bg-slate-900/90 backdrop-blur-xl text-white'
                           : 'card')}>
                    <div className="px-2.5 py-2 border-b border-edge mb-1 flex items-center gap-2.5">
                      <Avatar user={user} size={36} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{user?.username}</div>
                        <div className="text-xs text-faint truncate">{user?.email}</div>
                      </div>
                    </div>
                    <button type="button" role="menuitem" disabled={uploading}
                            onClick={() => fileRef.current?.click()}
                            className={cn('w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm disabled:opacity-50',
                              isHero ? 'hover:bg-white/10' : 'hover:bg-raised')}>
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      {uploading ? 'Uploading...' : (user?.avatar_url ? 'Change photo' : 'Add profile photo')}
                    </button>
                    <div className={cn('px-2.5 py-1.5 flex items-center justify-between text-xs',
                      isHero ? 'text-slate-400' : 'text-muted')}>
                      <span className="inline-flex items-center gap-1.5"><User size={12} /> Trust score</span>
                      <span className="font-mono">{user?.trust_score?.toFixed(2)}</span>
                    </div>
                    <button
                      type="button" role="menuitem"
                      onClick={() => { clearSession(); window.location.assign('/'); }}
                      className="w-full mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm
                                 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    >
                      <LogOut size={14} /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {loggedIn && (
        <div className={cn('md:hidden flex items-center gap-1 overflow-x-auto',
          isHero ? 'mx-auto max-w-7xl px-5 py-1.5' : 'mx-auto max-w-6xl px-4 pb-2')}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
                  className={cn('whitespace-nowrap text-sm px-3 py-1.5 rounded-lg',
                    isHero
                      ? (pathname?.startsWith(n.href) ? 'text-white bg-white/10 font-medium' : 'text-white/70')
                      : (pathname?.startsWith(n.href) ? 'nav-pill-active' : 'nav-pill'))}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
