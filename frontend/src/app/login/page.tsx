'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit}
            className="w-full max-w-sm p-8 rounded-lg border border-slate-800 bg-slate-900/50">
        <h1 className="text-2xl font-bold mb-6">Log in to ASTRA-IDE</h1>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-950 text-red-300 text-sm">{error}</div>
        )}

        <label className="block text-sm mb-1 text-slate-400">Username or email</label>
        <input
          type="text" required
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700 focus:border-astra-500 outline-none"
        />

        <label className="block text-sm mb-1 text-slate-400">Password</label>
        <input
          type="password" required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 px-3 py-2 rounded bg-slate-800 border border-slate-700 focus:border-astra-500 outline-none"
        />

        <button type="submit" disabled={loading}
                className="w-full py-2 rounded bg-astra-600 hover:bg-astra-700 disabled:opacity-50 font-medium">
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <p className="mt-6 text-sm text-slate-400 text-center">
          No account?{' '}
          <Link href="/register" className="text-astra-500 hover:underline">Create one</Link>
        </p>
      </form>
    </main>
  );
}
