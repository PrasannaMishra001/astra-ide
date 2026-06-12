'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

import { login }   from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Surface OAuth round-trip errors (?error=...) handed back by the backend.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (!code) return;
    setError({
      google_not_configured:  'Google sign-in is not configured on this server yet.',
      google_denied:          'Google sign-in was cancelled.',
      google_exchange_failed: 'Could not complete Google sign-in. Please try again.',
      google_no_email:        'Your Google account did not return an email.',
      oauth_failed:           'Sign-in failed. Please try again.',
    }[code] || 'Sign-in failed. Please try again.');
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(usernameOrEmail, password);
      setSession(res.access_token, res.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4">
      <div className="ambient" aria-hidden="true" />

      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm card p-8 shadow-pop"
      >
        <div className="flex flex-col items-center mb-6">
          <Link href="/" className="mb-3">
            <Image src="/logo.png" alt="ASTRA-IDE home" width={56} height={56} className="rounded-xl" priority />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted mt-1">Log in to your ASTRA-IDE account.</p>
        </div>

        {error && (
          <div role="alert"
               className="mb-4 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30
                          text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <label htmlFor="username" className="block text-xs font-medium text-muted mb-1">
          Username or email
        </label>
        <input
          id="username" type="text" required autoFocus autoComplete="username"
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          placeholder="jane.doe"
          className="input-base mb-4"
        />

        <label htmlFor="password" className="block text-xs font-medium text-muted mb-1">Password</label>
        <input
          id="password" type="password" required autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="input-base mb-6"
        />

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Logging in</>
            : <><LogIn size={16} /> Log in</>}
        </button>

        <div className="flex items-center gap-3 my-5" aria-hidden="true">
          <span className="h-px flex-1 bg-edge" />
          <span className="text-[11px] uppercase tracking-wider text-faint">or</span>
          <span className="h-px flex-1 bg-edge" />
        </div>

        {/* Full-page navigation: OAuth requires a top-level redirect to Google. */}
        <a
          href="/api/auth/google/login"
          className="w-full py-2.5 rounded-lg border border-edge-strong bg-surface hover:bg-raised
                     font-medium flex items-center justify-center gap-2 text-sm transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </a>

        <p className="mt-6 text-sm text-muted text-center">
          New here?{' '}
          <Link href="/register" className="text-astra-600 dark:text-astra-400 hover:underline">
            Create an account
          </Link>
        </p>
      </motion.form>
    </main>
  );
}
