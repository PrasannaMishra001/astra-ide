// Auth state (Zustand) — stores token + current user in memory and localStorage.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './api';

interface AuthState {
  token: string | null;
  user:  User | null;
  setSession: (token: string, user: User) => void;
  clearSession: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('astra_token', token);
        }
        set({ token, user });
      },
      clearSession: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('astra_token');
        }
        set({ token: null, user: null });
      },
    }),
    { name: 'astra-auth' }
  )
);
