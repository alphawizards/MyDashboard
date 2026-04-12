import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Dark mode driven by the `dark` class on <html> (set in layout.tsx).
  darkMode: 'class',
  theme: {
    // Override breakpoints: lg = 1000px per docs/04-css-design-system.md §Responsive.
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1000px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Design token → Tailwind class map. See docs/04-css-design-system.md §Colour Palette.
        dashboard: {
          bg: '#0f172a',       // page background
          surface: '#1e293b',  // card backgrounds, panels
          surface2: '#334155', // input backgrounds, secondary surfaces
          text: '#f1f5f9',     // primary text
          muted: '#94a3b8',    // secondary text, labels
          accent: '#38bdf8',   // primary accent (sky blue)
          green: '#4ade80',    // success, positive values
          red: '#f87171',      // warning, negative values, debt
          orange: '#fb923c',   // caution, alerts
          purple: '#a78bfa',   // tertiary accent, inheritance
          teal: '#2dd4bf',     // secondary accent, savings
          yellow: '#fbbf24',   // quaternary accent
          border: '#475569',   // borders, dividers
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        input: '8px',
      },
      maxWidth: {
        dashboard: '1500px',
      },
    },
  },
  plugins: [],
};

export default config;
