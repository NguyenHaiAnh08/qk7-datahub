/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./qk7_datahub_login_page.html",
    "./qk7_datahub_admin_dashboard.html",
    "./qk7_datahub_portal.html",
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
          600: '#1e4d3a',
          700: '#143628',
          800: '#0b2017',
          gold: '#d4af37',
          amber: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
