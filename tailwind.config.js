/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FAF8F5',
          100: '#F4F1EA',
          200: '#EAE6DC',
          300: '#E0DACB',
          400: '#D4CCB8',
        },
        vermillion: {
          DEFAULT: '#D94E28',
          hover: '#C4411C',
          light: '#FCEBE6',
        },
        charcoal: {
          DEFAULT: '#1A1917',
          muted: '#4A4843',
          light: '#7A766F',
        },
        editorial: {
          bg: '#F4F1EA',
          sidebar: '#EDE9DF',
          card: '#F8F6F0',
          border: '#DCD6C5',
          darkBorder: '#C8C1AE',
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Courier Prime', 'monospace'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
