'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register as registerApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await registerApi(email, username, password);
      setSession(res.access_token, res.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit}
            className="w-full max-w-sm p-8 rounded-lg border border-slate-800 bg-slate-900/50">
        <h1 className="text-2xl font-bold mb-6">Create your ASTRA-IDE account</h1>

        {error && <div className="mb-4 p-3 rounded bg-red-950 text-red-300 text-sm">{error}</div>}

        <label className="block text-sm mb-1 text-slate-400">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
               className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700 outline-none" />

        <label className="block text-sm mb-1 text-slate-400">Username</label>
        <input type="text" required minLength={3} value={username}
               onChange={(e) => setUsername(e.target.value)}
               className="w-full mb-4 px-3 py-2 rounded bg-slate-800 border border-slate-700 outline-none" />

        <label className="block text-sm mb-1 text-slate-400">Password (min 8)</label>
        <input type="password" required minLength={8} value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full mb-6 px-3 py-2 rounded bg-slate-800 border border-slate-700 outline-none" />

        <button type="submit" disabled={loading}
                className="w-full py-2 rounded bg-astra-600 hover:bg-astra-700 disabled:opacity-50 font-medium">
          {loading ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="mt-6 text-sm text-slate-400 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-astra-500 hover:underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}
