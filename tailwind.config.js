/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          navy:   '#0D1B3D',
          yellow: '#E8D44D',
        },
        warm: {
          50:  '#FFFBF5',
          100: '#FEF3E2',
          500: '#F59E0B',
          600: '#D97706',
        }
      }
    },
  },
  plugins: [],
}
