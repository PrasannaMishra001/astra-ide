'use client';
// Animated theme toggle — sun ↔ moon icon morphs with a smooth rotation, and a
// brief circular colour-spread overlay radiates from the button on click.

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import Tooltip from './ui/Tooltip';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const btnRef = useRef<HTMLButtonElement>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  function toggle() {
    const btn = btnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setRipple({ x: r.left + r.width / 2, y: r.top + r.height / 2, id: Date.now() });
    }
    setTheme(next);
  }

  return (
    <>
      <Tooltip content={`Switch to ${next} mode`}>
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${next} theme`}
          className={`relative btn-ghost p-2 overflow-visible ${className}`}
        >
          <AnimatePresence mode="wait">
            {theme === 'dark' ? (
              <motion.span key="sun"
                initial={{ rotate: -90, scale: 0, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 90, scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}>
                <Sun size={16} />
              </motion.span>
            ) : (
              <motion.span key="moon"
                initial={{ rotate: 90, scale: 0, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: -90, scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}>
                <Moon size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </Tooltip>

      {/* Colour-spread ripple overlay */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.35 }}
            animate={{ scale: 60, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            onAnimationComplete={() => setRipple(null)}
            className="pointer-events-none fixed z-[9999] w-10 h-10 rounded-full"
            style={{
              left: ripple.x - 20, top: ripple.y - 20,
              background: theme === 'dark'
                ? 'radial-gradient(circle, rgba(240,245,238,0.15), transparent 70%)'
                : 'radial-gradient(circle, rgba(33,44,48,0.12), transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
