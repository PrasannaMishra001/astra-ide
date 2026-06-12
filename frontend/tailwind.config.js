/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic surfaces driven by CSS variables (globals.css) so the whole
        // app re-themes between light and dark with one class on <html>.
        bg:      'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised:  'rgb(var(--c-raised) / <alpha-value>)',
        edge:    'rgb(var(--c-edge) / <alpha-value>)',
        'edge-strong': 'rgb(var(--c-edge-strong) / <alpha-value>)',
        ink:     'rgb(var(--c-ink) / <alpha-value>)',
        muted:   'rgb(var(--c-muted) / <alpha-value>)',
        faint:   'rgb(var(--c-faint) / <alpha-value>)',
        astra: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)',
        pop:  '0 10px 38px -10px rgb(2 6 23 / 0.35), 0 10px 20px -15px rgb(2 6 23 / 0.2)',
      },
    },
  },
  plugins: [],
};
