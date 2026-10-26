/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          500: '#334e68',
          800: '#102a43',
          900: '#0b1b29',
          950: '#061019'
        },
        military: {
          green: {
            DEFAULT: '#166534',
            light: '#166534',
            hover: '#14532d',
            active: '#15803d',
            dark: '#10b981',
            darkHover: '#059669',
            darkText: '#34d399',
          },
          gold: {
            DEFAULT: '#d97706',
            light: '#b45309',
            badgeBg: '#fef3c7',
            border: 'rgba(245, 158, 11, 0.4)',
            dark: '#fbbf24',
            darkHover: '#f59e0b',
          },
          red: {
            DEFAULT: '#dc2626',
            light: '#b91c1c',
            badgeBg: '#fee2e2',
            dark: '#f87171',
          },
          600: '#1e4d3a',
          700: '#143628',
          800: '#0b2017',
          gold_accent: '#d4af37',
          amber_accent: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.45, 0.64, 1)',
        'smooth': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'tactile': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'spin-slow': 'spin-slow 120s linear infinite',
      },
      keyframes: {
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    }
  },
  plugins: []
}
