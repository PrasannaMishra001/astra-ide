'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import Tooltip from './ui/Tooltip';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip content={`Switch to ${next} mode`}>
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} theme`}
        className={`btn-ghost p-2 ${className}`}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </Tooltip>
  );
}
