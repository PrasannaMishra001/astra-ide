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
        // Primary accent — sage→iron-teal scale derived from the brand palette
        // (b0c4b1 ash sage, 4a5759 iron grey). Replaces the old blue.
        astra: {
          50:  '#eef3f1',
          100: '#dde7e3',
          200: '#c4d3cc',
          300: '#b0c4b1',   // ash sage
          400: '#8ba395',
          500: '#6b8479',
          600: '#4a5759',   // iron grey — primary
          700: '#3d4849',
          800: '#313a3b',
          900: '#252c2d',
        },
        // Secondary accent — cherry-blossom for highlights / decorative gradients.
        blossom: {
          100: '#fbe6ea',
          200: '#f6d2d9',
          300: '#edafb8',   // cherry blossom
          400: '#e08e9b',
          500: '#cf6e7e',
          600: '#b45464',
        },
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Source Serif 4', 'Georgia', 'serif'],
        mono:  ['var(--font-mono)',  'Source Code Pro', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)',
        pop:  '0 10px 38px -10px rgb(2 6 23 / 0.35), 0 10px 20px -15px rgb(2 6 23 / 0.2)',
      },
    },
  },
  plugins: [],
};
