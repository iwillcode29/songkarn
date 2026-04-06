/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Kanit', 'sans-serif'],
        body: ['Sarabun', 'sans-serif'],
      },
      colors: {
        gold: {
          50: '#fef9ed',
          100: '#fcefc8',
          200: '#f9dc8c',
          400: '#e8b84a',
          500: '#d4982b',
          600: '#b87a1a',
          700: '#8f5b12',
          900: '#4a2d08',
        },
        twilight: {
          950: '#0c0a1a',
          900: '#13102a',
          800: '#1c1640',
          700: '#2a1f5e',
          600: '#3b2d7a',
        },
        terra: {
          400: '#d97755',
          500: '#c4603d',
          600: '#a34a2a',
        },
        water: {
          300: '#7dd3e8',
          400: '#4ab8d4',
          500: '#2a95b3',
          600: '#1d7490',
        },
        cream: {
          50: '#fdfbf5',
          100: '#f5ede0',
          200: '#e8dbc4',
          400: '#c4a87a',
        },
      },
      animation: {
        'float': 'float-gentle 3s ease-in-out infinite',
        'pulse-fast': 'pulse 0.8s ease-in-out infinite',
        'spin-in': 'spinIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'ripple': 'ripple 2s ease-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'drift': 'drift-down linear infinite',
        'glow': 'glow-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        spinIn: {
          '0%': { transform: 'scale(0) rotate(-180deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
